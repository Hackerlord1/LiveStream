const http = require("http");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HLS_DIR = path.join(__dirname, "hls");
const STREAM_BASE = "http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec";

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

// ========================================================
// STATE
// ========================================================
const streams = {};
const viewers = {};
const stopTimers = {};

// ========================================================
// PROBE STREAM (AUTO DETECT)
// ========================================================
function probeStream(url) {
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "${url}"`,
      { timeout: 5000 }
    )
      .toString()
      .trim();

    console.log(`🔍 Codec detected: ${output}`);

    if (!output) return "transcode";

    // Supported directly by browsers
    if (["h264"].includes(output)) {
      return "copy";
    }

    return "transcode";
  } catch (e) {
    console.log("⚠️ Probe failed → fallback to transcode");
    return "transcode";
  }
}

// ========================================================
// START STREAM
// ========================================================
function startStream(channelId) {
  if (streams[channelId]) return;

  const streamUrl = `${STREAM_BASE}/${channelId}`;
  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);

  console.log(`🚀 Starting stream ${channelId}...`);

  const mode = probeStream(streamUrl);

  let args;

  if (mode === "copy") {
    console.log(`✅ Using COPY mode for ${channelId}`);

    args = [
      "-fflags", "+genpts",
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_at_eof", "1",
      "-reconnect_delay_max", "5",

      "-user_agent", "Mozilla/5.0",
      "-i", streamUrl,

      "-c", "copy",

      "-f", "hls",
      "-hls_time", "4",
      "-hls_list_size", "12",
      "-hls_flags",
      "delete_segments+append_list+omit_endlist+independent_segments",
      "-hls_segment_filename",
      path.join(HLS_DIR, `${channelId}_%03d.ts`),

      m3u8Path,
    ];
  } else {
    console.log(`🔥 Using TRANSCODE mode for ${channelId}`);

    args = [
      "-fflags", "+genpts",
      "-avoid_negative_ts", "make_zero",

      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_at_eof", "1",
      "-reconnect_delay_max", "5",

      "-user_agent", "Mozilla/5.0",
      "-i", streamUrl,

      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "zerolatency",
      "-profile:v", "main",
      "-level", "3.1",
      "-pix_fmt", "yuv420p",

      "-g", "48",
      "-keyint_min", "48",
      "-sc_threshold", "0",
      "-force_key_frames", "expr:gte(t,n_forced*4)",

      "-c:a", "aac",
      "-b:a", "128k",
      "-ac", "2",

      "-f", "hls",
      "-hls_time", "4",
      "-hls_list_size", "12",
      "-hls_flags",
      "delete_segments+append_list+omit_endlist+independent_segments",
      "-hls_segment_filename",
      path.join(HLS_DIR, `${channelId}_%03d.ts`),

      m3u8Path,
    ];
  }

  const ffmpeg = spawn("ffmpeg", args);

  ffmpeg.stderr.on("data", (data) => {
    console.log(`[FFMPEG ${channelId}] ${data}`);
  });

  ffmpeg.on("close", (code) => {
    console.log(`❌ Stream ${channelId} stopped (${code})`);
    delete streams[channelId];
  });

  streams[channelId] = ffmpeg;
}

// ========================================================
// STOP STREAM (viewer aware)
// ========================================================
function scheduleStop(channelId) {
  if (stopTimers[channelId]) clearTimeout(stopTimers[channelId]);

  stopTimers[channelId] = setTimeout(() => {
    if ((viewers[channelId] || 0) === 0) {
      console.log(`🛑 Stopping idle stream ${channelId}`);
      if (streams[channelId]) {
        streams[channelId].kill("SIGKILL");
        delete streams[channelId];
      }
    }
  }, 30000); // 30s grace
}

// ========================================================
// HTTP SERVER
// ========================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ================================
  // VIEWER TRACKING
  // ================================
  if (url.pathname.startsWith("/watch/")) {
    const channelId = url.pathname.split("/")[2];

    viewers[channelId] = (viewers[channelId] || 0) + 1;
    console.log(`👀 Viewer +1 (${channelId}) = ${viewers[channelId]}`);

    startStream(channelId);

    res.writeHead(200);
    res.end("OK");
    return;
  }

  if (url.pathname.startsWith("/leave/")) {
    const channelId = url.pathname.split("/")[2];

    viewers[channelId] = Math.max(0, (viewers[channelId] || 1) - 1);

    console.log(`👋 Viewer -1 (${channelId}) = ${viewers[channelId]}`);

    scheduleStop(channelId);

    res.writeHead(200);
    res.end("OK");
    return;
  }

  // ================================
  // HLS SERVE
  // ================================
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

  // ================================
  // HEALTH
  // ================================
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        activeStreams: Object.keys(streams),
        viewers,
      })
    );
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () =>
  console.log(`🚀 Running on http://localhost:${PORT}`)
);