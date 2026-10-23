// Raw live relay for the Android app (GET /api/app/live/<id>.ts).
//
// The provider's original MPEG-TS stream is passed through over HTTPS byte for byte: no
// ffmpeg, no HLS. One provider connection per channel is shared by every app viewer of it,
// and the account's links never reach the phones. The website keeps using the HLS streams.

const portal = require("./portal");

// MPEG-TS is a run of 188-byte packets; a viewer has to start on a packet boundary
const TS_PACKET = 188;
// Recent stream kept per channel, so a new viewer starts with data instead of waiting
const BACKLOG_BYTES = 2 * 1024 * 1024;
// A viewer this far behind (unsent bytes) is dropped so one slow phone can't hold up others
const MAX_CLIENT_BACKLOG = 8 * 1024 * 1024;
// Keep the provider connection this long after the last viewer leaves (quick channel flips)
const IDLE_CLOSE_MS = 15000;
const RECONNECT_DELAY_MS = 1000;
// Give up after this many failed connects in a row (channel offline)
const MAX_FAILURES = 5;
const MAX_RELAYS = Number(process.env.MAX_APP_RELAYS) || 10;

const relays = new Map(); // channel id -> relay

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createRelay(channelId, cmd) {
  const relay = {
    channelId,
    cmd,
    clients: new Set(),
    backlog: [],       // recent chunks (Buffers)
    backlogBytes: 0,
    offset: 0,         // total bytes received from the provider (for packet alignment)
    controller: null,
    idleTimer: null,
    closed: false,
    startedAt: Date.now(),
  };
  relays.set(channelId, relay);
  run(relay);
  return relay;
}

function closeRelay(relay, reason) {
  if (relay.closed) return;
  relay.closed = true;
  clearTimeout(relay.idleTimer);
  relay.controller?.abort();
  for (const res of relay.clients) res.end();
  relay.clients.clear();
  relays.delete(relay.channelId);
  console.log(`📴 App relay ${relay.channelId} closed (${reason})`);
}

/** Bytes to skip at the start of `chunk` (received at stream position `position`) to reach a packet boundary. */
function alignSkip(position) {
  return (TS_PACKET - (position % TS_PACKET)) % TS_PACKET;
}

function broadcast(relay, chunk) {
  const start = relay.offset;
  relay.offset += chunk.length;
  relay.backlog.push(chunk);
  relay.backlogBytes += chunk.length;
  while (relay.backlogBytes - relay.backlog[0].length >= BACKLOG_BYTES) {
    relay.backlogBytes -= relay.backlog.shift().length;
  }
  for (const res of relay.clients) {
    if (res.writableLength > MAX_CLIENT_BACKLOG) {
      console.warn(`⚠️ App relay ${relay.channelId}: dropping a viewer who fell too far behind`);
      res.destroy();
      continue;
    }
    res.write(chunk);
  }
  return start;
}

/** Sends a new viewer the recent stream, starting on a packet boundary. */
function sendBacklog(relay, res) {
  if (relay.backlog.length === 0) return;
  const all = Buffer.concat(relay.backlog);
  const firstByte = relay.offset - all.length; // stream position of the backlog's first byte
  const skip = alignSkip(firstByte);
  if (skip < all.length) res.write(all.subarray(skip));
}

async function run(relay) {
  let failures = 0;
  while (!relay.closed) {
    try {
      const url = await portal.createLiveLink(relay.channelId, relay.cmd);
      relay.controller = new AbortController();
      const upstream = await fetch(url, {
        headers: { "User-Agent": portal.USER_AGENT },
        signal: relay.controller.signal,
      });
      if (!upstream.ok || !upstream.body) throw new Error(`provider answered ${upstream.status}`);
      // A reconnect starts a fresh TS stream: realign positions so new viewers start cleanly
      relay.offset = 0;
      relay.backlog = [];
      relay.backlogBytes = 0;
      let received = 0;
      for await (const piece of upstream.body) {
        if (relay.closed) break;
        broadcast(relay, Buffer.from(piece));
        received += piece.length;
        if (received > 1024 * 1024) failures = 0; // a healthy connection resets the count
      }
      if (!relay.closed) console.log(`🔁 App relay ${relay.channelId}: provider ended the stream, reconnecting`);
    } catch (err) {
      if (relay.closed) break;
      failures++;
      console.warn(`⚠️ App relay ${relay.channelId}: ${err.message} (attempt ${failures}/${MAX_FAILURES})`);
      if (failures >= MAX_FAILURES) {
        closeRelay(relay, "provider unavailable");
        break;
      }
    }
    if (!relay.closed) await sleep(RECONNECT_DELAY_MS);
  }
}

/**
 * Serves GET /api/app/live/<id>.ts: joins (or starts) the channel's relay and streams it
 * to this viewer until they disconnect.
 */
function serve(req, res, channel) {
  const channelId = String(channel.id);
  let relay = relays.get(channelId);
  if (!relay) {
    if (relays.size >= MAX_RELAYS) {
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Server busy, try again shortly" }));
    }
    relay = createRelay(channelId, channel.cmd);
    console.log(`📲 App relay ${channelId} started`);
  }
  clearTimeout(relay.idleTimer);

  res.writeHead(200, {
    "Content-Type": "video/mp2t",
    "Cache-Control": "no-store",
    // Tell proxies (Caddy) not to buffer: this is a live stream
    "X-Accel-Buffering": "no",
  });
  sendBacklog(relay, res);
  relay.clients.add(res);

  res.on("close", () => {
    relay.clients.delete(res);
    if (relay.clients.size === 0 && !relay.closed) {
      relay.idleTimer = setTimeout(() => closeRelay(relay, "no viewers"), IDLE_CLOSE_MS);
    }
  });
}

/** For /health and the daily restart: open relays and their viewers. */
function status() {
  let viewers = 0;
  for (const r of relays.values()) viewers += r.clients.size;
  return { relays: relays.size, viewers };
}

function closeAll() {
  for (const relay of [...relays.values()]) closeRelay(relay, "server shutting down");
}

module.exports = { serve, status, closeAll };
