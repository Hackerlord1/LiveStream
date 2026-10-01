"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Play, SearchX, Trophy, WifiOff } from "lucide-react";
import { fetchIptv } from "@/lib/iptv-client";
import { EmptyState, FilterChips, IptvPage, RetryButton, SearchBox, SkeletonGrid } from "@/components/iptv/ui";

interface Game {
  channelId: string;
  altChannelIds: string[];
  title: string;
  league: string;
  start: number | null;
  end: number | null;
  /** Kick-off time from the channel name when no date was given, e.g. "7:45pm UK" */
  timeText: string | null;
  status: "live" | "upcoming" | "unscheduled";
}

type Filter = "all" | "live" | "upcoming" | "unscheduled";

const REFRESH_MS = 60 * 1000;
const TEAMS_RE = /\s+(vs?\.?|@)\s+/i;

export default function IptvGamesPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Load, then refresh every minute so "live" and "in 20 min" stay accurate
  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchIptv<{ games: Game[] }>("/api/games")
        .then((data) => {
          if (cancelled) return;
          setGames(data.games);
          setError(false);
          setNow(Date.now());
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [attempt]);

  const counts = useMemo(() => {
    const c = { live: 0, upcoming: 0, unscheduled: 0 };
    for (const g of games ?? []) c[g.status]++;
    return c;
  }, [games]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (games ?? []).filter(
      (g) =>
        (filter === "all" || g.status === filter) &&
        (!q || g.title.toLowerCase().includes(q) || g.league.toLowerCase().includes(q))
    );
  }, [games, search, filter]);

  const live = visible.filter((g) => g.status === "live");
  const upcomingByDay = groupByDay(visible.filter((g) => g.status === "upcoming"), now);
  const unscheduled = visible.filter((g) => g.status === "unscheduled");

  const chips = [
    { id: "all", label: "All", count: games?.length ?? 0 },
    { id: "live", label: "🔴 Live now", count: counts.live },
    { id: "upcoming", label: "Coming up", count: counts.upcoming },
    { id: "unscheduled", label: "Time not confirmed", count: counts.unscheduled },
  ];

  let body;
  if (!games && error) {
    body = (
      <EmptyState
        icon={<WifiOff className="h-6 w-6" />}
        title="Can't reach the server"
        message="We couldn't load today's games right now."
        action={<RetryButton onClick={() => setAttempt((a) => a + 1)} />}
      />
    );
  } else if (!games) {
    body = <SkeletonGrid variant="tile" count={12} />;
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={search ? <SearchX className="h-6 w-6" /> : <CalendarClock className="h-6 w-6" />}
        title={search ? "No games found" : "No games scheduled right now"}
        message={search ? `Nothing matches “${search}”.` : "Check back later, or browse live channels."}
        action={
          !search && (
            <Link href="/iptv/channels" className="text-sm font-semibold" style={{ color: "var(--brand-red)" }}>
              Browse channels →
            </Link>
          )
        }
      />
    );
  } else {
    body = (
      <div className="space-y-8">
        {live.length > 0 && (
          <Section title="Live now" count={live.length}>
            {live.map((g) => (
              <GameCard key={`${g.channelId}-${g.title}`} game={g} now={now} />
            ))}
          </Section>
        )}
        {upcomingByDay.map(([day, dayGames]) => (
          <Section key={day} title={day} count={dayGames.length}>
            {dayGames.map((g) => (
              <GameCard key={`${g.channelId}-${g.title}`} game={g} now={now} />
            ))}
          </Section>
        ))}
        {unscheduled.length > 0 && (
          <Section
            title="Time not confirmed"
            count={unscheduled.length}
            note="These channels are named after a fixture but don't give a date, so they may be showing something else."
          >
            {unscheduled.map((g) => (
              <GameCard key={`${g.channelId}-${g.title}`} game={g} now={now} />
            ))}
          </Section>
        )}
      </div>
    );
  }

  return (
    <IptvPage
      title="Live Games"
      icon={<Trophy className="h-5 w-5" />}
      subtitle={games ? `${counts.live} live · ${counts.upcoming} coming up` : undefined}
      toolbar={
        <>
          <SearchBox value={search} onChange={setSearch} placeholder="Search teams or competitions…" />
          <FilterChips options={chips} value={filter} onChange={(id) => setFilter(id as Filter)} />
        </>
      }
    >
      {body}
    </IptvPage>
  );
}

function Section({ title, count, note, children }: { title: string; count: number; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {count}
        </span>
      </div>
      {note && (
        <p className="-mt-2 mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
          {note}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function GameCard({ game, now }: { game: Game; now: number }) {
  const parts = game.title.split(TEAMS_RE);
  const [home, , away] = parts.length >= 3 ? parts : [game.title, "", ""];
  const isLive = game.status === "live";
  const progress = isLive && game.start && game.end ? Math.min(100, Math.max(0, ((now - game.start) / (game.end - game.start)) * 100)) : null;

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl p-4"
      style={{
        backgroundColor: "var(--surface-primary)",
        border: `1px solid ${isLive ? "var(--brand-red)" : "var(--border-secondary)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {game.league || "Match"}
        </span>
        <TimeBadge game={game} now={now} />
      </div>

      <div className="my-4 min-w-0">
        <p className="truncate text-base font-bold leading-tight" title={home}>
          {home}
        </p>
        {away && (
          <>
            <p className="my-0.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              vs
            </p>
            <p className="truncate text-base font-bold leading-tight" title={away}>
              {away}
            </p>
          </>
        )}
      </div>

      {progress !== null && (
        <div className="mb-3 h-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-tertiary)" }}>
          <div className="h-full rounded-full bg-red-600" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Link
          href={`/iptv/watch/${game.channelId}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: isLive ? "var(--brand-red)" : "var(--text-secondary)" }}
        >
          <Play className="h-4 w-4 fill-current" /> {isLive ? "Watch live" : "Open channel"}
        </Link>
        {game.altChannelIds.map((id, i) => (
          <Link
            key={id}
            href={`/iptv/watch/${id}`}
            title={`Backup stream ${i + 1}`}
            className="rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
          >
            Alt {i + 1}
          </Link>
        ))}
      </div>
    </div>
  );
}

function TimeBadge({ game, now }: { game: Game; now: number }) {
  if (game.status === "live") {
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
      </span>
    );
  }
  if (game.start) {
    const time = new Date(game.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return (
      <span className="flex-shrink-0 text-xs font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {time} <span className="font-normal" style={{ color: "var(--text-muted)" }}>· {relative(game.start - now)}</span>
      </span>
    );
  }
  return game.timeText ? (
    <span className="flex-shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
      {game.timeText}
    </span>
  ) : null;
}

function relative(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `in ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

/** Groups upcoming games under "Today", "Tomorrow" or a date, in the visitor's timezone. */
function groupByDay(games: Game[], now: number): [string, Game[]][] {
  const dayKey = (t: number) => new Date(t).toDateString();
  const today = dayKey(now);
  const tomorrow = dayKey(now + 24 * 60 * 60 * 1000);
  const groups = new Map<string, Game[]>();
  for (const g of games) {
    if (!g.start) continue;
    const key = dayKey(g.start);
    const label =
      key === today ? "Coming up today" : key === tomorrow ? "Tomorrow" : new Date(g.start).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(g);
  }
  return [...groups];
}
