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
const viewers = {};
const restartCounters = {};
const stopTimers = {};

// ============================================================
// ✅ FORCE CLEAN START (CACHE RESET)
// ============================================================
console.log("🧹 Resetting cache...");

if (fs.existsSync(CACHE_FILE)) {
  fs.unlinkSync(CACHE_FILE);
  console.log("🗑️ Cache file deleted");
}

// ============================================================
// CHANNEL CACHE STATE
// ============================================================
let allChannelsCache = [];
let channelsReady = false;
let channelsProgress = { loaded: 0, total: TOTAL_CHANNELS_ESTIMATE, percent: 0 };

// ============================================================
// STREAM FUNCTIONS
// ============================================================
function startStream(channelId) {
  if (!channelId) return;

  if (streams[channelId]) {
    console.log(`✅ Stream ${channelId} already running`);
    return;
  }

  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const streamUrl = `${STREAM_BASE}/${channelId}`;

  console.log(`▶️ Starting ${channelId}`);

  const ffmpeg = spawn("ffmpeg", [
    "-loglevel", "error",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_at_eof", "1",
    "-reconnect_delay_max", "5",

    "-headers", "User-Agent: Lavf53.32.100\r\nIcy-MetaData: 1",
    "-i", streamUrl,

    "-fflags", "+genpts",
    "-avoid_negative_ts", "make_zero",

    "-c", "copy",
    "-f", "hls",

    "-hls_time", "4",
    "-hls_list_size", "15",
    "-hls_flags", "delete_segments+append_list+omit_endlist",

    "-hls_segment_filename",
    path.join(HLS_DIR, `${channelId}_%03d.ts`),

    m3u8Path,
  ]);

  streams[channelId] = ffmpeg;
  restartCounters[channelId] = 0;

  const stableTimer = setTimeout(() => {
    restartCounters[channelId] = 0;
  }, 20000);

  ffmpeg.on("close", () => {
    clearTimeout(stableTimer);

    delete streams[channelId];

    // ✅ critical fix
    if (!viewers[channelId]) {
      console.log(`⛔ No viewers → not restarting ${channelId}`);
      return;
    }

    restartCounters[channelId]++;

    if (restartCounters[channelId] > 10) {
      console.log(`🚫 Disabled ${channelId}`);
      return;
    }

    console.log(`🔄 Restarting ${channelId}`);
    setTimeout(() => startStream(channelId), 5000);
  });
}

function stopStream(channelId) {
  if (streams[channelId]) {
    console.log(`⛔ Stopping ${channelId}`);
    streams[channelId].kill();
    delete streams[channelId];
  }

  delete viewers[channelId];
}

// ============================================================
// VIEWER MANAGEMENT
// ============================================================
function addViewer(channelId) {
  if (!viewers[channelId]) viewers[channelId] = 0;

  viewers[channelId]++;
  console.log(`👁️ ${channelId}: ${viewers[channelId]}`);

  if (stopTimers[channelId]) {
    clearTimeout(stopTimers[channelId]);
    delete stopTimers[channelId];
  }

  startStream(channelId);
}

function removeViewer(channelId) {
  if (!viewers[channelId]) return;

  viewers[channelId]--;

  if (viewers[channelId] <= 0) {
    viewers[channelId] = 0;

    stopTimers[channelId] = setTimeout(() => {
      if (viewers[channelId] === 0) stopStream(channelId);
    }, 30000);
  }
}

// ============================================================
// CHANNEL LOADER (UNCHANGED LOGIC)
// ============================================================
async function fetchConvex(path, args = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args }),
      });

      const data = await res.json();
      if (data.value) return data.value;
    } catch {}

    if (i < retries) await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

async function loadAllChannels() {
  console.log("\n🔄 ===== CHANNELS =====");

  const seen = new Set();
  const temp = [];

  const firstPage = await fetchConvex("iptv:getOrderedList", {
    page: 0,
    genre: "*",
    sortby: "number",
  });

  if (!firstPage?.js?.total_items) {
    console.log("❌ retrying...");
    setTimeout(loadAllChannels, 30000);
    return;
  }

  const totalPages = Math.ceil(firstPage.js.total_items / 14);

  for (let p = 0; p < totalPages; p++) {
    const data = await fetchConvex("iptv:getOrderedList", {
      page: p,
      genre: "*",
      sortby: "number",
    });

    const list = data?.js?.data || [];

    for (const ch of list) {
      const key = `${ch.id}_${ch.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        temp.push(ch);
      }
    }

    if (p % 200 === 0) {
      console.log(`📦 ${temp.length} channels`);
    }

    await new Promise(r => setTimeout(r, 30));
  }

  allChannelsCache = temp;
  channelsReady = true;

  console.log(`✅ Loaded ${temp.length} channels`);
}

// ============================================================
// STARTUP
// ============================================================
console.log("📡 Starting fresh load...");
loadAllChannels();

// ============================================================
// SERVER
// ============================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const id = url.searchParams.get("id");

  if (url.pathname === "/viewer/join") {
    addViewer(id);
    res.end("joined");
    return;
  }

  if (url.pathname === "/viewer/leave") {
    removeViewer(id);
    res.end("left");
    return;
  }

  if (url.pathname === "/viewer/count") {
    res.end(JSON.stringify({ count: viewers[id] || 0 }));
    return;
  }

  if (url.pathname === "/api/channels/all") {
    res.end(JSON.stringify({ channels: allChannelsCache }));
    return;
  }

  if (url.pathname.startsWith("/hls/")) {
    const filePath = path.join(HLS_DIR, url.pathname.replace("/hls/", ""));

    if (fs.existsSync(filePath)) {
      res.writeHead(200, {
        "Content-Type":
          path.extname(filePath) === ".m3u8"
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t",
      });

      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});