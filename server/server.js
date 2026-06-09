const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HLS_DIR = path.join(__dirname, "hls");
const STREAM_BASE = "http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec";

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const streams = {};

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

// Cleanup old segments every 60 seconds
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
  console.log("Loading all channels...");
  const seen = new Set();
  allChannelsCache = [];

  const firstPage = await fetchPortalPage(0);
  if (!firstPage?.js?.total_items) {
    console.log("Failed, retrying in 30s...");
    setTimeout(loadAllChannels, 30000);
    return;
  }

  const totalPages = Math.ceil(firstPage.js.total_items / 14);
  console.log(`Total pages: ${totalPages}`);

  if (firstPage.js.data) {
    for (const ch of firstPage.js.data) {
      const key = `${ch.id}_${ch.number}`;
      if (!seen.has(key)) { seen.add(key); allChannelsCache.push({ id: ch.id, name: ch.name, number: ch.number, logo: ch.logo || "" }); }
    }
  }

  for (let p = 1; p < totalPages; p++) {
    try {
      const data = await fetchPortalPage(p);
      if (data?.js?.data) {
        for (const ch of data.js.data) {
          const key = `${ch.id}_${ch.number}`;
          if (!seen.has(key)) { seen.add(key); allChannelsCache.push({ id: ch.id, name: ch.name, number: ch.number, logo: ch.logo || "" }); }
        }
      }
      if (p % 500 === 0) console.log(`Loaded ${allChannelsCache.length}...`);
    } catch (e) {}
    await new Promise(r => setTimeout(r, 50));
  }

  channelsReady = true;
  console.log(`✅ All ${allChannelsCache.length} channels loaded!`);
}

loadAllChannels();

setInterval(() => {
  console.log("Refreshing cache...");
  loadAllChannels();
}, 6 * 60 * 60 * 1000);

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

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", streams: Object.keys(streams), channelsCached: allChannelsCache.length, channelsReady }));
    return;
  }

  // Get ALL channels
  if (url.pathname === "/api/channels/all") {
    if (!channelsReady) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ loading: true, channels: [], message: "Still loading..." }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ channels: allChannelsCache, total: allChannelsCache.length }));
    return;
  }

  // Get channels by range
  if (url.pathname === "/api/channels/range") {
    const start = parseInt(url.searchParams.get("start")) || 0;
    const end = parseInt(url.searchParams.get("end")) || 140;
    if (!channelsReady) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ loading: true, channels: [], message: "Still loading..." }));
      return;
    }
    const filtered = allChannelsCache.filter(ch => { const num = parseInt(ch.number); return num >= start && num <= end; });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ channels: filtered }));
    return;
  }

  if (url.pathname.startsWith("/streams/") && url.pathname.endsWith("/start") && req.method === "POST") {
    const channelId = url.pathname.split("/")[2];
    startStream(channelId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "started", channelId }));
    return;
  }

  if (url.pathname.startsWith("/streams/") && url.pathname.endsWith("/stop") && req.method === "POST") {
    const channelId = url.pathname.split("/")[2];
    stopStream(channelId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "stopped", channelId }));
    return;
  }

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
  console.log(`HLS Service running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`All channels: http://localhost:${PORT}/api/channels/all`);
  console.log(`Range: http://localhost:${PORT}/api/channels/range?start=1&end=140`);
});