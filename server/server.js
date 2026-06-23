const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// ✅ KEEP YOUR PORT (change if needed)
const PORT = 3477;

const HLS_DIR = path.join(__dirname, "hls");

const MAC = "00:1A:79:55:16:06";
const PREHASH = "9c42ac937c6bc42ba21b45b853bfc020b013f8f6";
const COOKIE = "mac=00%3A1A%3A79%3A55%3A16%3A06; stb_lang=en; timezone=Africa%2FNairobi; adid=13390b63b1ae7032187e40a96e160ee4";

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

// ✅ GLOBAL CACHE
let channelsCache = [];
let cacheReady = false;
let cacheProgress = { loaded: 0, total: 0, percent: 0 };

// ✅ STREAMING STATE
const streams = {};
const viewers = {};
const stopTimers = {};
const healthChecks = {};
const reencodeAttempts = {};
const restartCount = {};

// =============================
// CLEANUP HLS FILES
// =============================
function cleanupHLSFiles(channelId) {
  try {
    const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
    if (fs.existsSync(m3u8Path)) {
      fs.unlinkSync(m3u8Path);
      console.log(`🧹 Cleaned up ${channelId}.m3u8`);
    }
    const files = fs.readdirSync(HLS_DIR);
    const segmentPattern = new RegExp(`^${channelId}_\\d+\\.ts$`);
    files.forEach(file => {
      if (segmentPattern.test(file)) {
        const filePath = path.join(HLS_DIR, file);
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up ${file}`);
      }
    });
  } catch (err) {
    console.error(`❌ Cleanup error for ${channelId}: ${err.message}`);
  }
}

// =============================
// IPTV API
// =============================

async function getToken() {
  try {
    const res = await fetch(
      `http://seatv.xyz/portalott.php?type=stb&action=handshake&token=&prehash=${PREHASH}&JsHttpRequest=1-xml`,
      {
        headers: {
          Cookie: COOKIE,
          "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Handshake failed with status ${res.status}`);
    }

    const data = await res.json();
    const token = data?.js?.token;
    if (!token) {
      throw new Error("No token received from handshake");
    }
    return token;
  } catch (err) {
    console.error(`❌ getToken failed: ${err.message}`);
    throw err;
  }
}

async function fetchChannels(page = 0) {
  try {
    const token = await getToken();
    if (!token) {
      throw new Error("No token available for fetching channels");
    }

    const url = `http://seatv.xyz/portalott.php?type=itv&action=get_ordered_list&genre=*&force_ch_link_check=&fav=0&sortby=number&hd=0&p=${page}&JsHttpRequest=1-xml&from_ch_id=0`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: COOKIE,
        Referer: "http://seatv.xyz/c/",
        "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
        "X-User-Agent": "Model: MAG250; Link: WiFi",
      },
    });

    if (!res.ok) {
      throw new Error(`fetchChannels failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`❌ fetchChannels page ${page} failed: ${err.message}`);
    throw err;
  }
}

async function getStreamLink(channelId) {
  console.log(`🔗 Using direct URL for ${channelId}`);
  return { 
    url: `http://seatv.xyz/MAGL2ELNMB/MAG42M41CA/${channelId}`, 
    needsAuth: true, 
    token: null
  };
}

// =============================
// EPG DATA FETCH
// =============================
async function fetchEpgData() {
  try {
    const token = await getToken();
    if (!token) throw new Error("No token");

    const url = `http://seatv.xyz/portalott.php?type=itv&action=get_epg_info&period=5&JsHttpRequest=1-xml`;
    
    console.log(`📡 Fetching EPG from: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        Cookie: COOKIE,
        Authorization: `Bearer ${token}`,
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
        Referer: "http://seatv.xyz/c/",
        "X-User-Agent": "Model: MAG250; Link: WiFi",
      },
    });

    const text = await res.text();
    console.log(`📡 EPG response status: ${res.status}, length: ${text.length}`);
    
    if (!text || text.trim() === '') {
      console.warn(`⚠️ EPG returned empty response (status ${res.status})`);
      return null;
    }
    
    try {
      const parsed = JSON.parse(text);
      console.log(`📡 EPG parsed successfully`);
      
      // Check if EPG data is actually empty
      const channels = parsed?.js?.data || {};
      console.log(`📡 EPG contains data for ${Object.keys(channels).length} channels`);
      
      return parsed;
    } catch (parseErr) {
      console.error(`❌ Failed to parse EPG JSON: ${parseErr.message}`);
      console.error(`   First 500 chars: ${text.substring(0, 500)}`);
      return null;
    }
  } catch (err) {
    console.error(`❌ EPG fetch failed: ${err.message}`);
    return null;
  }
}

// =============================
// LOAD CHANNELS
// =============================
async function loadAllChannels() {
  console.log("📡 Loading channels...");

  let all = [];

  try {
    const first = await fetchChannels(0);

    const totalItems = first?.js?.total_items || 0;
    const perPage = 14;
    const totalPages = Math.ceil(totalItems / perPage);

    if (first?.js?.data) {
      all.push(...first.js.data);
      channelsCache = [...all];
    }

    for (let p = 1; p < totalPages; p++) {
      try {
        const data = await fetchChannels(p);

        if (data?.js?.data) {
          all.push(...data.js.data);
          channelsCache = [...all];
        }
      } catch (err) {
        console.log(`❌ failed page ${p}: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    cacheReady = true;
    fs.writeFileSync("channels.json", JSON.stringify(all));

    console.log(`✅ Loaded ${all.length} channels`);
  } catch (err) {
    console.error(`❌ Failed to load channels: ${err.message}`);
    console.log("⏳ Will retry in 30 seconds...");
    setTimeout(loadAllChannels, 30000);
  }
}

loadAllChannels();

function getFFmpegArgs(streamUrl, channelId, useReencode = false, needsAuth = true, token = null) {
  const m3u8Path = path.join(HLS_DIR, `${channelId}.m3u8`);
  const baseArgs = [
    "-analyzeduration", "5000000",
    "-probesize", "5000000",
    "-fflags", "+genpts+discardcorrupt+igndts",
    "-flags", "low_delay",
    "-max_delay", "1000000",
  ];

  if (needsAuth) {
    let headers =
      `User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C)\r\n` +
      `X-User-Agent: Model: MAG250; Link: WiFi\r\n` +
      `Referer: http://seatv.xyz/c/\r\n` +
      `Accept: */*\r\n` +
      `Cookie: ${COOKIE}\r\n`;
    if (token) {
      headers += `Authorization: Bearer ${token}\r\n`;
    }
    baseArgs.push("-headers", headers);
  }

  baseArgs.push(
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "2",
    "-reconnect_at_eof", "1",
    "-reconnect_on_network_error", "1",
    "-timeout", "15000000",
    "-rw_timeout", "15000000",
    "-err_detect", "ignore_err",
    "-correct_ts_overflow", "1",
    "-vsync", "drop",
    "-copytb", "0",
    "-multiple_requests", "1",
    "-i", streamUrl,
  );

  if (useReencode) {
    baseArgs.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-crf", "23",
      "-g", "48",
      "-sc_threshold", "0",
      "-c:a", "aac",
      "-b:a", "96k",
      "-ac", "2"
    );
  } else {
    baseArgs.push(
      "-c:v", "copy",
      "-c:a", "copy"
    );
  }

  baseArgs.push(
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "15",
    "-hls_flags", "delete_segments+append_list+omit_endlist",
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename",
    path.join(HLS_DIR, `${channelId}_%05d.ts`),
    "-force_key_frames", "expr:gte(t,n_forced*4)",
    m3u8Path
  );

  return baseArgs;
}

async function startStream(channelId, forceReencode = false) {
  if (streams[channelId]) {
    if (streams[channelId] instanceof Promise) {
      console.log(`⏳ Stream ${channelId} is initializing, waiting...`);
      await streams[channelId];
    }
    return;
  }

  if (!forceReencode) {
    reencodeAttempts[channelId] = 0;
  }

  console.log(`🚀 Starting stream ${channelId}${forceReencode ? ' (re-encode mode)' : ' (copy mode)'}`);

  const initPromise = (async () => {
    try {
      const streamInfo = await getStreamLink(channelId);

      if (!streamInfo || !streamInfo.url) {
        console.log(`❌ No stream URL for ${channelId}`);
        delete streams[channelId];
        return;
      }

      console.log(`🔗 INPUT: ${streamInfo.url}`);
      if (streamInfo.needsAuth) {
        console.log(`🔐 Using authentication headers for ${channelId}`);
      }

      const args = getFFmpegArgs(streamInfo.url, channelId, forceReencode, streamInfo.needsAuth, streamInfo.token);
      console.log("FFMPEG ARGS:", args.join(" "));
      const ffmpeg = spawn("ffmpeg", args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let lastOutput = Date.now();
      let streamStarted = false;
      let errorCount = 0;
      let hevcDetected = false;

      ffmpeg.stderr.on("data", (d) => {
        const logMessage = d.toString();
        lastOutput = Date.now();
        if (logMessage.includes("ffmpeg version") ||
            logMessage.includes("built with") ||
            logMessage.includes("configuration:") ||
            logMessage.includes("Copyright") ||
            (logMessage.includes("libav") && logMessage.includes("/"))) {
          return;
        }
        if (logMessage.includes("Video: hevc") && !forceReencode && !hevcDetected) {
          hevcDetected = true;
          console.log(`🔧 HEVC detected for ${channelId}, switching to re-encode mode...`);
          ffmpeg.kill("SIGTERM");
          cleanupHLSFiles(channelId);
          delete streams[channelId];
          clearInterval(healthCheck);
          setTimeout(() => startStream(channelId, true), 1000);
          return;
        }
        if (logMessage.includes("Opening") || logMessage.includes("Starting") || logMessage.includes("Input #")) {
          streamStarted = true;
        }
        if (logMessage.includes("speed=")) {
          const speedMatch = logMessage.match(/speed=\s*(\d+\.?\d*)x/);
          if (speedMatch) {
            const speed = parseFloat(speedMatch[1]);
            if (speed < 0.5) {
              console.warn(`⚠️ ${channelId} encoding too slow: ${speed}x`);
            }
          }
        }
        if (logMessage.includes("HTTP error") || 
            logMessage.includes("Connection refused") ||
            logMessage.includes("No route to host") ||
            logMessage.includes("403 Forbidden") ||
            logMessage.includes("404 Not Found") ||
            logMessage.includes("401 Unauthorized") ||
            logMessage.includes("406 Not Acceptable") ||
            logMessage.includes("Invalid data found")) {
          console.error(`❌ ${channelId} stream error: ${logMessage.trim()}`);
          errorCount++;
        }
        if (logMessage.includes("Stream #") || logMessage.includes("Duration:")) {
          const sanitized = logMessage.replace(/Cookie:.*?\r\n/g, 'Cookie: [REDACTED]\r\n');
          console.log(`[ffmpeg ${channelId}] ${sanitized.trim()}`);
        }
      });

      const healthCheck = setInterval(() => {
        const timeSinceLastOutput = Date.now() - lastOutput;
        if (timeSinceLastOutput > 15000) {
          console.warn(`⚠️ ${channelId} stream stalled (${timeSinceLastOutput}ms no output), restarting...`);
          ffmpeg.kill("SIGTERM");
          cleanupHLSFiles(channelId);
          delete streams[channelId];
          clearInterval(healthCheck);
          restartCount[channelId] = 0;
          if (!forceReencode && reencodeAttempts[channelId] < 2) {
            reencodeAttempts[channelId] = (reencodeAttempts[channelId] || 0) + 1;
            setTimeout(() => startStream(channelId, true), 2000);
          } else if (viewers[channelId] > 0) {
            setTimeout(() => startStream(channelId, forceReencode), 2000);
          }
        }
        if (!streamStarted && timeSinceLastOutput > 10000) {
          console.warn(`⚠️ ${channelId} stream failed to start, trying re-encode...`);
          ffmpeg.kill("SIGTERM");
          cleanupHLSFiles(channelId);
          delete streams[channelId];
          clearInterval(healthCheck);
          restartCount[channelId] = 0;
          if (!forceReencode) {
            setTimeout(() => startStream(channelId, true), 2000);
          }
        }
        if (errorCount > 10 && !forceReencode) {
          console.warn(`⚠️ ${channelId} too many errors, switching to re-encode mode...`);
          ffmpeg.kill("SIGTERM");
          cleanupHLSFiles(channelId);
          delete streams[channelId];
          clearInterval(healthCheck);
          restartCount[channelId] = 0;
          setTimeout(() => startStream(channelId, true), 2000);
        }
      }, 5000);

      ffmpeg.on("close", (code) => {
        console.log(`❌ ffmpeg ${channelId} exited (${code})`);
        clearInterval(healthCheck);
        cleanupHLSFiles(channelId);
        delete streams[channelId];
        if (stopTimers[channelId]) {
          clearTimeout(stopTimers[channelId]);
          delete stopTimers[channelId];
        }
        restartCount[channelId] = (restartCount[channelId] || 0) + 1;
        if (viewers[channelId] > 0 && restartCount[channelId] < 3) {
          console.log(`🔄 Auto-restarting ${channelId} (attempt ${restartCount[channelId]}/3)...`);
          setTimeout(() => startStream(channelId, forceReencode), 3000);
        } else if (restartCount[channelId] >= 3) {
          console.log(`🛑 ${channelId} failed 3 times, stopping auto-restart`);
          delete viewers[channelId];
          delete restartCount[channelId];
          delete reencodeAttempts[channelId];
        }
      });

      ffmpeg.on("error", (err) => {
        console.error(`❌ ffmpeg error for ${channelId}: ${err.message}`);
        clearInterval(healthCheck);
        cleanupHLSFiles(channelId);
        delete streams[channelId];
        if (stopTimers[channelId]) {
          clearTimeout(stopTimers[channelId]);
          delete stopTimers[channelId];
        }
        restartCount[channelId] = (restartCount[channelId] || 0) + 1;
        if (!forceReencode && viewers[channelId] > 0 && restartCount[channelId] < 3) {
          console.log(`🔄 Auto-restarting ${channelId} with re-encode (attempt ${restartCount[channelId]}/3)...`);
          setTimeout(() => startStream(channelId, true), 3000);
        } else if (restartCount[channelId] >= 3) {
          console.log(`🛑 ${channelId} failed 3 times, stopping auto-restart`);
          delete viewers[channelId];
          delete restartCount[channelId];
          delete reencodeAttempts[channelId];
        }
      });

      streams[channelId] = ffmpeg;
      healthChecks[channelId] = healthCheck;
      console.log(`✅ Stream ${channelId} started successfully (${forceReencode ? 're-encode' : 'copy'} mode)`);
      restartCount[channelId] = 0;
    } catch (err) {
      console.error(`❌ Failed to start stream ${channelId}: ${err.message}`);
      delete streams[channelId];
    }
  })();

  streams[channelId] = initPromise;
  await initPromise;
}

function scheduleStop(channelId) {
  if (stopTimers[channelId]) clearTimeout(stopTimers[channelId]);

  stopTimers[channelId] = setTimeout(() => {
    if ((viewers[channelId] || 0) === 0) {
      console.log(`🛑 Stopping ${channelId}`);
      if (streams[channelId]) {
        if (healthChecks[channelId]) {
          clearInterval(healthChecks[channelId]);
          delete healthChecks[channelId];
        }
        
        if (!(streams[channelId] instanceof Promise)) {
          streams[channelId].kill("SIGTERM");
        }
        delete streams[channelId];
        delete reencodeAttempts[channelId];
        delete restartCount[channelId];
      }
      cleanupHLSFiles(channelId);
    }
  }, 30000);
}

// =============================
// SERVER WITH ALL ENDPOINTS
// =============================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // =============================
  // DEBUG ENDPOINTS
  // =============================

  if (url.pathname.startsWith("/debug/stream-url/")) {
    const id = url.pathname.split("/")[3];
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Channel ID required" }));
    }
    try {
      const streamInfo = await getStreamLink(id);
      return res.end(JSON.stringify({
        channelId: id,
        url: streamInfo?.url,
        needsAuth: streamInfo?.needsAuth,
        hasToken: !!streamInfo?.token,
        success: !!streamInfo?.url
      }));
    } catch (err) {
      return res.end(JSON.stringify({
        channelId: id,
        error: err.message,
        success: false
      }));
    }
  }

  if (url.pathname.startsWith("/debug/test-stream/")) {
    const id = url.pathname.split("/")[3];
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Channel ID required" }));
    }
    
    res.writeHead(200, { 
      "Content-Type": "text/plain",
      "Transfer-Encoding": "chunked" 
    });
    
    res.write(`🔍 Testing stream for channel ${id}...\n\n`);
    
    try {
      const streamInfo = await getStreamLink(id);
      const streamUrl = streamInfo?.url;
      res.write(`📡 Stream URL: ${streamUrl}\n`);
      res.write(`   Needs Auth: ${streamInfo?.needsAuth ? 'Yes' : 'No'}\n\n`);
      
      const urlsToTest = [
        { label: "Direct URL", url: streamUrl },
        { label: "Port 80", url: `http://seatv.xyz:80/MAGL2ELNMB/MAG42M41CA/${id}` },
      ];
      
      for (const test of urlsToTest) {
        if (!test.url) continue;
        
        res.write(`\n📡 Testing: ${test.label}\n`);
        res.write(`   URL: ${test.url}\n`);
        
        try {
          const headers = {
            "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
            "X-User-Agent": "Model: MAG250; Link: WiFi",
            "Referer": "http://seatv.xyz/c/",
            "Accept": "*/*",
            "Cookie": COOKIE,
          };
          
          const testRes = await fetch(test.url, {
            method: 'GET',
            headers: headers,
            signal: AbortSignal.timeout(5000),
            redirect: 'follow'
          });
          
          res.write(`   Status: ${testRes.status} ${testRes.statusText}\n`);
          res.write(`   Content-Type: ${testRes.headers.get('content-type')}\n`);
          
          if (testRes.ok) {
            res.write(`   ✅ Stream appears valid!\n`);
          } else {
            res.write(`   ❌ Failed\n`);
          }
        } catch (err) {
          res.write(`   ❌ Error: ${err.message}\n`);
        }
      }
      
      res.end();
    } catch (err) {
      res.write(`❌ Error: ${err.message}\n`);
      res.end();
    }
    
    return;
  }

  if (url.pathname.startsWith("/debug/restart-stream/")) {
    const id = url.pathname.split("/")[3];
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Channel ID required" }));
    }
    
    if (streams[id] && !(streams[id] instanceof Promise)) {
      streams[id].kill("SIGTERM");
    }
    if (healthChecks[id]) {
      clearInterval(healthChecks[id]);
      delete healthChecks[id];
    }
    
    cleanupHLSFiles(id);
    delete streams[id];
    delete reencodeAttempts[id];
    delete restartCount[id];
    
    startStream(id, true);
    
    return res.end(JSON.stringify({ 
      ok: true, 
      message: `Stream ${id} restarted with re-encode mode`,
      viewers: viewers[id] || 0
    }));
  }

  if (url.pathname === "/debug/streams") {
    const streamStatus = {};
    
    Object.keys(streams).forEach(id => {
      const stream = streams[id];
      streamStatus[id] = {
        type: stream instanceof Promise ? "initializing" : "active",
        pid: stream instanceof Promise ? null : stream.pid,
        viewers: viewers[id] || 0,
        reencodeAttempts: reencodeAttempts[id] || 0,
        restartCount: restartCount[id] || 0,
        hasHealthCheck: !!healthChecks[id]
      };
    });
    
    if (fs.existsSync(HLS_DIR)) {
      const files = fs.readdirSync(HLS_DIR);
      const m3u8Files = files.filter(f => f.endsWith('.m3u8'));
      m3u8Files.forEach(f => {
        const id = f.replace('.m3u8', '');
        if (!streamStatus[id]) {
          streamStatus[id] = {
            type: "orphaned_files",
            pid: null,
            viewers: 0,
            reencodeAttempts: 0,
            restartCount: 0,
            hasHealthCheck: false
          };
        }
      });
    }
    
    return res.end(JSON.stringify(streamStatus, null, 2));
  }

  // =============================
  // REGULAR ENDPOINTS
  // =============================

  if (url.pathname === "/health") {
    return res.end(JSON.stringify({
      status: "ok",
      cacheReady,
      activeStreams: Object.keys(streams).filter(id => !(streams[id] instanceof Promise)).length,
      initializingStreams: Object.keys(streams).filter(id => streams[id] instanceof Promise).length,
      totalViewers: Object.values(viewers).reduce((a, b) => a + b, 0),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));
  }

  if (url.pathname === "/api/channels-all") {
    return res.end(JSON.stringify({
      channels: channelsCache,
      total: channelsCache.length,
      ready: cacheReady,
    }));
  }

  // ✅ EPG DATA ENDPOINT
  if (url.pathname === "/api/epg") {
    try {
      const epgData = await fetchEpgData();
      if (!epgData) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: "Failed to fetch EPG data" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(epgData));
    } catch (err) {
      console.error(`❌ EPG endpoint error: ${err.message}`);
      res.writeHead(500);
      return res.end(JSON.stringify({ error: "Failed to fetch EPG" }));
    }
  }

  if (url.pathname.startsWith("/api/stream-status/")) {
    const id = url.pathname.split("/")[3];
    const stream = streams[id];
    return res.end(JSON.stringify({
      channelId: id,
      active: !!stream && !(stream instanceof Promise),
      initializing: stream instanceof Promise,
      viewers: viewers[id] || 0,
      reencodeAttempts: reencodeAttempts[id] || 0,
      restartCount: restartCount[id] || 0
    }));
  }

  if (url.pathname.startsWith("/watch/")) {
    const id = url.pathname.split("/")[2];
    if (!id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Channel ID required" }));
    }
    
    viewers[id] = (viewers[id] || 0) + 1;
    console.log(`👁️ ${id}: ${viewers[id]} viewer(s)`);
    
    startStream(id).catch(err => {
      console.error(`Failed to start stream for viewer: ${err.message}`);
    });
    
    return res.end(JSON.stringify({ ok: true, viewers: viewers[id] }));
  }

  if (url.pathname.startsWith("/leave/")) {
    const id = url.pathname.split("/")[2];
    if (!id) {
      res.writeHead(400);
      return res.end("Channel ID required");
    }
    
    viewers[id] = Math.max(0, (viewers[id] || 0) - 1);
    console.log(`👁️ ${id}: ${viewers[id]} viewer(s)`);
    
    scheduleStop(id);
    return res.end(JSON.stringify({ ok: true, viewers: viewers[id] }));
  }

  if (url.pathname.startsWith("/hls/")) {
    const file = url.pathname.replace("/hls/", "");
    const filePath = path.join(HLS_DIR, file);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end("not found");
    }

    const ext = path.extname(file);
    const type = ext === ".m3u8" 
      ? "application/vnd.apple.mpegurl" 
      : "video/mp2t";

    res.writeHead(200, { 
      "Content-Type": type,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*"
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});

// ✅ Cleanup on server shutdown
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  Object.keys(stopTimers).forEach(id => {
    clearTimeout(stopTimers[id]);
    delete stopTimers[id];
  });
  
  Object.keys(healthChecks).forEach(id => {
    clearInterval(healthChecks[id]);
    delete healthChecks[id];
  });
  
  Object.keys(streams).forEach(channelId => {
    const stream = streams[channelId];
    if (stream && !(stream instanceof Promise)) {
      console.log(`🛑 Killing stream ${channelId}`);
      stream.kill("SIGTERM");
      cleanupHLSFiles(channelId);
    }
    delete streams[channelId];
  });
  
  Object.keys(viewers).forEach(id => delete viewers[id]);
  Object.keys(restartCount).forEach(id => delete restartCount[id]);
  Object.keys(reencodeAttempts).forEach(id => delete reencodeAttempts[id]);
  
  server.close(() => {
    console.log("👋 Server closed");
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});