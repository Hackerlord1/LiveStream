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

// ============================================================
// STREAM FUNCTION (FINAL OPTIMIZED)
// ============================================================
function startStream(channelId) {
  if (streams[channelId]) return streams[channelId];

  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const streamUrl = `${STREAM_BASE}/${channelId}`;

  console.log(`Starting stream for channel ${channelId}...`);

  const ffmpeg = spawn("ffmpeg", [
    "-loglevel", "error",

    // ✅ keep connection alive
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_at_eof", "1",
    "-reconnect_delay_max", "5",

    "-headers", "User-Agent: Lavf53.32.100\r\nIcy-MetaData: 1",
    "-i", streamUrl,

    // ✅ timeline stability
    "-fflags", "+genpts",
    "-avoid_negative_ts", "make_zero",

    "-c", "copy",

    "-f", "hls",

    // ✅ segment size
    "-hls_time", "4",

    // ✅ ✅ BIG BUFFER (this is your improvement)
    // 4s * 15 = ~60 seconds buffer
    "-hls_list_size", "15",

    // ✅ NEVER END LIVE STREAM
    "-hls_flags", "delete_segments+append_list+omit_endlist",

    "-hls_segment_filename",
    path.join(HLS_DIR, `${channelId}_%03d.ts`),

    m3u8Path,
  ]);

  ffmpeg.stderr.on("data", () => {});

  if (!restartCounters[channelId]) {
    restartCounters[channelId] = 0;
  }

  // ✅ If it survives → reset counter
  const stableTimer = setTimeout(() => {
    restartCounters[channelId] = 0;
    console.log(`✅ Stream ${channelId} stable (counter reset)`);
  }, 20000);

  ffmpeg.on("close", (code) => {
    clearTimeout(stableTimer);

    console.log(`Stream ${channelId} stopped (code ${code})`);

    const wasActive = !!streams[channelId];
    delete streams[channelId];

    if (!wasActive) return;

    restartCounters[channelId]++;

    // ✅ STOP bad channel
    if (restartCounters[channelId] > 10) {
      console.log(`❌ Channel ${channelId} disabled after 10 failures`);
      delete restartCounters[channelId];
      return;
    }

    console.log(
      `🔄 Restarting ${channelId} (${restartCounters[channelId]}/10)`
    );

    setTimeout(() => startStream(channelId), 5000);
  });

  ffmpeg.on("error", (err) => {
    clearTimeout(stableTimer);

    console.error(`Stream ${channelId} error:`, err.message);

    const wasActive = !!streams[channelId];
    delete streams[channelId];

    if (!wasActive) return;

    restartCounters[channelId]++;

    if (restartCounters[channelId] > 10) {
      console.log(`❌ Channel ${channelId} disabled after errors`);
      delete restartCounters[channelId];
      return;
    }

    console.log(
      `🔄 Restarting after error ${channelId} (${restartCounters[channelId]}/10)`
    );

    setTimeout(() => startStream(channelId), 5000);
  });

  streams[channelId] = ffmpeg;
  return ffmpeg;
}

// ============================================================
// STOP STREAM
// ============================================================
function stopStream(channelId) {
  if (streams[channelId]) {
    streams[channelId].kill();
    delete streams[channelId];
  }
  delete restartCounters[channelId];
}

// ============================================================
// CLEANUP
// ============================================================
setInterval(() => {
  try {
    const files = fs.readdirSync(HLS_DIR);
    const now = Date.now();

    files.forEach((f) => {
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (
    url.pathname.startsWith("/streams/") &&
    url.pathname.endsWith("/start")
  ) {
    const id = url.pathname.split("/")[2];
    startStream(id);
    res.writeHead(200);
    res.end(JSON.stringify({ status: "started" }));
    return;
  }

  if (
    url.pathname.startsWith("/streams/") &&
    url.pathname.endsWith("/stop")
  ) {
    const id = url.pathname.split("/")[2];
    stopStream(id);
    res.writeHead(200);
    res.end(JSON.stringify({ status: "stopped" }));
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
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});