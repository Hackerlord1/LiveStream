const http = require("http");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HLS_DIR = path.join(__dirname, "hls");
const STREAM_BASE = "http://expat-tv.xyz/MAGL2ELNMB/MAG42M41CA";
const CACHE_FILE = path.join(__dirname, "channels_cache.json");

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

// =============================
// GLOBAL STATE
// =============================
const streams = {};
const viewers = {};
const stopTimers = {};

let allChannelsCache = [];
let channelsReady = false;
let channelsProgress = { loaded: 0, total: 0, percent: 0 };

// =============================
// FETCH
// =============================
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

// =============================
// CHANNEL CACHE
// =============================
async function loadAllChannels() {
  console.log("📡 Loading channels from expat-tv.xyz...");

  const tempCache = [];
  const seen = new Set();

  const first = await fetchConvex("iptv:getOrderedList", {
    page: 0,
    genre: "*",
    sortby: "number",
  });

  if (!first?.js?.total_items) {
    console.log("❌ Failed initial load");
    return;
  }

  const totalPages = Math.ceil(first.js.total_items / 14);
  const totalItems = first.js.total_items;

  function add(data) {
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

  add(first.js.data);

  for (let p = 1; p < totalPages; p++) {
    const res = await fetchConvex("iptv:getOrderedList", {
      page: p,
      genre: "*",
      sortby: "number",
    });

    if (res?.js?.data) add(res.js.data);

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

    await new Promise((r) => setTimeout(r, 20));
  }

  allChannelsCache = tempCache;
  channelsReady = true;

  channelsProgress = {
    loaded: allChannelsCache.length,
    total: allChannelsCache.length,
    percent: 100,
  };

  fs.writeFileSync(CACHE_FILE, JSON.stringify(allChannelsCache));
  console.log(`✅ Cached ${allChannelsCache.length} channels`);
}

if (fs.existsSync(CACHE_FILE)) {
  allChannelsCache = JSON.parse(fs.readFileSync(CACHE_FILE));
  channelsReady = true;
  console.log(`⚡ Loaded cached channels (${allChannelsCache.length})`);
} else {
  loadAllChannels();
}

// =============================
// CODEC DETECTION
// =============================
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

// =============================
// START STREAM
// =============================
function startStream(channelId, forceTranscode = false) {
  if (streams[channelId]) return;

  const streamUrl = `${STREAM_BASE}/${channelId}`;
  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);

  console.log(`🚀 Starting stream ${channelId}`);

  const mode = forceTranscode ? "transcode" : probeStream(streamUrl);

  const baseFlags = [
    "-analyzeduration", "1000000",
    "-probesize", "1000000",
    "-fflags", "+genpts",
    "-vsync", "1",

    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_at_eof", "1",

    "-user_agent", "Mozilla/5.0",
    "-i", streamUrl,
  ];

  const hlsFlags = [
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "12",
    "-hls_flags",
    "delete_segments+append_list+omit_endlist+independent_segments",
    "-hls_segment_filename",
    path.join(HLS_DIR, `${channelId}_%03d.ts`),
    m3u8Path,
  ];

  const args =
    mode === "copy"
      ? [...baseFlags, "-c", "copy", ...hlsFlags]
      : [
          ...baseFlags,
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

          ...hlsFlags,
        ];

  const ffmpeg = spawn("ffmpeg", args);

  ffmpeg.stderr.on("data", (d) =>
    console.log(`[FFMPEG ${channelId}] ${d}`)
  );

  ffmpeg.on("close", () => delete streams[channelId]);

  streams[channelId] = ffmpeg;
}

// =============================
// STOP STREAM
// =============================
function scheduleStop(channelId) {
  if (stopTimers[channelId]) clearTimeout(stopTimers[channelId]);

  stopTimers[channelId] = setTimeout(() => {
    if ((viewers[channelId] || 0) === 0) {
      console.log(`🛑 Stopping ${channelId}`);
      streams[channelId]?.kill();
      delete streams[channelId];
    }
  }, 30000);
}

// =============================
// SERVER
// =============================
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ✅ Channel progress
  if (url.pathname === "/progress") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ channels: channelsProgress, ready: channelsReady }));
  }

  // ✅ Channels API
  if (url.pathname === "/api/channels/all") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      channels: allChannelsCache,
      total: allChannelsCache.length,
      ready: channelsReady
    }));
  }

  // ✅ WATCH
  if (url.pathname.startsWith("/watch/")) {
    const id = url.pathname.split("/")[2];
    const force = url.searchParams.get("forceTranscode");

    viewers[id] = (viewers[id] || 0) + 1;

    startStream(id, !!force);

    res.writeHead(200);
    return res.end("OK");
  }

  // ✅ LEAVE
  if (url.pathname.startsWith("/leave/")) {
    const id = url.pathname.split("/")[2];

    viewers[id] = Math.max(0, (viewers[id] || 1) - 1);
    scheduleStop(id);

    res.writeHead(200);
    return res.end("OK");
  }

  // ✅ HLS
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