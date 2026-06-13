const http = require("http");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HLS_DIR = path.join(__dirname, "hls");
const STREAM_BASE = "http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec";
const CACHE_FILE = path.join(__dirname, "channels_cache.json");

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

// =====================================================
// GLOBAL STATE
// =====================================================
const streams = {};
const viewers = {};
const stopTimers = {};

// ✅ Channel cache
let allChannelsCache = [];
let channelsReady = false;
let channelsProgress = { loaded: 0, total: 0, percent: 0 };

// =====================================================
// FETCH (Convex)
// =====================================================
async function fetchConvex(path, args = {}) {
  try {
    const res = await fetch(
      "https://neighborly-perch-272.convex.cloud/api/action",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args }),
      }
    );

    const data = await res.json();
    return data.value;
  } catch {
    return null;
  }
}

// =====================================================
// CHANNEL LOADER (28K CACHE)
// =====================================================
async function loadAllChannels() {
  console.log("📡 Loading channels...");

  const tempCache = [];
  const seen = new Set();

  channelsReady = false;

  const first = await fetchConvex("iptv:getOrderedList", {
    page: 0,
    genre: "*",
    sortby: "number",
  });

  if (!first?.js?.total_items) {
    console.log("❌ Failed initial load");
    setTimeout(loadAllChannels, 30000);
    return;
  }

  const totalPages = Math.ceil(first.js.total_items / 14);
  const totalItems = first.js.total_items;

  console.log(`📄 Total: ${totalItems} | Pages: ${totalPages}`);

  function addChannels(data) {
    for (const ch of data) {
      const key = `${ch.id}_${ch.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        tempCache.push({
          id: ch.id,
          name: ch.name,
          number: ch.number,
          logo: ch.logo || "",
        });
      }
    }
  }

  addChannels(first.js.data);

  for (let p = 1; p < totalPages; p++) {
    const res = await fetchConvex("iptv:getOrderedList", {
      page: p,
      genre: "*",
      sortby: "number",
    });

    if (res?.js?.data) {
      addChannels(res.js.data);
    }

    channelsProgress = {
      loaded: tempCache.length,
      total: totalItems,
      percent: Math.round((p / totalPages) * 100),
    };

    if (p % 100 === 0) {
      console.log(
        `📊 ${channelsProgress.loaded}/${channelsProgress.total} (${channelsProgress.percent}%)`
      );
    }

    await new Promise((r) => setTimeout(r, 20)); // prevent overload
  }

  allChannelsCache = tempCache;
  channelsReady = true;

  channelsProgress = {
    loaded: allChannelsCache.length,
    total: allChannelsCache.length,
    percent: 100,
  };

  fs.writeFileSync(CACHE_FILE, JSON.stringify(allChannelsCache));

  console.log(`✅ DONE: ${allChannelsCache.length} channels cached`);
}

// ✅ Load cache instantly if exists
if (fs.existsSync(CACHE_FILE)) {
  allChannelsCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  channelsReady = true;

  console.log(`⚡ Loaded ${allChannelsCache.length} channels from cache`);
} else {
  loadAllChannels();
}

// =====================================================
// STREAM MODE DETECTION
// =====================================================
function probeStream(url) {
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "${url}"`,
      { timeout: 5000 }
    )
      .toString()
      .trim();

    if (["h264"].includes(output)) return "copy";
    return "transcode";
  } catch {
    return "transcode";
  }
}

// =====================================================
// START STREAM
// =====================================================
function startStream(channelId) {
  if (streams[channelId]) return;

  const streamUrl = `${STREAM_BASE}/${channelId}`;
  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);

  console.log(`🚀 Starting stream ${channelId}`);

  const mode = probeStream(streamUrl);

  const args =
    mode === "copy"
      ? [
          "-fflags", "+genpts",

          "-reconnect", "1",
          "-reconnect_streamed", "1",
          "-reconnect_at_eof", "1",

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
        ]
      : [
          "-fflags", "+genpts",
          "-avoid_negative_ts", "make_zero",

          "-reconnect", "1",
          "-reconnect_streamed", "1",
          "-reconnect_at_eof", "1",

          "-user_agent", "Mozilla/5.0",
          "-i", streamUrl,

          "-c:v", "libx264",
          "-preset", "veryfast",
          "-tune", "zerolatency",
          "-pix_fmt", "yuv420p",

          "-g", "48",
          "-keyint_min", "48",
          "-sc_threshold", "0",
          "-force_key_frames", "expr:gte(t,n_forced*4)",

          "-c:a", "aac",
          "-b:a", "128k",

          "-f", "hls",
          "-hls_time", "4",
          "-hls_list_size", "12",
          "-hls_flags",
          "delete_segments+append_list+omit_endlist+independent_segments",
          "-hls_segment_filename",
          path.join(HLS_DIR, `${channelId}_%03d.ts`),

          m3u8Path,
        ];

  const ffmpeg = spawn("ffmpeg", args);

  ffmpeg.stderr.on("data", (data) => {
    console.log(`[FFMPEG ${channelId}] ${data}`);
  });

  ffmpeg.on("close", () => {
    delete streams[channelId];
  });

  streams[channelId] = ffmpeg;
}

// =====================================================
// STOP STREAM (VIEWER BASED)
// =====================================================
function scheduleStop(channelId) {
  if (stopTimers[channelId]) clearTimeout(stopTimers[channelId]);

  stopTimers[channelId] = setTimeout(() => {
    if ((viewers[channelId] || 0) === 0) {
      console.log(`🛑 Stopping stream ${channelId}`);
      streams[channelId]?.kill("SIGKILL");
      delete streams[channelId];
    }
  }, 30000);
}

// =====================================================
// SERVER
// =====================================================
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader("Access-Control-Allow-Origin", "*");

  // ✅ Progress (CHANNEL CACHE)
  if (url.pathname === "/progress") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        channels: channelsProgress,
        ready: channelsReady,
      })
    );
  }

  // ✅ Channels API
  if (url.pathname === "/api/channels/all") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        channels: allChannelsCache,
        total: allChannelsCache.length,
        ready: channelsReady,
      })
    );
  }

  // ✅ Watch (start stream)
  if (url.pathname.startsWith("/watch/")) {
    const id = url.pathname.split("/")[2];

    viewers[id] = (viewers[id] || 0) + 1;
    startStream(id);

    res.writeHead(200);
    return res.end("OK");
  }

  // ✅ Leave (stop stream)
  if (url.pathname.startsWith("/leave/")) {
    const id = url.pathname.split("/")[2];

    viewers[id] = Math.max(0, (viewers[id] || 1) - 1);
    scheduleStop(id);

    res.writeHead(200);
    return res.end("OK");
  }

  // ✅ HLS serve
  if (url.pathname.startsWith("/hls/")) {
    const filePath = path.join(HLS_DIR, url.pathname.replace("/hls/", ""));

    if (fs.existsSync(filePath)) {
      res.writeHead(200, {
        "Content-Type":
          path.extname(filePath) === ".m3u8"
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t",
      });

      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404);
    return res.end("Not found");
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);