const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HLS_DIR = path.join(__dirname, "hls");
const STREAM_BASE = "http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec";
const CACHE_FILE = path.join(__dirname, "channels_cache.json");
const TOTAL_CHANNELS_ESTIMATE = 28400;

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const streams = {};

// ============================================================
// STREAM FUNCTIONS
// ============================================================
function startStream(channelId) {
  if (streams[channelId]) return streams[channelId];

  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const streamUrl = `${STREAM_BASE}/${channelId}`;

  console.log(`Starting stream for channel ${channelId}...`);

  const ffmpeg = spawn("ffmpeg", [
    "-i", streamUrl,
    "-headers", "User-Agent: Lavf53.32.100\r\nIcy-MetaData: 1",
    "-c", "copy",
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "6",
    "-hls_flags", "delete_segments",
    "-hls_segment_filename", path.join(HLS_DIR, `${channelId}_%03d.ts`),
    m3u8Path,
  ]);

  ffmpeg.stderr.on("data", () => {});

  ffmpeg.on("close", (code) => {
    console.log(`Stream ${channelId} stopped (code ${code})`);
    delete streams[channelId];
  });

  ffmpeg.on("error", (err) => {
    console.error(`Stream ${channelId} error:`, err.message);
    delete streams[channelId];
  });

  streams[channelId] = ffmpeg;
  return ffmpeg;
}

function stopStream(channelId) {
  if (streams[channelId]) {
    streams[channelId].kill();
    delete streams[channelId];
    try {
      const files = fs.readdirSync(HLS_DIR);
      files.forEach(f => {
        if (f.startsWith(`${channelId}`)) {
          try { fs.unlinkSync(path.join(HLS_DIR, f)); } catch (e) {}
        }
      });
    } catch (e) {}
  }
}

setInterval(() => {
  try {
    const files = fs.readdirSync(HLS_DIR);
    const now = Date.now();
    files.forEach(f => {
      const filePath = path.join(HLS_DIR, f);
      try {
        const stats = fs.statSync(filePath);
        const channelId = f.split(/[_.]/)[0];
        if (now - stats.mtimeMs > 120000 && !streams[channelId]) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {}
    });
  } catch (e) {}
}, 60000);

// ============================================================
// CHANNEL CACHE
// ============================================================
let allChannelsCache = [];
let channelsReady = false;

if (fs.existsSync(CACHE_FILE)) {
  fs.unlinkSync(CACHE_FILE);
  console.log("🗑️ Old cache deleted — starting fresh");
}

function saveCacheToDisk() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(allChannelsCache));
  } catch (e) {}
}

async function fetchPortalPage(page) {
  try {
    const res = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "iptv:getOrderedList", args: { page, genre: "*", sortby: "number" } }),
    });
    const data = await res.json();
    return data.value;
  } catch (e) {
    return null;
  }
}

async function loadAllChannels() {
  console.log("🔄 Loading channels...");
  const seen = new Set();
  const tempCache = [];

  const firstPage = await fetchPortalPage(0);
  if (!firstPage?.js?.total_items) {
    console.log("❌ Failed, retrying in 30s...");
    setTimeout(loadAllChannels, 30000);
    return;
  }

  const totalPages = Math.ceil(firstPage.js.total_items / 14);
  console.log(`📄 Total pages: ${totalPages.toLocaleString()}`);

  if (firstPage.js.data) {
    for (const ch of firstPage.js.data) {
      const key = `${ch.id}_${ch.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        tempCache.push({ id: ch.id, name: ch.name, number: ch.number, logo: ch.logo || "" });
      }
    }
  }

  const BATCH_SIZE = 5;
  for (let p = 1; p < totalPages; p += BATCH_SIZE) {
    const batch = [];
    for (let i = 0; i < BATCH_SIZE && p + i < totalPages; i++) {
      batch.push(fetchPortalPage(p + i));
    }

    let results = [];
    try { results = await Promise.all(batch); } catch (e) {
      for (const pagePromise of batch) {
        try { results.push(await pagePromise); } catch (e2) { results.push(null); }
      }
    }

    for (const data of results) {
      if (data?.js?.data) {
        for (const ch of data.js.data) {
          const key = `${ch.id}_${ch.number}`;
          if (!seen.has(key)) { seen.add(key); tempCache.push({ id: ch.id, name: ch.name, number: ch.number, logo: ch.logo || "" }); }
        }
      }
    }

    if (p % 200 === 0 && p > 0) {
      const percent = Math.round((p / totalPages) * 100);
      console.log(`⏳ ${tempCache.length.toLocaleString()} channels (${percent}%)`);
      allChannelsCache = [...tempCache];
      saveCacheToDisk();
    }

    await new Promise(r => setTimeout(r, 50));
  }

  allChannelsCache = tempCache;
  channelsReady = true;
  saveCacheToDisk();
  console.log(`✅ All ${allChannelsCache.length.toLocaleString()} channels loaded!`);
}

// ============================================================
// GAMES CACHE
// ============================================================
let allGamesCache = [];
let gamesReady = false;

async function loadAllGames() {
  console.log("⚽ Loading games...");
  try {
    const res = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "iptv:getLiveGames", args: { period: 1, page: 0, pageSize: 5000 } }),
    });
    const data = await res.json();
    allGamesCache = data.value?.games || [];
    gamesReady = true;
    console.log(`✅ ${allGamesCache.length} games loaded!`);
  } catch (e) {
    console.log("❌ Games load failed, retrying in 60s...");
    setTimeout(loadAllGames, 60000);
  }
}

// ============================================================
// STARTUP
// ============================================================
console.log("📡 Loading from network...");
loadAllChannels();
setTimeout(loadAllGames, 10000);

// Refresh every 3 hours
setInterval(loadAllChannels, 3 * 60 * 60 * 1000);
setInterval(loadAllGames, 3 * 60 * 60 * 1000);

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Progress
  if (url.pathname === "/progress") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      channels: { loaded: allChannelsCache.length, total: TOTAL_CHANNELS_ESTIMATE, ready: channelsReady },
      games: { loaded: allGamesCache.length, ready: gamesReady },
    }));
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      streams: Object.keys(streams),
      channelsCached: allChannelsCache.length,
      channelsReady,
      gamesCached: allGamesCache.length,
      gamesReady,
    }));
    return;
  }

  // Get ALL channels
  if (url.pathname === "/api/channels/all") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ channels: allChannelsCache, total: allChannelsCache.length, ready: channelsReady }));
    return;
  }

  // Get channels by range
  if (url.pathname === "/api/channels/range") {
    const start = parseInt(url.searchParams.get("start")) || 0;
    const end = parseInt(url.searchParams.get("end")) || 140;
    const filtered = allChannelsCache.filter(ch => { const num = parseInt(ch.number); return num >= start && num <= end; });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ channels: filtered, total: allChannelsCache.length, ready: channelsReady }));
    return;
  }

  // Get ALL games
  if (url.pathname === "/api/games/all") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ games: allGamesCache, total: allGamesCache.length, ready: gamesReady }));
    return;
  }

  // Start a stream
  if (url.pathname.startsWith("/streams/") && url.pathname.endsWith("/start") && req.method === "POST") {
    const channelId = url.pathname.split("/")[2];
    startStream(channelId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "started", channelId }));
    return;
  }

  // Stop a stream
  if (url.pathname.startsWith("/streams/") && url.pathname.endsWith("/stop") && req.method === "POST") {
    const channelId = url.pathname.split("/")[2];
    stopStream(channelId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "stopped", channelId }));
    return;
  }

  // Serve HLS files
  if (url.pathname.startsWith("/hls/")) {
    const filePath = path.join(HLS_DIR, url.pathname.replace("/hls/", ""));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const contentType = ext === ".m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("File not found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Health: /health`);
  console.log(`   Progress: /progress`);
  console.log(`   All channels: /api/channels/all`);
  console.log(`   Range: /api/channels/range?start=1&end=140`);
  console.log(`   All games: /api/games/all`);
  console.log(`   Stream: POST /streams/{id}/start`);
  console.log(`   HLS: /hls/{id}.m3u8`);
});