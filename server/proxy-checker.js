// Admin diagnostics: bulk proxy checker (HTTP, SOCKS5, SOCKS4) for lists of thousands.
//
// Each proxy is checked the way a browser profile would use it: open a tunnel through the
// proxy to an IP-echo service over HTTPS, complete a TLS handshake with a verified
// certificate, and read the exit IP back. A proxy that passes can carry real HTTPS traffic,
// not just accept a TCP connection. Exit IPs are then geolocated in batches.
//
// It is built on raw sockets (no dependencies), so a few hundred checks can run at once
// cheaply. It is only reachable through the DEBUG_TOKEN-gated endpoint.

const net = require("net");
const tls = require("tls");

const JUDGE_HOST = "api.ipify.org";
const JUDGE_PORT = 443;
const JUDGE_PATH = "/?format=json";

const MAX_PROXIES = 20000;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_CONCURRENCY = 100;
const MAX_CONCURRENCY = 300;
const PROTOCOLS = ["http", "https", "socks5", "socks4"];

// ip-api.com free batch endpoint: up to 100 IPs per request, 15 requests per minute
const GEO_URL = "http://ip-api.com/batch?fields=status,country,countryCode,city,isp,query";
const GEO_BATCH = 100;
const GEO_INTERVAL_MS = 4500;

const noop = () => {};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

// host:port, or [ipv6]:port
const HOST_PORT_RE = /^(\[[0-9a-fA-F:.]+\]|[^:@\s/[\]]+):(\d{1,5})$/;
// MoreLogin-style trailing extras: [Refresh URL]{Groups}(Proxy name), any of them
const SUFFIX_RE = /(?:\[[^\]]*\]|\{[^}]*\}|\([^)]*\))+$/;

function normalizeProtocol(p) {
  const s = String(p || "").toLowerCase();
  if (s === "socks5h" || s === "socks") return "socks5";
  if (s === "socks4a") return "socks4";
  return PROTOCOLS.includes(s) ? s : null;
}

function splitCredentials(s) {
  const i = s.indexOf(":");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

/**
 * Parses one proxy line. Accepts, with or without a scheme (http://, socks5://, …):
 *   host:port   user:pass@host:port   host:port@user:pass   host:port:user:pass
 * Returns { protocol|null, host, port, user, pass } or throws with a readable reason.
 */
function parseProxy(line) {
  let s = String(line).trim();
  let protocol = null;
  const scheme = s.match(/^([a-z0-9]+):\/\//i);
  if (scheme) {
    if (/^ssh$/i.test(scheme[1])) throw new Error("SSH tunnels can't be checked here");
    protocol = normalizeProtocol(scheme[1]);
    if (!protocol) throw new Error(`unsupported protocol "${scheme[1]}"`);
    s = s.slice(scheme[0].length);
  }
  // Strip [refresh]{group}(name) — but not a bare "[ipv6]:port", which ends in the port
  const suffix = (s.match(SUFFIX_RE) || [""])[0];
  s = s.slice(0, s.length - suffix.length).replace(/\/+$/, "");

  let hostPort, user, pass;
  const at = s.lastIndexOf("@");
  if (at >= 0) {
    const left = s.slice(0, at);
    const right = s.slice(at + 1);
    const rightIsHost = HOST_PORT_RE.test(right);
    const leftIsHost = HOST_PORT_RE.test(left);
    // "1.2.3.4:8080@user:1234" matches both ways; the side with a dotted host is the proxy
    const useRight = rightIsHost && (!leftIsHost || right.includes(".") || !left.includes("."));
    if (useRight) {
      hostPort = right;
      [user, pass] = splitCredentials(left);
    } else if (leftIsHost) {
      hostPort = left;
      [user, pass] = splitCredentials(right);
    } else {
      throw new Error("couldn't find host:port");
    }
  } else if (s.startsWith("[")) {
    // [ipv6]:port  or  [ipv6]:port:user:pass
    const m = s.match(/^(\[[^\]]+\]:\d{1,5})(?::([^:]*):(.*))?$/);
    if (!m) throw new Error("expected [ipv6]:port or [ipv6]:port:user:pass");
    hostPort = m[1];
    user = m[2];
    pass = m[3];
  } else {
    const parts = s.split(":");
    if (parts.length === 2) hostPort = s;
    else if (parts.length >= 4) {
      hostPort = `${parts[0]}:${parts[1]}`;
      user = parts[2];
      pass = parts.slice(3).join(":");
    } else throw new Error("expected host:port or host:port:user:pass");
  }

  const hp = hostPort.match(HOST_PORT_RE);
  if (!hp) throw new Error("couldn't find host:port");
  const port = Number(hp[2]);
  if (!(port >= 1 && port <= 65535)) throw new Error(`invalid port ${hp[2]}`);
  const host = hp[1].replace(/^\[|\]$/g, "");
  return { protocol, host, port, user: user || undefined, pass: user ? pass || "" : undefined, suffix };
}

/** MoreLogin import line: type://host:port[:user:pass] plus any original [refresh]{group}(name). */
function exportLine(proxy, protocol) {
  const host = proxy.host.includes(":") ? `[${proxy.host}]` : proxy.host;
  const auth = proxy.user ? `:${proxy.user}:${proxy.pass}` : "";
  return `${protocol}://${host}:${proxy.port}${auth}${proxy.suffix || ""}`;
}

// ---------------------------------------------------------------------------
// Socket helpers
// ---------------------------------------------------------------------------

class WrongProtocol extends Error {
  constructor(message) {
    super(message);
    this.wrongProtocol = true;
  }
}

/**
 * Reads from the socket until `done(buffer)` returns something other than undefined, and
 * resolves with that. Rejects if the socket closes or errors first.
 */
function readUntil(socket, done) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    function cleanup() {
      socket.off("data", onData);
      socket.off("end", onClose);
      socket.off("close", onClose);
      socket.off("error", onError);
    }
    function onData(chunk) {
      buf = Buffer.concat([buf, chunk]);
      let r;
      try {
        r = done(buf);
      } catch (err) {
        cleanup();
        return reject(err);
      }
      if (r !== undefined) {
        cleanup();
        resolve(r);
      }
    }
    function onClose() {
      cleanup();
      const err = new Error(buf.length ? "proxy closed the connection mid-reply" : "proxy closed the connection");
      err.closedEmpty = buf.length === 0;
      reject(err);
    }
    function onError(err) {
      cleanup();
      reject(err);
    }
    socket.on("data", onData);
    socket.once("end", onClose);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

/** Opens a TCP (or TLS, for https:// proxies) connection, registered with ctx for timeouts. */
function openSocket(ctx, host, port, useTls) {
  return new Promise((resolve, reject) => {
    const s = useTls
      ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false })
      : net.connect({ host, port });
    ctx.sockets.push(s);
    s.on("error", noop); // never let a late socket error crash the server
    s.setNoDelay(true);
    const onError = (err) => reject(err);
    s.once("error", onError);
    s.once(useTls ? "secureConnect" : "connect", () => {
      s.off("error", onError);
      resolve(s);
    });
  });
}

// ---------------------------------------------------------------------------
// Tunnel handshakes
// ---------------------------------------------------------------------------

async function httpConnect(socket, proxy, host, port) {
  const auth = proxy.user ? `Proxy-Authorization: Basic ${Buffer.from(`${proxy.user}:${proxy.pass}`).toString("base64")}\r\n` : "";
  socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}Proxy-Connection: keep-alive\r\n\r\n`);
  let head;
  try {
    head = await readUntil(socket, (b) => {
      // Anything that doesn't start like an HTTP reply isn't an HTTP proxy
      if (b.length >= 5 && b.subarray(0, 5).toString("latin1") !== "HTTP/") throw new WrongProtocol("not an HTTP proxy");
      const end = b.indexOf("\r\n\r\n");
      if (end >= 0) return b.subarray(0, end).toString("latin1");
      if (b.length > 16384) throw new Error("proxy sent an oversized reply");
      return undefined;
    });
  } catch (err) {
    // A SOCKS server hangs up on "CONNECT …" straight away
    if (err.closedEmpty || err.code === "ECONNRESET") throw new WrongProtocol("not an HTTP proxy");
    throw err;
  }
  const status = Number(head.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/)?.[1]);
  if (!status) throw new WrongProtocol("not an HTTP proxy");
  if (status === 407) throw new Error(proxy.user ? "login rejected (407)" : "needs a username/password (407)");
  // Lists scraped from the web are full of plain websites (often Cloudflare on :80) that
  // answer CONNECT like any bad request or with a redirect
  if (status === 400 || status === 404 || (status >= 300 && status < 400)) throw new Error(`a web server, not a proxy (${status})`);
  if (status === 405 || status === 403) throw new Error(`proxy blocks HTTPS tunnels (${status})`);
  if (status < 200 || status >= 300) throw new Error(`proxy refused the tunnel (${status})`);
}

const SOCKS5_ERRORS = {
  1: "general failure",
  2: "not allowed by ruleset",
  3: "network unreachable",
  4: "host unreachable",
  5: "connection refused",
  6: "TTL expired",
  7: "command not supported",
  8: "address type not supported",
};

async function socks5Connect(socket, proxy, host, port, probeMs) {
  const methods = proxy.user ? [0x00, 0x02] : [0x00];
  socket.write(Buffer.from([0x05, methods.length, ...methods]));
  let greeting;
  let probeTimer;
  try {
    const read = readUntil(socket, (b) => (b.length >= 2 ? [b[0], b[1]] : undefined));
    // While auto-detecting, silence after the greeting means "not SOCKS5" (an HTTP proxy
    // just waits for the rest of a request that never comes), so give up early
    const probe = probeMs
      ? new Promise((_, reject) => {
          probeTimer = setTimeout(() => {
            socket.destroy();
            reject(new WrongProtocol("not a SOCKS5 proxy"));
          }, probeMs);
        })
      : null;
    greeting = await (probe ? Promise.race([read, probe]) : read);
  } catch (err) {
    if (err.closedEmpty || err.code === "ECONNRESET") throw new WrongProtocol("not a SOCKS5 proxy");
    throw err;
  } finally {
    clearTimeout(probeTimer);
  }
  const [ver, method] = greeting;
  if (ver !== 0x05) throw new WrongProtocol("not a SOCKS5 proxy");
  if (method === 0xff) throw new Error(proxy.user ? "SOCKS5 refused our login method" : "needs a username/password");
  if (method === 0x02) {
    if (!proxy.user) throw new Error("needs a username/password");
    const u = Buffer.from(proxy.user);
    const p = Buffer.from(proxy.pass || "");
    if (u.length > 255 || p.length > 255) throw new Error("username/password too long for SOCKS5");
    socket.write(Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]));
    const status = await readUntil(socket, (b) => (b.length >= 2 ? b[1] : undefined));
    if (status !== 0x00) throw new Error("login rejected");
  } else if (method !== 0x00) {
    throw new Error(`SOCKS5 asked for unsupported auth method ${method}`);
  }

  const h = Buffer.from(host);
  socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, h.length]), h, Buffer.from([port >> 8, port & 0xff])]));
  const reply = await readUntil(socket, (b) => {
    if (b.length < 5) return undefined;
    const atyp = b[3];
    const len = atyp === 0x04 ? 22 : atyp === 0x03 ? 7 + b[4] : 10;
    return b.length >= len ? b[1] : undefined;
  });
  if (reply !== 0x00) throw new Error(`SOCKS5 tunnel failed: ${SOCKS5_ERRORS[reply] || `code ${reply}`}`);
}

async function socks4Connect(socket, proxy, host, port) {
  // SOCKS4a: IP 0.0.0.1 means "the proxy resolves the hostname that follows"
  const userId = Buffer.from(proxy.user || "");
  socket.write(
    Buffer.concat([
      Buffer.from([0x04, 0x01, port >> 8, port & 0xff, 0, 0, 0, 1]),
      userId,
      Buffer.from([0]),
      Buffer.from(host),
      Buffer.from([0]),
    ]),
  );
  let reply;
  try {
    reply = await readUntil(socket, (b) => (b.length >= 8 ? [b[0], b[1]] : undefined));
  } catch (err) {
    if (err.closedEmpty || err.code === "ECONNRESET") throw new WrongProtocol("not a SOCKS4 proxy");
    throw err;
  }
  if (reply[0] !== 0x00) throw new WrongProtocol("not a SOCKS4 proxy");
  if (reply[1] !== 0x5a) throw new Error(`SOCKS4 tunnel refused (code ${reply[1]})`);
}

const HANDSHAKES = { http: httpConnect, https: httpConnect, socks5: socks5Connect, socks4: socks4Connect };

// ---------------------------------------------------------------------------
// The judge request (through a tunnel, or directly for the preflight)
// ---------------------------------------------------------------------------

/** TLS + GET to the IP-echo service over an open tunnel. Resolves with the exit IP. */
async function askJudge(ctx, socket) {
  const secure = tls.connect({ socket, servername: JUDGE_HOST });
  ctx.sockets.push(secure);
  secure.on("error", noop);
  await new Promise((resolve, reject) => {
    secure.once("secureConnect", resolve);
    secure.once("error", reject);
  });
  return requestJudge(secure);
}

/** Plain-HTTP GET to the IP-echo service over an open tunnel (for HTTPS-intercepting proxies). */
function askJudgePlain(socket) {
  return requestJudge(socket);
}

function requestJudge(socket) {
  socket.write(`GET ${JUDGE_PATH} HTTP/1.1\r\nHost: ${JUDGE_HOST}\r\nUser-Agent: Mozilla/5.0\r\nAccept: application/json\r\nConnection: close\r\n\r\n`);
  return readUntil(socket, (b) => {
    const end = b.indexOf("\r\n\r\n");
    if (end < 0) {
      if (b.length > 65536) throw new Error("oversized reply");
      return undefined;
    }
    const status = Number(b.subarray(0, 16).toString("latin1").match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/)?.[1]);
    if (status && status !== 200) throw new Error(`IP check returned ${status} through this proxy`);
    const ip = b.subarray(end + 4).toString("utf8").match(/"ip"\s*:\s*"([^"]+)"/);
    return ip ? ip[1] : undefined;
  });
}

const CERT_ERRORS = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/;

function describeError(err, ctx) {
  if (ctx.timedOut) return "timed out";
  const code = err && err.code;
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "host not found";
  if (code === "ECONNRESET") return "connection reset";
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") return "host unreachable";
  if (code === "ETIMEDOUT") return "timed out";
  if (code && CERT_ERRORS.test(code)) return "HTTPS is intercepted (bad certificate)";
  return (err && err.message) || "failed";
}

/** Runs `fn(ctx)` with a hard deadline; every socket it opened is destroyed afterwards. */
async function withDeadline(timeoutMs, fn) {
  const ctx = { sockets: [], timedOut: false };
  const timer = setTimeout(() => {
    ctx.timedOut = true;
    for (const s of ctx.sockets) s.destroy(new Error("timed out"));
  }, timeoutMs);
  try {
    return await fn(ctx);
  } catch (err) {
    err.description = describeError(err, ctx);
    throw err;
  } finally {
    clearTimeout(timer);
    for (const s of ctx.sockets) s.destroy();
  }
}

async function tryProtocol(ctx, proxy, protocol, probeMs) {
  const socket = await openSocket(ctx, proxy.host, proxy.port, protocol === "https");
  await HANDSHAKES[protocol](socket, proxy, JUDGE_HOST, JUDGE_PORT, probeMs);
  try {
    return { exitIp: await askJudge(ctx, socket) };
  } catch (err) {
    if (!(err.code && CERT_ERRORS.test(err.code))) throw err;
    // The tunnel works but the proxy swaps in its own certificate (it decrypts HTTPS).
    // Confirm it still carries plain HTTP and report it as working-but-intercepted, so the
    // admin sees it (other checkers call these "normal") without exporting it by default.
    try {
      const plain = await openSocket(ctx, proxy.host, proxy.port, protocol === "https");
      await HANDSHAKES[protocol](plain, proxy, JUDGE_HOST, 80);
      return { exitIp: await askJudgePlain(plain), intercepted: true };
    } catch {
      throw err;
    }
  }
}

/** Checks one proxy line. Returns a result object (never throws). */
async function checkProxy(line, defaultProtocol, timeoutMs) {
  const entry = { raw: line, ok: false };
  let proxy;
  try {
    proxy = parseProxy(line);
  } catch (err) {
    entry.error = err.message;
    entry.invalid = true;
    return entry;
  }
  entry.host = proxy.host;
  entry.port = proxy.port;
  entry.hasAuth = !!proxy.user;

  // A scheme in the line wins; otherwise use the chosen protocol. Auto mode tries SOCKS5
  // first (MoreLogin's default for untyped lines), giving up on it early if the greeting
  // gets no reply, then HTTP. Not in parallel: some proxies reset a client that opens a
  // second connection while the first is still going.
  const fixed = proxy.protocol || (defaultProtocol !== "auto" ? defaultProtocol : null);
  const candidates = fixed ? [fixed] : ["socks5", "http"];
  const probeMs = fixed ? 0 : Math.max(2500, Math.round(timeoutMs * 0.4));

  const started = Date.now();
  try {
    await withDeadline(timeoutMs, async (ctx) => {
      let lastErr;
      for (const protocol of candidates) {
        try {
          const r = await tryProtocol(ctx, proxy, protocol, probeMs);
          entry.exitIp = r.exitIp;
          entry.protocol = protocol;
          if (r.intercepted) entry.intercepted = true;
          return;
        } catch (err) {
          // Keep a real reason (login rejected, refused tunnel…) over "wrong protocol"
          if (!lastErr || !err.wrongProtocol) lastErr = err;
          if (!err.wrongProtocol || ctx.timedOut) break;
        }
      }
      throw lastErr;
    });
    entry.ok = true;
    entry.latencyMs = Date.now() - started;
    entry.export = exportLine(proxy, entry.protocol);
  } catch (err) {
    entry.error = err.description || err.message;
    if (!fixed && err.wrongProtocol) entry.error = "not an HTTP or SOCKS5 proxy";
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Geolocation of exit IPs (batched, rate-limited)
// ---------------------------------------------------------------------------

function createGeoQueue(onGeo, isCancelled) {
  const pending = [];
  const seen = new Set();
  let finished = false;
  let wake = null;

  async function lookup(ips) {
    const res = await fetch(GEO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ips),
      signal: AbortSignal.timeout(15000),
    });
    // ip-api tells us how many requests are left in this minute and when it resets
    const remaining = Number(res.headers.get("x-rl"));
    const resetSec = Number(res.headers.get("x-ttl"));
    if (res.status === 429) {
      pending.unshift(...ips); // rate-limited: retry this batch after the reset
      return { retryInMs: (resetSec || 60) * 1000 };
    }
    if (!res.ok) throw new Error(`geo lookup returned ${res.status}`);
    const data = await res.json();
    const map = {};
    for (const g of Array.isArray(data) ? data : []) {
      if (g && g.status === "success" && g.query) {
        map[g.query] = { country: g.country, countryCode: g.countryCode, city: g.city, isp: g.isp };
      }
    }
    onGeo(map);
    return { retryInMs: remaining === 0 && resetSec ? resetSec * 1000 + 500 : 0 };
  }

  const sleep = (ms) =>
    new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(t);
        resolve();
      };
    });

  const worker = (async () => {
    let failures = 0;
    for (;;) {
      if (isCancelled()) return;
      if (pending.length === 0) {
        if (finished) return;
        await sleep(GEO_INTERVAL_MS);
        continue;
      }
      const batch = pending.splice(0, GEO_BATCH);
      let wait = GEO_INTERVAL_MS;
      try {
        const { retryInMs } = await lookup(batch);
        wait = Math.max(wait, retryInMs);
        failures = 0;
      } catch {
        // Put the batch back and give up after a few failures in a row (geo is best-effort)
        failures++;
        if (failures >= 3) return;
        pending.unshift(...batch);
      }
      if (pending.length === 0 && finished) return;
      await sleep(wait);
    }
  })();

  return {
    add(ip) {
      if (!ip || seen.has(ip)) return;
      seen.add(ip);
      pending.push(ip);
    },
    /** No more IPs are coming; resolves once everything queued has been looked up. */
    finish() {
      finished = true;
      if (wake) wake();
      return worker;
    },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Preflight: the judge must be reachable directly, or every proxy would look dead. */
async function checkJudgeReachable() {
  await withDeadline(10000, async (ctx) => {
    const socket = await openSocket(ctx, JUDGE_HOST, JUDGE_PORT, false);
    await askJudge(ctx, socket);
  }).catch((err) => {
    throw new Error(`the IP check service (${JUDGE_HOST}) isn't reachable from the server: ${err.description || err.message}`);
  });
}

/** Runs the async mapper over items with a concurrency limit; stops early when cancelled. */
async function mapLimited(items, limit, mapper, isCancelled) {
  let next = 0;
  async function worker() {
    while (next < items.length && !isCancelled()) {
      const i = next++;
      await mapper(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Check a list of proxies. Callbacks stream progress: `onMeta` once before testing,
 * `onResult` per proxy (completion order, with `index` = position in the deduped list),
 * `onGeo` with { ip: {country, countryCode, city, isp} } maps as lookups come back.
 */
async function checkProxies({ proxies, protocol = "auto", timeoutMs, concurrency, geo = true, onMeta, onResult, onGeo, isCancelled = () => false } = {}) {
  const defaultProtocol = protocol === "auto" ? "auto" : normalizeProtocol(protocol);
  if (!defaultProtocol) throw new Error(`unsupported protocol "${protocol}"`);
  const timeout = Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 2000), 30000);
  const limit = Math.min(Math.max(Number(concurrency) || DEFAULT_CONCURRENCY, 1), MAX_CONCURRENCY);

  // Trim, drop blanks/comments, dedupe (keeping first-seen order), cap
  const seen = new Set();
  const list = [];
  for (const raw of Array.isArray(proxies) ? proxies : []) {
    const line = String(raw).trim();
    if (!line || line.startsWith("#") || seen.has(line)) continue;
    seen.add(line);
    list.push(line);
  }
  if (list.length === 0) throw new Error("no proxies to test");
  const truncated = list.length > MAX_PROXIES;
  if (truncated) list.length = MAX_PROXIES;

  await checkJudgeReachable();

  const checkedAt = new Date().toISOString();
  if (onMeta) onMeta({ total: list.length, truncated, maxProxies: MAX_PROXIES, protocol: defaultProtocol, timeoutMs: timeout, concurrency: limit, checkedAt });

  const geoQueue = geo && onGeo ? createGeoQueue(onGeo, isCancelled) : null;

  await mapLimited(
    list,
    limit,
    async (line, i) => {
      const entry = await checkProxy(line, defaultProtocol, timeout);
      entry.index = i;
      if (entry.ok && geoQueue) geoQueue.add(entry.exitIp);
      if (onResult && !isCancelled()) {
        try {
          onResult(entry);
        } catch {}
      }
    },
    isCancelled,
  );

  if (geoQueue) await geoQueue.finish();
}

module.exports = { checkProxies, parseProxy };
