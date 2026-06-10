"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const VPS_URL = "https://hls.bravestream.live";

export default function SeriesPage() {
  const [series, setSeries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState("");
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${VPS_URL}/api/series/all`);
        const data = await res.json();
        setCategories(data.categories || []);
        const allSeries = data.series || [];
        setTotalItems(data.total || allSeries.length);
        setSeries(allSeries.slice(0, 30));
        setHasMore(allSeries.length > 30);
      } catch (e) {
        setError("Failed to load series.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const start = nextPage * 30;
    const end = start + 30;
    fetch(`${VPS_URL}/api/series/all`).then(r => r.json()).then(data => {
      const allSeries = data.series || [];
      const nextBatch = allSeries.slice(start, end);
      if (nextBatch.length === 0) {
        setHasMore(false);
      } else {
        setSeries(prev => [...prev, ...nextBatch]);
        setPage(nextPage);
      }
      setLoadingMore(false);
    });
  }, [page, loadingMore, hasMore]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(loader);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0f', color: '#fff' }}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/iptv" className="text-sm hover:underline" style={{ color: '#aaa' }}>← Back</Link>
          <h1 className="text-3xl font-bold">📺 TV Series</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: '#666' }}>{totalItems.toLocaleString()} series available</p>

        {categories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Categories</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.slice(0, 30).map((cat: any) => (
                <button key={cat.id} className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all hover:bg-red-600 hover:text-white flex-shrink-0"
                  style={{ backgroundColor: '#1a1a2e', color: '#aaa', border: '1px solid #2a2a3e' }}>{cat.title}</button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#2d0000', border: '1px solid #ff4444', color: '#ff8888' }}>{error}</div>}

        {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600"></div></div>}

        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {series.map((item: any) => (
              <Link key={item.id} href={`/iptv/watch/series/${item.id}`}
                className="group relative rounded-lg overflow-hidden hover:scale-[1.02] transition-transform duration-200"
                style={{ backgroundColor: '#1a1a2e' }}>
                <div className="aspect-[2/3] relative overflow-hidden">
                  {item.screenshot_uri ? (
                    <img src={item.screenshot_uri} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%231a1a2e" width="200" height="300"/><text x="100" y="150" text-anchor="middle" fill="%23555" font-size="40">📺</text></svg>'; }} />
                  ) : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#1a1a2e' }}><span className="text-5xl opacity-30">📺</span></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
                    <p className="text-white text-sm font-medium line-clamp-3">{item.name}</p>
                  </div>
                  {item.rating_kinopoisk && <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded text-yellow-400 text-xs font-bold">★ {item.rating_kinopoisk}</div>}
                  {item.year && <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-white text-xs">{item.year}</div>}
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium truncate group-hover:text-red-500 transition-colors">{item.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#666' }}>{item.genres_str || ''}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div ref={loaderRef} className="flex justify-center py-8">
          {loadingMore && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>}
          {!hasMore && series.length > 0 && <p className="text-sm" style={{ color: '#555' }}>You've reached the end 🎉</p>}
        </div>

        {!loading && series.length === 0 && <div className="text-center py-20" style={{ color: '#555' }}><span className="text-6xl mb-4 block opacity-30">📺</span><p className="text-xl">No series available</p></div>}
      </main>
    </div>
  );
}