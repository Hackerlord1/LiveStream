"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useVirtualizer } from "@tanstack/react-virtual";

const VPS_URL = "http://57.129.106.133:3822";

export default function IptvChannelsPage() {
  const [allChannels, setAllChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState({
    ready: false,
    progress: { percent: 0, loaded: 0, total: 0 },
  });
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(7);

  // ✅ Responsive columns
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

  // ✅ FETCH channels
  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout;

    async function fetchData() {
      try {
        console.log(`Fetching from: ${VPS_URL}/api/channels-all`);
        const res = await fetch(`${VPS_URL}/api/channels-all`);
        console.log(`Response status: ${res.status}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        console.log(`Channels received:`, data);

        if (!mounted) return;

        if (data.channels && data.channels.length > 0) {
          setAllChannels(data.channels);
          setLoading(false);
          setError("");
        }

        setCacheStatus({
          ready: data.ready,
          progress: {
            percent:
              data.total > 0
                ? Math.round((data.channels.length / data.total) * 100)
                : 0,
            loaded: data.channels.length,
            total: data.total,
          },
        });

        if (data.ready) {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        if (!mounted) return;
        setError(`Failed to load channels: ${err instanceof Error ? err.message : "Unknown error"}`);
        setLoading(false);
      }
    }

    fetchData();
    pollInterval = setInterval(fetchData, 2000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  // ✅ Search
  const filteredChannels = useMemo(() => {
    if (!search.trim()) return allChannels;
    const q = search.toLowerCase();
    return allChannels.filter((ch) => {
      const name = (ch.name || "").toLowerCase();
      const number = (ch.number || "").toString();
      return name.includes(q) || number === q;
    });
  }, [allChannels, search]);

  const totalRows = Math.ceil(filteredChannels.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => {
      if (columns <= 3) return 120;
      if (columns <= 5) return 140;
      return 150;
    },
    overscan: 5,
  });

  // ✅ LOADING state
  if (loading && allChannels.length === 0) {
    return (
      <div
        className="h-screen flex flex-col"
        style={{ backgroundColor: "#0a0a0f", color: "#e4e4e7" }}
      >
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" />
            <p style={{ color: "#a1a1aa" }}>Connecting to server...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#0a0a0f", color: "#e4e4e7" }}
    >
      <Header />

      {/* HEADER */}
      <div className="px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/iptv"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: "#1a1a2e",
                color: "#a1a1aa",
                border: "1px solid #27272a",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </Link>

            <h1 className="text-xl sm:text-2xl font-bold flex-shrink-0">
              📺 Channels
            </h1>

            <span
              className="text-xs sm:text-sm flex-shrink-0"
              style={{ color: "#a1a1aa" }}
            >
              ({filteredChannels.length.toLocaleString()})
            </span>

            {!cacheStatus.ready && (
              <span
                className="flex items-center gap-2 text-xs flex-shrink-0"
                style={{ color: "#f59e0b" }}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Loading more… {cacheStatus.progress.percent}%
              </span>
            )}
          </div>

          {error && (
            <div
              className="mb-2 p-3 rounded-lg text-sm flex items-center gap-2"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors duration-200 focus:ring-2 focus:ring-red-600/30"
            style={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #27272a",
              color: "#e4e4e7",
            }}
          />
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 overflow-hidden px-2 sm:px-4 pb-4">
        <div className="max-w-7xl mx-auto h-full">
          <div
            ref={parentRef}
            className="h-full overflow-auto rounded-xl"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#27272a transparent",
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
                        rowGap: columns >= 6 ? "16px" : "12px",
                        columnGap: columns >= 6 ? "14px" : "10px",
                      }}
                    >
                      {rowChannels.map((channel: any) => (
                        <Link
                          key={`${channel.id}_${channel.number}`}
                          href={`/iptv/watch/${channel.id}`}
                          title={channel.name}
                          className="block rounded-xl text-center p-2.5 no-underline transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                          style={{
                            backgroundColor: "#1a1a2e",
                            border: "1px solid #27272a",
                            color: "#e4e4e7",
                          }}
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
                            style={{ color: "#a1a1aa" }}
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