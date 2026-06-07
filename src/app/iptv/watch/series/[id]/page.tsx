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

export default function SeriesWatchPage() {
  const params = useParams();
  const seriesId = Number(params.id);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [series, setSeries] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await callWrapper("iptv:getSeriesList", { seriesId, page: 1 });
        setEpisodes(data?.js?.data || []);

        const listData = await callWrapper("iptv:getSeriesList", { page: 1 });
        const allSeries = listData?.js?.data || [];
        const found = allSeries.find((s: any) => s.id === seriesId);
        setSeries(found || { name: `Series ${seriesId}` });
      } catch (e) {
        setError("Failed to load series");
      }
      setLoading(false);
    }
    load();
  }, [seriesId]);

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
        <Link href="/iptv/series" className="text-sm hover:underline mb-4 inline-block" style={{ color: '#aaa' }}>
          ← Back to Series
        </Link>
        <h2 className="text-2xl font-bold mb-4">{series?.name || `Series ${seriesId}`}</h2>

        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#2d0000', color: '#ff8888' }}>{error}</div>
        )}

        <div className="rounded-xl overflow-hidden bg-black mb-6">
          <video ref={videoRef} controls autoPlay muted playsInline className="w-full aspect-video" style={{ maxHeight: '70vh' }} />
        </div>

        {episodes.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Episodes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
              {episodes.map((ep: any, i: number) => (
                <div key={ep.id || i} className="p-3 rounded-lg text-left text-sm"
                  style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a3e', color: '#aaa' }}>
                  <p className="font-medium truncate text-xs">{ep.name || `Episode ${i + 1}`}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}