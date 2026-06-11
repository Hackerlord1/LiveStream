"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  const [columns, setColumns] = useState(7);

  // Responsive columns
  useEffect(() => {
    function updateColumns() {
      const w = window.innerWidth;
      if (w < 400) setColumns(2);
      else if (w < 640) setColumns(3);
      else if (w < 768) setColumns(4);
      else if (w < 1024) setColumns(5);
      else if (w < 1280) setColumns(6);
      else setColumns(7);
    }
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${VPS_URL}/api/channels/all`);
        const data = await res.json();
        if (data.channels?.length > 0) {
          setAllChannels(data.channels);
          sessionStorage.setItem(
            "iptv-channels-cache-v3",
            JSON.stringify(data.channels)
          );
        } else if (data.loading) {
          setError("Server still loading channels. Please refresh.");
        }
      } catch (e) {
        const stored = sessionStorage.getItem("iptv-channels-cache-v3");
        if (stored) setAllChannels(JSON.parse(stored));
        else setError("Failed to load channels");
      }
      setLoading(false);
    }
    load();
  }, []);

  const filteredChannels = useMemo(() => {
    if (!search.trim()) return allChannels;
    const q = search.toLowerCase();
    return allChannels.filter((ch: any) => {
      const name = (ch.name || "").toLowerCase();
      const number = (ch.number || "").toString();
      return name.includes(q) || number === q;
    });
  }, [allChannels, search]);

  const totalRows = Math.ceil(filteredChannels.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,

    // ✅ FIXED HEIGHT CALCULATION (DESKTOP SAFE)
    estimateSize: () => {
      if (columns <= 3) return 120;   // mobile unchanged ✅
      if (columns <= 5) return 140;   // tablet
      return 150;                     // desktop fix ✅
    },

    overscan: 5,
  });

  if (loading) {
    return (
      <div
        className="h-screen flex flex-col"
        style={{ backgroundColor: "var(--neu-bg-page)" }}
      >
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" />
            <p style={{ color: "var(--text-muted)" }}>
              Loading channels...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundColor: "var(--neu-bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <Header />

      {/* HEADER */}
      <div className="px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/iptv"
              className="text-sm hover:underline flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              ← Back
            </Link>

            <h1 className="text-xl sm:text-2xl font-bold flex-shrink-0">
              📺 Channels
            </h1>

            <span
              className="text-xs sm:text-sm flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              ({filteredChannels.length.toLocaleString()})
            </span>
          </div>

          {error && (
            <div
              className="mb-2 p-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--error-bg)",
                color: "var(--error-text)",
              }}
            >
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{
              backgroundColor: "var(--surface-primary)",
              border: "2px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* CHANNEL GRID */}
      <div className="flex-1 overflow-hidden px-2 sm:px-4 pb-4">
        <div className="max-w-7xl mx-auto h-full">
          <div
            ref={parentRef}
            className="h-full overflow-auto rounded-xl"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "var(--border-primary) transparent",
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const start = virtualRow.index * columns;
                const rowChannels = filteredChannels.slice(
                  start,
                  start + columns
                );

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
                    }}
                  >
                    <div
                      className="grid px-2"
                      style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,

                        // ✅ DESKTOP SPACING FIX
                        rowGap: columns >= 6 ? "16px" : "12px",
                        columnGap: columns >= 6 ? "14px" : "10px",
                      }}
                    >
                      {rowChannels.map((channel: any) => (
                        <Link
                          key={`${channel.id}_${channel.number}`}
                          href={`/iptv/watch/${channel.id}`}
                          title={channel.name}
                          className={`neumorphic-card rounded-xl text-center ${columns >= 6 ? "p-2.5" : "p-2.5"}`}
                        >
                          <div className="w-full h-10 sm:h-14 flex items-center justify-center mb-1">
                            {channel.logo ? (
                              <img
                                src={channel.logo}
                                alt=""
                                loading="lazy"
                                className="max-h-full max-w-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <span className="text-lg sm:text-xl">📺</span>
                            )}
                          </div>

                          <p className="font-semibold text-[9px] sm:text-[10px] leading-tight line-clamp-2">
                            {channel.name}
                          </p>

                          <p
                            className="text-[9px] sm:text-[10px] mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Ch. {channel.number}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}