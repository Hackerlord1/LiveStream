"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
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

// ✅ Update this to match your server (use port 3822 - external forwarding to internal 3477)
const VPS_URL = "http://57.129.106.133:3822";

type Game = {
  title?: string;
  channelId?: string | number;
  startTime?: string;
  channelName?: string;
};

// ============================================================
// CHANNEL MAP FROM VPS (not sessionStorage)
// ============================================================
let channelMapCache: Record<string, string> | null = null;

async function fetchChannelMap(): Promise<Record<string, string>> {
  if (channelMapCache) return channelMapCache;

  try {
    const res = await fetch(`${VPS_URL}/api/channels-all`);
    const data = await res.json();
    const channels = data.channels || [];

    console.log(`📡 Loaded ${channels.length} channels from VPS`);

    const map: Record<string, string> = {};
    for (const ch of channels) {
      if (ch.name) {
        if (ch.id) map[String(ch.id)] = ch.name;
        if (ch.number) map[String(ch.number)] = ch.name;
      }
    }

    // Debug: Check specific missing channel
    console.log("108906 lookup:", map["108906"] || "NOT FOUND");
    console.log("45233 lookup:", map["45233"] || "NOT FOUND");

    channelMapCache = map;
    return map;
  } catch (e) {
    console.error("Failed to load channel map:", e);
    return {};
  }
}

function getChannelName(channelId: string | number, channelMap: Record<string, string>): string {
  const id = String(channelId ?? "").trim();
  if (!id) return "";
  return channelMap[id] || "";
}

// ============================================================
// COMPONENT
// ============================================================
export default function IptvGamesPage() {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  const parentRef = useRef<HTMLDivElement>(null);

  // Load channel map + games
  useEffect(() => {
    const controller = new AbortController();

    async function loadGames() {
  setLoading(true);
  setError("");

  try {
    // 1. Load channel map from VPS
    const map = await fetchChannelMap();
    setChannelMap(map);
    console.log("✅ Channel map loaded:", Object.keys(map).length, "entries");

    // 2. Fetch EPG data from VPS
    console.log("📡 Fetching EPG data from VPS...");
    const res = await fetch(`${VPS_URL}/api/epg`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`EPG fetch failed with status ${res.status}`);
    }

    const epgData = await res.json();
    console.log("📡 EPG data received");

    // 3. Transform EPG data into games format
    const games: Game[] = [];
    
    // EPG data structure: { js: { data: { "channel_id": [{ epg entries }] } } }
    const channels = epgData?.js?.data || {};
    
    const now = Date.now();
    
    for (const [channelId, epgEntries] of Object.entries(channels)) {
      if (!Array.isArray(epgEntries)) continue;
      
      for (const entry of epgEntries as any[]) {
        const startTime = entry.start_timestamp ? new Date(entry.start_timestamp * 1000) : null;
        const endTime = entry.stop_timestamp ? new Date(entry.stop_timestamp * 1000) : null;
        const title = entry.name || "";
        
        // Only include current or upcoming programs
        if (startTime && endTime && endTime.getTime() > now) {
          games.push({
            title: title,
            channelId: channelId,
            startTime: startTime.toISOString(),
            channelName: map[channelId] || "",
          });
        }
      }
    }

    // Sort by start time
    games.sort((a, b) => {
      const timeA = new Date(a.startTime || "").getTime() || 0;
      const timeB = new Date(b.startTime || "").getTime() || 0;
      return timeA - timeB;
    });

    console.log(`✅ Loaded ${games.length} programs from EPG`);
    setAllGames(games);
  } catch (err: any) {
    console.error("❌ Error loading games:", err);
    if (err?.name !== "AbortError") {
      setError("Failed to load games: " + err.message);
      setAllGames([]);
    }
  } finally {
    if (!controller.signal.aborted) setLoading(false);
  }
}

    loadGames();
    return () => controller.abort();
  }, []);

  // Filter + sort games
  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let games = allGames;

    if (q) {
      games = games.filter((game) => {
        const title = String(game.title || "").toLowerCase();
        const channelId = String(game.channelId || "").toLowerCase();
        const channelName = getChannelName(game.channelId || "", channelMap).toLowerCase();
        return title.includes(q) || channelName.includes(q) || channelId.includes(q);
      });
    }

    // Sort by time
    games = [...games].sort((a, b) => {
      const timeA = new Date(a.startTime || "").getTime() || 0;
      const timeB = new Date(b.startTime || "").getTime() || 0;
      return timeA - timeB;
    });

    return games;
  }, [allGames, searchQuery, channelMap]);

  const rowVirtualizer = useVirtualizer({
    count: filteredGames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 12,
  });

  if (loading) {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: "var(--neu-bg-page)" }}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" />
            <p style={{ color: "var(--text-muted)" }}>Loading games...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "var(--neu-bg-page)", color: "var(--text-primary)" }}>
      <Header />

      {/* Header Bar */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <Link href="/iptv" className="text-sm flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft className="h-4 w-4 inline mr-1" />Back
            </Link>
            <Trophy className="h-5 w-5 text-red-500 flex-shrink-0" />
            <h1 className="text-2xl font-bold flex-shrink-0">Live Games</h1>
            <span className="text-sm flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              ({filteredGames.length.toLocaleString()})
            </span>
          </div>

          {error && (
            <div className="mb-2 p-2 rounded-lg text-sm" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>
              {error}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--text-muted)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches, teams, or channels..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--surface-primary)", border: "2px solid var(--border-primary)", color: "var(--text-primary)" }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear search">
                <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="max-w-7xl mx-auto h-full">
          <div ref={parentRef} className="h-full overflow-auto rounded-xl" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border-primary) transparent" }}>
            {filteredGames.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-lg" style={{ color: "var(--text-muted)" }}>No live games found</p>
                </div>
              </div>
            ) : (
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const game = filteredGames[virtualRow.index];
                  const channelName = getChannelName(game.channelId || "", channelMap);
                  const displayChannel = channelName || `Channel ${game.channelId || "?"}`;

                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        paddingBottom: "8px",
                      }}
                    >
                      <Link
                        href={`/iptv/watch/${encodeURIComponent(String(game.channelId || ""))}`}
                        className="neumorphic-card mx-1 relative block overflow-hidden rounded-2xl p-4"
                      >
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-red-600 to-orange-500 opacity-80" />
                        <div className="flex items-center justify-between pl-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <CirclePlay className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <h2 className="text-sm font-bold truncate">{game.title || "Untitled game"}</h2>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                              <span className="flex items-center gap-1 min-w-0">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{game.startTime || "TBD"}</span>
                              </span>
                              <span className="flex items-center gap-1 min-w-0">
                                <Tv className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{displayChannel}</span>
                              </span>
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