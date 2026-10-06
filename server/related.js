// "Related channels" for the player sidebar.
//
// The portal has no programme guide, so similarity comes from what channels do have:
// the brand/name (BBC 1 -> BBC 2, BBC News), shared name words, the genre, the region
// tag ("UK|", "ENGLISH|") and nearby channel numbers.

// Words that say nothing about what a channel is
const NOISE_WORDS = new Set([
  "hd", "fhd", "uhd", "sd", "4k", "8k", "hevc", "h265", "vip", "raw", "backup", "plus",
  "tv", "channel", "channels", "live", "the", "and", "of", "en", "multi", "exclusive",
]);

/** "UK| BBC 1 HD" -> { tag: "UK", title: "BBC 1 HD" } */
function splitTag(name) {
  const raw = String(name || "").trim();
  const match = raw.match(/^([A-Z0-9]{2,10}(?:[ -][A-Z]{2,3})?)\s*[|:\-–]\s*(.+)$/);
  return match ? { tag: match[1], title: match[2].trim() } : { tag: null, title: raw };
}

function tokensOf(title) {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !NOISE_WORDS.has(w) && !/^\d{1,3}$/.test(w));
}

function describe(channel) {
  const { tag, title } = splitTag(channel.name);
  const tokens = tokensOf(title);
  return {
    channel,
    tag,
    tokens: new Set(tokens),
    brand: tokens[0] || null,
    genre: String(channel.tv_genre_id ?? ""),
    number: Number(channel.number) || null,
    isFixture: /\s(?:vs?\.?|@)\s/i.test(title),
  };
}

// Separator rows like "##### GENERAL FHD #####" aren't channels
const isSeparator = (channel) => /^\s*#{2,}/.test(String(channel.name || ""));

// Described channels are cached per catalogue array (rebuilt when the catalogue refreshes)
let cache = { items: null, described: [] };

function describeAll(items) {
  if (cache.items !== items) {
    cache = { items, described: items.filter((c) => !isSeparator(c)).map(describe) };
  }
  return cache.described;
}

function score(a, b) {
  let s = 0;
  if (a.brand && a.brand === b.brand) s += 6;
  for (const t of a.tokens) if (t !== a.brand && b.tokens.has(t)) s += 2;
  if (a.genre && a.genre === b.genre) s += 3;
  if (a.tag && a.tag === b.tag) s += 1;
  if (a.isFixture && b.isFixture && a.genre === b.genre) s += 2;
  if (a.number && b.number && Math.abs(a.number - b.number) <= 20) s += 1;
  return s;
}

const MIN_SCORE = 4;

/** Up to `limit` channels most similar to `channel` (raw portal channel objects). */
function relatedChannels(channel, items, limit = 16) {
  const all = describeAll(items);
  const target = describe(channel);
  return all
    .filter((d) => String(d.channel.id) !== String(channel.id))
    .map((d) => ({ d, s: score(target, d) }))
    .filter(({ s }) => s >= MIN_SCORE)
    .sort((x, y) =>
      y.s - x.s ||
      Math.abs((x.d.number ?? 1e9) - (target.number ?? 0)) - Math.abs((y.d.number ?? 1e9) - (target.number ?? 0)))
    .slice(0, limit)
    .map(({ d }) => d.channel);
}

module.exports = { relatedChannels };
