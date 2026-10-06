// Movie / episode playback.
//
// The portal serves plain-HTTP files the HTTPS site can't load directly, and many
// movies are MKV (often with E-AC3 audio) that browsers can't play. So each title is
// probed once and then either:
//   - "direct": browser-friendly MP4/H.264 → proxied as-is with Range support
//     (native seeking, no CPU), or
//   - "remux":  anything else → ffmpeg repackages it to fragmented MP4 on the fly,
//     copying H.264 video and converting audio to AAC. Seeking restarts the
//     stream at ?start=<seconds>.
//
// The provider's file server regularly closes connections mid-file, and its URLs
// expire after ~30-40 s. Every read therefore goes through proxyResilient(), which
// resumes from the exact byte it reached with a freshly resolved URL. ffmpeg reads
// through the same mechanism via a local-only HTTP endpoint, so neither the browser
// nor ffmpeg sees the drops.

const http = require("http");
const crypto = require("crypto");
const { spawn, execFile } = require("child_process");
const portal = require("./portal");
const { FFMPEG, FFPROBE, ffmpegOk, ffprobeOk, MISSING_MESSAGE } = require("./tools");

const MAX_VOD_SESSIONS = Number(process.env.MAX_VOD_SESSIONS) || 10;
// Lower-quality playback re-encodes per viewer (CPU-heavy), so cap how many run at once
const MAX_VOD_TRANSCODES = Number(process.env.MAX_VOD_TRANSCODES) || 3;
// Qualities offered below the original (only those smaller than the source are shown)
const VOD_QUALITIES = [1080, 720, 480, 360];
// A portal link (with its play_token) stays valid for minutes: reuse it briefly
const PORTAL_LINK_TTL_MS = 2 * 60 * 1000;
// The file-server URL it redirects to expires after ~30-40 s: reuse it only briefly,
// which keeps ffmpeg's burst of seeks at start-up fast
const RESOLVED_TTL_MS = 15 * 1000;
// Consecutive failed reconnects before giving up on a read
const MAX_RESUME_FAILURES = 5;
const PROBE_CACHE_MAX = 1000;

let activeSessions = 0;
let activeTranscodes = 0;
const portalLinks = new Map();   // key -> { url, expiresAt }
const resolvedLinks = new Map(); // key -> { url, expiresAt }
const probeCache = new Map();    // key -> { mode, duration, video, audio, videoPlayable }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// LINKS
// ============================================================

async function getPortalLink(key, createLink, fresh) {
  const cached = portalLinks.get(key);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.url;
  const url = await createLink();
  portalLinks.set(key, { url, expiresAt: Date.now() + PORTAL_LINK_TTL_MS });
  return url;
}

/** Follows the portal's redirect; null if the portal rejected the link. */
async function resolveRedirect(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": portal.USER_AGENT, Range: "bytes=0-0" },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    res.body?.cancel();
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) return new URL(location, url).href;
    return res.ok ? url : null;
  } catch {
    return url;
  }
}

/** A file-server URL to read from now. `fresh` forces new links (after a failure). */
async function getLink(key, createLink, { fresh = false } = {}) {
  const cached = resolvedLinks.get(key);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.url;

  let resolved = await resolveRedirect(await getPortalLink(key, createLink, false));
  if (!resolved) {
    // The portal link itself was rejected: make a new one
    resolved = (await resolveRedirect(await getPortalLink(key, createLink, true))) || (await getPortalLink(key, createLink, false));
  }
  resolvedLinks.set(key, { url: resolved, expiresAt: Date.now() + RESOLVED_TTL_MS });
  return resolved;
}

// ============================================================
// RESILIENT READS
// ============================================================

/** Writes a chunk, waiting for the client to drain; false if the client went away. */
function writeChunk(res, chunk) {
  if (res.destroyed) return Promise.resolve(false);
  if (res.write(chunk)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok) => {
      res.off("drain", onDrain);
      res.off("close", onClose);
      resolve(ok);
    };
    const onDrain = () => done(true);
    const onClose = () => done(false);
    res.on("drain", onDrain);
    res.on("close", onClose);
  });
}

/**
 * Serves the file (or the requested byte range) to `res`, transparently resuming
 * from the current byte with a fresh URL whenever the file server cuts the connection.
 */
async function proxyResilient(req, res, key, createLink) {
  const rangeMatch = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
  let pos = rangeMatch ? Number(rangeMatch[1]) : 0;
  const end = rangeMatch && rangeMatch[2] ? Number(rangeMatch[2]) : null;

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let headersSent = false;
  let total = null;
  let failures = 0;

  while (!controller.signal.aborted) {
    let upstream = null;
    try {
      const url = await getLink(key, createLink, { fresh: failures > 0 });
      upstream = await fetch(url, {
        headers: { "User-Agent": portal.USER_AGENT, Range: `bytes=${pos}-${end ?? ""}` },
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
    }

    if (upstream && upstream.status === 206 && upstream.body) {
      if (!headersSent) {
        const contentRange = upstream.headers.get("content-range") || "";
        total = Number(contentRange.split("/")[1]) || null;
        const last = end ?? (total !== null ? total - 1 : null);
        const headers = {
          "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
          "Accept-Ranges": "bytes",
        };
        if (last !== null) headers["Content-Length"] = String(last - pos + 1);
        if (rangeMatch && total !== null) headers["Content-Range"] = `bytes ${pos}-${last}/${total}`;
        res.writeHead(rangeMatch ? 206 : 200, headers);
        headersSent = true;
      }
      try {
        for await (const chunk of upstream.body) {
          if (!(await writeChunk(res, chunk))) return;
          pos += chunk.length;
          failures = 0;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      const finished = end !== null ? pos > end : total !== null && pos >= total;
      if (finished) return res.end();
      console.warn(`↻ ${key}: file server closed the connection at byte ${pos.toLocaleString()}, resuming`);
    } else {
      upstream?.body?.cancel().catch(() => {});
    }

    failures++;
    if (failures > MAX_RESUME_FAILURES) {
      console.error(`❌ ${key}: giving up after ${MAX_RESUME_FAILURES} failed reconnects`);
      if (!headersSent) res.writeHead(502);
      return res.end();
    }
    await sleep(Math.min(1000 * failures, 4000));
  }
}

// ============================================================
// LOCAL SOURCE FOR FFMPEG
// ============================================================
// ffmpeg reads movies from http://127.0.0.1:<port>/<token>, served by
// proxyResilient(), so it survives drops and can still seek within the file.

const sources = new Map(); // token -> { key, createLink }
const sourceServer = http.createServer((req, res) => {
  const source = sources.get(req.url.slice(1));
  if (!source) {
    res.writeHead(404);
    return res.end();
  }
  proxyResilient(req, res, source.key, source.createLink).catch(() => res.end());
});
const sourceServerReady = new Promise((resolve) => sourceServer.listen(0, "127.0.0.1", resolve));

async function localSourceUrl(key, createLink) {
  await sourceServerReady;
  const token = crypto.randomBytes(16).toString("hex");
  sources.set(token, { key, createLink });
  return { url: `http://127.0.0.1:${sourceServer.address().port}/${token}`, release: () => sources.delete(token) };
}

// ============================================================
// PROBING
// ============================================================

function ffprobe(url) {
  return new Promise((resolve, reject) => {
    execFile(
      FFPROBE,
      ["-v", "error", "-user_agent", portal.USER_AGENT, "-print_format", "json", "-show_format", "-show_streams", url],
      { timeout: 30000, maxBuffer: 5 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          // ffprobe's own explanation, not just "Command failed: <command line>"
          const reason = String(stderr || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop()
            || (err.killed ? "timed out" : err.message.split("\n")[0]);
          return reject(new Error(`ffprobe failed: ${reason}`));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("ffprobe returned invalid JSON"));
        }
      }
    );
  });
}

/** How the title will be played, plus its duration. Cached per title. */
async function describe(key, createLink) {
  if (!ffprobeOk || !ffmpegOk) throw Object.assign(new Error(MISSING_MESSAGE), { unavailable: true });
  if (probeCache.has(key)) return probeCache.get(key);

  // Probe through the resilient local source too, so a dropped connection
  // mid-probe is resumed instead of failing playback before it starts
  const source = await localSourceUrl(key, createLink);
  let info;
  try {
    info = await ffprobe(source.url);
  } finally {
    source.release();
  }
  const videoStream = info.streams?.find((s) => s.codec_type === "video");
  const video = videoStream?.codec_name || null;
  const audio = info.streams?.find((s) => s.codec_type === "audio")?.codec_name || null;
  const container = info.format?.format_name || "";
  // Browsers only decode 8-bit 4:2:0 H.264; 10-bit ("High 10") or HEVC must be re-encoded
  const videoPlayable = video === "h264" && /^yuvj?420p$/.test(videoStream?.pix_fmt || "yuv420p");
  const browserFriendly =
    /mp4|mov/.test(container) && videoPlayable && (audio === null || audio === "aac" || audio === "mp3");

  const result = {
    mode: browserFriendly ? "direct" : "remux",
    duration: Number(info.format?.duration) || null,
    video,
    audio,
    videoPlayable,
    height: Number(videoStream?.height) || null,
  };
  if (probeCache.size >= PROBE_CACHE_MAX) probeCache.delete(probeCache.keys().next().value);
  probeCache.set(key, result);
  return result;
}

// ============================================================
// PLAYBACK
// ============================================================

function busy(res) {
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Server busy, try again shortly" }));
}

/** Browser-playable file: proxied as-is with Range support (native seeking). */
async function streamDirect(req, res, key, createLink) {
  activeSessions++;
  res.on("close", () => activeSessions--);
  await proxyResilient(req, res, key, createLink);
}

// Only used for the lower qualities a viewer picks; "Original" is never re-encoded
function videoKbpsFor(height) {
  if (height >= 1080) return 5000;
  if (height >= 720) return 3000;
  if (height >= 480) return 1500;
  return 800;
}

/** "original" plus every standard quality smaller than the source. */
function qualitiesFor(info) {
  const lower = info.height ? VOD_QUALITIES.filter((h) => h < info.height) : [];
  return ["original", ...lower.map(String)];
}

/**
 * Repackages to fragmented MP4 starting at `start` seconds. With `targetHeight`, the
 * video is re-encoded down to that height at a capped bitrate (for slow connections).
 */
async function streamRemux(res, key, createLink, info, start, targetHeight = null) {
  const source = await localSourceUrl(key, createLink);
  let videoArgs;
  if (targetHeight) {
    const kbps = videoKbpsFor(targetHeight);
    videoArgs = ["-vf", `scale=-2:${targetHeight}`, "-c:v", "libx264", "-preset", "veryfast",
      "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.1)}k`, "-bufsize", `${kbps * 2}k`, "-pix_fmt", "yuv420p"];
  } else if (info.videoPlayable) {
    videoArgs = ["-c:v", "copy"];
  } else {
    // HEVC / 10-bit: costly, but plays everywhere
    videoArgs = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"];
  }
  const audioKbps = targetHeight && targetHeight <= 480 ? "96k" : "160k";

  const ffmpeg = spawn(FFMPEG, [
    "-loglevel", "error",
    // Copied video can only start at a keyframe (up to several seconds before `start`).
    // Without this, audio was cut exactly at `start` and played that much ahead of the picture.
    "-noaccurate_seek",
    "-ss", String(start),
    "-i", source.url,
    "-map", "0:v:0", "-map", "0:a:0?",
    ...videoArgs,
    "-c:a", "aac", "-b:a", audioKbps, "-ac", "2",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

  activeSessions++;
  if (targetHeight) activeTranscodes++;
  res.writeHead(200, { "Content-Type": "video/mp4", "Cache-Control": "no-cache" });
  ffmpeg.stdout.pipe(res);
  ffmpeg.stderr.on("data", (d) => console.error(`[vod ${key}] ${d.toString().trim()}`));
  ffmpeg.on("error", (err) => {
    console.error(`❌ VOD ffmpeg: ${err.message}`);
    res.end();
  });
  ffmpeg.on("close", () => {
    source.release();
    res.end();
  });
  res.on("close", () => {
    activeSessions--;
    if (targetHeight) activeTranscodes--;
    ffmpeg.kill("SIGTERM");
  });
}

/**
 * GET …/stream: plays the title in whichever mode describe() picked, or re-encoded to a
 * lower quality when `quality` is a height smaller than the source (e.g. "480").
 */
async function stream(req, res, key, createLink, start = 0, quality = "original") {
  if (activeSessions >= MAX_VOD_SESSIONS) return busy(res);
  const info = await describe(key, createLink);
  const safeStart = Math.max(0, Math.min(Number(start) || 0, info.duration || Infinity));

  const targetHeight = qualitiesFor(info).includes(String(quality)) && quality !== "original" ? Number(quality) : null;
  if (targetHeight) {
    if (activeTranscodes >= MAX_VOD_TRANSCODES) {
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Lower qualities are busy right now. Try Original, or again shortly." }));
    }
    return streamRemux(res, key, createLink, info, safeStart, targetHeight);
  }

  if (info.mode === "direct") return streamDirect(req, res, key, createLink);
  return streamRemux(res, key, createLink, info, safeStart);
}

module.exports = { describe, stream, qualitiesFor };
