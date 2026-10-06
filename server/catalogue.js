// Channel / radio / movie / series catalogues.
//
// Each catalogue is saved to server/cache/<kind>.json once fully loaded, and read
// back on startup so a restart serves the full list immediately. Refreshes run in
// the background and only replace the served list once the new one is complete,
// so visitors only ever see a partial list on the very first run.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const portal = require("./portal");

const CACHE_DIR = path.join(__dirname, "cache");
// Identifies the portal account a cache came from (a hash, so the MAC isn't stored).
// Switching to a different portal or MAC makes old caches be ignored automatically.
const PORTAL_FINGERPRINT = crypto
  .createHash("sha256")
  .update(`${portal.PORTAL_URL}|${(process.env.IPTV_MAC || "").toUpperCase()}`)
  .digest("hex")
  .slice(0, 16);
const REFRESH_HOURS = Number(process.env.CATALOGUE_REFRESH_HOURS) || 6;

const VOD_LIST_PARAMS = {
  category: "*", sortby: "added", fav: "0", hd: "0", not_ended: "0",
  movie_id: "0", season_id: "0", episode_id: "0",
};

const SOURCES = {
  channels: {
    list: { type: "itv", action: "get_ordered_list", genre: "*", sortby: "number", fav: "0", hd: "0" },
    categories: { type: "itv", action: "get_genres" },
    delayMs: 200,
  },
  radio: {
    list: { type: "radio", action: "get_ordered_list", all: "0" },
  },
  vod: {
    list: { type: "vod", action: "get_ordered_list", ...VOD_LIST_PARAMS },
    categories: { type: "vod", action: "get_categories" },
  },
  series: {
    list: { type: "series", action: "get_ordered_list", ...VOD_LIST_PARAMS },
    categories: { type: "series", action: "get_categories" },
  },
};

const KINDS = Object.keys(SOURCES);

const catalogue = Object.fromEntries(
  KINDS.map((kind) => [kind, {
    items: [],
    categories: [],
    ready: false,      // a complete list is being served
    loading: false,    // a (re)load is in progress
    loaded: 0,         // progress of the current load
    total: 0,
    updatedAt: null,
  }])
);

function cachePath(kind) {
  return path.join(CACHE_DIR, `${kind}.json`);
}

function loadFromDisk(kind) {
  try {
    const saved = JSON.parse(fs.readFileSync(cachePath(kind), "utf8"));
    if (!Array.isArray(saved.items) || saved.items.length === 0) return;
    if (saved.portal !== PORTAL_FINGERPRINT) {
      console.log(`💾 ${kind}: cache is from a different portal (or an older version), downloading fresh`);
      return;
    }
    Object.assign(catalogue[kind], {
      items: saved.items,
      categories: saved.categories || [],
      updatedAt: saved.updatedAt || null,
      ready: true,
    });
    console.log(`💾 ${kind}: ${saved.items.length.toLocaleString()} items from disk cache`);
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`⚠️ Could not read ${kind} cache: ${err.message}`);
  }
}

async function saveToDisk(kind) {
  const { items, categories, updatedAt } = catalogue[kind];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Write then rename, so a crash mid-write never leaves a corrupt cache
  const tmp = `${cachePath(kind)}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify({ portal: PORTAL_FINGERPRINT, items, categories, updatedAt }));
  await fs.promises.rename(tmp, cachePath(kind));
}

async function refresh(kind) {
  const entry = catalogue[kind];
  const source = SOURCES[kind];
  if (entry.loading) return;

  const firstRun = entry.items.length === 0;
  entry.loading = true;
  entry.loaded = 0;
  console.log(`📡 ${firstRun ? "Loading" : "Refreshing"} ${kind}...`);

  try {
    let categories = entry.categories;
    if (source.categories) {
      const data = await portal.portalGet(source.categories);
      categories = Array.isArray(data?.js) ? data.js : [];
    }

    const items = await portal.fetchAllPages(source.list, {
      delayMs: source.delayMs ?? 100,
      onPage: (all, total) => {
        entry.loaded = all.length;
        entry.total = total;
        // With nothing to show yet, serve the list as it grows
        if (firstRun) {
          entry.items = all;
          entry.categories = categories;
        }
      },
    });

    // A portal hiccup can return a short list; don't replace a good one with it
    if (!firstRun && items.length < entry.items.length * 0.5) {
      console.warn(`⚠️ ${kind} refresh returned ${items.length} items (had ${entry.items.length}); keeping the old list`);
      return;
    }

    Object.assign(entry, { items, categories, ready: true, updatedAt: Date.now() });
    await saveToDisk(kind);
    console.log(`✅ ${kind}: ${items.length.toLocaleString()} items`);
  } catch (err) {
    console.error(`❌ Failed to load ${kind}: ${err.message}`);
    if (firstRun) setTimeout(() => refresh(kind), 60000);
  } finally {
    entry.loading = false;
  }
}

async function refreshAll() {
  // One at a time, so the portal isn't hit with parallel crawls
  for (const kind of KINDS) await refresh(kind);
}

function start() {
  KINDS.forEach(loadFromDisk);
  refreshAll();
  setInterval(refreshAll, REFRESH_HOURS * 60 * 60 * 1000);
}

function status() {
  return Object.fromEntries(
    KINDS.map((kind) => {
      const e = catalogue[kind];
      return [kind, {
        count: e.items.length,
        ready: e.ready,
        loading: e.loading,
        loaded: e.loaded,
        total: e.total,
        updatedAt: e.updatedAt,
      }];
    })
  );
}

module.exports = { catalogue, start, status };
