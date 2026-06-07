"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";

async function callWrapper(path: string, args: Record<string, any> = {}) {
  const res = await fetch(WRAPPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  return data.value;
}

type SortKey = "added" | "name" | "rating";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "added", label: "Latest" },
  { key: "name", label: "A-Z" },
  { key: "rating", label: "Top Rated" },
];

function MovieCard({ movie }: { movie: any }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      href={`/iptv/watch/movie/${movie.id}`}
      className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
      style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}
    >
      <div className="aspect-[2/3] relative overflow-hidden bg-gray-800">
        {movie.screenshot_uri && !imgError ? (
          <img
            src={movie.screenshot_uri}
            alt={movie.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-30">🎬</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-lg">▶</span>
          </div>
        </div>

        {/* Rating */}
        {movie.rating_kinopoisk && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-yellow-400 text-xs font-bold">
            ★ {movie.rating_kinopoisk}
          </div>
        )}

        {/* Year */}
        {movie.year && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-white text-xs">
            {movie.year}
          </div>
        )}

        {/* HD */}
        {movie.hd === 1 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-red-600 rounded text-xs font-bold text-white">
            HD
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="font-medium text-sm truncate group-hover:text-red-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
          {movie.name}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {movie.time || movie.genres_str || 'Movie'}
        </p>
      </div>
    </Link>
  );
}

export default function VodPage() {
  const [movies, setMovies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("added");
  const [error, setError] = useState("");
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [catData, movieData] = await Promise.all([
          callWrapper("iptv:getVodCategories", {}),
          callWrapper("iptv:getVodList", { page: 1 }),
        ]);
        setCategories(catData?.js?.data || []);
        const movieList = movieData?.js?.data || [];
        setMovies(movieList);
        setTotalItems(movieData?.js?.total_items || 0);
        setHasMore(movieList.length > 0);
      } catch (e) {
        setError("Failed to load movies.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await callWrapper("iptv:getVodList", { page: nextPage });
      const newMovies = data?.js?.data || [];
      if (newMovies.length === 0) {
        setHasMore(false);
      } else {
        setMovies(prev => [...prev, ...newMovies]);
        setPage(nextPage);
      }
    } catch (e) {
      console.error("Load more error:", e);
    }
    setLoadingMore(false);
  }, [page, loadingMore, hasMore]);

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/iptv" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">🎬 Movies</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          {totalItems.toLocaleString()} movies available
        </p>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--brand-red)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {/* Categories + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 flex-1" style={{ scrollbarWidth: 'none' }}>
              {categories.slice(0, 20).map((cat: any) => (
                <button
                  key={cat.id}
                  className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors hover:bg-red-600 hover:text-white"
                  style={{
                    backgroundColor: 'var(--surface-primary)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-4 py-2 rounded-lg text-sm flex-shrink-0"
            style={{
              backgroundColor: 'var(--surface-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600" />
          </div>
        )}

        {/* Movies Grid */}
        {!loading && movies.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {movies.map((movie: any) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>

            <div ref={loaderRef} className="flex justify-center py-12">
              {loadingMore && (
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600" />
              )}
              {!hasMore && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All movies loaded 🎉</p>
              )}
            </div>
          </>
        )}

        {/* Empty */}
        {!loading && movies.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            <span className="text-6xl mb-4 block opacity-30">🎬</span>
            <p className="text-xl">No movies available</p>
          </div>
        )}
      </main>
    </div>
  );
}