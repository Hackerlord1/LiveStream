"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE = "http://localhost:8080";
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

export default function IptvWatchPage() {
  const params = useParams();
  const channelId = Number(params.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const [channelName, setChannelName] = useState("");
  const [epgData, setEpgData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    async function loadInfo() {
      try {
        const epg = await callWrapper("iptv:getShortEpg", { channelId, size: 1 });
        setEpgData(epg);
        const programs = (epg as any)?.js?.data || [];
        if (programs.length > 0) setChannelName(programs[0].name || "");
      } catch (e) {}
      setLoading(false);
    }
    loadInfo();
  }, [channelId]);

  useEffect(() => {
    if (loading || !videoRef.current) return;
    const video = videoRef.current;

    async function play() {
      try {
        setStatus("Starting stream...");
        await fetch(`${HLS_BASE}/streams/${channelId}/start`, { method: "POST" });
      } catch (e) {}

      // Wait for segments
      await new Promise(r => setTimeout(r, 4000));
      setStatus("Connecting...");

      const Hls = (await import("hls.js")).default;
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
        });

        hls.loadSource(`${HLS_BASE}/hls/${channelId}.m3u8`);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus("");
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.log("HLS error:", data.type);
          if (data.fatal) {
            setError("Stream interrupted. Trying to recover...");
            setTimeout(() => {
              setError("");
              hls.loadSource(`${HLS_BASE}/hls/${channelId}.m3u8`);
            }, 3000);
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = `${HLS_BASE}/hls/${channelId}.m3u8`;
        video.play().catch(() => {});
        setStatus("");
      } else {
        setError("Browser does not support HLS playback");
      }
    }

    play();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [loading, channelId]);

  const programs = (epgData as any)?.js?.data || [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-4">
        <Link href="/iptv/channels" className="text-sm hover:underline mb-4 inline-block" style={{ color: '#aaa' }}>
          ← Back to Channels
        </Link>
        <h2 className="text-2xl font-bold mb-4">{channelName || `Channel ${channelId}`}</h2>

        {status && !error && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: '#1a1a2e', color: '#aaa' }}>
            {status}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#2d0000', color: '#ff8888' }}>{error}</div>
        )}

        <div className="rounded-xl overflow-hidden bg-black mb-6">
          <video ref={videoRef} controls autoPlay muted playsInline className="w-full aspect-video" style={{ maxHeight: '70vh' }} />
        </div>

        {programs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">📅 Now Playing</h3>
            {programs.map((program: any, i: number) => (
              <div key={i} className="p-4 rounded-lg mb-2" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
                <p className="font-semibold">{program.name}</p>
                <p className="text-sm mt-1" style={{ color: '#aaa' }}>{program.time} – {program.time_to}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}