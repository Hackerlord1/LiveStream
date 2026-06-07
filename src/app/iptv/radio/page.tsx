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

export default function RadioPage() {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Prevent double-fetch in strict mode
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function load() {
      setLoading(true);
      try {
        console.log("Fetching radio stations...");
        const data = await callWrapper("iptv:getRadioList", { page: 1 });
        console.log("Radio response:", data);
        const list = data?.js?.data || [];
        console.log("Stations found:", list.length);
        setStations(list);
        if (list.length === 0) {
          setError("No radio stations found.");
        }
      } catch (e) {
        console.error("Radio error:", e);
        setError("Failed to load radio stations.");
      }
      setLoading(false);
    }
    load();
  }, []);

  const playStation = async (station: any) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === station.id) {
      setPlayingId(null);
      return;
    }

    try {
      const url = await callWrapper("iptv:getLiveStreamUrl", { channelId: station.id });
      if (url && typeof url === "string") {
        const audio = new Audio(url);
        audio.play().catch((e) => console.log("Play error:", e));
        audioRef.current = audio;
        setPlayingId(station.id);
      }
    } catch (e) {
      console.error("Stream error:", e);
    }
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  console.log("Render - stations:", stations.length, "loading:", loading, "error:", error);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/iptv" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">📻 Radio</h1>
        </div>

        {/* Now Playing */}
        {playingId && (
          <div className="sticky top-16 z-20 mb-6 p-4 rounded-xl flex items-center gap-4" 
            style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}>
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
              <span>📻</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {stations.find(s => s.id === playingId)?.name || 'Radio'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Now Playing</p>
            </div>
            <button onClick={stopPlaying} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
              Stop
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--brand-red)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600" />
          </div>
        )}

        {/* Station List - Always render once loaded */}
        {!loading && stations.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              {stations.length} stations loaded
            </p>
            {stations.map((station: any) => (
              <button
                key={station.id}
                onClick={() => playStation(station)}
                className="w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left hover:bg-white/5"
                style={{
                  backgroundColor: playingId === station.id ? 'var(--surface-primary)' : 'transparent',
                  border: playingId === station.id ? '1px solid var(--border-primary)' : '1px solid transparent',
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: playingId === station.id ? 'var(--brand-red)' : 'var(--surface-secondary)' }}>
                  <span>{playingId === station.id ? '🔊' : '📻'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{station.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {station.number ? `Ch. ${station.number}` : 'Radio Station'}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded flex-shrink-0" style={{
                  backgroundColor: playingId === station.id ? 'var(--brand-red)' : 'var(--surface-secondary)',
                  color: playingId === station.id ? '#fff' : 'var(--text-muted)',
                }}>
                  {playingId === station.id ? 'PLAYING' : 'PLAY'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && stations.length === 0 && !error && (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            <span className="text-6xl mb-4 block opacity-30">📻</span>
            <p className="text-xl">No radio stations available</p>
          </div>
        )}
      </main>
    </div>
  );
}