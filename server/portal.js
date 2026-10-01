// Stalker/MAG portal client. All portal access goes through here.
// Configured from the environment (see server/.env.example).

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

// e.g. http://3tv.pro (no trailing slash)
const PORTAL_URL = requireEnv("IPTV_PORTAL_URL").replace(/\/+$/, "");
const MAC = requireEnv("IPTV_MAC");
// Most portals serve the API at portal.php; some use server/load.php
const API_URL = `${PORTAL_URL}/${process.env.IPTV_API_PATH || "portal.php"}`;
const TOKEN_TTL_MS = 30 * 60 * 1000;

const USER_AGENT =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";

const BASE_HEADERS = {
  Cookie: `mac=${encodeURIComponent(MAC)}; stb_lang=en; timezone=Africa%2FNairobi`,
  "User-Agent": USER_AGENT,
  "X-User-Agent": "Model: MAG250; Link: WiFi",
  Referer: `${PORTAL_URL}/c/`,
  Accept: "*/*",
};

let token = null;
let tokenExpiresAt = 0;
let tokenPromise = null;

async function rawGet(params, bearer) {
  const query = new URLSearchParams({ ...params, JsHttpRequest: "1-xml" });
  const headers = bearer ? { ...BASE_HEADERS, Authorization: `Bearer ${bearer}` } : BASE_HEADERS;
  const res = await fetch(`${API_URL}?${query}`, { headers, signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Portal ${params.type}/${params.action} returned ${res.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    // Portals answer "Authorization failed." as plain text when the token is stale
    const err = new Error(`Portal ${params.type}/${params.action} returned non-JSON: ${text.slice(0, 80)}`);
    err.authFailed = /authorization failed/i.test(text);
    throw err;
  }
}

// Handshake, then get_profile to activate the token for this MAC
async function login() {
  const hs = await rawGet({ type: "stb", action: "handshake", token: "" });
  const newToken = hs?.js?.token;
  if (!newToken) throw new Error("Handshake returned no token");
  await rawGet({ type: "stb", action: "get_profile", hd: "1" }, newToken);
  token = newToken;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  console.log("🔑 Portal session refreshed");
  return token;
}

async function getToken(force = false) {
  if (!force && token && Date.now() < tokenExpiresAt) return token;
  // Share one in-flight login between concurrent callers
  if (!tokenPromise) {
    tokenPromise = login().finally(() => { tokenPromise = null; });
  }
  return tokenPromise;
}

/**
 * Authenticated portal request. Re-logs in once if the session expired, and retries
 * once on a network error (the portal occasionally drops a request).
 */
async function portalGet(params) {
  try {
    return await rawGet(params, await getToken());
  } catch (err) {
    if (err.authFailed) return rawGet(params, await getToken(true));
    if (err instanceof TypeError || err.name === "TimeoutError") {
      await new Promise((r) => setTimeout(r, 500));
      return rawGet(params, await getToken());
    }
    throw err;
  }
}

/** Fetch every page of a paginated list, calling onPage with each page's items. */
async function fetchAllPages(params, { firstPage = 1, delayMs = 100, onPage } = {}) {
  const first = await portalGet({ ...params, p: String(firstPage) });
  const total = Number(first?.js?.total_items) || 0;
  const perPage = Number(first?.js?.max_page_items) || 14;
  const lastPage = firstPage + Math.ceil(total / perPage) - 1;
  const all = [...(first?.js?.data || [])];
  onPage?.(all, total);

  for (let p = firstPage + 1; p <= lastPage; p++) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const data = await portalGet({ ...params, p: String(p) });
        all.push(...(data?.js?.data || []));
        onPage?.(all, total);
        break;
      } catch (err) {
        if (attempt === 3) console.warn(`⚠️ ${params.type} page ${p} failed: ${err.message}`);
        else await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  return all;
}

function stripFfmpegPrefix(cmd) {
  return String(cmd || "").replace(/^ffmpeg\s+/, "").trim();
}

/** Fresh playable URL for a live TV or radio channel (URLs carry a short-lived play_token). */
async function createLiveLink(channelId, cmd) {
  // A few channels point straight at a third-party stream; those need no portal link
  const direct = stripFfmpegPrefix(cmd);
  if (/^https?:\/\//.test(direct) && !direct.startsWith(PORTAL_URL) && !/\/\/localhost\//.test(direct)) {
    return direct;
  }
  const data = await portalGet({
    type: "itv",
    action: "create_link",
    // Always the short form: passing the channel's stored play URL makes the
    // portal return a link with an empty stream id
    cmd: `ffmpeg http://localhost/ch/${channelId}_`,
    series: "",
    forced_storage: "0",
    disable_ad: "0",
    download: "0",
  });
  const url = stripFfmpegPrefix(data?.js?.cmd);
  if (!/^https?:\/\//.test(url)) throw new Error(`create_link gave no URL for ${channelId}`);
  return url;
}

/**
 * Fresh playable URL for a movie (item cmd) or a series episode
 * (season cmd + episode number).
 */
async function createVodLink(cmd, episode = "") {
  const data = await portalGet({
    type: "vod",
    action: "create_link",
    cmd,
    series: String(episode),
    forced_storage: "",
    disable_ad: "0",
    download: "0",
  });
  const url = stripFfmpegPrefix(data?.js?.cmd);
  if (!/^https?:\/\//.test(url)) throw new Error("create_link gave no VOD URL");
  return url;
}

module.exports = {
  PORTAL_URL,
  USER_AGENT,
  portalGet,
  fetchAllPages,
  createLiveLink,
  createVodLink,
};
