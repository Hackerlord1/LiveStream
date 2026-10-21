// Channel / radio / movie / series catalogues.
//
// Channels, movies and series come from the Xtream API in one request each (about a
// minute for everything), mapped to the portal's item format the rest of the server
// uses. If the Xtream API fails, the portal's paged lists are crawled instead (14 items
// per request: hours). Radio only exists on the portal.
//
// Each catalogue is saved to server/cache/<kind>.json after a load, and read back
// on startup so a restart serves the list immediately. A list only counts as
// complete once it has (nearly) every item the portal says it has; incomplete
// catalogues are loaded again shortly instead of waiting for the next refresh.
// Refreshes run in the background and only replace the served list with one that
// is complete or bigger, so visitors only see a growing list on the very first run.

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
// A list within this share of the portal's total_items counts as complete
const COMPLETE_RATIO = 0.98;
// Incomplete catalogues are loaded again after this pause, up to this many times per cycle
const INCOMPLETE_RETRY_MINUTES = 15;
const INCOMPLETE_RETRY_ROUNDS = 4;

const VOD_LIST_PARAMS = {
  category: "*", sortby: "added", fav: "0", hd: "0", not_ended: "0",
  movie_id: "0", season_id: "0", episode_id: "0",
};

const HD_RE = /\b(?:HD|FHD|UHD|4K)\b/i;

/** Last year-like number in a title, e.g. "FR - Matchbox – Le film - 2026" → "2026". */
function yearFromName(name) {
  const years = String(name || "").match(/\b(?:19|20)\d{2}\b/g);
  return years ? years[years.length - 1] : "";
}

// Xtream categories → the portal's genre/category format, with the portal's "All" entry
function mapCategories(list) {
  return [
    { id: "*", title: "All" },
    ...(Array.isArray(list) ? list : []).map((c) => ({ id: String(c.category_id), title: c.category_name })),
  ];
}

// Xtream items → the portal's item format (same ids, so playback through the portal still works)
const fromXtream = {
  channels: (s) => ({
    id: String(s.stream_id),
    name: s.name,
    number: String(s.num ?? ""),
    logo: s.stream_icon || "",
    tv_genre_id: String(s.category_id ?? ""),
    hd: HD_RE.test(s.name) ? "1" : "0",
    // Only third-party direct streams need their own URL; portal channels get a fresh link
    cmd: s.direct_source ? `ffmpeg ${s.direct_source}` : "",
  }),
  vod: (s) => ({
    id: Number(s.stream_id),
    name: s.name,
    o_name: s.name,
    screenshot_uri: s.stream_icon || "",
    rating_imdb: s.rating || "",
    rating_kinopoisk: s.rating || "",
    year: yearFromName(s.name),
    category_id: String(s.category_id ?? ""),
    hd: HD_RE.test(s.name) ? 1 : 0,
    added: s.added,
    // The portal's play command for a movie: base64 JSON naming the stream
    cmd: Buffer.from(JSON.stringify({
      type: "movie",
      stream_id: Number(s.stream_id),
      stream_source: null,
      target_container: JSON.stringify([s.container_extension || "mp4"]),
    })).toString("base64"),
  }),
  series: (s) => ({
    id: Number(s.series_id),
    name: s.name,
    o_name: s.name,
    screenshot_uri: s.cover || "",
    description: s.plot || "",
    actors: s.cast || "",
    director: s.director || "",
    genres_str: s.genre || "",
    year: s.releaseDate || yearFromName(s.name),
    rating_imdb: s.rating || "",
    rating_kinopoisk: s.rating || "",
    category_id: String(s.category_id ?? ""),
    added: s.last_modified,
  }),
};

const SOURCES = {
  channels: {
    list: { type: "itv", action: "get_ordered_list", genre: "*", sortby: "number", fav: "0", hd: "0" },
    categories: { type: "itv", action: "get_genres" },
    xtream: { list: "get_live_streams", categories: "get_live_categories", sort: (a, b) => Number(a.number) - Number(b.number) },
    delayMs: 200,
  },
  radio: {
    list: { type: "radio", action: "get_ordered_list", all: "0" },
    // The portal has answered the radio list with its TV channels (thousands of them);
    // drop anything that is also a TV channel (same id and name)
    filter: (items) => {
      const tv = new Map(catalogue.channels.items.map((ch) => [String(ch.id), ch.name]));
      return items.filter((item) => tv.get(String(item.id)) !== item.name);
    },
  },
  vod: {
    list: { type: "vod", action: "get_ordered_list", ...VOD_LIST_PARAMS },
    categories: { type: "vod", action: "get_categories" },
    // Newest first, like the portal's sortby=added
    xtream: { list: "get_vod_streams", categories: "get_vod_categories", sort: (a, b) => Number(b.added) - Number(a.added) },
  },
  series: {
    list: { type: "series", action: "get_ordered_list", ...VOD_LIST_PARAMS },
    categories: { type: "series", action: "get_categories" },
    xtream: { list: "get_series", categories: "get_series_categories", sort: (a, b) => Number(b.added) - Number(a.added) },
  },
};

const KINDS = Object.keys(SOURCES);

const catalogue = Object.fromEntries(
  KINDS.map((kind) => [kind, {
    items: [],
    categories: [],
    ready: false,      // a list is being served
    complete: false,   // the served list has (nearly) every item the portal lists
    loading: false,    // a (re)load is in progress
    loaded: 0,         // progress of the current load
    total: 0,
    updatedAt: null,
    lastLoad: null,    // how the latest load went: timing, missing pages, why pages failed
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
    const items = SOURCES[kind].filter ? SOURCES[kind].filter(saved.items) : saved.items;
    if (items.length < saved.items.length) {
      console.log(`💾 ${kind}: dropped ${(saved.items.length - items.length).toLocaleString()} cached items that are TV channels`);
    }
    Object.assign(catalogue[kind], {
      items,
      categories: saved.categories || [],
      updatedAt: saved.updatedAt || null,
      total: saved.total || 0,
      // Older caches didn't record this; treat them as incomplete so they get topped up
      complete: saved.complete === true && items.length === saved.items.length,
      ready: true,
    });
    console.log(`💾 ${kind}: ${items.length.toLocaleString()} items from disk cache${catalogue[kind].complete ? "" : " (incomplete)"}`);
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`⚠️ Could not read ${kind} cache: ${err.message}`);
  }
}

async function saveToDisk(kind) {
  const { items, categories, updatedAt, total, complete } = catalogue[kind];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Write then rename, so a crash mid-write never leaves a corrupt cache
  const tmp = `${cachePath(kind)}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify({ portal: PORTAL_FINGERPRINT, items, categories, updatedAt, total, complete }));
  // On Windows the rename fails (EPERM/EBUSY/EACCES) while something briefly holds the old
  // file open, e.g. antivirus scanning a large cache it just saw written: try again shortly
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.promises.rename(tmp, cachePath(kind));
      return;
    } catch (err) {
      if (attempt >= 10 || !["EPERM", "EBUSY", "EACCES"].includes(err.code)) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

/**
 * The whole list in one Xtream request. `listed` is the portal's own count (one cheap
 * page request), so a short Xtream answer still shows up as incomplete.
 */
async function loadFromXtream(kind, entry) {
  const source = SOURCES[kind];
  const [list, categories] = await Promise.all([
    portal.xtreamGet(source.xtream.list),
    portal.xtreamGet(source.xtream.categories).catch(() => null),
  ]);
  if (!Array.isArray(list) || list.length === 0) throw new Error(`Xtream ${source.xtream.list} returned no items`);
  const fetched = list.map(fromXtream[kind]).sort(source.xtream.sort);
  entry.loaded = fetched.length;

  let listed = fetched.length;
  try {
    const first = await portal.portalGet({ ...source.list, p: "1" });
    listed = Number(first?.js?.total_items) || listed;
  } catch (err) {
    console.warn(`⚠️ ${kind}: couldn't get the portal's count to check against (${err.message})`);
  }
  entry.total = listed;
  return {
    fetched,
    listed,
    categories: categories ? mapCategories(categories) : entry.categories,
    missingPages: [],
    failures: [],
  };
}

/** The portal's paged list, 14 items per request (hours for the big catalogues). */
async function loadFromPortalPages(kind, entry, firstRun) {
  const source = SOURCES[kind];
  let categories = entry.categories;
  if (source.categories) {
    const data = await portal.portalGet(source.categories);
    categories = Array.isArray(data?.js) ? data.js : [];
  }

  const { items: fetched, total: listed, missingPages, failures } = await portal.fetchAllPages(source.list, {
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
  return { fetched, listed, categories, missingPages, failures };
}

async function refresh(kind) {
  const entry = catalogue[kind];
  const source = SOURCES[kind];
  if (entry.loading) return;

  const firstRun = entry.items.length === 0;
  const startedAt = Date.now();
  const timing = () => ({
    startedAt: new Date(startedAt).toISOString(),
    seconds: Math.round((Date.now() - startedAt) / 1000),
  });
  entry.loading = true;
  entry.loaded = 0;
  console.log(`📡 ${firstRun ? "Loading" : "Refreshing"} ${kind}...`);

  try {
    let loaded = null;
    let via = "portal pages";
    let xtreamError;
    if (source.xtream) {
      try {
        loaded = await loadFromXtream(kind, entry);
        via = "xtream";
      } catch (err) {
        xtreamError = err.message;
        console.warn(`⚠️ ${kind}: Xtream API failed (${err.message}); loading page by page from the portal`);
      }
    }
    loaded ??= await loadFromPortalPages(kind, entry, firstRun);
    const { fetched, listed, categories, missingPages, failures } = loaded;

    // Completeness is judged on what the portal listed; items dropped by the filter
    // (radio entries that are really TV channels) are then left out of the total too
    const complete = listed > 0 && fetched.length >= listed * COMPLETE_RATIO;
    const items = source.filter ? source.filter(fetched) : fetched;
    const total = listed - (fetched.length - items.length);
    entry.lastLoad = {
      ...timing(),
      via,
      ...(xtreamError && { xtreamError }),
      items: items.length,
      total,
      complete,
      missingPages: missingPages.length,
      ...(items.length < fetched.length && { droppedAsTvChannels: fetched.length - items.length }),
      failures,
    };

    // Mostly TV channels: the portal answered with the wrong list, so the rest can't be trusted either
    if (fetched.length - items.length > fetched.length / 2) {
      console.warn(`⚠️ ${kind}: portal answered with TV channels (${(fetched.length - items.length).toLocaleString()} of ${fetched.length.toLocaleString()}); keeping the old list`);
      entry.lastLoad.rejected = "portal answered with TV channels";
      if (firstRun) entry.items = []; // don't keep serving what the load showed so far
      return;
    }

    // Take the new list if it's complete (even if shorter: the portal's own count agrees
    // with it) or at least bigger than what's served
    const better = firstRun || complete || items.length > entry.items.length;
    if (!better) {
      console.warn(`⚠️ ${kind} refresh returned ${items.length} of ${total} items (serving ${entry.items.length}); keeping the old list`);
      return;
    }

    Object.assign(entry, { items, categories, total, complete, ready: true, updatedAt: Date.now() });
    // The new list is already served; a failed save only means the next start uses the older cache
    await saveToDisk(kind).catch((err) => console.warn(`⚠️ ${kind}: loaded, but couldn't save the cache: ${err.message}`));
    console.log(complete
      ? `✅ ${kind}: ${items.length.toLocaleString()} of ${total.toLocaleString()} items (${via}, ${timing().seconds}s)`
      : `⚠️ ${kind}: ${items.length.toLocaleString()} of ${total.toLocaleString()} items (${via}, ${missingPages.length} pages missing)`);
  } catch (err) {
    console.error(`❌ Failed to load ${kind}: ${err.message}`);
    entry.lastLoad = { ...timing(), error: err.message };
  } finally {
    entry.loading = false;
  }
}

let cycleRunning = false;

async function refreshAll() {
  // A full cycle can outlast the refresh interval; never run two at once
  if (cycleRunning) {
    console.log("⏭️ Catalogue refresh still running, skipping this cycle");
    return;
  }
  cycleRunning = true;
  try {
    // One at a time, so the portal isn't hit with parallel crawls
    for (const kind of KINDS) await refresh(kind);
    // Load incomplete catalogues again rather than waiting for the next cycle
    for (let round = 1; round <= INCOMPLETE_RETRY_ROUNDS; round++) {
      const incomplete = KINDS.filter((kind) => !catalogue[kind].complete);
      if (incomplete.length === 0) break;
      console.log(`🔁 Incomplete: ${incomplete.join(", ")}; loading again in ${INCOMPLETE_RETRY_MINUTES} min`);
      await new Promise((r) => setTimeout(r, INCOMPLETE_RETRY_MINUTES * 60000));
      for (const kind of incomplete) await refresh(kind);
    }
  } finally {
    cycleRunning = false;
  }
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
        complete: e.complete,
        loading: e.loading,
        loaded: e.loaded,
        total: e.total,
        updatedAt: e.updatedAt,
        lastLoad: e.lastLoad,
      }];
    })
  );
}

module.exports = { catalogue, start, status };
