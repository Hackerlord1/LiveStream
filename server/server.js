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

  ffmpeg.stderr.on("data", (data) => {
    // Uncomment for debug: console.log(data.toString());
  });

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
        if (f.startsWith(`${channelId}`) ) {
          try {
            fs.unlinkSync(path.join(HLS_DIR, f));
          } catch (e) { /* file already gone */ }
        }
      });
    } catch (e) { /* directory read error */ }
  }
}

// ═══════════════════════════════════════════════════
// ✅ Cleanup interval — OUTSIDE the request handler
// ═══════════════════════════════════════════════════
setInterval(() => {
  try {
    const files = fs.readdirSync(HLS_DIR);
    const now = Date.now();
    files.forEach(f => {
      const filePath = path.join(HLS_DIR, f);
      try {
        const stats = fs.statSync(filePath);
        // Extract channel ID: everything before the first '_' or '.'
        const channelId = f.split(/[_.]/)[0];
        if (now - stats.mtimeMs > 120000 && !streams[channelId]) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up: ${f}`);
        }
      } catch (e) {
        // File was deleted between readdir and stat — safe to ignore
      }
    });
  } catch (e) {
    console.error("Cleanup error:", e.message);
  }
}, 60000);

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
    res.end(JSON.stringify({ status: "ok", streams: Object.keys(streams) }));
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
});