"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

export default function IptvChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [cacheStatus, setCacheStatus] = useState("");

  useEffect(() => {
    async function load() {
      // Only run on client side
      if (typeof window === "undefined") {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/channels-all`);
        const data = await res.json();

        if (data.channels && data.channels.length > 0) {
          setChannels(data.channels);
          if (!data.ready) {
            setCacheStatus(`Loading from server... ${data.total?.toLocaleString()} loaded so far`);
          }
        } else if (data.loading) {
          setError("Server is still caching channels. Please wait a moment and refresh.");
          setCacheStatus("First-time setup in progress...");
        } else {
          setError("Trying backup source...");
          try {
            const convexRes = await fetch("https://neighborly-perch-272.convex.cloud/api/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: "iptv:getOrderedList", args: { page: 0, genre: "*", sortby: "number" } }),
            });
            const convexData = await convexRes.json();
            const initialChannels = convexData.value?.js?.data || [];
            setChannels(initialChannels);
            setError("");
          } catch (e2) {
            setError("Failed to load channels. Please try again.");
          }
        }
      } catch (e) {
        try {
          const stored = sessionStorage.getItem("iptv-channels-cache-v3");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 100) {
              setChannels(parsed);
              setError("");
            }
          }
        } catch (e2) {}
        if (channels.length === 0) setError("Failed to load channels. Please try again.");
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (channels.length > 100) {
      try {
        sessionStorage.setItem("iptv-channels-cache-v3", JSON.stringify(channels));
      } catch (e) {}
    }
  }, [channels]);

  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const q = query.toLowerCase();
    const results = channels.filter((ch: any) => {
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
            ({channels.length > 0 ? channels.length.toLocaleString() : "..."} channels)
          </span>
        </div>

        {cacheStatus && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>📥 {cacheStatus}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--brand-red)', color: 'var(--error-text)' }}>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-sm underline hover:no-underline">
              Refresh Page
            </button>
          </div>
        )}

        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={channels.length > 100 ? "Instant search across all channels..." : "Loading channels..."}
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
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" />
              <p style={{ color: 'var(--text-muted)' }}>Loading all channels...</p>
            </div>
          </div>
        )}

        {!loading && displayChannels.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {displayChannels.map((channel: any) => (
              <Link
                key={`${channel.id}_${channel.number}`}
                href={`/iptv/watch/${channel.id}`}
                className="neumorphic-card p-3 rounded-xl hover:shadow-lg transition-all text-center group"
                title={channel.name}
              >
                <div className="w-full h-20 flex items-center justify-center mb-2 relative">
                  {channel.logo ? (
                    <img src={channel.logo} alt={channel.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" loading="lazy"
                      onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.parentElement?.querySelector('.logo-fallback') as HTMLElement).style.display = 'flex'; }} />
                  ) : null}
                  <span className="logo-fallback text-3xl" style={{ display: channel.logo ? 'none' : 'flex' }}>📺</span>
                </div>
                <p className="font-semibold text-xs leading-tight group-hover:text-red-600 transition-colors line-clamp-2">{channel.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ch. {channel.number}</p>
                <div className="flex justify-center gap-1 mt-1.5">
                  {channel.hd === 1 && <span className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded">HD</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && displayChannels.length === 0 && !error && (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-xl">No channels found</p>
          </div>
        )}
      </main>
    </div>
  );
}