// Admin diagnostics: test any Stalker/MAG portal with one or many MACs.
//
// For each MAC it logs in, asks for a live stream link, reads the Xtream account behind
// that link (status, connections, expiry) and counts the catalogue (live channels, movies,
// series, radio) from each list's first page — cheap, no full lists fetched.
//
// This is standalone and never touches the running portal.js session, so testing does not
// disturb live viewers. It is only reachable through the DEBUG_TOKEN-gated endpoint, where
// full MAC addresses are intentionally shown to the admin.

const portal = require("./portal");

const USER_AGENT = portal.USER_AGENT;
const REQUEST_TIMEOUT_MS = 30000;
// Test this many MACs at once; the rest queue. Keeps a long list moving without hammering
// the portal.
const CONCURRENCY = 3;
const MAX_MACS = 200;
// Stalker/MAG MACs are six colon-separated hex pairs, e.g. 00:1A:79:AA:BB:CC
const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

// The list each count comes from — same params the catalogue uses, so counts match the app
const LIST_PARAMS = {
  channels: { type: "itv", action: "get_ordered_list", genre: "*", sortby: "number", fav: "0", hd: "0" },
  movies: { type: "vod", action: "get_ordered_list", category: "*", sortby: "added", fav: "0", hd: "0", not_ended: "0", movie_id: "0", season_id: "0", episode_id: "0" },
  series: { type: "series", action: "get_ordered_list", category: "*", sortby: "added", fav: "0", hd: "0", not_ended: "0", movie_id: "0", season_id: "0", episode_id: "0" },
  radio: { type: "radio", action: "get_ordered_list", all: "0" },
};

// Category (genre) lists per section — one request each, the whole list in one response
const CATEGORY_PARAMS = {
  channels: { type: "itv", action: "get_genres" },
  movies: { type: "vod", action: "get_categories" },
  series: { type: "series", action: "get_categories" },
};

function headers(mac, portalUrl, bearer) {
  const h = {
    Cookie: `mac=${encodeURIComponent(mac)}; stb_lang=en; timezone=Africa%2FNairobi`,
    "User-Agent": USER_AGENT,
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Referer: `${portalUrl}/c/`,
    Accept: "*/*",
  };
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  return h;
}

async function apiGet(apiUrl, params, mac, portalUrl, bearer) {
  const query = new URLSearchParams({ ...params, JsHttpRequest: "1-xml" });
  const res = await fetch(`${apiUrl}?${query}`, {
    headers: headers(mac, portalUrl, bearer),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${params.type}/${params.action} returned ${res.status}`);
  if (!text.trim()) {
    // An empty body to a valid request means the provider is refusing this MAC/portal
    const err = new Error(`${params.type}/${params.action} gave an empty response — provider blocked`);
    err.blocked = true;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    if (/authorization failed/i.test(text)) throw new Error("authorization failed");
    throw new Error(`${params.type}/${params.action} returned non-JSON: ${text.slice(0, 60)}`);
  }
}

/** First-page item count for a list (reads total_items; no full fetch). null if unavailable. */
async function countList(apiUrl, params, mac, portalUrl, bearer) {
  try {
    const data = await apiGet(apiUrl, { ...params, p: "1" }, mac, portalUrl, bearer);
    const total = Number(data?.js?.total_items);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

/** Category/genre titles for a section (e.g. live genres, VOD categories). null if unavailable. */
async function listCategories(apiUrl, params, mac, portalUrl, bearer) {
  try {
    const data = await apiGet(apiUrl, params, mac, portalUrl, bearer);
    const arr = Array.isArray(data?.js) ? data.js : data?.js?.data || [];
    return arr
      .map((c) => c && (c.title ?? c.name))
      .filter((t) => t != null && String(t).trim())
      .map(String);
  } catch {
    return null;
  }
}

/** Xtream account summary (status, connections, expiry) from a stream link's credentials. */
async function xtreamUserInfo(base, username, password) {
  const res = await fetch(`${base}?${new URLSearchParams({ username, password })}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`account info returned ${res.status}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("account info was not JSON");
  }
  const ui = data.user_info || {};
  const toDate = (unix) => (unix ? new Date(Number(unix) * 1000) : null);
  const exp = toDate(ui.exp_date);
  const created = toDate(ui.created_at);
  return {
    status: ui.status || null,
    isTrial: ui.is_trial === "1" || ui.is_trial === 1 || ui.is_trial === true,
    maxConnections: ui.max_connections != null ? Number(ui.max_connections) : null,
    activeConnections: ui.active_cons != null ? Number(ui.active_cons) : null,
    expiresAt: exp ? exp.toISOString() : null,
    daysLeft: exp ? Math.round((exp.getTime() - Date.now()) / 86400000) : null,
    createdAt: created ? created.toISOString() : null,
  };
}

/** Tests one MAC against one portal. Returns a result object (never throws). */
async function testMac(portalUrl, apiUrl, mac) {
  const entry = { mac, portal: "failed", streamLink: "failed" };
  if (!MAC_RE.test(mac)) {
    entry.error = "invalid MAC — use XX:XX:XX:XX:XX:XX";
    return entry;
  }
  try {
    const hs = await apiGet(apiUrl, { type: "stb", action: "handshake", token: "" }, mac, portalUrl);
    const bearer = hs?.js?.token;
    if (!bearer) throw new Error("handshake returned no token");
    await apiGet(apiUrl, { type: "stb", action: "get_profile", hd: "1" }, mac, portalUrl, bearer);
    entry.portal = "ok";

    // Live stream link, and the account behind it
    const link = await apiGet(
      apiUrl,
      { type: "itv", action: "create_link", cmd: "ffmpeg http://localhost/ch/1_", series: "", forced_storage: "0", disable_ad: "0", download: "0" },
      mac,
      portalUrl,
      bearer,
    );
    const linkUrl = String(link?.js?.cmd || "").replace(/^ffmpeg\s+/, "").trim();
    if (/^https?:\/\//.test(linkUrl)) {
      entry.streamLink = "ok";
      const u = new URL(linkUrl);
      const [, username, password] = u.pathname.split("/");
      if (username && password) {
        try {
          entry.account = await xtreamUserInfo(`${u.protocol}//${u.host}/player_api.php`, username, password);
        } catch (err) {
          entry.accountError = err.message;
        }
      }
    } else {
      entry.streamLinkError = "portal gave no stream link";
    }

    // Catalogue sizes (cheap first-page counts)
    entry.catalog = {
      channels: await countList(apiUrl, LIST_PARAMS.channels, mac, portalUrl, bearer),
      movies: await countList(apiUrl, LIST_PARAMS.movies, mac, portalUrl, bearer),
      series: await countList(apiUrl, LIST_PARAMS.series, mac, portalUrl, bearer),
      radio: await countList(apiUrl, LIST_PARAMS.radio, mac, portalUrl, bearer),
    };

    // Category names per section (shown in the expandable panel on the page)
    entry.categories = {
      channels: await listCategories(apiUrl, CATEGORY_PARAMS.channels, mac, portalUrl, bearer),
      movies: await listCategories(apiUrl, CATEGORY_PARAMS.movies, mac, portalUrl, bearer),
      series: await listCategories(apiUrl, CATEGORY_PARAMS.series, mac, portalUrl, bearer),
    };
  } catch (err) {
    entry.error = err.message;
    if (err.blocked) entry.blocked = true;
  }
  return entry;
}

/** Runs the async mapper over items with a small concurrency limit, preserving order. */
async function mapLimited(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await mapper(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Test a portal with a list of MACs. `onMeta` fires once before testing starts, `onResult`
 * fires as each MAC finishes (completion order) so callers can stream progress.
 * @param {{ portalUrl?: string, macs: string[], onMeta?: Function, onResult?: Function }} opts
 */
async function testPortal({ portalUrl, macs, onMeta, onResult } = {}) {
  const base = String(portalUrl || portal.PORTAL_URL || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("portal URL must start with http:// or https://");
  // API path is fixed to portal.php
  const path = "portal.php";
  const apiUrl = `${base}/${path}`;

  const cleaned = (Array.isArray(macs) ? macs : [])
    .map((m) => String(m).trim())
    .filter(Boolean)
    .slice(0, MAX_MACS);
  if (cleaned.length === 0) throw new Error("no MACs to test");

  const checkedAt = new Date().toISOString();
  if (onMeta) onMeta({ portalUrl: base, apiPath: path, total: cleaned.length, checkedAt });

  const results = await mapLimited(cleaned, CONCURRENCY, async (mac, i) => {
    const entry = await testMac(base, apiUrl, mac);
    entry.index = i; // original position, so a caller can keep the list stable
    if (onResult) {
      try {
        onResult(entry);
      } catch {}
    }
    return entry;
  });
  return { portalUrl: base, apiPath: path, macCount: cleaned.length, checkedAt, macs: results };
}

module.exports = { testPortal };
