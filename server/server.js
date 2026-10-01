
// Always load server/.env, whichever folder the server is started from
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const http = require("http");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const portal = require("./portal");
const { catalogue, start: startCatalogue, status: catalogueStatus } = require("./catalogue");
const vod = require("./vod");
const { buildGames } = require("./games");
const tools = require("./tools");

// Fixtures are derived from channel names; statuses (live/upcoming) depend on the clock
let gamesCache = { data: null, builtAt: 0 };
const GAMES_TTL_MS = 60 * 1000;

const PORT = Number(process.env.PORT) || 3477;
const FFMPEG = tools.FFMPEG;
// Live restream retries: give up after this many failures in a row
const MAX_RESTARTS = 3;
// ...but a stream that ran this long counts as healthy and resets the count
const HEALTHY_RUN_MS = 60 * 1000;

const HLS_DIR = path.join(__dirname, "hls");

// Hard cap on concurrent ffmpeg processes so the box can't be exhausted
const MAX_ACTIVE_STREAMS = Number(process.env.MAX_ACTIVE_STREAMS) || 20;
// Debug endpoints are disabled unless a token is configured and supplied
const DEBUG_TOKEN = process.env.DEBUG_TOKEN || "";
// Radio is transcoded per listener, so cap concurrent listeners too
const MAX_RADIO_PROXIES = Number(process.env.MAX_RADIO_PROXIES) || 50;
let activeRadioProxies = 0;

function parseChannelId(value) {
  return typeof value === "string" && /^\d{1,10}$/.test(value) ? value : null;
}

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

startCatalogue();

// ✅ STREAMING STATE
const streams = {};
const viewers = {};
const stopTimers = {};
const healthChecks = {};
const reencodeAttempts = {};
// Channels seen carrying HEVC video (re-encoded from the start next time)
const hevcChannels = new Set();
// Live video is re-encoded by default: even 4-second segments and clean timestamps across
// the provider's frequent reconnects. LIVE_VIDEO_MODE=copy saves CPU (HEVC is still
// re-encoded) but copy-mode channels start slower and can freeze after reconnects.
const LIVE_COPY = process.env.LIVE_VIDEO_MODE === "copy";
const restartCount = {};

// =============================
// CLEANUP HLS FILES
// =============================
// Files ffmpeg writes per channel: <id>.m3u8 (playlist, or master playlist when there are
// several qualities), <id>_720p.m3u8 (per-quality playlists), <id>_00012.ts / <id>_720p_00012.ts
const HLS_FILE_RE = /^(\d{1,10})(\.m3u8|_\d{3,4}p\.m3u8|_(?:\d{3,4}p_)?\d+\.ts)$/;

function cleanupHLSFiles(channelId) {
  try {
    const files = fs.readdirSync(HLS_DIR).filter((file) => HLS_FILE_RE.exec(file)?.[1] === String(channelId));
    for (const file of files) fs.unlinkSync(path.join(HLS_DIR, file));
    if (files.length) console.log(`🧹 Cleaned up ${files.length} HLS files for ${channelId}`);
  } catch (err) {
    console.error(`❌ Cleanup error for ${channelId}: ${err.message}`);
  }
}

// =============================
// IPTV API
// =============================

function findChannel(channelId) {
  return catalogue.channels.items.find((c) => String(c.id) === String(channelId));
}

async function getStreamLink(channelId) {
  const url = await portal.createLiveLink(channelId, findChannel(channelId)?.cmd);
  return { url };
}

// EPG changes often but is expensive, so cache it briefly
let epgCache = { data: null, fetchedAt: 0 };
const EPG_TTL_MS = 10 * 60 * 1000;

async function fetchEpgData() {
  if (epgCache.data && Date.now() - epgCache.fetchedAt < EPG_TTL_MS) return epgCache.data;
  try {
    console.log("📡 Fetching EPG");
    const parsed = await portal.portalGet({ type: "itv", action: "get_epg_info", period: "5" });
    const channels = parsed?.js?.data || {};
    console.log(`📡 EPG contains data for ${Object.keys(channels).length} channels`);
    epgCache = { data: parsed, fetchedAt: Date.now() };
    return parsed;
  } catch (err) {
    console.error(`❌ EPG fetch failed: ${err.message}`);
    return epgCache.data;
  }
}

// A series' seasons (each with its episode numbers and the cmd used to play them).
// Cached briefly: the detail page and every episode play need them.
const seasonsCache = new Map();
const SEASONS_TTL_MS = 10 * 60 * 1000;

async function getSeasons(seriesId) {
  const cached = seasonsCache.get(seriesId);
  if (cached && cached.expiresAt > Date.now()) return cached.seasons;
  const data = await portal.portalGet({
    type: "series", action: "get_ordered_list", movie_id: seriesId,
    season_id: "0", episode_id: "0", category: "*", sortby: "added", p: "1",
  });
  const seasons = (data?.js?.data || []).map((s) => ({ id: s.id, name: s.name, series: s.series, cmd: s.cmd }));
  if (seasonsCache.size > 500) seasonsCache.clear();
  seasonsCache.set(seriesId, { seasons, expiresAt: Date.now() + SEASONS_TTL_MS });
  return seasons;
}

// =============================
// RESPONSE HELPERS
// =============================

// Only what the channel grid and player show (the raw portal objects are ~10x bigger)
function channelFields(ch) {
  return {
    id: ch.id,
    number: ch.number,
    name: ch.name,
    logo: ch.logo,
    hd: ch.hd,
    genreId: ch.tv_genre_id,
  };
}

// Only what the movie/series grids show; full items come from /api/vod/:id and /api/series/:id
function listFields(item) {
  return {
    id: item.id,
    name: item.name,
    screenshot_uri: item.screenshot_uri,
    rating_kinopoisk: item.rating_kinopoisk,
    genres_str: item.genres_str,
    year: item.year,
    hd: item.hd,
    category_id: item.category_id,
  };
}

// JSON response, gzipped when the client accepts it (the catalogues are large)
function sendJson(req, res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body);
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (json.length > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    zlib.gzip(json, (err, gz) => {
      if (err) {
        res.writeHead(status, headers);
        return res.end(json);
      }
      res.writeHead(status, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
      res.end(gz);
    });
    return;
  }
  res.writeHead(status, headers);
  res.end(json);
}

// =============================
// LIVE QUALITIES
// =============================
// Heights encoded for each live channel (never above the source). Fewer = less CPU.
const LIVE_QUALITIES = (process.env.LIVE_QUALITIES || "1080,720,480,360")
  .split(",").map((h) => Number(h.trim())).filter((h) => h >= 144 && h <= 2160)
  .sort((a, b) => b - a);

function videoKbpsFor(height) {
  if (height >= 1080) return 4500;
  if (height >= 720) return 2500;
  if (height >= 576) return 1600;
  if (height >= 480) return 1200;
  return 700;
}

// Source height per channel, probed once (avoids encoding e.g. a "1080p" that is really 720p)
const sourceHeights = new Map();

function probeSourceHeight(url) {
  return new Promise((resolve) => {
    execFile(
      tools.FFPROBE,
      ["-v", "error", "-user_agent", portal.USER_AGENT, "-analyzeduration", "3000000", "-probesize", "3000000",
        "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", url],
      { timeout: 15000, windowsHide: true },
      (err, stdout) => resolve(err ? null : Number(String(stdout).trim().split(/\s+/)[0]) || null)
    );
  });
}

/** Heights to encode for this channel: the source (capped at the top quality) plus every lower rung. */
async function qualityLadder(channelId) {
  if (!sourceHeights.has(channelId) && tools.ffprobeOk) {
    try {
      const { url } = await getStreamLink(channelId);
      sourceHeights.set(channelId, await probeSourceHeight(url));
    } catch {
      sourceHeights.set(channelId, null);
    }
  }
  const source = sourceHeights.get(channelId) || LIVE_QUALITIES[0];
  const top = Math.min(source, LIVE_QUALITIES[0]);
  return [top, ...LIVE_QUALITIES.filter((h) => h < top)];
}

function getFFmpegArgs(streamUrl, channelId, useReencode = false, ladder = null) {
  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const baseArgs = [
    "-analyzeduration", "5000000",
    "-probesize", "5000000",
    "-fflags", "+genpts+discardcorrupt+igndts",
    "-flags", "low_delay",
    "-max_delay", "1000000",
    // create_link URLs carry their own play_token, so only a player-like UA is needed
    "-user_agent", portal.USER_AGENT,
  ];

  baseArgs.push(
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "2",
    "-reconnect_at_eof", "1",
    "-reconnect_on_network_error", "1",
    "-timeout", "15000000",
    "-rw_timeout", "15000000",
    "-err_detect", "ignore_err",
    "-correct_ts_overflow", "1",
    "-copytb", "0",
    "-multiple_requests", "1",
    "-i", streamUrl,
  );

  // Re-encode mode with several qualities: one master playlist (<id>.m3u8, the same URL
  // players always used) listing a variant per height. Players pick automatically or
  // let the viewer choose.
  if (useReencode && ladder && ladder.length > 1) {
    const split = ladder.map((_, i) => `[s${i}]`).join("");
    const scales = ladder.map((h, i) => `[s${i}]scale=-2:${h}[v${i}]`).join(";");
    baseArgs.push(
      "-filter_complex",
      // Deinterlace only frames flagged interlaced (1080i broadcasts), then one scaled copy per quality
      `[0:v:0]yadif=mode=0:deint=interlaced,split=${ladder.length}${split};${scales}`,
    );
    ladder.forEach((_, i) => baseArgs.push("-map", `[v${i}]`, "-map", "0:a:0?"));
    baseArgs.push(
      ...tools.fpsPassthroughArgs,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-pix_fmt", "yuv420p", // browsers can't decode 10-bit
      "-g", "48",
      "-sc_threshold", "0",
    );
    ladder.forEach((h, i) => {
      const kbps = videoKbpsFor(h);
      baseArgs.push(`-b:v:${i}`, `${kbps}k`, `-maxrate:v:${i}`, `${Math.round(kbps * 1.1)}k`, `-bufsize:v:${i}`, `${kbps * 2}k`);
    });
    // Always AAC: browsers can't play the AC3/E-AC3/MP2 audio many channels carry
    baseArgs.push("-c:a", "aac", "-ac", "2");
    ladder.forEach((h, i) => baseArgs.push(`-b:a:${i}`, i === 0 ? "128k" : h <= 360 ? "64k" : "96k"));
    baseArgs.push(
      "-force_key_frames", "expr:gte(t,n_forced*4)",
      "-f", "hls",
      "-hls_time", "4",
      "-hls_list_size", "15",
      "-hls_flags", "delete_segments+append_list+omit_endlist+independent_segments",
      "-hls_segment_type", "mpegts",
      "-master_pl_name", `${channelId}.m3u8`,
      "-var_stream_map", ladder.map((h, i) => `v:${i},a:${i},name:${h}p`).join(" "),
      "-hls_segment_filename", path.join(HLS_DIR, `${channelId}_%v_%05d.ts`),
      path.join(HLS_DIR, `${channelId}_%v.m3u8`),
    );
    return baseArgs;
  }

  // Single quality (copy mode, or LIVE_QUALITIES set to one height)
  // First video + first audio only (sources can carry DVB subtitles / data streams)
  baseArgs.push("-map", "0:v:0", "-map", "0:a:0?");

  if (useReencode) {
    baseArgs.push(
      // Deinterlace only frames flagged interlaced (1080i broadcasts); progressive passes through
      "-vf", "yadif=mode=0:deint=interlaced",
      ...tools.fpsPassthroughArgs,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-crf", "23",
      "-pix_fmt", "yuv420p", // browsers can't decode 10-bit
      "-g", "48",
      "-sc_threshold", "0",
    );
  } else {
    baseArgs.push("-c:v", "copy");
  }

  // Always AAC: browsers can't play the AC3/E-AC3/MP2 audio many channels carry
  baseArgs.push("-c:a", "aac", "-b:a", "128k", "-ac", "2");

  baseArgs.push(
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "15",
    "-hls_flags", "delete_segments+append_list+omit_endlist",
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename",
    path.join(HLS_DIR, `${channelId}_%05d.ts`),
    "-force_key_frames", "expr:gte(t,n_forced*4)",
    m3u8Path
  );

  return baseArgs;
}

async function startStream(channelId, forceReencode = false) {
  if (!tools.ffmpegOk) return;
  if (streams[channelId]) {
    if (streams[channelId] instanceof Promise) {
      console.log(`⏳ Stream ${channelId} is initializing, waiting...`);
      await streams[channelId];
    }
    return;
  }

  // Channels already known to be HEVC go straight to re-encode (browsers can't play
  // HEVC), instead of opening a copy-mode connection only to throw it away
  if (!LIVE_COPY || hevcChannels.has(channelId)) forceReencode = true;

  if (!forceReencode) {
    reencodeAttempts[channelId] = 0;
  }

  console.log(`🚀 Starting stream ${channelId}${forceReencode ? ' (re-encode mode)' : ' (copy mode)'}`);

  const initPromise = (async () => {
    try {
      // Qualities to encode (probes the channel's resolution the first time)
      const ladder = forceReencode ? await qualityLadder(channelId) : null;
      if (ladder) console.log(`📐 ${channelId}: qualities ${ladder.map((h) => `${h}p`).join(", ")}`);

      const streamInfo = await getStreamLink(channelId);

      if (!streamInfo || !streamInfo.url) {
        console.log(`❌ No stream URL for ${channelId}`);
        delete streams[channelId];
        return;
      }

      console.log(`🔗 Got stream link for ${channelId}`);

      const args = getFFmpegArgs(streamInfo.url, channelId, forceReencode, ladder);
      const ffmpeg = spawn(FFMPEG, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true, // no console window per ffmpeg on Windows
      });

      let lastOutput = Date.now();
      let streamStarted = false;
      let errorCount = 0;
      let hevcDetected = false;

      // Last lines of ffmpeg output, printed if it exits unexpectedly
      const recentOutput = [];

      ffmpeg.stderr.on("data", (d) => {
        const logMessage = d.toString();
        lastOutput = Date.now();
        recentOutput.push(...logMessage.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("frame=")));
        if (recentOutput.length > 8) recentOutput.splice(0, recentOutput.length - 8);
        if (logMessage.includes("ffmpeg version") ||
            logMessage.includes("built with") ||
            logMessage.includes("configuration:") ||
            logMessage.includes("Copyright") ||
            (logMessage.includes("libav") && logMessage.includes("/"))) {
          return;
        }
        if (logMessage.includes("Video: hevc") && !forceReencode && !hevcDetected) {
          hevcDetected = true;
          hevcChannels.add(channelId);
          killAndRestart("HEVC video detected", true);
          return;
        }
        if (logMessage.includes("Opening") || logMessage.includes("Starting") || logMessage.includes("Input #")) {
          streamStarted = true;
        }
        if (logMessage.includes("speed=")) {
          const speedMatch = logMessage.match(/speed=\s*(\d+\.?\d*)x/);
          if (speedMatch) {
            const speed = parseFloat(speedMatch[1]);
            if (speed < 0.5) {
              console.warn(`⚠️ ${channelId} encoding too slow: ${speed}x`);
            }
          }
        }
        if (logMessage.includes("Unrecognized option") ||
            logMessage.includes("Error opening") ||
            logMessage.includes("Error splitting") ||
            logMessage.includes("HTTP error") || 
            logMessage.includes("Connection refused") ||
            logMessage.includes("No route to host") ||
            logMessage.includes("403 Forbidden") ||
            logMessage.includes("404 Not Found") ||
            logMessage.includes("401 Unauthorized") ||
            logMessage.includes("406 Not Acceptable") ||
            logMessage.includes("Invalid data found")) {
          console.error(`❌ ${channelId} stream error: ${logMessage.trim()}`);
          errorCount++;
        }
        if (logMessage.includes("Stream #") || logMessage.includes("Duration:")) {
          console.log(`[ffmpeg ${channelId}] ${logMessage.trim()}`);
        }
      });

      const startedAt = Date.now();
      let exitHandled = false;

      // The single place that decides whether to restart, so one failure is never
      // counted (or restarted) twice, and attempts really stop at MAX_RESTARTS.
      function handleExit(reason, reencode) {
        if (exitHandled) return;
        exitHandled = true;
        clearInterval(healthCheck);
        delete streams[channelId];
        delete healthChecks[channelId];
        if (stopTimers[channelId]) {
          clearTimeout(stopTimers[channelId]);
          delete stopTimers[channelId];
        }
        if (!(viewers[channelId] > 0)) {
          cleanupHLSFiles(channelId);
          return;
        }

        // A stream that played for a while earns a fresh set of attempts
        if (Date.now() - startedAt > HEALTHY_RUN_MS) restartCount[channelId] = 0;
        restartCount[channelId] = (restartCount[channelId] || 0) + 1;
        if (restartCount[channelId] > MAX_RESTARTS) {
          console.log(`🛑 ${channelId} failed ${MAX_RESTARTS} times, giving up`);
          cleanupHLSFiles(channelId);
          delete viewers[channelId];
          delete restartCount[channelId];
          delete reencodeAttempts[channelId];
          return;
        }
        // Same mode: keep the segments so players carry on (ffmpeg's append_list continues
        // the playlist with a discontinuity marker). A mode change starts a fresh playlist.
        if (reencode !== forceReencode) cleanupHLSFiles(channelId);
        console.log(`🔄 ${reason}: restarting ${channelId}${reencode ? " in re-encode mode" : ""} (attempt ${restartCount[channelId]}/${MAX_RESTARTS})`);
        setTimeout(() => startStream(channelId, reencode), 2000);
      }

      function killAndRestart(reason, reencode) {
        handleExit(reason, reencode); // mark handled first so the resulting "close" is ignored
        ffmpeg.kill("SIGTERM");
      }

      const healthCheck = setInterval(() => {
        const timeSinceLastOutput = Date.now() - lastOutput;
        if (!streamStarted && timeSinceLastOutput > 10000) {
          killAndRestart("Stream didn't start", true);
        } else if (timeSinceLastOutput > 15000) {
          const tryReencode = !forceReencode && (reencodeAttempts[channelId] || 0) < 2;
          if (tryReencode) reencodeAttempts[channelId] = (reencodeAttempts[channelId] || 0) + 1;
          killAndRestart(`Stream stalled (${timeSinceLastOutput}ms without output)`, tryReencode || forceReencode);
        } else if (errorCount > 10 && !forceReencode) {
          killAndRestart("Too many stream errors", true);
        }
      }, 5000);

      ffmpeg.on("close", (code) => {
        console.log(`ffmpeg ${channelId} exited (${code})`);
        if (!exitHandled && code !== 0 && recentOutput.length) {
          console.log(`   last ffmpeg output:\n     ${recentOutput.join("\n     ")}`);
        }
        handleExit("ffmpeg exited", forceReencode);
      });

      ffmpeg.on("error", (err) => {
        console.error(`❌ ffmpeg error for ${channelId}: ${err.message}`);
        handleExit("ffmpeg error", true);
      });

      streams[channelId] = ffmpeg;
      healthChecks[channelId] = healthCheck;
      console.log(`▶️ ffmpeg launched for ${channelId} (${forceReencode ? "re-encode" : "copy"} mode)`);
    } catch (err) {
      console.error(`❌ Failed to start stream ${channelId}: ${err.message}`);
      delete streams[channelId];
    }
  })();

  streams[channelId] = initPromise;
  await initPromise;
}

function scheduleStop(channelId) {
  if (stopTimers[channelId]) clearTimeout(stopTimers[channelId]);

  stopTimers[channelId] = setTimeout(() => {
    if ((viewers[channelId] || 0) === 0) {
      console.log(`🛑 Stopping ${channelId}`);
      if (streams[channelId]) {
        if (healthChecks[channelId]) {
          clearInterval(healthChecks[channelId]);
          delete healthChecks[channelId];
        }
        
        if (!(streams[channelId] instanceof Promise)) {
          streams[channelId].kill("SIGTERM");
        }
        delete streams[channelId];
        delete reencodeAttempts[channelId];
        delete restartCount[channelId];
      }
      cleanupHLSFiles(channelId);
    }
  }, 30000);
}

// =============================
// SERVER WITH ALL ENDPOINTS
// =============================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // =============================
  // DEBUG ENDPOINTS (require ?token=DEBUG_TOKEN)
  // =============================

  if (url.pathname.startsWith("/debug/")) {
    if (!DEBUG_TOKEN || url.searchParams.get("token") !== DEBUG_TOKEN) {
      res.writeHead(404);
      return res.end("not found");
    }
  }

  if (url.pathname.startsWith("/debug/restart-stream/")) {
    const id = parseChannelId(url.pathname.split("/")[3]);
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Channel ID required" }));
    }
    
    if (streams[id] && !(streams[id] instanceof Promise)) {
      streams[id].kill("SIGTERM");
    }
    if (healthChecks[id]) {
      clearInterval(healthChecks[id]);
      delete healthChecks[id];
    }
    
    cleanupHLSFiles(id);
    delete streams[id];
    delete reencodeAttempts[id];
    delete restartCount[id];
    
    startStream(id, true);
    
    return res.end(JSON.stringify({ 
      ok: true, 
      message: `Stream ${id} restarted with re-encode mode`,
      viewers: viewers[id] || 0
    }));
  }

  if (url.pathname === "/debug/streams") {
    const streamStatus = {};
    
    Object.keys(streams).forEach(id => {
      const stream = streams[id];
      streamStatus[id] = {
        type: stream instanceof Promise ? "initializing" : "active",
        pid: stream instanceof Promise ? null : stream.pid,
        viewers: viewers[id] || 0,
        reencodeAttempts: reencodeAttempts[id] || 0,
        restartCount: restartCount[id] || 0,
        hasHealthCheck: !!healthChecks[id]
      };
    });
    
    if (fs.existsSync(HLS_DIR)) {
      const files = fs.readdirSync(HLS_DIR);
      const m3u8Files = files.filter(f => f.endsWith('.m3u8'));
      m3u8Files.forEach(f => {
        const id = f.replace('.m3u8', '');
        if (!streamStatus[id]) {
          streamStatus[id] = {
            type: "orphaned_files",
            pid: null,
            viewers: 0,
            reencodeAttempts: 0,
            restartCount: 0,
            hasHealthCheck: false
          };
        }
      });
    }
    
    return res.end(JSON.stringify(streamStatus, null, 2));
  }

  // =============================
  // REGULAR ENDPOINTS
  // =============================

  if (url.pathname === "/health") {
    return sendJson(req, res, 200, {
      status: "ok",
      catalogue: catalogueStatus(),
      activeStreams: Object.keys(streams).filter(id => !(streams[id] instanceof Promise)).length,
      initializingStreams: Object.keys(streams).filter(id => streams[id] instanceof Promise).length,
      totalViewers: Object.values(viewers).reduce((a, b) => a + b, 0),
      uptime: process.uptime(),
    });
  }

  // Small, cheap to poll: counts and load progress for every catalogue
  if (url.pathname === "/api/status") {
    return sendJson(req, res, 200, catalogueStatus());
  }

  if (url.pathname === "/api/channels-all") {
    const { items, categories, ready } = catalogue.channels;
    return sendJson(req, res, 200, {
      channels: items.map(channelFields),
      genres: categories.map((g) => ({ id: g.id, title: g.title })),
      total: items.length,
      ready,
    });
  }

  if (url.pathname === "/api/games") {
    if (!gamesCache.data || Date.now() - gamesCache.builtAt > GAMES_TTL_MS) {
      gamesCache = {
        data: buildGames(catalogue.channels.items, catalogue.channels.categories),
        builtAt: Date.now(),
      };
    }
    return sendJson(req, res, 200, { games: gamesCache.data, ready: catalogue.channels.ready });
  }

  const channelMatch = url.pathname.match(/^\/api\/channel\/(\d{1,10})$/);
  if (channelMatch) {
    const channel = findChannel(channelMatch[1]);
    return channel
      ? sendJson(req, res, 200, { channel: channelFields(channel) })
      : sendJson(req, res, 404, { error: "Channel not found", ready: catalogue.channels.ready });
  }

  if (url.pathname === "/api/radio") {
    const { items, ready } = catalogue.radio;
    return sendJson(req, res, 200, { stations: items.map(channelFields), ready });
  }

  // Radio arrives as MPEG-TS, which browsers can't play in <audio>, so ffmpeg converts it
  // to MP3. Serving it from here also keeps plain-HTTP URLs off the HTTPS site.
  const radioMatch = url.pathname.match(/^\/api\/radio\/(\d{1,10})\/listen$/);
  if (radioMatch) {
    const station = catalogue.radio.items.find((s) => String(s.id) === radioMatch[1]);
    if (!station) return sendJson(req, res, 404, { error: "Station not found" });
    if (!tools.ffmpegOk) return sendJson(req, res, 503, { error: tools.MISSING_MESSAGE });
    if (activeRadioProxies >= MAX_RADIO_PROXIES) return sendJson(req, res, 503, { error: "Server busy, try again shortly" });
    try {
      const upstreamUrl = await portal.createLiveLink(station.id, station.cmd);
      const ffmpeg = spawn(FFMPEG, [
        "-loglevel", "error",
        "-user_agent", portal.USER_AGENT,
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "2",
        "-i", upstreamUrl,
        "-vn", "-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", "pipe:1",
      ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      activeRadioProxies++;
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" });
      ffmpeg.stdout.pipe(res);
      ffmpeg.stderr.on("data", (d) => console.error(`[radio ${station.id}] ${d.toString().trim()}`));
      ffmpeg.on("error", (err) => { console.error(`❌ Radio ffmpeg: ${err.message}`); res.end(); });
      ffmpeg.on("close", () => res.end());
      res.on("close", () => { activeRadioProxies--; ffmpeg.kill("SIGTERM"); });
      return;
    } catch (err) {
      console.error(`❌ Radio ${radioMatch[1]} failed: ${err.message}`);
      return sendJson(req, res, 502, { error: "Station unavailable" });
    }
  }

  if (url.pathname === "/api/vod/all") {
    const { items, categories, ready } = catalogue.vod;
    return sendJson(req, res, 200, { movies: items.map(listFields), categories, total: items.length, ready });
  }

  if (url.pathname === "/api/series/all") {
    const { items, categories, ready } = catalogue.series;
    return sendJson(req, res, 200, { series: items.map(listFields), categories, total: items.length, ready });
  }

  // ---- Movie playback: /api/vod/:id/source (how to play + duration) and /stream ----
  const vodPlayMatch = url.pathname.match(/^\/api\/vod\/(\d{1,12})\/(source|stream)$/);
  if (vodPlayMatch) {
    const [, id, action] = vodPlayMatch;
    const movie = catalogue.vod.items.find((m) => String(m.id) === id);
    if (!movie?.cmd) return sendJson(req, res, 404, { error: "Movie not found" });
    const key = `vod:${id}`;
    const createLink = () => portal.createVodLink(movie.cmd);
    try {
      if (action === "source") {
        const info = await vod.describe(key, createLink);
        return sendJson(req, res, 200, { mode: info.mode, duration: info.duration, height: info.height, qualities: vod.qualitiesFor(info), stream: `/api/vod/${id}/stream` });
      }
      return await vod.stream(req, res, key, createLink, url.searchParams.get("start"), url.searchParams.get("q") || "original");
    } catch (err) {
      if (err.unavailable) return sendJson(req, res, 503, { error: err.message });
      console.error(`❌ Movie ${id} playback failed: ${err.message}`);
      if (!res.headersSent) return sendJson(req, res, 502, { error: "This movie can't be played right now" });
      return res.end();
    }
  }

  // ---- Episode playback: /api/series/:id/(source|stream)?season=<seasonId>&episode=<n> ----
  const episodePlayMatch = url.pathname.match(/^\/api\/series\/([^/]{1,80})\/(source|stream)$/);
  if (episodePlayMatch) {
    let id;
    try { id = decodeURIComponent(episodePlayMatch[1]); } catch { id = ""; }
    const seasonId = url.searchParams.get("season") || "";
    const episode = url.searchParams.get("episode") || "";
    if (!/^[\w:-]{1,40}$/.test(id) || !/^[\w:-]{1,40}$/.test(seasonId) || !/^\d{1,4}$/.test(episode)) {
      return sendJson(req, res, 400, { error: "Invalid episode" });
    }
    try {
      const season = (await getSeasons(id)).find((s) => String(s.id) === seasonId);
      if (!season?.cmd) return sendJson(req, res, 404, { error: "Episode not found" });
      const key = `ep:${seasonId}:${episode}`;
      const createLink = () => portal.createVodLink(season.cmd, episode);
      if (episodePlayMatch[2] === "source") {
        const info = await vod.describe(key, createLink);
        const qs = new URLSearchParams({ season: seasonId, episode });
        return sendJson(req, res, 200, {
          mode: info.mode,
          height: info.height,
          qualities: vod.qualitiesFor(info),
          duration: info.duration,
          stream: `/api/series/${encodeURIComponent(id)}/stream?${qs}`,
        });
      }
      return await vod.stream(req, res, key, createLink, url.searchParams.get("start"), url.searchParams.get("q") || "original");
    } catch (err) {
      if (err.unavailable) return sendJson(req, res, 503, { error: err.message });
      console.error(`❌ Episode ${id} ${seasonId}/${episode} playback failed: ${err.message}`);
      if (!res.headersSent) return sendJson(req, res, 502, { error: "This episode can't be played right now" });
      return res.end();
    }
  }

  const vodMatch = url.pathname.match(/^\/api\/vod\/(\d{1,12})$/);
  if (vodMatch) {
    const movie = catalogue.vod.items.find((m) => String(m.id) === vodMatch[1]);
    return movie
      ? sendJson(req, res, 200, { movie })
      : sendJson(req, res, 404, { error: "Movie not found", ready: catalogue.vod.ready });
  }

  // Series ids look like "47441:47441" and arrive URL-encoded ("47441%3A47441")
  const seriesMatch = url.pathname.match(/^\/api\/series\/([^/]{1,80})(\/episodes)?$/);
  if (seriesMatch && seriesMatch[1] !== "all") {
    let id;
    try { id = decodeURIComponent(seriesMatch[1]); } catch { id = ""; }
    if (!/^[\w:-]{1,40}$/.test(id)) return sendJson(req, res, 400, { error: "Invalid series ID" });
    if (!seriesMatch[2]) {
      const series = catalogue.series.items.find((s) => String(s.id) === id);
      return series
        ? sendJson(req, res, 200, { series })
        : sendJson(req, res, 404, { error: "Series not found", ready: catalogue.series.ready });
    }
    try {
      const seasons = await getSeasons(id);
      // Season cmds are only needed server-side for playback
      return sendJson(req, res, 200, { episodes: seasons.map(({ cmd: _cmd, ...season }) => season) });
    } catch (err) {
      console.error(`❌ Episodes for ${id} failed: ${err.message}`);
      return sendJson(req, res, 502, { error: "Failed to load episodes" });
    }
  }

  if (url.pathname === "/api/epg") {
    const epgData = await fetchEpgData();
    return epgData
      ? sendJson(req, res, 200, epgData)
      : sendJson(req, res, 502, { error: "Failed to fetch EPG" });
  }

  if (url.pathname.startsWith("/api/stream-status/")) {
    const id = parseChannelId(url.pathname.split("/")[3]);
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Invalid channel ID" }));
    }
    const stream = streams[id];
    return res.end(JSON.stringify({
      channelId: id,
      active: !!stream && !(stream instanceof Promise),
      initializing: stream instanceof Promise,
      viewers: viewers[id] || 0,
      reencodeAttempts: reencodeAttempts[id] || 0,
      restartCount: restartCount[id] || 0
    }));
  }

  if (url.pathname.startsWith("/watch/")) {
    const id = parseChannelId(url.pathname.split("/")[2]);
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Invalid channel ID" }));
    }

    if (!tools.ffmpegOk) return sendJson(req, res, 503, { error: tools.MISSING_MESSAGE });

    if (!streams[id] && Object.keys(streams).length >= MAX_ACTIVE_STREAMS) {
      res.writeHead(503);
      return res.end(JSON.stringify({ error: "Server busy, try again shortly" }));
    }

    viewers[id] = (viewers[id] || 0) + 1;
    console.log(`👁️ ${id}: ${viewers[id]} viewer(s)`);
    
    startStream(id).catch(err => {
      console.error(`Failed to start stream for viewer: ${err.message}`);
    });
    
    return res.end(JSON.stringify({ ok: true, viewers: viewers[id] }));
  }

  if (url.pathname.startsWith("/leave/")) {
    const id = parseChannelId(url.pathname.split("/")[2]);
    if (!id) {
      res.writeHead(400);
      return res.end("Invalid channel ID");
    }
    
    if (!viewers[id]) {
      // Already nobody watching (e.g. the stream never started): nothing to do
      return res.end(JSON.stringify({ ok: true, viewers: 0 }));
    }
    viewers[id] -= 1;
    console.log(`👁️ ${id}: ${viewers[id]} viewer(s)`);

    scheduleStop(id);
    return res.end(JSON.stringify({ ok: true, viewers: viewers[id] }));
  }

  if (url.pathname.startsWith("/hls/")) {
    const file = url.pathname.slice("/hls/".length);
    // Only serve playlists and segments this server writes (see HLS_FILE_RE)
    if (!HLS_FILE_RE.test(file)) {
      res.writeHead(404);
      return res.end("not found");
    }
    const filePath = path.join(HLS_DIR, file);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end("not found");
    }

    const ext = path.extname(file);
    const type = ext === ".m3u8" 
      ? "application/vnd.apple.mpegurl" 
      : "video/mp2t";

    res.writeHead(200, { 
      "Content-Type": type,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*"
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});

// ✅ Cleanup on server shutdown
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  Object.keys(stopTimers).forEach(id => {
    clearTimeout(stopTimers[id]);
    delete stopTimers[id];
  });
  
  Object.keys(healthChecks).forEach(id => {
    clearInterval(healthChecks[id]);
    delete healthChecks[id];
  });
  
  Object.keys(streams).forEach(channelId => {
    const stream = streams[channelId];
    if (stream && !(stream instanceof Promise)) {
      console.log(`🛑 Killing stream ${channelId}`);
      stream.kill("SIGTERM");
      cleanupHLSFiles(channelId);
    }
    delete streams[channelId];
  });
  
  Object.keys(viewers).forEach(id => delete viewers[id]);
  Object.keys(restartCount).forEach(id => delete restartCount[id]);
  Object.keys(reencodeAttempts).forEach(id => delete reencodeAttempts[id]);
  
  server.close(() => {
    console.log("👋 Server closed");
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});