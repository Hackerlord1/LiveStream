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
  // A rejected or expired token is answered with HTTP 200 and an empty body
  if (!text.trim()) {
    const err = new Error(`Portal ${params.type}/${params.action} returned an empty response (session rejected)`);
    err.authFailed = true;
    throw err;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pages that still fail after the first pass are retried in later rounds, after these pauses
const RETRY_ROUND_DELAYS_MS = [30000, 120000, 300000];
// This many failed pages in a row means the portal is refusing us: pause, then log in again
const FAILURE_STREAK_PAUSE = 10;
const FAILURE_STREAK_PAUSE_MS = 60000;

/**
 * Fetch every page of a paginated list. onPage is called with the items so far.
 * Returns { items, total, missingPages, failures }: missingPages are the pages that
 * never came back, failures a sample of why (page, reason, time).
 */
async function fetchAllPages(params, { firstPage = 1, delayMs = 100, onPage } = {}) {
  const first = await portalGet({ ...params, p: String(firstPage) });
  const total = Number(first?.js?.total_items) || 0;
  const perPage = Number(first?.js?.max_page_items) || 14;
  const lastPage = firstPage + Math.ceil(total / perPage) - 1;
  const pages = new Map([[firstPage, first?.js?.data || []]]);
  const all = [...pages.get(firstPage)];
  const failures = [];
  onPage?.(all, total);

  async function fetchPage(p) {
    const data = await portalGet({ ...params, p: String(p) });
    const items = data?.js?.data || [];
    // An empty page that should have items is a refusal, not the end of the list
    if (items.length === 0 && (p - firstPage) * perPage < total) {
      throw new Error(`page came back empty (total_items=${data?.js?.total_items})`);
    }
    return items;
  }

  async function pass(pageNumbers, round) {
    const failed = [];
    let streak = 0;
    for (const p of pageNumbers) {
      let lastErr;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const items = await fetchPage(p);
          pages.set(p, items);
          all.push(...items);
          onPage?.(all, total);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 3) await sleep(1000 * attempt);
        }
      }
      if (lastErr) {
        failed.push(p);
        streak++;
        failures.push({ page: p, round, reason: lastErr.message, at: new Date().toISOString() });
        if (failures.length > 20) failures.splice(1, 1); // keep the first failure and the latest ones
        console.warn(`⚠️ ${params.type} page ${p} failed (round ${round}): ${lastErr.message}`);
        if (streak % FAILURE_STREAK_PAUSE === 0) {
          console.warn(`⏸️ ${params.type}: ${streak} pages in a row failed, pausing then logging in again`);
          await sleep(FAILURE_STREAK_PAUSE_MS);
          await getToken(true).catch((err) => console.warn(`⚠️ Portal login failed: ${err.message}`));
        }
      } else {
        streak = 0;
      }
      if (delayMs) await sleep(delayMs);
    }
    return failed;
  }

  const rest = [];
  for (let p = firstPage + 1; p <= lastPage; p++) rest.push(p);
  let missing = await pass(rest, 1);

  for (let i = 0; i < RETRY_ROUND_DELAYS_MS.length && missing.length; i++) {
    console.log(`🔁 ${params.type}: retrying ${missing.length} missing pages in ${RETRY_ROUND_DELAYS_MS[i] / 1000}s`);
    await sleep(RETRY_ROUND_DELAYS_MS[i]);
    await getToken(true).catch(() => {});
    missing = await pass(missing, i + 2);
  }

  // Retried pages arrive out of order; rebuild the list in page order
  const items = [...pages.keys()].sort((a, b) => a - b).flatMap((p) => pages.get(p));
  return { items, total, missingPages: missing, failures };
}

// =============================
// XTREAM API
// =============================
// The provider's stream server also speaks the Xtream API, which returns a whole list
// (all channels, all movies...) in one request instead of 14 items per portal page.
// Its username/password are the ones in every stream link the portal hands out:
// http://host/<username>/<password>/<stream id>.
let xtreamAccount = null;

async function getXtreamAccount() {
  if (xtreamAccount) return xtreamAccount;
  // Any channel id works: only the account part of the link is needed
  const link = new URL(await createLiveLink("1"));
  const [, username, password] = link.pathname.split("/");
  if (!username || !password) throw new Error("No Xtream account in the portal's stream link");
  xtreamAccount = { base: `${link.protocol}//${link.host}/player_api.php`, username, password };
  return xtreamAccount;
}

/** Xtream API call, e.g. xtreamGet("get_live_streams") or xtreamGet("get_vod_info", { vod_id: 5 }). */
async function xtreamGet(action, params = {}) {
  const account = await getXtreamAccount();
  const query = new URLSearchParams({ username: account.username, password: account.password, action, ...params });
  const res = await fetch(`${account.base}?${query}`, {
    headers: { "User-Agent": USER_AGENT },
    // The full movie and series lists are 50-80 MB
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`Xtream ${action} returned ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Xtream ${action} returned non-JSON: ${text.slice(0, 80)}`);
  }
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
  xtreamGet,
  createLiveLink,
  createVodLink,
};
