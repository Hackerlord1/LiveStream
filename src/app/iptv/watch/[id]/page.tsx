"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE = process.env.NEXT_PUBLIC_HLS_BASE || "https://hls.bravestream.live";
const VPS_URL = "https://hls.bravestream.live";
const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";
const CHANNELS_CACHE_KEY = "iptv-channels-cache-v2";

type Channel = { id: number; name: string; number?: number | string; logo?: string; hd?: number; censored?: number; };
type EpgProgram = { id?: string | number; name?: string; title?: string; time?: string; time_to?: string; description?: string; };
type EpgResponse = { js?: EpgProgram[] | { data?: EpgProgram[] } };

async function callWrapper(path: string, args: Record<string, unknown> = {}) {
  const res = await fetch(WRAPPER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, args }) });
  if (!res.ok) throw new Error(`Wrapper request failed: ${res.status}`);
  const data = await res.json(); return data.value;
}

// ============================================================
// CHANNEL NAME FROM VPS
// ============================================================
let channelNameCache: Record<string, { name: string; number?: string; logo?: string; hd?: number }> | null = null;
async function fetchChannelFromVps(channelId: number): Promise<Channel | null> {
  if (!channelNameCache) {
    try {
      const res = await fetch(`${VPS_URL}/api/channels/all`); const data = await res.json(); const channels = data.channels || [];
      channelNameCache = {};
      for (const ch of channels) { if (ch.id) { channelNameCache[String(ch.id)] = { name: ch.name || "", number: ch.number, logo: ch.logo, hd: ch.hd }; } }
    } catch (e) { channelNameCache = {}; }
  }
  const info = channelNameCache[String(channelId)];
  if (info && info.name) return { id: channelId, name: info.name, number: info.number, logo: info.logo, hd: info.hd };
  return null;
}

function isPlayInterruptedError(error: unknown) { const message = error instanceof Error ? error.message : String(error || ""); return message.includes("play() request was interrupted") || message.includes("interrupted by a call to pause") || message.includes("interrupted by a new load request"); }
async function safePlay(video: HTMLVideoElement) { try { const playPromise = video.play(); if (playPromise !== undefined) await playPromise; return true; } catch (error) { if (isPlayInterruptedError(error)) return false; throw error; } }

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  return (<div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--border-primary)" }}><span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "var(--brand-green)" }} />{status}</div>);
}
function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (<div className="mb-5 rounded-2xl p-4 text-sm" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}><div className="font-semibold">Playback issue</div><div className="mt-1">{message}</div></div>);
}

// ============================================================
// COMPONENT
// ============================================================
export default function IptvWatchPage() {
  const params = useParams();
  const channelId = Number(params.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectAttemptRef = useRef(0);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [epgData, setEpgData] = useState<EpgResponse | null>(null);
  const [error, setError] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [status, setStatus] = useState("Loading channel...");

  const programs = useMemo(() => { if (!epgData) return []; const data = epgData.js; return Array.isArray(data) ? data : data?.data || []; }, [epgData]);
  const currentProgram = programs[0];
  const channelTitle = channel?.name || `Channel ${channelId}`;

  // ============================================================
  // LOAD CHANNEL INFO
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    async function loadChannelInfo() {
      if (Number.isNaN(channelId)) { setError("Invalid channel selected."); setLoadingInfo(false); return; }
      try {
        setLoadingInfo(true); setStatus("Loading channel..."); setError("");
        const vpsChannel = await fetchChannelFromVps(channelId);
        if (vpsChannel) setChannel(vpsChannel);
        else {
          try { const stored = sessionStorage.getItem(CHANNELS_CACHE_KEY); if (stored) { const channels = JSON.parse(stored); if (Array.isArray(channels)) { const cached = channels.find((c: Channel) => Number(c.id) === channelId); if (cached) { setChannel(cached); return; } } } } catch (e) {}
          setChannel({ id: channelId, name: `Channel ${channelId}` });
        }
        const [epgResult] = await Promise.allSettled([callWrapper("iptv:getShortEpg", { channelId, size: 8 })]);
        if (cancelled) return;
        if (epgResult.status === "fulfilled") setEpgData(epgResult.value as EpgResponse);
      } catch (e) { if (!cancelled) setChannel({ id: channelId, name: `Channel ${channelId}` }); }
      finally { if (!cancelled) { setLoadingInfo(false); setStatus(""); } }
    }
    loadChannelInfo();
    return () => { cancelled = true; };
  }, [channelId]);

  // ============================================================
  // PLAY STREAM (full player recreation on reconnect)
  // ============================================================
  useEffect(() => {
    if (loadingInfo || !videoRef.current || Number.isNaN(channelId)) return;
    const video = videoRef.current;
    let cancelled = false;
    reconnectAttemptRef.current = 0;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const onPlaying = () => { setStatus(""); setError(""); reconnectAttemptRef.current = 0; };
    const onVideoError = () => { if (!cancelled) setError("Video decode error."); };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onVideoError);

    async function createPlayer() {
      if (cancelled || !videoRef.current) return;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      try { if (!video.paused) video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}

      const playlistUrl = `${HLS_BASE}/hls/${channelId}.m3u8`;

      const Hls = (await import("hls.js")).default;
      if (!Hls.isSupported()) { setError("Browser does not support HLS."); return; }

      const hls = new Hls({
        enableWorker: true, lowLatencyMode: true, backBufferLength: 90, maxBufferLength: 30,
        liveSyncDurationCount: 6, liveMaxLatencyDurationCount: 15,
        manifestLoadingMaxRetry: 6, manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 6, levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 6, fragLoadingRetryDelay: 1000,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus(""); safePlay(video).catch(() => {}); });

      // ═══════════════════════════════════════════════════
      // FULL RECONNECT: destroy + recreate on stream end
      // ═══════════════════════════════════════════════════
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (data?.details?.live === false && !cancelled) {
          console.log(`🔄 Stream ended (attempt ${reconnectAttemptRef.current + 1}), recreating player...`);
          reconnectAttemptRef.current++;
          setStatus(`Reconnecting (${reconnectAttemptRef.current})...`);

          // Destroy current player
          if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

          // Restart FFmpeg + recreate player
          fetch(`${HLS_BASE}/streams/${channelId}/start`, { method: "POST" })
            .then(() => new Promise(r => setTimeout(r, 5000)))
            .then(() => { if (!cancelled) createPlayer(); })
            .catch(() => { if (!cancelled) { setTimeout(() => createPlayer(), 5000); } });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(); return; }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
        hls.destroy(); hlsRef.current = null;
        if (!cancelled) { setStatus("Reconnecting..."); setTimeout(() => createPlayer(), 5000); }
      });

      hls.attachMedia(video);
      hls.loadSource(playlistUrl);
    }

    // Start FFmpeg then create player
    fetch(`${HLS_BASE}/streams/${channelId}/start`, { method: "POST" })
      .then(() => new Promise(r => setTimeout(r, 4000)))
      .then(() => { if (!cancelled) createPlayer(); })
      .catch(() => { if (!cancelled) setError("Failed to start stream."); });

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onVideoError);
      abortRef.current?.abort(); abortRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [loadingInfo, channelId]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--neu-bg-page)", color: "var(--text-primary)" }}>
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/iptv/channels" className="inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ backgroundColor: "var(--neu-bg)", color: "var(--text-secondary)", boxShadow: "4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)" }}><span aria-hidden="true">←</span> Back to Channels</Link>
          <StatusBadge status={error ? "" : status} />
        </div>
        <section className="overflow-hidden rounded-[28px]" style={{ backgroundColor: "var(--neu-bg)", color: "var(--text-secondary)", boxShadow: "8px 8px 18px var(--neu-shadow-dark), -8px -8px 18px var(--neu-shadow-light)" }}>
          <div className="px-5 py-5 sm:px-7" style={{ backgroundColor: "var(--surface-primary)", borderBottom: "1px solid var(--border-primary)" }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border-primary)" }}>{channel?.logo ? <img src={channel.logo} alt={channel.name || "Channel logo"} className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span className="text-3xl">📺</span>}</div>
                <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--brand-red)" }}>Live TV</p><h1 className="text-2xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>{loadingInfo ? "Loading channel..." : channelTitle}</h1>{currentProgram && <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>Now playing: <span style={{ color: "var(--text-primary)" }}>{currentProgram.name || currentProgram.title}</span></p>}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">{channel?.number && <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>Ch. {channel.number}</span>}{channel?.hd === 1 && <span className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">HD</span>}</div>
            </div>
          </div>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-3 sm:p-5">
              <ErrorBanner message={error} />
              <div className="relative overflow-hidden rounded-3xl bg-black" style={{ border: "1px solid var(--border-primary)", boxShadow: "0 15px 35px var(--shadow-color-heavy)" }}>
                {status && !error && (
                  <div className="absolute bottom-4 right-4 z-10 rounded-xl bg-black/70 backdrop-blur-sm px-4 py-2 border border-white/10">
                    <div className="flex items-center gap-2"><div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-red-500" /><p className="text-xs text-white/80">{status}</p></div>
                  </div>
                )}
                <video ref={videoRef} controls autoPlay muted playsInline preload="auto" className="aspect-video w-full bg-black" style={{ maxHeight: "72vh" }} />
              </div>
            </div>
            <aside className="p-4 lg:border-l" style={{ backgroundColor: "var(--surface-secondary)", borderColor: "var(--border-primary)" }}>
              <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Program Guide</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>Current and upcoming</p></div><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}>EPG</span></div>
              {programs.length > 0 ? (
                <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">{programs.map((program, i) => { const title = program.name || program.title || "Untitled"; const isNow = i === 0; return (<div key={program.id || `${title}-${i}`} className="rounded-xl border p-2.5" style={{ backgroundColor: isNow ? "var(--error-bg)" : "var(--surface-primary)", borderColor: isNow ? "var(--brand-red)" : "var(--border-primary)" }}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>{isNow && <span className="flex-shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">On Air</span>}</div>{(program.time || program.time_to) && <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{program.time || "--:--"} – {program.time_to || "--:--"}</p>}{program.description && <p className="mt-1 line-clamp-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{program.description}</p>}</div>); })}</div>
              ) : (<div className="rounded-xl border border-dashed p-4 text-center text-xs" style={{ backgroundColor: "var(--surface-primary)", borderColor: "var(--border-primary)", color: "var(--text-muted)" }}>No program guide available.</div>)}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}