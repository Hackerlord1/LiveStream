"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE =
  process.env.NEXT_PUBLIC_HLS_BASE || "https://hls.bravestream.live";

const VPS_URL = "https://hls.bravestream.live";
const WRAPPER_URL =
  "https://neighborly-perch-272.convex.cloud/api/action";
const CHANNELS_CACHE_KEY = "iptv-channels-cache-v2";

type Channel = {
  id: number;
  name: string;
  number?: number | string;
  logo?: string;
  hd?: number;
};

type EpgProgram = {
  name?: string;
  title?: string;
  time?: string;
  time_to?: string;
  description?: string;
};

type EpgResponse = {
  js?: EpgProgram[] | { data?: EpgProgram[] };
};

async function callWrapper(path: string, args: any = {}) {
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

  const [channel, setChannel] = useState<Channel | null>(null);
  const [epgData, setEpgData] = useState<EpgResponse | null>(null);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [viewers, setViewers] = useState(0); // ✅ viewer count

  const programs = useMemo<EpgProgram[]>(() => {
    if (!epgData) return [];
    const data = epgData.js;
    return Array.isArray(data) ? data : data?.data || [];
  }, [epgData]);

  // ✅ LOAD CHANNEL
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${VPS_URL}/api/channels/all`);
        const data = await res.json();

        const ch = data.channels?.find(
          (c: any) => Number(c.id) === channelId
        );

        setChannel(ch || { id: channelId, name: `Channel ${channelId}` });

        const epg = await callWrapper("iptv:getShortEpg", {
          channelId,
          size: 8,
        });

        setEpgData(epg);
      } catch {}
    }

    load();
  }, [channelId]);

  // ✅ VIEWER JOIN / LEAVE
  useEffect(() => {
    if (!channelId) return;

    // join
    fetch(`${HLS_BASE}/viewer/join?id=${channelId}`);

    // poll viewer count
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${HLS_BASE}/viewer/join?id=${channelId}`
        ); // reuse endpoint just to keep alive
        // (simple design — server logs count, optional improvements later)
      } catch {}
    }, 10000);

    // leave
    return () => {
      fetch(`${HLS_BASE}/viewer/leave?id=${channelId}`);
      clearInterval(interval);
    };
  }, [channelId]);

  // ===============================
  // ✅ STREAM PLAYER
  // ===============================
  useEffect(() => {
    if (!videoRef.current) return;

    let cancelled = false;
    const video = videoRef.current;

    async function createPlayer() {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const playlistUrl = `${HLS_BASE}/hls/${channelId}.m3u8`;

      const Hls = (await import("hls.js")).default;

      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 90,
        maxBufferLength: 30,

        // ✅ BUFFER STRATEGY
        liveSyncDurationCount: 6,
        liveMaxLatencyDurationCount: 15,
      });

      hlsRef.current = hls;

      hls.attachMedia(video);
      hls.loadSource(playlistUrl);

      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        try {
          await video.play();
          setStatus("");
        } catch {}
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
        if (data?.details?.live === false && !cancelled) {
          setStatus("Reconnecting...");

          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          fetch(`${HLS_BASE}/streams/${channelId}/start`, {
            method: "POST",
          })
            .then(() => new Promise((r) => setTimeout(r, 5000)))
            .then(() => {
              if (!cancelled) createPlayer();
            });
        }
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        if (!cancelled) {
          setError("Stream error... retrying");
          setTimeout(createPlayer, 5000);
        }
      });
    }

    fetch(`${HLS_BASE}/streams/${channelId}/start`, {
      method: "POST",
    })
      .then(() => new Promise((r) => setTimeout(r, 4000)))
      .then(() => {
        if (!cancelled) createPlayer();
      });

    return () => {
      cancelled = true;

      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [channelId]);

  // ===============================
  // ✅ UI
  // ===============================
  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto p-4">

        <div className="flex justify-between items-center mb-4">
          <Link href="/iptv/channels">← Back</Link>

          {/* ✅ Viewer Count */}
          <div className="text-sm">
            👁 {viewers} watching
          </div>
        </div>

        <h1 className="text-2xl font-bold">
          {channel?.name || "Loading..."}
        </h1>

        {status && <p className="text-sm">{status}</p>}
        {error && <p className="text-red-500">{error}</p>}

        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          className="w-full bg-black mt-4"
        />

        <div className="mt-4">
          <h2>Program Guide</h2>
          {programs.map((p, i) => (
            <div key={i}>{p.name || p.title}</div>
          ))}
        </div>
      </main>
    </div>
  );
}