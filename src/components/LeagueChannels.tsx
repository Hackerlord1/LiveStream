"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tv } from "lucide-react";
import { apiAsset, fetchIptv } from "@/lib/iptv-client";
import { splitTag } from "@/lib/iptv-format";
import ChannelLogo from "@/components/iptv/ChannelLogo";

interface LeagueChannel {
  id: string;
  number?: string;
  name: string;
  language: string;
  /** EFL club channels: "Championship", "League One", "League Two" */
  division?: string;
}

interface League {
  key: string;
  name: string;
  /** One always-on channel per club (the EFL) rather than one per match */
  clubs?: boolean;
  logo: string;
  channels: LeagueChannel[];
}

interface Game {
  key: string;
  title: string;
  time: string | null;
  /** One button per channel, labelled by language ("EN", "EN 2" when a language has several) */
  watch: { id: string; label: string; language: string; number?: string }[];
}

// Short labels for the language buttons
const LANGUAGE_CODES: Record<string, string> = {
  English: "EN", French: "FR", Arabic: "AR", Spanish: "ES", German: "DE",
  Italian: "IT", Albanian: "ALB", Portuguese: "PT",
};

/** "EN - COMO VS MANCHESTER UNITED 17:45 CET [BK1]" → title "COMO VS MANCHESTER UNITED", time "17:45 CET" */
function parseChannelName(name: string): { title: string; time: string | null } {
  const title = splitTag(name).title.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  const found = title.match(/^(.*?)\s+(\d{1,2}:\d{2}(?:\s*[A-Z]{2,4})?)\s*$/);
  return found ? { title: found[1], time: found[2] } : { title, time: null };
}

/** The league's channels grouped into one entry per game, with a button per language. */
function groupGames(channels: LeagueChannel[]): Game[] {
  const games = new Map<string, Game>();
  for (const ch of channels) {
    const { title, time } = parseChannelName(ch.name);
    const key = title.toUpperCase();
    // A club channel shows its division where a match shows its kick-off time
    const game = games.get(key) ?? { key, title, time: time ?? ch.division ?? null, watch: [] };
    game.time ??= time;
    const code = LANGUAGE_CODES[ch.language] ?? ch.language.slice(0, 3).toUpperCase();
    const sameLanguage = game.watch.filter((w) => w.language === ch.language).length;
    game.watch.push({ id: ch.id, label: sameLanguage ? `${code} ${sameLanguage + 1}` : code, language: ch.language, number: ch.number });
    games.set(key, game);
  }
  // Games (with a kick-off time) first, by time; then channels like "MULTI SCREEN"
  return [...games.values()].sort((a, b) => {
    if (Boolean(a.time) !== Boolean(b.time)) return a.time ? -1 : 1;
    return (a.time || "").localeCompare(b.time || "") || a.title.localeCompare(b.title);
  });
}

const chipStyle = {
  backgroundColor: "var(--surface-primary)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-primary)",
};

/**
 * "Watch on BraveStream TV": the big football competitions on our own channels. Opens on
 * the league with the most games on; each game is one card with a button per language.
 */
export default function LeagueChannels() {
  const [leagues, setLeagues] = useState<League[]>([]);
  // null = not chosen yet (the busiest league is shown); "" = closed
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIptv<{ leagues: League[] }>("/api/leagues")
      .then((data) => {
        if (!cancelled) setLeagues(data.leagues);
      })
      .catch(() => {
        // League channels are optional on the home page
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const busiest = useMemo(
    // Club channels are always there, so they'd always win: only count real matches
    () => leagues.reduce<League | null>((best, l) => (!l.clubs && l.channels.length > (best?.channels.length ?? 0) ? l : best), null),
    [leagues]
  );
  const activeKey = selected ?? busiest?.key ?? "";
  const league = leagues.find((l) => l.key === activeKey) ?? null;
  const games = useMemo(() => groupGames(league?.channels ?? []), [league]);

  if (leagues.length === 0) return null;

  return (
    <section
      className="mb-5 rounded-xl p-3 sm:p-4"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-primary)" }}
      aria-labelledby="bravestream-tv-heading"
    >
      <div className="mb-3">
        <h2 id="bravestream-tv-heading" className="flex items-center gap-2 text-lg font-bold sm:text-xl" style={{ color: "var(--text-primary)" }}>
          <Tv className="h-5 w-5 text-red-600" />
          Watch on BraveStream TV
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Pick a league, then the language you want.
        </p>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
        {leagues.map((l) => {
          const active = l.key === activeKey;
          const gameCount = groupGames(l.channels).length;
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => setSelected(active ? "" : l.key)}
              aria-pressed={active}
              className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg py-1 pl-1 pr-2.5 text-sm transition-colors ${active ? "bg-red-600 text-white" : ""}`}
              style={active ? undefined : chipStyle}
            >
              <ChannelLogo
                src={apiAsset(l.logo)}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded"
                style={{ backgroundColor: "var(--surface-secondary)" }}
                imgClassName="max-h-full max-w-full object-contain p-0.5"
                fallback={<Tv className="h-3.5 w-3.5" />}
              />
              <span className="font-medium">{l.name}</span>
              <span
                className="text-xs tabular-nums opacity-70"
                title={l.clubs ? `${gameCount} club channels` : `${gameCount} game${gameCount === 1 ? "" : "s"} on`}
              >
                {gameCount}
              </span>
            </button>
          );
        })}
      </div>

      {league && (
        <div className="mt-4">
          {games.length === 0 ? (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-muted)" }}>
              No {league.name} match on our channels right now. Games appear here when they&apos;re scheduled.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <div
                  key={game.key}
                  className="flex flex-col gap-2 rounded-xl p-3"
                  style={{ backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border-secondary)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {game.title}
                    </p>
                    {game.time && (
                      <span className="flex-shrink-0 rounded-md bg-red-600/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
                        {game.time}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Watch in:</span>
                    {game.watch.map((w) => (
                      <Link
                        key={w.id}
                        // from=home: the player's back button returns to the home page
                        href={`/iptv/watch/${w.id}?from=home`}
                        title={`${w.language}${w.number ? ` · CH ${w.number}` : ""}`}
                        className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold transition-opacity hover:opacity-85"
                        // Inline so the site's global link colour can't override it
                        style={{ color: "#fff" }}
                      >
                        {w.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
