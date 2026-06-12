const http = require("http");
const PORT = 8081;

// ============================================================
// CACHE STATE
// ============================================================
let allVodCache = [], vodCategoriesCache = [], vodReady = false;
let allSeriesCache = [], seriesCategoriesCache = [], seriesReady = false;

// ============================================================
// CONVEX FETCH WITH RETRY
// ============================================================
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

// ============================================================
// VOD LOADING
// ============================================================
async function loadAllVod() {
  console.log("🎬 ===== VOD ====="); vodReady = false;
  try {
    const catData = await fetchConvex("iptv:getVodCategories", {}); vodCategoriesCache = catData?.js?.data || [];
    const seen = new Set(); allVodCache = [];
    let p = 1, consecutiveFailures = 0;
    while (true) {
      const data = await fetchConvex("iptv:getVodList", { page: p }, 2); const movies = data?.js?.data || [];
      if (movies.length === 0) { consecutiveFailures++; if (consecutiveFailures > 10) break; await new Promise(r => setTimeout(r, 5000)); continue; }
      consecutiveFailures = 0; for (const m of movies) { if (!seen.has(String(m.id))) { seen.add(String(m.id)); allVodCache.push(m); } }
      if (p % 50 === 0) console.log(`⏳ VOD: ${allVodCache.length.toLocaleString()} movies - page ${p}`);
      p++; if ((data?.js?.total_items || 0) > 0 && allVodCache.length >= data.js.total_items) break;
      await new Promise(r => setTimeout(r, 100));
    }
    vodReady = true; console.log(`✅ VOD COMPLETE: ${allVodCache.length.toLocaleString()} movies loaded!\n`);
  } catch (e) { console.log("❌ VOD failed, retrying..."); setTimeout(loadAllVod, 60000); }
}

// ============================================================
// SERIES LOADING
// ============================================================
async function loadAllSeries() {
  console.log("📺 ===== SERIES ====="); seriesReady = false;
  try {
    const catData = await fetchConvex("iptv:getSeriesCategories", {}); seriesCategoriesCache = catData?.js?.data || [];
    const seen = new Set(); allSeriesCache = [];
    let p = 1, consecutiveFailures = 0;
    while (true) {
      const data = await fetchConvex("iptv:getSeriesList", { page: p }, 2); const series = data?.js?.data || [];
      if (series.length === 0) { consecutiveFailures++; if (consecutiveFailures > 10) break; await new Promise(r => setTimeout(r, 5000)); continue; }
      consecutiveFailures = 0; for (const s of series) { if (!seen.has(String(s.id))) { seen.add(String(s.id)); allSeriesCache.push(s); } }
      if (p % 50 === 0) console.log(`⏳ Series: ${allSeriesCache.length.toLocaleString()} - page ${p}`);
      p++; if ((data?.js?.total_items || 0) > 0 && allSeriesCache.length >= data.js.total_items) break;
      await new Promise(r => setTimeout(r, 100));
    }
    seriesReady = true; console.log(`✅ SERIES COMPLETE: ${allSeriesCache.length.toLocaleString()} series loaded!\n`);
  } catch (e) { console.log("❌ Series failed, retrying..."); setTimeout(loadAllSeries, 60000); }
}

// ============================================================
// STARTUP
// ============================================================
async function loadAll() {
  console.log("📡 ===== STARTING DATA SERVER =====");
  await loadAllVod();
  await loadAllSeries();
  console.log("🎉 ===== ALL DATA LOADED =====");
}
loadAll();

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: "ok", vod: allVodCache.length, vodReady, series: allSeriesCache.length, seriesReady })); return; }
  if (url.pathname === "/api/vod/all") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ movies: allVodCache, categories: vodCategoriesCache, total: allVodCache.length, ready: vodReady })); return; }
  if (url.pathname === "/api/series/all") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ series: allSeriesCache, categories: seriesCategoriesCache, total: allSeriesCache.length, ready: seriesReady })); return; }
  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => console.log(`🚀 Data server running at http://localhost:${PORT}`));