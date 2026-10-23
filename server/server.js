
// Always load server/.env, whichever folder the server is started from
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const portal = require("./portal");
const { catalogue, start: startCatalogue, status: catalogueStatus } = require("./catalogue");
const vod = require("./vod");
// Raw live relay for the Android app (the website uses the HLS streams below)
const appRelay = require("./relay");
const { buildGames } = require("./games");
const { relatedChannels } = require("./related");
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
// A running stream with no new frames for this long is reconnected
const NO_FRAMES_TIMEOUT_MS = 20 * 1000;

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
// Channels whose copied video a viewer's player couldn't play (re-encoded from then on)
const copyFailedChannels = new Set();
// Live video is passed through untouched by default (the provider's original picture).
// HEVC channels are still re-encoded, since browsers can't play HEVC. LIVE_VIDEO_MODE=reencode
// re-encodes every channel: even segments and clean timestamps across the provider's
// reconnects, at the cost of CPU and some picture quality.
const LIVE_COPY = process.env.LIVE_VIDEO_MODE !== "reencode";
const restartCount = {};

// =============================
// CLEANUP HLS FILES
// =============================
// Files ffmpeg writes per channel: <id>.m3u8 (playlist) and <id>_00012.ts (segments).
// Also matches <id>_720p.m3u8 / <id>_720p_00012.ts left over from the old multi-quality encoding.
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

// Per-channel programme guide. This portal answers get_epg_info (the all-channels EPG)
// with an empty list, but get_short_epg works for most regular channels. It starts
// hours in the past, so only programmes that haven't ended yet are kept.
const channelEpgCache = new Map(); // channel id -> { programmes, expiresAt }
const CHANNEL_EPG_TTL_MS = 5 * 60 * 1000;

async function getChannelEpg(channelId) {
  const cached = channelEpgCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return cached.programmes;
  const data = await portal.portalGet({ type: "itv", action: "get_short_epg", ch_id: channelId, size: "10" });
  const programmes = (Array.isArray(data?.js) ? data.js : [])
    .map((p) => ({
      title: String(p.name || "").trim(),
      description: String(p.descr || "").trim(),
      start: Number(p.start_timestamp) * 1000,
      stop: Number(p.stop_timestamp) * 1000,
    }))
    .filter((p) => p.title && p.stop > p.start)
    .sort((a, b) => a.start - b.start);
  if (channelEpgCache.size > 2000) channelEpgCache.clear();
  channelEpgCache.set(channelId, { programmes, expiresAt: Date.now() + CHANNEL_EPG_TTL_MS });
  return programmes;
}

// Movies from the Xtream list come without description, cast etc.: fetched once, when a
// movie's page is opened, and kept on the item (a failed fetch is tried again next time)
async function withVodDetails(movie) {
  if (movie.description !== undefined) return movie;
  try {
    const info = (await portal.xtreamGet("get_vod_info", { vod_id: movie.id }))?.info || {};
    Object.assign(movie, {
      description: info.plot || info.description || "",
      director: info.director || "",
      actors: info.cast || info.actors || "",
      genres_str: info.genre || "",
      age: info.age || info.mpaa_rating || "",
      country: info.country || "",
      year: info.releasedate || movie.year,
      rating_imdb: info.rating || movie.rating_imdb,
      screenshot_uri: info.cover_big || info.movie_image || movie.screenshot_uri,
    });
  } catch (err) {
    console.warn(`⚠️ Details for movie ${movie.id} failed: ${err.message}`);
  }
  return movie;
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
// CHANNEL LOGOS
// =============================
// Almost all portal logos are plain-HTTP links, which browsers block on the HTTPS site.
// /api/logo/<channel id> fetches the logo once, keeps it in server/cache/logos/, and
// serves it over HTTPS. Only logos of known channels/stations are fetched (no open proxy).
const LOGO_DIR = path.join(__dirname, "cache", "logos");
const LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_FAILURE_TTL_MS = 60 * 60 * 1000;
const logoFailures = new Map(); // source url -> time it failed (don't retry broken logos constantly)
const logoFetches = new Map();  // source url -> in-flight fetch, shared by concurrent requests
// A logo host that doesn't answer at all (some provider logo servers are down) is skipped for a
// while, so its other logos fail instantly instead of each waiting for the timeout
const LOGO_HOST_DOWN_MS = 10 * 60 * 1000;
const logoHostsDown = new Map(); // host -> time it timed out

function logoUrlFor(item) {
  return item?.logo ? `/api/logo/${item.id}` : "";
}

function imageType(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (/^\s*</.test(buf.subarray(0, 64).toString("utf8"))) return "image/svg+xml";
  return null;
}

async function fetchLogo(src) {
  const res = await fetch(src, { headers: { "User-Agent": portal.USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`logo host returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > LOGO_MAX_BYTES || !imageType(buf)) throw new Error("not an image");
  return buf;
}

async function serveLogo(req, res, id) {
  const item = findChannel(id) || catalogue.radio.items.find((s) => String(s.id) === String(id));
  const src = String(item?.logo || "").trim();
  if (!/^https?:\/\//.test(src)) {
    res.writeHead(404);
    return res.end();
  }

  const file = path.join(LOGO_DIR, crypto.createHash("sha1").update(src).digest("hex"));
  let buf = await fs.promises.readFile(file).catch(() => null);

  if (!buf) {
    const failedAt = logoFailures.get(src);
    const host = new URL(src).host;
    const hostDownAt = logoHostsDown.get(host);
    if ((failedAt && Date.now() - failedAt < LOGO_FAILURE_TTL_MS) || (hostDownAt && Date.now() - hostDownAt < LOGO_HOST_DOWN_MS)) {
      res.writeHead(404);
      return res.end();
    }
    if (!logoFetches.has(src)) {
      logoFetches.set(src, fetchLogo(src).finally(() => logoFetches.delete(src)));
    }
    try {
      buf = await logoFetches.get(src);
      await fs.promises.mkdir(LOGO_DIR, { recursive: true });
      await fs.promises.writeFile(file, buf).catch(() => {});
    } catch (err) {
      logoFailures.set(src, Date.now());
      // Timeouts / unreachable host (not a plain 404): mark the whole host as down for a while
      if (err.name === "TimeoutError" || err instanceof TypeError) logoHostsDown.set(host, Date.now());
      res.writeHead(404);
      return res.end();
    }
  }

  res.writeHead(200, {
    "Content-Type": imageType(buf),
    "Content-Length": buf.length,
    // Logos rarely change; let browsers keep them for a week
    "Cache-Control": "public, max-age=604800",
  });
  res.end(buf);
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
    logo: logoUrlFor(ch), // proxied over HTTPS (see serveLogo)
    hd: ch.hd,
    genreId: ch.tv_genre_id,
  };
}

// =============================
// LEAGUE CHANNELS
// =============================
// The provider keeps a channel group per big football competition ("VIP | PREMIER LEAGUE"...).
// In each, divider rows ("##### FRENCH #####") start a language, and "NO MATCH" rows are
// placeholders on days without a game.
const LEAGUES = [
  { key: "ucl", name: "Champions League", match: /CHAMPIONS LEAGUE/i },
  { key: "uel", name: "Europa League", match: /EUROPA LEAGUE/i },
  { key: "ligue1", name: "Ligue 1", match: /LIGUE 1\b/i },
  { key: "epl", name: "Premier League", match: /PREMIER LEAGUE/i },
  { key: "laliga", name: "LaLiga", match: /LA ?LIGA/i },
  { key: "seriea", name: "Serie A", match: /SERIE A\b/i },
  { key: "bundesliga", name: "Bundesliga", match: /BUNDESLIGA/i },
];

const LANGUAGES = {
  FRENCH: "French", FR: "French",
  ENGLISH: "English", EN: "English", UK: "English",
  ARABIC: "Arabic", AR: "Arabic",
  SPANISH: "Spanish", SPAIN: "Spanish", ES: "Spanish", SP: "Spanish",
  DEUTSCH: "German", GERMAN: "German", DE: "German",
  ITALY: "Italian", ITALIAN: "Italian", IT: "Italian",
  ALBANIAN: "Albanian", ALBANIA: "Albanian", ALB: "Albanian",
  PORTUGAL: "Portuguese", PORTUGUESE: "Portuguese", PT: "Portuguese",
};
const DIVIDER_RE = /^#{3,}\s*(.*?)\s*#{3,}$/;
const PLACEHOLDER_RE = /\bNO (?:MATCH|EVENT)\b/i;

function buildLeagues() {
  const { items, categories } = catalogue.channels;
  return LEAGUES.map(({ key, name, match }) => {
    const genre = categories.find((g) => /^VIP\s*\|/i.test(g.title || "") && match.test(g.title));
    const rows = genre
      ? items.filter((ch) => String(ch.tv_genre_id) === String(genre.id)).sort((a, b) => Number(a.number) - Number(b.number))
      : [];

    // The league's logo is the one most of its channels use
    const logoCounts = new Map();
    for (const ch of rows) if (ch.logo) logoCounts.set(ch.logo, (logoCounts.get(ch.logo) || 0) + 1);
    const topLogo = [...logoCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
    const logoChannel = rows.find((ch) => ch.logo === topLogo);

    const channels = [];
    let language = null;
    for (const ch of rows) {
      const divider = DIVIDER_RE.exec(ch.name);
      if (divider) {
        language = LANGUAGES[divider[1].toUpperCase()] || divider[1];
        continue;
      }
      if (PLACEHOLDER_RE.test(ch.name)) continue;
      const tag = (ch.name.match(/^([A-Z]{2,4})\s*[-|:]/) || [])[1];
      channels.push({ ...channelFields(ch), language: LANGUAGES[tag] || language || "Other" });
    }
    return { key, name, logo: logoChannel ? logoUrlFor(logoChannel) : "", channels };
  });
}

// Categories that actually have items, with counts, for the app's filters (cached per list)
const appCategoryCache = new Map(); // kind -> { items, list }
function appCategories(kind, items, categories) {
  const cached = appCategoryCache.get(kind);
  if (cached && cached.items === items) return cached.list;
  const counts = new Map();
  for (const item of items) counts.set(String(item.category_id), (counts.get(String(item.category_id)) || 0) + 1);
  const list = categories
    .filter((c) => c.id !== "*" && counts.has(String(c.id)))
    .map((c) => ({ id: String(c.id), title: c.title, count: counts.get(String(c.id)) }));
  appCategoryCache.set(kind, { items, list });
  return list;
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

// Segments are cut every 4 s; one much longer means the source timestamps jumped
const MAX_COPY_SEGMENT_SECONDS = 15;
// No new segment for this long, while frames keep arriving, means the segmenter is stuck
const MAX_PLAYLIST_IDLE_MS = 25000;

/** Why a copy-mode channel's playlist is broken (see the health check), or null if it's fine. */
function copyPlaylistProblem(channelId, framesArriving) {
  const file = path.join(HLS_DIR, `${channelId}.m3u8`);
  let text, modifiedAt;
  try {
    text = fs.readFileSync(file, "utf8");
    modifiedAt = fs.statSync(file).mtimeMs;
  } catch {
    return null; // no playlist yet
  }
  const longest = Math.max(0, ...[...text.matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1])));
  if (longest > MAX_COPY_SEGMENT_SECONDS) return `a ${Math.round(longest)} s segment`;
  const idle = Date.now() - modifiedAt;
  if (framesArriving && idle > MAX_PLAYLIST_IDLE_MS) return `no new segment for ${Math.round(idle / 1000)} s`;
  return null;
}

function getFFmpegArgs(streamUrl, channelId, useReencode = false) {
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
    // Real-time input speed: some channels arrive faster than real time, which made the
    // stream run ahead of viewers and players skip forward (see tools.liveReadRateArgs)
    ...tools.liveReadRateArgs,
    "-i", streamUrl,
  );

  // First video + first audio only (sources can carry DVB subtitles / data streams)
  baseArgs.push("-map", "0:v:0", "-map", "0:a:0?");

  if (useReencode) {
    baseArgs.push(
      // Deinterlace only frames flagged interlaced (1080i broadcasts); progressive passes through
      "-vf", "yadif=mode=0:deint=interlaced",
      ...tools.fpsPassthroughArgs,
      "-c:v", "libx264",
      // Only HEVC channels and channels whose copied video broke are re-encoded, so spend
      // the CPU on picture quality: ultrafast/CRF 23 turned grass into blocks
      "-preset", "veryfast",
      "-crf", "20",
      // A ceiling so a busy scene can't flood viewers' connections
      "-maxrate", "10000k",
      "-bufsize", "20000k",
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
  if (!LIVE_COPY || hevcChannels.has(channelId) || copyFailedChannels.has(channelId)) forceReencode = true;

  if (!forceReencode) {
    reencodeAttempts[channelId] = 0;
  }

  console.log(`🚀 Starting stream ${channelId}${forceReencode ? ' (re-encode mode)' : ' (copy mode)'}`);

  const initPromise = (async () => {
    try {
      const streamInfo = await getStreamLink(channelId);

      if (!streamInfo || !streamInfo.url) {
        console.log(`❌ No stream URL for ${channelId}`);
        delete streams[channelId];
        return;
      }

      console.log(`🔗 Got stream link for ${channelId}`);

      const args = getFFmpegArgs(streamInfo.url, channelId, forceReencode);
      const ffmpeg = spawn(FFMPEG, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true, // no console window per ffmpeg on Windows
      });

      let lastOutput = Date.now();
      let streamStarted = false;
      let errorCount = 0;
      let hevcDetected = false;
      // Frame counter from ffmpeg's progress lines. ffmpeg keeps printing progress even when
      // the provider switches feeds mid-stream and no new frames arrive (viewers then see a
      // frozen/blank picture with no sound), so "any output" alone doesn't prove it's healthy.
      let lastFrames = -1;
      let lastProgress = Date.now();

      // Last lines of ffmpeg output, printed if it exits unexpectedly
      const recentOutput = [];

      ffmpeg.stderr.on("data", (d) => {
        const logMessage = d.toString();
        lastOutput = Date.now();
        const frameCounts = logMessage.match(/frame=\s*(\d+)/g);
        if (frameCounts) {
          const frames = Number(frameCounts[frameCounts.length - 1].replace(/\D/g, ""));
          if (frames > lastFrames) {
            lastFrames = frames;
            lastProgress = Date.now();
          }
        }
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
        // Copy mode passes the provider's timestamps through. When they jump (seen: +25 h),
        // the playlist gets absurd segments (0.1 s, 92,197 s) or stops growing while frames
        // still arrive, and players stall with video already downloaded. Re-encoding writes
        // clean timestamps, so switch this channel to it for good.
        if (!forceReencode && streamStarted) {
          const problem = copyPlaylistProblem(channelId, Date.now() - lastProgress < 10000);
          if (problem) {
            copyFailedChannels.add(channelId);
            killAndRestart(`Copied video broke (${problem})`, true);
            return;
          }
        }
        if (!streamStarted && timeSinceLastOutput > 10000) {
          killAndRestart("Stream didn't start", true);
        } else if (timeSinceLastOutput > 15000) {
          const tryReencode = !forceReencode && (reencodeAttempts[channelId] || 0) < 2;
          if (tryReencode) reencodeAttempts[channelId] = (reencodeAttempts[channelId] || 0) + 1;
          killAndRestart(`Stream stalled (${timeSinceLastOutput}ms without output)`, tryReencode || forceReencode);
        } else if (lastFrames >= 0 && Date.now() - lastProgress > NO_FRAMES_TIMEOUT_MS) {
          // Running, but no new frames: reconnect to pick up the provider's current feed
          killAndRestart(`No new video for ${Math.round((Date.now() - lastProgress) / 1000)}s (feed changed or stuck)`, forceReencode);
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

      // Used by /watch?forceTranscode=1 when a player can't play this copy-mode stream
      if (!forceReencode) ffmpeg.switchToReencode = () => killAndRestart("Player couldn't play the copied video", true);
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
      appRelays: appRelay.status(),
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

  const relatedMatch = url.pathname.match(/^\/api\/channel\/(\d{1,10})\/related$/);
  if (relatedMatch) {
    const channel = findChannel(relatedMatch[1]);
    if (!channel) return sendJson(req, res, 404, { error: "Channel not found" });
    const related = relatedChannels(channel, catalogue.channels.items, 16).map(channelFields);
    return sendJson(req, res, 200, { related });
  }

  // Channels of the big football competitions, by language: /api/leagues
  if (url.pathname === "/api/leagues") {
    return sendJson(req, res, 200, { leagues: buildLeagues(), ready: catalogue.channels.ready });
  }

  // What's on now and next: /api/channel/:id/epg (empty list when the channel has no guide)
  const epgMatch = url.pathname.match(/^\/api\/channel\/(\d{1,10})\/epg$/);
  if (epgMatch) {
    const channel = findChannel(epgMatch[1]);
    if (!channel) return sendJson(req, res, 404, { error: "Channel not found" });
    try {
      const now = Date.now();
      const programmes = (await getChannelEpg(String(channel.id))).filter((p) => p.stop > now).slice(0, 6);
      return sendJson(req, res, 200, { programmes });
    } catch (err) {
      console.error(`❌ EPG for ${channel.id} failed: ${err.message}`);
      return sendJson(req, res, 502, { error: "Programme guide unavailable" });
    }
  }

  const logoMatch = url.pathname.match(/^\/api\/logo\/(\d{1,10})$/);
  if (logoMatch) return serveLogo(req, res, logoMatch[1]);

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
  // ---- Android app: the channel's original stream, relayed (see relay.js) ----
  const appLiveMatch = url.pathname.match(/^\/api\/app\/live\/(\d{1,10})\.ts$/);
  if (appLiveMatch) {
    const channel = findChannel(appLiveMatch[1]);
    if (!channel) return sendJson(req, res, 404, { error: "Channel not found" });
    return appRelay.serve(req, res, channel);
  }

  // ---- Android app: movies and series a page at a time (the full lists are too big for a phone) ----
  const appCatalogMatch = url.pathname.match(/^\/api\/app\/(vod|series)(\/categories)?$/);
  if (appCatalogMatch) {
    const { items, categories } = catalogue[appCatalogMatch[1]];
    if (appCatalogMatch[2]) {
      return sendJson(req, res, 200, { categories: appCategories(appCatalogMatch[1], items, categories) });
    }
    const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size")) || 60));
    const category = url.searchParams.get("category") || "";
    const words = (url.searchParams.get("q") || "").toLowerCase().split(/\s+/).filter(Boolean);
    const matches = items.filter((item) =>
      (!category || String(item.category_id) === category) &&
      (words.length === 0 || words.every((w) => String(item.name || "").toLowerCase().includes(w))));
    const slice = matches.slice(page * size, (page + 1) * size).map(listFields);
    return sendJson(req, res, 200, { items: slice, total: matches.length, page, hasMore: (page + 1) * size < matches.length });
  }

  // ---- Android app: the original movie / episode file (seekable, no conversion) ----
  const appVodFileMatch = url.pathname.match(/^\/api\/app\/vod\/(\d{1,12})\/file$/);
  if (appVodFileMatch) {
    const movie = catalogue.vod.items.find((m) => String(m.id) === appVodFileMatch[1]);
    if (!movie?.cmd) return sendJson(req, res, 404, { error: "Movie not found" });
    try {
      return await vod.streamFile(req, res, `vod:${movie.id}`, () => portal.createVodLink(movie.cmd));
    } catch (err) {
      console.error(`❌ App movie ${movie.id} failed: ${err.message}`);
      if (!res.headersSent) return sendJson(req, res, 502, { error: "This movie can't be played right now" });
      return res.end();
    }
  }
  const appEpisodeFileMatch = url.pathname.match(/^\/api\/app\/series\/([\w:-]{1,40})\/file$/);
  if (appEpisodeFileMatch) {
    const id = appEpisodeFileMatch[1];
    const seasonId = url.searchParams.get("season") || "";
    const episode = url.searchParams.get("episode") || "";
    if (!/^[\w:-]{1,40}$/.test(seasonId) || !/^\d{1,4}$/.test(episode)) return sendJson(req, res, 400, { error: "Invalid episode" });
    try {
      const season = (await getSeasons(id)).find((s) => String(s.id) === seasonId);
      if (!season?.cmd) return sendJson(req, res, 404, { error: "Episode not found" });
      return await vod.streamFile(req, res, `ep:${seasonId}:${episode}`, () => portal.createVodLink(season.cmd, episode));
    } catch (err) {
      console.error(`❌ App episode ${id} ${seasonId}/${episode} failed: ${err.message}`);
      if (!res.headersSent) return sendJson(req, res, 502, { error: "This episode can't be played right now" });
      return res.end();
    }
  }

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
        return sendJson(req, res, 200, { mode: info.mode, duration: info.duration, height: info.height, stream: `/api/vod/${id}/stream` });
      }
      return await vod.stream(req, res, key, createLink, url.searchParams.get("start"));
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
          duration: info.duration,
          stream: `/api/series/${encodeURIComponent(id)}/stream?${qs}`,
        });
      }
      return await vod.stream(req, res, key, createLink, url.searchParams.get("start"));
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
      ? sendJson(req, res, 200, { movie: await withVodDetails(movie) })
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

    // The player couldn't play this channel's original (copied) video: re-encode it from now on
    if (url.searchParams.get("forceTranscode") === "1" && LIVE_COPY && !copyFailedChannels.has(id)) {
      copyFailedChannels.add(id);
      const running = streams[id];
      if (running && !(running instanceof Promise) && running.switchToReencode) {
        running.switchToReencode();
        return res.end(JSON.stringify({ ok: true, viewers: viewers[id] }));
      }
    }

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
  console.log(`\n🛑 ${signal}: shutting down gracefully...`);
  
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
  appRelay.closeAll();
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

// =============================
// DAILY RESTART
// =============================
// After RESTART_AFTER_HOURS of uptime the process exits and pm2 starts it again, which
// reloads the catalogues and frees memory. It waits for a quiet moment (nobody watching
// or listening, no catalogue loading), but restarts anyway once RESTART_MAX_WAIT_HOURS
// more have passed. 0 turns it off, e.g. in development where nothing restarts the server.
const RESTART_AFTER_HOURS = Number(process.env.RESTART_AFTER_HOURS ?? 24);
const RESTART_MAX_WAIT_HOURS = 6;

if (RESTART_AFTER_HOURS > 0) {
  console.log(`🔁 Restarting after ${RESTART_AFTER_HOURS} h of uptime (at a quiet moment)`);
  setInterval(() => {
    const uptimeHours = process.uptime() / 3600;
    if (uptimeHours < RESTART_AFTER_HOURS) return;
    const busy = Object.values(viewers).some((n) => n > 0) || activeRadioProxies > 0 || vod.sessionCount() > 0
      || appRelay.status().viewers > 0
      || Object.values(catalogueStatus()).some((c) => c.loading);
    if (busy && uptimeHours < RESTART_AFTER_HOURS + RESTART_MAX_WAIT_HOURS) return;
    gracefulShutdown(`scheduled restart after ${Math.round(uptimeHours)} h uptime${busy ? " (still busy, restarting anyway)" : ""}`);
  }, 5 * 60 * 1000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});