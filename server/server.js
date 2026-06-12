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
const viewers = {};
const stopTimers = {};

// ============================================================
// STREAM START
// ============================================================
function startStream(channelId) {
  if (!channelId) return;

  if (streams[channelId]) {
    console.log(`✅ Stream ${channelId} already running`);
    return;
  }

  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const streamUrl = `${STREAM_BASE}/${channelId}`;

  console.log(`▶️ Starting stream ${channelId}`);
  console.log(`📡 Source: ${streamUrl}`);

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
    "-hls_list_size", "15", // ~60s buffer

    "-hls_flags", "delete_segments+append_list+omit_endlist",

    "-hls_segment_filename",
    path.join(HLS_DIR, `${channelId}_%03d.ts`),

    m3u8Path,
  ]);

  streams[channelId] = ffmpeg;

  if (!restartCounters[channelId]) restartCounters[channelId] = 0;

  // ✅ Reset counter if stable
  const stableTimer = setTimeout(() => {
    restartCounters[channelId] = 0;
    console.log(`✅ Stream ${channelId} stable`);
  }, 20000);

  ffmpeg.stderr.on("data", (data) => {
    console.log(`FFmpeg ${channelId}: ${data}`);
  });

  ffmpeg.on("close", () => {
    clearTimeout(stableTimer);
    delete streams[channelId];

    // ✅ CRITICAL FIX: do NOT restart if no viewers
    if (!viewers[channelId] || viewers[channelId] === 0) {
      console.log(`⛔ No viewers → not restarting ${channelId}`);
      return;
    }

    restartCounters[channelId]++;

    if (restartCounters[channelId] > 10) {
      console.log(`🚫 Disabled ${channelId} after 10 failures`);
      return;
    }

    console.log(
      `🔄 Restarting ${channelId} (${restartCounters[channelId]}/10)`
    );

    setTimeout(() => startStream(channelId), 5000);
  });

  ffmpeg.on("error", (err) => {
    clearTimeout(stableTimer);
    delete streams[channelId];

    console.error(`⚠️ FFmpeg error ${channelId}: ${err.message}`);

    // ✅ respect viewer condition
    if (!viewers[channelId] || viewers[channelId] === 0) {
      console.log(`⛔ Not restarting ${channelId} (no viewers)`);
      return;
    }

    restartCounters[channelId]++;

    if (restartCounters[channelId] > 10) {
      console.log(`🚫 Disabled ${channelId}`);
      return;
    }

    setTimeout(() => startStream(channelId), 5000);
  });
}

// ============================================================
// STOP STREAM
// ============================================================
function stopStream(channelId) {
  if (streams[channelId]) {
    console.log(`⛔ Stopping ${channelId}`);
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
  if (!channelId) return;

  if (!viewers[channelId]) viewers[channelId] = 0;

  viewers[channelId]++;
  console.log(`👁️ ${channelId} viewers: ${viewers[channelId]}`);

  // cancel pending stop
  if (stopTimers[channelId]) {
    clearTimeout(stopTimers[channelId]);
    delete stopTimers[channelId];
  }

  startStream(channelId);
}

function removeViewer(channelId) {
  if (!channelId || !viewers[channelId]) return;

  viewers[channelId]--;
  console.log(`👁️ ${channelId} viewers: ${viewers[channelId]}`);

  if (viewers[channelId] <= 0) {
    viewers[channelId] = 0;

    stopTimers[channelId] = setTimeout(() => {
      if (viewers[channelId] === 0) {
        stopStream(channelId);
      }
    }, 30000); // 30s delay
  }
}

// ============================================================
// CLEANUP FILES
// ============================================================
setInterval(() => {
  try {
    const files = fs.readdirSync(HLS_DIR);
    const now = Date.now();

    files.forEach((f) => {
      try {
        const full = path.join(HLS_DIR, f);
        const stat = fs.statSync(full);
        const cid = f.split(/[_.]/)[0];

        if (now - stat.mtimeMs > 120000 && !streams[cid]) {
          fs.unlinkSync(full);
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
  const id = url.searchParams.get("id");

  // ✅ validate input
  if (url.pathname.includes("/viewer") && !id) {
    res.writeHead(400);
    res.end("Missing channel id");
    return;
  }

  // ✅ JOIN
  if (url.pathname.includes("/viewer/join")) {
    addViewer(id);
    res.end("joined");
    return;
  }

  // ✅ LEAVE
  if (url.pathname.includes("/viewer/leave")) {
    removeViewer(id);
    res.end("left");
    return;
  }

  // ✅ COUNT
  if (url.pathname.includes("/viewer/count")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ count: viewers[id] || 0 }));
    return;
  }

  // ✅ HLS
  if (url.pathname.startsWith("/hls/")) {
    const filePath = path.join(
      HLS_DIR,
      url.pathname.replace("/hls/", "")
    );

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