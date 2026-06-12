"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useVirtualizer } from "@tanstack/react-virtual";

const VPS_URL = "http://51.15.20.170:8081";

export default function SeriesPage() {
  const [allSeries, setAllSeries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [columns, setColumns] = useState(6);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 400) setColumns(2); else if (w < 640) setColumns(3);
      else if (w < 768) setColumns(4); else if (w < 1024) setColumns(5);
      else setColumns(6);
    }
    update(); window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/series-data`);
        const data = await res.json();
        setCategories(data.categories || []);
        setAllSeries(data.series || []);
      } catch (e) { setError("Failed to load series"); }
      setLoading(false);
    }
    load();
  }, []);

  const filteredSeries = useMemo(() => {
    if (!search.trim()) return allSeries;
    const q = search.toLowerCase();
    return allSeries.filter((s: any) => (s.name || "").toLowerCase().includes(q));
  }, [allSeries, search]);

  const totalRows = Math.ceil(filteredSeries.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => columns <= 3 ? 280 : 310,
    overscan: 3,
  });

  if (loading) {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: '#0a0a0f' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" /><p style={{ color: '#aaa' }}>Loading series...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a0f', color: '#fff' }}>
      <Header />
      <div className="px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/iptv" className="text-sm hover:underline flex-shrink-0" style={{ color: '#aaa' }}>← Back</Link>
            <h1 className="text-xl sm:text-2xl font-bold flex-shrink-0">📺 TV Series</h1>
            <span className="text-xs sm:text-sm flex-shrink-0" style={{ color: '#aaa' }}>({filteredSeries.length.toLocaleString()})</span>
          </div>
          {error && <div className="mb-2 p-2 rounded-lg text-sm" style={{ backgroundColor: '#2d0000', color: '#ff8888' }}>{error}</div>}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
              {categories.slice(0, 20).map((cat: any) => (
                <button key={cat.id} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
                  style={{ backgroundColor: '#1a1a2e', color: '#aaa', border: '1px solid #2a2a3e' }}>{cat.title}</button>
              ))}
            </div>
          )}
          <input type="text" placeholder="Search series..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm" style={{ backgroundColor: '#1a1a2e', border: '2px solid #2a2a3e', color: '#fff' }} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-2 sm:px-4 pb-4">
        <div className="max-w-7xl mx-auto h-full">
          <div ref={parentRef} className="h-full overflow-auto rounded-xl" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a3e transparent' }}>
            {filteredSeries.length === 0 ? (
              <div className="flex items-center justify-center h-full"><p style={{ color: '#555' }}>No series found</p></div>
            ) : (
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const start = virtualRow.index * columns;
                  const rowSeries = filteredSeries.slice(start, start + columns);
                  return (
                    <div key={virtualRow.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                      <div className="grid gap-2 sm:gap-3 px-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {rowSeries.map((item: any) => (
                          <Link key={item.id} href={`/iptv/watch/series/${item.id}`}
                            className="group relative rounded-lg overflow-hidden hover:scale-[1.02] transition-transform duration-200"
                            style={{ backgroundColor: '#1a1a2e' }}>
                            <div className="aspect-[2/3] relative overflow-hidden">
                              {item.screenshot_uri ? (
                                <img src={item.screenshot_uri} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : <div className="w-full h-full flex items-center justify-center"><span className="text-2xl opacity-30">📺</span></div>}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center"><span className="text-white text-sm">▶</span></div>
                              </div>
                              {item.rating_kinopoisk && <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/80 rounded text-yellow-400 text-[10px] font-bold">★ {item.rating_kinopoisk}</div>}
                              {item.year && <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-white text-[10px]">{item.year}</div>}
                            </div>
                            <div className="p-2">
                              <p className="text-sm font-medium truncate group-hover:text-red-500 transition-colors">{item.name}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: '#666' }}>{item.genres_str || ''}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
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