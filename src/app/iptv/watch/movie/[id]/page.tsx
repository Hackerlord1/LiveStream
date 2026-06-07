"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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

export default function MovieWatchPage() {
  const params = useParams();
  const movieId = Number(params.id);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const vodData = await callWrapper("iptv:getVodList", { page: 1 });
        const movies = vodData?.js?.data || [];
        const found = movies.find((m: any) => m.id === movieId);
        setMovie(found || { name: `Movie ${movieId}` });
      } catch (e) {
        setError("Failed to load movie info");
      }
      setLoading(false);
    }
    load();
  }, [movieId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#000' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-4">
        <Link href="/iptv/vod" className="text-sm hover:underline mb-4 inline-block" style={{ color: '#aaa' }}>
          ← Back to Movies
        </Link>
        <h2 className="text-2xl font-bold mb-4">{movie?.name || `Movie ${movieId}`}</h2>
        {movie?.year && <p className="text-sm mb-2" style={{ color: '#888' }}>{movie.year}</p>}
        {movie?.descr && <p className="text-sm mb-4" style={{ color: '#aaa' }}>{movie.descr}</p>}

        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#2d0000', color: '#ff8888' }}>{error}</div>
        )}

        <div className="rounded-xl overflow-hidden bg-black mb-6">
          <video ref={videoRef} controls autoPlay muted playsInline className="w-full aspect-video" style={{ maxHeight: '70vh' }} />
        </div>
      </main>
    </div>
  );
}