"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useLiveGames } from "@/hooks/use-iptv-wrapper";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowLeft,
  CirclePlay,
  Clock,
  Search,
  Trophy,
  Tv,
  X,
} from "lucide-react";

const CACHE_KEY = "iptv-channels-cache-v3";

function getChannelName(channelId: string): string {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const channels = JSON.parse(cached);
      const found = channels.find(
        (ch: any) => String(ch.id) === String(channelId)
      );
      if (found?.name) return found.name;
    }
  } catch (e) {}
  return "";
}

export default function IptvGamesPage() {
  const [allGames, setAllGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  // Load ALL games at once
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch a large page to get all games
        const res = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "iptv:getLiveGames",
            args: { period: 1, page: 0, pageSize: 5000 },
          }),
        });
        const data = await res.json();
        const games = data.value?.games || [];
        setAllGames(games);
      } catch (e) {
        setError("Failed to load games");
      }
      setLoading(false);
    }
    load();
  }, []);

  const filteredGames = useMemo(() => {
    let games = [...allGames];
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      games = games.filter((game: any) => {
        const title = String(game.title || "").toLowerCase();
        const channelName = getChannelName(game.channelId).toLowerCase();
        const channelId = String(game.channelId || "");
        return title.includes(query) || channelName.includes(query) || channelId.includes(query);
      });
    }
    // Sort by time
    games.sort((a: any, b: any) => {
      const timeA = new Date(a.startTime).getTime() || 0;
      const timeB = new Date(b.startTime).getTime() || 0;
      return timeA - timeB;
    });
    return games;
  }, [allGames, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredGames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--neu-bg-page)' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" />
            <p style={{ color: 'var(--text-muted)' }}>Loading games...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}>
      <Header />

      {/* Header + Search - Fixed */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <Link href="/iptv" className="text-sm hover:underline flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft className="h-4 w-4 inline mr-1" />Back
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Trophy className="h-5 w-5 text-red-500" />
              <h1 className="text-2xl font-bold">Live Games</h1>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              ({filteredGames.length.toLocaleString()} matches)
            </span>
          </div>

          {error && (
            <div className="mb-2 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)' }}>
              {error}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches, teams, or channels..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              style={{ backgroundColor: 'var(--surface-primary)', border: '2px solid var(--border-primary)', color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Virtual Games List - Fills remaining space */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="max-w-7xl mx-auto h-full">
          <div
            ref={parentRef}
            className="h-full overflow-auto rounded-xl"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--border-primary) transparent',
            }}
          >
            {filteredGames.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No live games right now</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Check back when matches are scheduled</p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const game = filteredGames[virtualRow.index];
                  const channelName = getChannelName(game.channelId);

                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <Link
                        href={`/iptv/watch/${game.channelId}`}
                        className="neumorphic-card mx-1 relative block overflow-hidden rounded-2xl p-4 hover:shadow-lg transition-all"
                      >
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-red-600 to-orange-500 opacity-80" />
                        <div className="flex items-center justify-between pl-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <CirclePlay className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <h2 className="text-sm font-bold truncate">{game.title}</h2>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{game.startTime || "TBD"}</span>
                              <span className="flex items-center gap-1"><Tv className="h-3 w-3" />{channelName || `Ch ${game.channelId}`}</span>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg font-bold flex-shrink-0 ml-3">WATCH</span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}