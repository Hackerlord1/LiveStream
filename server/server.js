const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HLS_DIR = path.join(__dirname, "hls");
const STREAM_BASE = "http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec";

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const streams = {};
const restartCounters = {};
const viewers = {};        // ✅ track active viewers
const stopTimers = {};     // ✅ stop timers

// ============================================================
// STREAM START
// ============================================================
function startStream(channelId) {
  if (streams[channelId]) return;

  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const streamUrl = `${STREAM_BASE}/${channelId}`;

  console.log(`▶️ Starting stream ${channelId}`);

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
    "-hls_list_size", "15", // ✅ ~60s buffer

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

    restartCounters[channelId]++;

    if (restartCounters[channelId] > 10) {
      console.log(`🚫 Disabled channel ${channelId}`);
      return;
    }

    console.log(`🔄 Restarting ${channelId}`);
    setTimeout(() => startStream(channelId), 5000);
  });
}

// ============================================================
// STOP STREAM
// ============================================================
function stopStream(channelId) {
  if (streams[channelId]) {
    console.log(`⛔ Stopping stream ${channelId}`);
    streams[channelId].kill();
    delete streams[channelId];
  }

  delete viewers[channelId];
  delete restartCounters[channelId];
}

// ============================================================
// VIEWER MANAGEMENT
// ============================================================

function addViewer(channelId) {
  if (!viewers[channelId]) viewers[channelId] = 0;

  viewers[channelId]++;
  console.log(`👁️ ${channelId} viewers: ${viewers[channelId]}`);

  // ✅ cancel stop timer if exists
  if (stopTimers[channelId]) {
    clearTimeout(stopTimers[channelId]);
    delete stopTimers[channelId];
  }

  // ✅ start stream if needed
  startStream(channelId);
}

function removeViewer(channelId) {
  if (!viewers[channelId]) return;

  viewers[channelId]--;
  console.log(`👁️ ${channelId} viewers: ${viewers[channelId]}`);

  if (viewers[channelId] <= 0) {
    viewers[channelId] = 0;

    // ✅ wait before stopping (important)
    stopTimers[channelId] = setTimeout(() => {
      if (viewers[channelId] === 0) {
        stopStream(channelId);
      }
    }, 30000); // ✅ 30 seconds grace
  }
}

// ============================================================
// CLEANUP FILES
// ============================================================
setInterval(() => {
  try {
    const files = fs.readdirSync(HLS_DIR);
    const now = Date.now();

    files.forEach(f => {
      try {
        const stat = fs.statSync(path.join(HLS_DIR, f));
        const cid = f.split(/[_.]/)[0];

        if (now - stat.mtimeMs > 120000 && !streams[cid]) {
          fs.unlinkSync(path.join(HLS_DIR, f));
        }
      } catch {}
    });
  } catch {}
}, 60000);

// ============================================================
// SERVER
// ============================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ✅ USER START WATCHING
  if (url.pathname.includes("/viewer/join")) {
    const id = url.searchParams.get("id");
    addViewer(id);
    res.end("joined");
    return;
  }

  // ✅ USER STOP WATCHING
  if (url.pathname.includes("/viewer/leave")) {
    const id = url.searchParams.get("id");
    removeViewer(id);
    res.end("left");
    return;
  }

  // ✅ HLS SERVE
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

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);