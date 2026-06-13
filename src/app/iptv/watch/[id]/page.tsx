"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE =
  process.env.NEXT_PUBLIC_HLS_BASE || "https://hls.bravestream.live";

const WRAPPER_URL =
  "https://neighborly-perch-272.convex.cloud/api/action";

type Channel = {
  id: number;
  name: string;
  number?: number | string;
  logo?: string;
  hd?: number;
};

type EpgProgram = {
  id?: string | number;
  name?: string;
  title?: string;
  time?: string;
  time_to?: string;
};

type EpgResponse = {
  js?: EpgProgram[] | { data?: EpgProgram[] };
};

async function callWrapper(path: string, args: Record<string, unknown> = {}) {
  const res = await fetch(WRAPPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });

  const data = await res.json();
  return data.value;
}

// ✅ Wait for playlist to be READY
async function waitForPlaylist(url: string) {
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.includes("#EXTINF")) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export default function IptvWatchPage() {
  const params = useParams();
  const channelId = Number(params.id);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [epgData, setEpgData] = useState<EpgResponse | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState("");

  const programs = useMemo(() => {
    if (!epgData) return [];
    const data = epgData.js;
    return Array.isArray(data) ? data : data?.data || [];
  }, [epgData]);

  // ============================================
  // LOAD CHANNEL INFO
  // ============================================
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [epg] = await Promise.allSettled([
          callWrapper("iptv:getShortEpg", { channelId, size: 6 }),
        ]);

        if (!cancelled && epg.status === "fulfilled") {
          setEpgData(epg.value);
        }

        setChannel({ id: channelId, name: `Channel ${channelId}` });
      } catch {}

      setStatus("");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // ============================================
  // PLAYER
  // ============================================
  useEffect(() => {
    if (!videoRef.current) return;

    let cancelled = false;
    const video = videoRef.current;

    async function init() {
      setStatus("Starting stream...");
      setError("");

      // ✅ Notify server viewer joined
      await fetch(`${HLS_BASE}/watch/${channelId}`);

      const playlist = `${HLS_BASE}/hls/${channelId}.m3u8`;

      // ✅ wait for playlist to be ready
      const ready = await waitForPlaylist(playlist);

      if (!ready) {
        setError("Stream not available.");
        return;
      }

      const Hls = (await import("hls.js")).default;

      if (!Hls.isSupported()) {
        video.src = playlist;
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,

        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferHole: 1,

        liveSyncDurationCount: 6,
        liveMaxLatencyDurationCount: 15,

        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 6,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("");
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (!data.fatal) return;

        console.log("HLS error", data);

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        hls.destroy();

        if (!cancelled) {
          setStatus("Reconnecting...");
          setTimeout(init, 4000);
        }
      });

      hls.attachMedia(video);
      hls.loadSource(playlist);
    }

    init();

    return () => {
      cancelled = true;

      // ✅ notify server viewer left
      fetch(`${HLS_BASE}/leave/${channelId}`);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelId]);

  // ============================================
  // UI
  // ============================================
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto p-5">
        <Link href="/iptv/channels">← Back</Link>

        <h1 className="text-2xl font-bold mt-4">
          {channel?.name || "Loading..."}
        </h1>

        {status && <p className="text-sm text-yellow-500">{status}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          className="w-full mt-4 bg-black"
        />

        <div className="mt-4">
          <h2>EPG</h2>
          {programs.map((p, i) => (
            <div key={i}>{p.name || p.title}</div>
          ))}
        </div>
      </main>
    </div>
  );
}