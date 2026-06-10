"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { ArrowLeft, Clock, Search, Trophy, Tv, X } from "lucide-react";

const CACHE_KEY = "iptv-channels-cache-v3";

function getChannelName(channelId: string): string {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const channels = JSON.parse(cached);
      const found = channels.find((ch: any) => String(ch.id) === String(channelId));
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
  const [visibleCount, setVisibleCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "iptv:getLiveGames", args: { period: 1, page: 0, pageSize: 5000 } }),
        });
        const data = await res.json();
        setAllGames(data.value?.games || []);
      } catch (e) {
        setError("Failed to load games");
      }
      setLoading(false);
    }
    load();
  }, []);

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return allGames;
    const q = searchQuery.toLowerCase();
    return allGames.filter((game: any) => {
      const title = String(game.title || "").toLowerCase();
      const channelName = getChannelName(game.channelId).toLowerCase();
      return title.includes(q) || channelName.includes(q);
    });
  }, [allGames, searchQuery]);

  // Lazy load: show 50, then 50 more on scroll
  const visibleGames = useMemo(() => {
    return filteredGames.slice(0, visibleCount);
  }, [filteredGames, visibleCount]);

  // Load more on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
        if (visibleCount < filteredGames.length) {
          setVisibleCount(prev => Math.min(prev + 50, filteredGames.length));
        }
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredGames.length]);

  // Reset visible count on search
  useEffect(() => {
    setVisibleCount(50);
  }, [searchQuery]);

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
      <div className="px-4 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <Link href="/iptv" className="text-sm hover:underline flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft className="h-4 w-4 inline mr-1" />Back
            </Link>
            <Trophy className="h-5 w-5 text-red-500 flex-shrink-0" />
            <h1 className="text-2xl font-bold flex-shrink-0">Live Games</h1>
            <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              ({filteredGames.length.toLocaleString()})
            </span>
          </div>
          {error && (
            <div className="mb-2 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)' }}>{error}</div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches or teams..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm"
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

      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="max-w-3xl mx-auto h-full">
          <div ref={scrollRef} className="h-full overflow-auto rounded-xl" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-primary) transparent' }}>
            {filteredGames.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No live games right now</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {visibleGames.map((game: any, i: number) => {
                  const channelName = getChannelName(game.channelId);
                  return (
                    <Link
                      key={`${game.channelId}-${i}`}
                      href={`/iptv/watch/${game.channelId}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:shadow-md transition-all"
                      style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{game.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{game.startTime || "TBD"}</span>
                          <span className="flex items-center gap-1"><Tv className="h-3 w-3" />{channelName || `Ch ${game.channelId}`}</span>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold flex-shrink-0">WATCH</span>
                    </Link>
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