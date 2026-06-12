"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useVirtualizer } from "@tanstack/react-virtual";

const VPS_URL = "http://51.15.20.170:8081";

export default function VodPage() {
  const [allMovies, setAllMovies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [columns, setColumns] = useState(6);
  const parentRef = useRef<HTMLDivElement>(null);

  // Responsive columns
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
        const res = await fetch(`/api/vod-data`);
        const data = await res.json();
        setCategories(data.categories || []);
        setAllMovies(data.movies || []);
      } catch (e) { setError("Failed to load movies"); }
      setLoading(false);
    }
    load();
  }, []);

  const filteredMovies = useMemo(() => {
    if (!search.trim()) return allMovies;
    const q = search.toLowerCase();
    return allMovies.filter((m: any) => (m.name || "").toLowerCase().includes(q));
  }, [allMovies, search]);

  const totalRows = Math.ceil(filteredMovies.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => columns <= 3 ? 280 : 310,
    overscan: 3,
  });

  if (loading) {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--neu-bg-page)' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-3" /><p style={{ color: 'var(--text-muted)' }}>Loading movies...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}>
      <Header />
      <div className="px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/iptv" className="text-sm hover:underline flex-shrink-0" style={{ color: 'var(--text-muted)' }}>← Back</Link>
            <h1 className="text-xl sm:text-2xl font-bold flex-shrink-0">🎬 Movies</h1>
            <span className="text-xs sm:text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>({filteredMovies.length.toLocaleString()})</span>
          </div>
          {error && <div className="mb-2 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)' }}>{error}</div>}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
              {categories.slice(0, 20).map((cat: any) => (
                <button key={cat.id} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
                  style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>{cat.title}</button>
              ))}
            </div>
          )}
          <input type="text" placeholder="Search movies..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm" style={{ backgroundColor: 'var(--surface-primary)', border: '2px solid var(--border-primary)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-2 sm:px-4 pb-4">
        <div className="max-w-7xl mx-auto h-full">
          <div ref={parentRef} className="h-full overflow-auto rounded-xl" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-primary) transparent' }}>
            {filteredMovies.length === 0 ? (
              <div className="flex items-center justify-center h-full"><p style={{ color: 'var(--text-muted)' }}>No movies found</p></div>
            ) : (
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const start = virtualRow.index * columns;
                  const rowMovies = filteredMovies.slice(start, start + columns);
                  return (
                    <div key={virtualRow.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                      <div className="grid gap-2 sm:gap-3 px-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {rowMovies.map((movie: any) => (
                          <Link key={movie.id} href={`/iptv/watch/movie/${movie.id}`}
                            className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                            style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}>
                            <div className="aspect-[2/3] relative overflow-hidden bg-gray-800">
                              {movie.screenshot_uri ? (
                                <img src={movie.screenshot_uri} alt={movie.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : <div className="w-full h-full flex items-center justify-center"><span className="text-2xl opacity-30">🎬</span></div>}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center"><span className="text-white text-sm">▶</span></div>
                              </div>
                              {movie.rating_kinopoisk && <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 rounded text-yellow-400 text-[10px] font-bold">★ {movie.rating_kinopoisk}</div>}
                              {movie.year && <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-white text-[10px]">{movie.year}</div>}
                              {movie.hd === 1 && <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-red-600 rounded text-[10px] font-bold text-white">HD</div>}
                            </div>
                            <div className="p-2">
                              <p className="font-medium text-[11px] truncate group-hover:text-red-500 transition-colors" style={{ color: 'var(--text-primary)' }}>{movie.name}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{movie.time || movie.genres_str || 'Movie'}</p>
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