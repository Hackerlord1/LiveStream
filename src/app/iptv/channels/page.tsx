"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";
const CHANNELS_PER_PAGE = 56;
const CACHE_KEY = "iptv-channels-cache-v2";

async function callWrapper(path: string, args: Record<string, any> = {}) {
  const res = await fetch(WRAPPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  return data.value;
}

// ============================================================
// PERSISTENT CACHE
// ============================================================
let allChannelsCache: any[] = [];
let cacheLoading = false;
let cacheLoaded = false;

if (typeof window !== "undefined") {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 100) {
        allChannelsCache = parsed;
        cacheLoaded = true;
      }
    }
  } catch (e) {}
}

function saveCache() {
  if (typeof window !== "undefined" && allChannelsCache.length > 100) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(allChannelsCache.slice(0, 5000)));
    } catch (e) {}
  }
}

async function loadAllChannels(onProgress: (loaded: number, total: number) => void): Promise<any[]> {
  if (cacheLoaded) return allChannelsCache;
  if (cacheLoading) {
    while (cacheLoading) await new Promise(r => setTimeout(r, 500));
    return allChannelsCache;
  }

  cacheLoading = true;
  const seen = new Set<string>();
  allChannelsCache = [];

  try {
    const firstPage = await callWrapper("iptv:getOrderedList", { page: 0, genre: "*", sortby: "number" });
    const totalItems = firstPage?.js?.total_items || 28386;
    const totalPages = Math.ceil(totalItems / 14);

    for (const ch of firstPage?.js?.data || []) {
      const key = `${ch.id}_${ch.number}`;
      if (!seen.has(key)) { seen.add(key); allChannelsCache.push(ch); }
    }
    onProgress(allChannelsCache.length, totalItems);
    saveCache();

    for (let p = 1; p < totalPages && p < 500; p += 5) {
      const batch = [];
      for (let i = 0; i < 5 && p + i < totalPages; i++) {
        batch.push(callWrapper("iptv:getOrderedList", { page: p + i, genre: "*", sortby: "number" }));
      }

      const results = await Promise.all(batch);
      let batchCount = 0;
      for (const result of results) {
        if (result?.js?.data) {
          for (const ch of result.js.data) {
            const key = `${ch.id}_${ch.number}`;
            if (!seen.has(key)) { seen.add(key); allChannelsCache.push(ch); batchCount++; }
          }
        }
      }

      onProgress(allChannelsCache.length, totalItems);
      saveCache();
      if (batchCount === 0 && p > 10) break;
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (e) {
    console.error("Cache load error:", e);
  }

  cacheLoaded = true;
  cacheLoading = false;
  return allChannelsCache;
}

// ============================================================
// COMPONENT
// ============================================================
export default function IptvChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [cacheProgress, setCacheProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState("");
  const loaderRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // Initial load — restore cache or fresh load
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");

      // Restore from cache immediately
      if (allChannelsCache.length > 0) {
        setChannels(allChannelsCache.slice(0, CHANNELS_PER_PAGE));
        setTotalItems(allChannelsCache.length);
        setHasMore(allChannelsCache.length > CHANNELS_PER_PAGE);
        setLoading(false);
        restoredRef.current = true;

        if (!cacheLoaded) {
          loadAllChannels((loaded, total) => setCacheProgress({ loaded, total }));
        }
        return;
      }

      // Fresh load
      try {
        const firstPage = await callWrapper("iptv:getOrderedList", { page: 0, genre: "*", sortby: "number" });
        const initialChannels = firstPage?.js?.data || [];
        setChannels(initialChannels);
        setTotalItems(firstPage?.js?.total_items || 0);
        setHasMore((firstPage?.js?.total_items || 0) > CHANNELS_PER_PAGE);
        setLoading(false);

        loadAllChannels((loaded, total) => setCacheProgress({ loaded, total }));
      } catch (e) {
        setError("Failed to load channels");
        setLoading(false);
      }
    }

    init();
  }, []);

  // Load more on scroll
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || searchResults !== null) return;
    setLoadingMore(true);

    const source = allChannelsCache.length > 0 ? allChannelsCache : channels;
    const currentCount = channels.length;
    const nextBatch = source.slice(currentCount, currentCount + CHANNELS_PER_PAGE);

    if (nextBatch.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    setChannels(prev => [...prev, ...nextBatch]);
    setHasMore(currentCount + nextBatch.length < source.length);
    setLoadingMore(false);
  }, [loadingMore, hasMore, channels, searchResults]);

  // Intersection Observer
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(loader);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  // Instant search
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const q = query.toLowerCase();
    const source = allChannelsCache.length > 0 ? allChannelsCache : channels;
    const results = source.filter((ch: any) => {
      const name = (ch.name || "").toLowerCase();
      const number = (ch.number || "").toString();
      return name.includes(q) || number === q;
    }).slice(0, 50);
    setSearchResults(results);
  }, [channels]);

  const displayChannels = searchResults !== null ? searchResults : channels;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/iptv" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>← Back</Link>
          <h1 className="text-3xl font-bold">📺 Live Channels</h1>
          <span style={{ color: 'var(--text-muted)' }}>
            ({allChannelsCache.length > 0 ? allChannelsCache.length.toLocaleString() : `${totalItems.toLocaleString()} total`})
          </span>
        </div>

        {!cacheLoaded && cacheProgress.total > 0 && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              📥 Caching: {cacheProgress.loaded.toLocaleString()} / {cacheProgress.total.toLocaleString()}
            </p>
            <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: 'var(--surface-secondary)' }}>
              <div className="h-1 rounded-full bg-red-600 transition-all" style={{ width: `${(cacheProgress.loaded / cacheProgress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--brand-red)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={allChannelsCache.length > 100 ? "Instant search..." : "Search channels..."}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  e.target.value.trim() ? performSearch(e.target.value) : setSearchResults(null);
                }}
                className="w-full px-5 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--surface-primary)', border: '2px solid var(--border-primary)', color: 'var(--text-primary)' }}
              />
            </div>
            {searchResults !== null && (
              <button onClick={() => { setSearch(""); setSearchResults(null); }} className="px-4 py-3 rounded-xl font-medium"
                style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                Clear
              </button>
            )}
          </div>
          {searchResults !== null && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Found {searchResults.length} channel{searchResults.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600" />
          </div>
        )}

        {!loading && displayChannels.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {displayChannels.map((channel: any) => (
              <Link key={`${channel.id}_${channel.number}`} href={`/iptv/watch/${channel.id}`}
                className="neumorphic-card p-3 rounded-xl hover:shadow-lg transition-all text-center group" title={channel.name}>
                <div className="w-full h-20 flex items-center justify-center mb-2 relative">
                  {channel.logo ? (
                    <img src={channel.logo} alt={channel.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.logo-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }} />
                  ) : null}
                  <span className="logo-fallback text-3xl" style={{ display: channel.logo ? 'none' : 'flex' }}>📺</span>
                </div>
                <p className="font-semibold text-xs leading-tight group-hover:text-red-600 transition-colors line-clamp-2">{channel.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ch. {channel.number}</p>
                <div className="flex justify-center gap-1 mt-1.5">
                  {channel.hd === 1 && <span className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded">HD</span>}
                  {channel.censored === 0 && <span className="text-xs px-1.5 py-0.5 bg-green-600 text-white rounded">LIVE</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && displayChannels.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-xl">No channels found</p>
          </div>
        )}

        {searchResults === null && (
          <div ref={loaderRef} className="flex justify-center py-12">
            {loadingMore && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600" />}
            {!hasMore && channels.length > 0 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All channels loaded 🎉</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}