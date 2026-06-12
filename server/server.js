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
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_at_eof", "1",
    "-reconnect_delay_max", "5",
    "-i", streamUrl,
    "-headers", "User-Agent: Lavf53.32.100\r\nIcy-MetaData: 1",
    "-c", "copy",
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "12",
    "-hls_flags", "delete_segments+append_list+omit_endlist",
    "-hls_segment_filename", path.join(HLS_DIR, `${channelId}_%03d.ts`),
    m3u8Path,
  ]);

  ffmpeg.stderr.on("data", () => {});

  ffmpeg.on("close", (code) => {
    console.log(`Stream ${channelId} stopped (code ${code})`);
    const wasActive = !!streams[channelId];
    delete streams[channelId];
    if (wasActive && code !== 0 && code !== null) {
      console.log(`🔄 Auto-restarting stream ${channelId} in 3s...`);
      setTimeout(() => startStream(channelId), 3000);
    }
  });

  ffmpeg.on("error", (err) => {
    console.error(`Stream ${channelId} error:`, err.message);
    const wasActive = !!streams[channelId];
    delete streams[channelId];
    if (wasActive) {
      console.log(`🔄 Auto-restarting stream ${channelId} after error in 3s...`);
      setTimeout(() => startStream(channelId), 3000);
    }
  });

  streams[channelId] = ffmpeg;
  return ffmpeg;
}

function stopStream(channelId) {
  if (streams[channelId]) { streams[channelId].kill(); delete streams[channelId]; }
}

setInterval(() => {
  try {
    const files = fs.readdirSync(HLS_DIR);
    const now = Date.now();
    files.forEach(f => {
      try { const s = fs.statSync(path.join(HLS_DIR, f)); const cid = f.split(/[_.]/)[0]; if (now - s.mtimeMs > 120000 && !streams[cid]) fs.unlinkSync(path.join(HLS_DIR, f)); } catch (e) {}
    });
  } catch (e) {}
}, 60000);

// ============================================================
// CHANNEL CACHE ONLY
// ============================================================
let allChannelsCache = [], channelsReady = false, channelsProgress = { loaded: 0, total: TOTAL_CHANNELS_ESTIMATE, percent: 0 };

if (fs.existsSync(CACHE_FILE)) { fs.unlinkSync(CACHE_FILE); console.log("🗑️ Old cache deleted"); }
function saveCacheToDisk() { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(allChannelsCache)); } catch (e) {} }

async function fetchConvex(path, args = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args }),
      });
      const data = await res.json();
      if (data.value) return data.value;
    } catch (e) {}
    if (i < retries) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  return null;
}

async function loadAllChannels() {
  console.log("\n🔄 ===== CHANNELS =====");
  channelsReady = false;
  const seen = new Set();
  const tempCache = [];
  const firstPage = await fetchConvex("iptv:getOrderedList", { page: 0, genre: "*", sortby: "number" });
  if (!firstPage?.js?.total_items) { console.log("❌ Failed, retrying in 30s..."); setTimeout(loadAllChannels, 30000); return; }
  const totalPages = Math.ceil(firstPage.js.total_items / 14);
  const totalItems = firstPage.js.total_items;
  console.log(`📄 Pages: ${totalPages.toLocaleString()} | Target: ${totalItems.toLocaleString()} channels`);
  if (firstPage.js.data) { for (const ch of firstPage.js.data) { const key = `${ch.id}_${ch.number}`; if (!seen.has(key)) { seen.add(key); tempCache.push({ id: ch.id, name: ch.name, number: ch.number, logo: ch.logo || "" }); } } }
  let lastMilestone = 0;
  const milestones = [2000, 5000, 10000, 15000, 20000, 25000, 28000];
  let consecutiveFailures = 0;
  for (let p = 1; p < totalPages; p++) {
    const data = await fetchConvex("iptv:getOrderedList", { page: p, genre: "*", sortby: "number" }, 2);
    if (data?.js?.data && data.js.data.length > 0) { for (const ch of data.js.data) { const key = `${ch.id}_${ch.number}`; if (!seen.has(key)) { seen.add(key); tempCache.push({ id: ch.id, name: ch.name, number: ch.number, logo: ch.logo || "" }); } } consecutiveFailures = 0; }
    else { consecutiveFailures++; }
    if (consecutiveFailures > 30) { console.log(`⚠️ Pausing at page ${p}...`); await new Promise(r => setTimeout(r, 30000)); consecutiveFailures = 0; }
    const count = tempCache.length;
    for (const m of milestones) { if (count >= m && lastMilestone < m) { console.log(`🎯 MILESTONE: ${m.toLocaleString()} channels`); lastMilestone = m; } }
    if (p % 200 === 0 && p > 0) { channelsProgress = { loaded: count, total: totalItems, percent: Math.round((p / totalPages) * 100) }; console.log(`⏳ ${count.toLocaleString()} channels (${channelsProgress.percent}%)`); allChannelsCache = [...tempCache]; saveCacheToDisk(); }
    await new Promise(r => setTimeout(r, 30));
  }
  allChannelsCache = tempCache; channelsReady = true;
  channelsProgress = { loaded: allChannelsCache.length, total: allChannelsCache.length, percent: 100 };
  saveCacheToDisk();
  console.log(`✅ CHANNELS COMPLETE: ${allChannelsCache.length.toLocaleString()} loaded!\n`);
}

// ============================================================
// STARTUP
// ============================================================
console.log("📡 Loading channels...");
loadAllChannels();

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/progress") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ channels: { loaded: channelsProgress.loaded, total: channelsProgress.total, percent: channelsProgress.percent, ready: channelsReady } }));
    return;
  }
  if (url.pathname === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: "ok", streams: Object.keys(streams), channels: allChannelsCache.length })); return; }
  if (url.pathname === "/api/channels/all") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ channels: allChannelsCache, total: allChannelsCache.length, ready: channelsReady })); return; }
  if (url.pathname === "/api/channels/range") { const start = parseInt(url.searchParams.get("start")) || 0, end = parseInt(url.searchParams.get("end")) || 140; const filtered = allChannelsCache.filter(ch => { const num = parseInt(ch.number); return num >= start && num <= end; }); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ channels: filtered, total: allChannelsCache.length, ready: channelsReady })); return; }
  if (url.pathname.startsWith("/streams/") && url.pathname.endsWith("/start") && req.method === "POST") { startStream(url.pathname.split("/")[2]); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: "started" })); return; }
  if (url.pathname.startsWith("/streams/") && url.pathname.endsWith("/stop") && req.method === "POST") { stopStream(url.pathname.split("/")[2]); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: "stopped" })); return; }
  if (url.pathname.startsWith("/hls/")) { const filePath = path.join(HLS_DIR, url.pathname.replace("/hls/", "")); if (fs.existsSync(filePath)) { res.writeHead(200, { "Content-Type": path.extname(filePath) === ".m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t" }); fs.createReadStream(filePath).pipe(res); } else { res.writeHead(404); res.end("Not found"); } return; }
  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));