// Live games from event channels.
//
// The portal's programme guide is empty, but sports/PPV "event channels" are named
// after the fixture they carry, in many provider formats, e.g.
//   "National League 1 | Oldham vs Southend // UK Sun 1 Jun 3:00pm // ET Sun 1 Jun 10:00am"
//   "Next | Brunei vs. Hong Kong | FIFA ASEAN Cup | 2026-09-30 | 12:00 (GMT) | 8K EXCLUSIVE"
//   "NEXT | WHITE SOX @ ASTROS | Wed 30 Sep 21:00 UTC (UK) | ..."
//   "LOI TV 2 | Longford Town v Cork City  start: 2026-09-26 19:20:00  stop: 2026-09-26 22:20:00"
// This turns them into fixtures with a kick-off time where one can be found.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const HOUR = 60 * 60 * 1000;
const LIVE_BEFORE_MS = 15 * 60 * 1000; // show as live shortly before kick-off
const DEFAULT_LENGTH_MS = 3 * HOUR;
const MAX_AHEAD_MS = 14 * 24 * HOUR;
const FIXTURE_RE = /\s(?:vs?\.?|@)\s/i;

const londonFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" });

/** Minutes London is ahead of UTC at a given instant (0 in winter, 60 in summer). */
function londonOffsetMinutes(utcMs) {
  const tz = londonFormatter.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = tz.match(/GMT([+-]\d+)(?::(\d+))?/);
  return match ? Number(match[1]) * 60 + Math.sign(Number(match[1])) * Number(match[2] || 0) : 0;
}

function londonToUtc(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month, day, hour, minute);
  return guess - londonOffsetMinutes(guess) * 60000;
}

function to24h(hour, ampm) {
  let h = Number(hour) % 12;
  if (/pm/i.test(ampm || "")) h += 12;
  else if (!ampm) h = Number(hour);
  return h;
}

/** Names rarely include a year: pick the year that puts the date closest to now. */
function nearestYear(toUtc, now) {
  const year = new Date(now).getUTCFullYear();
  return [year - 1, year, year + 1]
    .map((y) => toUtc(y))
    .reduce((best, t) => (Math.abs(t - now) < Math.abs(best - now) ? t : best));
}

/** Returns { start, end } in UTC ms, or null if the name has no usable date. */
function parseSchedule(name, now) {
  // "start:2026-09-27 01:55:00 stop:2026-09-27 06:00:00" (UK time)
  let m = name.match(/start:\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/i);
  if (m) {
    const start = londonToUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const stop = name.match(/stop:\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/i);
    const end = stop ? londonToUtc(+stop[1], +stop[2] - 1, +stop[3], +stop[4], +stop[5]) : start + DEFAULT_LENGTH_MS;
    return { start, end };
  }

  // "2026-09-30 | 12:00 (GMT)"
  m = name.match(/(\d{4})-(\d{2})-(\d{2})\s*\|?\s*(\d{1,2}):(\d{2})\s*\((?:GMT|UTC)\)/i);
  if (m) {
    const start = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return { start, end: start + DEFAULT_LENGTH_MS };
  }

  // "Wed 30 Sep 21:00 UTC"
  m = name.match(/\b(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{1,2}):(\d{2})\s*(?:UTC|GMT)\b/i);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    const start = nearestYear((y) => Date.UTC(y, MONTHS[m[2].toLowerCase()], +m[1], +m[3], +m[4]), now);
    return { start, end: start + DEFAULT_LENGTH_MS };
  }

  // "UK Sun 1 Jun 3:00pm" or "Sun 31 May 08:50" (UK time)
  m = name.match(/(?:UK\s+)?\b[A-Za-z]{3}\s+(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    const hour = to24h(m[3], m[5]);
    const start = nearestYear((y) => londonToUtc(y, MONTHS[m[2].toLowerCase()], +m[1], hour, +m[4]), now);
    return { start, end: start + DEFAULT_LENGTH_MS };
  }

  return null;
}

/** A bare time with no date ("7:45pm", "14:00 GMT"): shown as text, since the day is unknown. */
function parseTimeOnly(name) {
  const m = name.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\s*(GMT|UTC|UK)?/i);
  return m ? `${m[1]}:${m[2]}${m[3] ? m[3].toLowerCase() : ""} UK` : null;
}

function cleanTitle(segment) {
  return segment
    .replace(/^\s*(?:next|end|live|now)\s*[|:-]\s*/i, "")
    .replace(/^\s*live event\s*\d*\s*-\s*/i, "")
    .replace(/^\s*\d{1,2}:\d{2}\s*(?:GMT|UTC)?\s*/i, "")     // leading "14:00 GMT "
    .replace(/^[A-Za-z][^:|]{0,29}?\d+\s*:\s*/, "")          // "Rugby 1: ", "UFC 04 : ", "GaaGo 01: "
    .replace(/^\s*\d{1,2}:\d{2}\s*(?:GMT|UTC)?\s*/i, "")     // time after such a label
    .replace(/^\s*\d{1,2}\s*-\s*/, "")                        // "01 - "
    .replace(/\s*start:.*$/i, "")
    .replace(/\s*\d{1,2}[.:]\d{2}\s*(?:am|pm)?\s*(?:GMT|UTC|UK|Sun|Sat)?$/i, "") // trailing "7:45pm", "17.45", "10:53"
    .replace(/\s+\d{1,2}\s*(?:am|pm)$/i, "")                                   // trailing "6PM"
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Picks the "Team A vs Team B" part and, where given, the competition. */
function parseName(name) {
  const segments = name.split(/\s*(?:\||\/\/)\s*/).filter(Boolean);
  const titleIndex = segments.findIndex((s) => FIXTURE_RE.test(` ${s} `));
  const title = cleanTitle(segments[titleIndex] ?? name);

  // DAZN-style names put the competition right after the fixture
  const next = segments[titleIndex + 1];
  const competition = next && !/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}|exclusive|ppv|\bUK\b|\bET\b/i.test(next) ? next.trim() : null;
  return { title, competition };
}

function leagueFromGenre(genreTitle) {
  return String(genreTitle || "")
    .replace(/^[A-Z]{2,4}\s*\|\s*/, "")
    .replace(/\b(PPV|VIP|HEVC|\+)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * @param channels raw portal channels
 * @param genres   raw portal genres ({ id, title })
 */
function buildGames(channels, genres, now = Date.now()) {
  const genreTitles = new Map(genres.map((g) => [String(g.id), g.title]));
  const games = [];
  const byKey = new Map();

  for (const ch of channels) {
    const name = String(ch.name || "");
    if (!FIXTURE_RE.test(name) || /^#+/.test(name)) continue;
    if (/^\s*end\s*\|/i.test(name)) continue; // provider marks finished events

    const schedule = parseSchedule(name, now);
    let status = "unscheduled";
    if (schedule) {
      if (now >= schedule.start - LIVE_BEFORE_MS && now < schedule.end) status = "live";
      else if (schedule.start > now && schedule.start - now < MAX_AHEAD_MS) status = "upcoming";
      else continue; // finished, or a stale name far from now
    }

    const { title, competition } = parseName(name);
    if (!title) continue;

    // Providers often run the same fixture on several channels (backups): keep one entry
    const key = `${title.toLowerCase()}|${schedule?.start ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.altChannelIds.push(String(ch.id));
      continue;
    }

    const game = {
      channelId: String(ch.id),
      altChannelIds: [],
      title,
      league: competition || leagueFromGenre(genreTitles.get(String(ch.tv_genre_id))),
      start: schedule?.start ?? null,
      end: schedule?.end ?? null,
      timeText: schedule ? null : parseTimeOnly(name),
      status,
      logo: ch.logo ? `/api/logo/${ch.id}` : null, // proxied over HTTPS by the server
    };
    byKey.set(key, game);
    games.push(game);
  }

  const rank = { live: 0, upcoming: 1, unscheduled: 2 };
  return games.sort(
    (a, b) => rank[a.status] - rank[b.status] || (a.start ?? 0) - (b.start ?? 0) || a.title.localeCompare(b.title)
  );
}

module.exports = { buildGames, parseSchedule, parseName };
