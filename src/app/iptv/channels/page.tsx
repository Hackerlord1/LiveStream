"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useVirtualizer } from "@tanstack/react-virtual";

const VPS_URL = "https://hls.bravestream.live";

export default function IptvChannelsPage() {
  const [allChannels, setAllChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  // Load channels once
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${VPS_URL}/api/channels/all`);
        const data = await res.json();

        if (data.channels?.length > 0) {
          setAllChannels(data.channels);
          sessionStorage.setItem("iptv-channels-cache-v3", JSON.stringify(data.channels));
        } else if (data.loading) {
          setError("Server still loading channels. Please refresh.");
        }
      } catch (e) {
        // Fallback to sessionStorage
        const stored = sessionStorage.getItem("iptv-channels-cache-v3");
        if (stored) setAllChannels(JSON.parse(stored));
        else setError("Failed to load channels");
      }
      setLoading(false);
    }
    load();
  }, []);

  // Filter channels for search — memoized, doesn't block rendering
  const filteredChannels = useMemo(() => {
    if (!search.trim()) return allChannels;
    const q = search.toLowerCase();
    return allChannels.filter((ch: any) => {
      const name = (ch.name || "").toLowerCase();
      const number = (ch.number || "").toString();
      return name.includes(q) || number === q;
    });
  }, [allChannels, search]);

  // Virtual list — only renders visible rows
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredChannels.length / 7), // 7 columns per row
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 3,
  });

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)' }}>
        <Header />
        <main className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" />
            <p style={{ color: 'var(--text-muted)' }}>Loading channels...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/iptv" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>← Back</Link>
          <h1 className="text-3xl font-bold">📺 Live Channels</h1>
          <span style={{ color: 'var(--text-muted)' }}>
            ({filteredChannels.length.toLocaleString()} channels)
          </span>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-5 py-3 rounded-xl text-sm"
            style={{ backgroundColor: 'var(--surface-primary)', border: '2px solid var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Virtual Channel Grid */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: 'calc(100vh - 250px)' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const start = virtualRow.index * 7;
              const rowChannels = filteredChannels.slice(start, start + 7);

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
                  <div className="grid grid-cols-7 gap-3">
                    {rowChannels.map((channel: any) => (
                      <Link
                        key={`${channel.id}_${channel.number}`}
                        href={`/iptv/watch/${channel.id}`}
                        className="neumorphic-card p-3 rounded-xl hover:shadow-lg transition-all text-center group"
                        title={channel.name}
                      >
                        <div className="w-full h-16 flex items-center justify-center mb-1">
                          {channel.logo ? (
                            <img src={channel.logo} alt="" className="max-h-full max-w-full object-contain" loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-2xl">📺</span>
                          )}
                        </div>
                        <p className="font-semibold text-[10px] leading-tight line-clamp-2">{channel.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Ch. {channel.number}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}