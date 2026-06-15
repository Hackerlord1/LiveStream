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

// ✅ faster readiness check (2 segments instead of full)
async function waitForPlaylist(url: string) {
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();

      const segments = text.match(/\.ts/g);
      if (segments && segments.length >= 2) return true;
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
  const [status, setStatus] = useState("Loading channel...");
  const [error, setError] = useState("");

  const programs = useMemo(() => {
    if (!epgData) return [];
    const data = epgData.js;
    return Array.isArray(data) ? data : data?.data || [];
  }, [epgData]);

  const currentProgram = programs[0];
  const channelTitle = channel?.name || `Channel ${channelId}`;

  // ✅ LOAD CHANNEL INFO (UNCHANGED LOGIC)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [epg] = await Promise.allSettled([
          callWrapper("iptv:getShortEpg", { channelId, size: 8 }),
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

  // ✅ PLAYER (FIXED CORE LOGIC)
  useEffect(() => {
    if (!videoRef.current || Number.isNaN(channelId)) return;

    let cancelled = false;
    let fallbackTried = false;

    const video = videoRef.current;

    async function startPlayer(forceTranscode = false) {
      setError("");
      setStatus("Starting stream...");

      // ✅ notify server
      await fetch(
        `${HLS_BASE}/watch/${channelId}${
          forceTranscode ? "?forceTranscode=1" : ""
        }`
      );

      const playlist = `${HLS_BASE}/hls/${channelId}.m3u8`;

      const ready = await waitForPlaylist(playlist);

      if (!ready) {
        setError("Stream not ready.");
        return;
      }

      if (cancelled) return;

      const Hls = (await import("hls.js")).default;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,

        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferHole: 1,

        liveSyncDurationCount: 6,
        liveMaxLatencyDurationCount: 15,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("");
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, async (_: any, data: any) => {
        if (!data.fatal) return;

        console.log("HLS ERROR", data);

        // ✅ NETWORK RECOVERY
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        // ✅ MEDIA RECOVERY
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        // ✅ FALLBACK (IMPORTANT)
        if (!fallbackTried) {
          fallbackTried = true;

          console.log("🔥 Retrying with transcode...");

          await fetch(`${HLS_BASE}/leave/${channelId}`);

          setTimeout(() => {
            startPlayer(true);
          }, 2000);

          return;
        }

        // ❌ HARD FAIL
        hls.destroy();
        hlsRef.current = null;

        if (!cancelled) {
          setError("Playback failed.");
          setStatus("");
        }
      });

      hls.attachMedia(video);
      hls.loadSource(playlist);
    }

    startPlayer();

    return () => {
      cancelled = true;

      fetch(`${HLS_BASE}/leave/${channelId}`);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelId]);

  // ✅ UI (UNCHANGED)
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--neu-bg-page)", color: "var(--text-primary)" }}>
      <Header />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/iptv/channels"
            className="inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--neu-bg)",
              color: "var(--text-secondary)",
              boxShadow: "4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)"
            }}>
            ← Back to Channels
          </Link>

          {status && !error && (
            <span className="text-xs">{status}</span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold">
            {channelTitle}
          </h1>

          {currentProgram && (
            <p className="text-sm text-gray-400">
              Now playing: {currentProgram.name || currentProgram.title}
            </p>
          )}
        </div>

        <div className="mt-4">
          {error && (
            <div className="text-red-500 text-sm mb-2">
              {error}
            </div>
          )}

          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            className="w-full bg-black rounded-xl"
          />
        </div>
      </main>
    </div>
  );
}