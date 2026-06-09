"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { callWrapper, useLiveGames } from "@/hooks/use-iptv-wrapper";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Clock,
  Hash,
  Search,
  SlidersHorizontal,
  Trophy,
  X,
} from "lucide-react";

const PAGE_SIZE = 300;

function getTimeValue(startTime: any) {
  if (!startTime) return Number.MAX_SAFE_INTEGER;

  const value = String(startTime).trim();
  const parsedDate = new Date(value);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = Number(timeMatch[3] || 0);

    return hours * 60 * 60 + minutes * 60 + seconds;
  }

  return Number.MAX_SAFE_INTEGER;
}

function buildChannelMap(channels: any[]) {
  const map: Record<string, any> = {};

  for (const channel of channels) {
    if (channel?.id) {
      map[String(channel.id)] = channel;
    }
  }

  return map;
}

export default function IptvGamesPage() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("time-asc");
  const [channelMap, setChannelMap] = useState<Record<string, any>>({});

  const { fetch: fetchGames } = useLiveGames(1, page, PAGE_SIZE);

  useEffect(() => {
    let mounted = true;

    async function loadGames() {
      setLoading(true);

      try {
        const result = await fetchGames();

        if (!mounted) return;

        setData(result);

        const games = result?.games || [];

        const channelIds = Array.from(
          new Set(
            games
              .map((game: any) => Number(game.channelId))
              .filter((id: number) => !Number.isNaN(id))
          )
        );

        if (channelIds.length > 0) {
          try {
            const channelResult = await callWrapper("iptv:getChannelsByIds", {
              channelIds,
            });

            if (!mounted) return;

            const channels = channelResult?.js?.data || [];
            setChannelMap(buildChannelMap(channels));
          } catch (channelError) {
            console.error("Failed to load channel names:", channelError);
            setChannelMap({});
          }
        } else {
          setChannelMap({});
        }
      } catch (error) {
        console.error("Failed to fetch live games:", error);

        if (mounted) {
          setData({
            games: [],
            total: 0,
            totalPages: 1,
          });
          setChannelMap({});
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadGames();

    return () => {
      mounted = false;
    };
  }, [page, fetchGames]);

  const gameData = data?.games || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const filteredGames = useMemo(() => {
    let games = [...gameData];

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      games = games.filter((game: any) => {
        const title = String(game.title || "").toLowerCase();
        const channelId = String(game.channelId || "").toLowerCase();
        const startTime = String(game.startTime || "").toLowerCase();
        const apiChannelName = String(game.channelName || "").toLowerCase();
        const mappedChannelName = String(
          channelMap[String(game.channelId)]?.name || ""
        ).toLowerCase();

        return (
          title.includes(query) ||
          channelId.includes(query) ||
          startTime.includes(query) ||
          apiChannelName.includes(query) ||
          mappedChannelName.includes(query)
        );
      });
    }

    if (sortBy === "time-asc") {
      games.sort(
        (a: any, b: any) =>
          getTimeValue(a.startTime) - getTimeValue(b.startTime)
      );
    }

    if (sortBy === "time-desc") {
      games.sort(
        (a: any, b: any) =>
          getTimeValue(b.startTime) - getTimeValue(a.startTime)
      );
    }

    if (sortBy === "title-asc") {
      games.sort((a: any, b: any) =>
        String(a.title || "").localeCompare(String(b.title || ""))
      );
    }

    if (sortBy === "title-desc") {
      games.sort((a: any, b: any) =>
        String(b.title || "").localeCompare(String(a.title || ""))
      );
    }

    if (sortBy === "channel-asc") {
      games.sort(
        (a: any, b: any) =>
          Number(a.channelId || 0) - Number(b.channelId || 0)
      );
    }

    if (sortBy === "channel-desc") {
      games.sort(
        (a: any, b: any) =>
          Number(b.channelId || 0) - Number(a.channelId || 0)
      );
    }

    return games;
  }, [gameData, searchQuery, sortBy, channelMap]);

  const hasActiveFilters = searchQuery.trim() !== "" || sortBy !== "time-asc";

  function clearFilters() {
    setSearchQuery("");
    setSortBy("time-asc");
  }

  function goToPreviousPage() {
    setPage((currentPage) => Math.max(0, currentPage - 1));
    clearFilters();
  }

  function goToNextPage() {
    setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1));
    clearFilters();
  }

  function getChannelName(game: any) {
    return (
      game.channelName ||
      channelMap[String(game.channelId)]?.name ||
      `Channel ${game.channelId}`
    );
  }

  if (loading) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--neu-bg-page)" }}
      >
        <Header />

        <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="neumorphic-card rounded-3xl p-8 text-center">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-red-600/20 border-t-red-600" />

            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Loading live games...
            </h2>

            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Please wait while we fetch the latest {PAGE_SIZE} Live Events.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--neu-bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/iptv"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to IPTV
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg">
                <Trophy className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Live Games
                </h1>

                <p
                  className="mt-1 text-sm sm:text-base"
                  style={{ color: "var(--text-muted)" }}
                >
                  Matches are sorted by time, earliest first.
                </p>
              </div>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-sm backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
            <span className="text-sm font-semibold">
              {total.toLocaleString()} matches
            </span>
          </div>
        </div>

        <section className="neumorphic-card mb-6 rounded-3xl p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by match, time, or channel..."
                className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-12 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="relative">
              <SlidersHorizontal
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/10 py-3 pl-12 pr-4 text-sm outline-none transition focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="time-asc">Time earliest first</option>
                <option value="time-desc">Time latest first</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
                <option value="channel-asc">Channel low-high</option>
                <option value="channel-desc">Channel high-low</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold transition hover:bg-white/15"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          <div className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Showing {filteredGames.length} of {gameData.length} loaded matches
            on this page.
          </div>
        </section>

        {filteredGames.length > 0 ? (
          <section className="mb-8 space-y-3">
            {filteredGames.map((game: any, i: number) => (
              <Link
                key={`${game.channelId}-${game.startTime}-${i}`}
                href={`/iptv/watch/${game.channelId}`}
                className="neumorphic-card relative block overflow-hidden rounded-2xl p-5"
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-red-600 to-orange-500 opacity-80" />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 pl-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600/10 text-red-500">
                        <CirclePlay className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-lg font-bold leading-snug sm:text-xl">
                          {game.title}
                        </h2>

                        <div
                          className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {game.startTime || "Time unavailable"}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <Hash className="h-4 w-4" />
                            {getChannelName(game)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-500">
                      Live
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-600/20">
                      Watch
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="neumorphic-card mb-8 rounded-3xl p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 text-red-500">
              <Search className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-bold">No games found</h2>

            <p
              className="mx-auto mt-2 max-w-md"
              style={{ color: "var(--text-muted)" }}
            >
              Try another search term or clear the filters.
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </section>
        )}

        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:flex-row">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={page === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold">
              Page {page + 1} of {totalPages}
            </p>

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {PAGE_SIZE} matches per page
            </p>
          </div>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={page >= totalPages - 1}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}