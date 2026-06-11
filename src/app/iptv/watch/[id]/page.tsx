"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE =
  process.env.NEXT_PUBLIC_HLS_BASE || "https://hls.bravestream.live";

const VPS_URL = "https://hls.bravestream.live";
const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";
const CHANNELS_CACHE_KEY = "iptv-channels-cache-v2";

type Channel = {
  id: number;
  name: string;
  number?: number | string;
  logo?: string;
  hd?: number;
  censored?: number;
};

type EpgProgram = {
  id?: string | number;
  name?: string;
  title?: string;
  time?: string;
  time_to?: string;
  description?: string;
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
  if (!res.ok) throw new Error(`Wrapper request failed: ${res.status}`);
  const data = await res.json();
  return data.value;
}

// ============================================================
// CHANNEL NAME FROM VPS (NEW - everything else unchanged)
// ============================================================
let channelNameCache: Record<string, { name: string; number?: string; logo?: string; hd?: number }> | null = null;

async function fetchChannelFromVps(channelId: number): Promise<Channel | null> {
  if (!channelNameCache) {
    try {
      const res = await fetch(`${VPS_URL}/api/channels/all`);
      const data = await res.json();
      const channels = data.channels || [];
      channelNameCache = {};
      for (const ch of channels) {
        if (ch.id) {
          channelNameCache[String(ch.id)] = {
            name: ch.name || "",
            number: ch.number,
            logo: ch.logo,
            hd: ch.hd,
          };
        }
      }
    } catch (e) {
      channelNameCache = {};
    }
  }
  const info = channelNameCache[String(channelId)];
  if (info && info.name) {
    return { id: channelId, name: info.name, number: info.number, logo: info.logo, hd: info.hd };
  }
  return null;
}

function isPlayInterruptedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("play() request was interrupted") ||
    message.includes("The play() request was interrupted") ||
    message.includes("interrupted by a call to pause") ||
    message.includes("interrupted by a new load request")
  );
}

async function safePlay(video: HTMLVideoElement) {
  try {
    const playPromise = video.play();
    if (playPromise !== undefined) await playPromise;
    return true;
  } catch (error) {
    if (isPlayInterruptedError(error)) {
      console.warn("Play request was interrupted during channel switch. This is safe to ignore.", error);
      return false;
    }
    throw error;
  }
}

function getSegmentLinesFromPlaylist(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => {
    if (line.startsWith("#")) return false;
    return line.includes(".ts") || line.includes(".m4s") || line.includes(".aac") || line.includes(".mp4");
  });
}

async function waitForPlaylistReady(playlistUrl: string, options?: { retries?: number; delayMs?: number; signal?: AbortSignal; onStatus?: (message: string) => void }) {
  const retries = options?.retries ?? 30;
  const delayMs = options?.delayMs ?? 1500;
  let lastError = "";
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (options?.signal?.aborted) throw new Error("Playback cancelled.");
    try {
      options?.onStatus?.(`Preparing stream... ${attempt}/${retries}`);
      const cacheBustedPlaylistUrl = `${playlistUrl}?t=${Date.now()}`;
      const playlistRes = await fetch(cacheBustedPlaylistUrl, { method: "GET", cache: "no-store", signal: options?.signal });
      if (!playlistRes.ok) { lastError = `Playlist returned HTTP ${playlistRes.status}`; }
      else {
        const playlistText = await playlistRes.text();
        const hasM3uHeader = playlistText.includes("#EXTM3U");
        const segmentLines = getSegmentLinesFromPlaylist(playlistText);
        if (hasM3uHeader && segmentLines.length > 0) {
          return cacheBustedPlaylistUrl;
        } else if (hasM3uHeader) { lastError = "Playlist exists but has no media segment URLs yet."; }
        else { lastError = "Playlist response is not a valid HLS playlist."; }
      }
    } catch (error: any) {
      if (error?.name === "AbortError") throw new Error("Playback cancelled.");
      lastError = error?.message || "Could not fetch playlist.";
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(lastError || "Playlist was not ready.");
}

function getReadableHlsError(data: any) {
  const type = data?.type || "unknown";
  const details = data?.details || "unknown";
  const responseCode = data?.response?.code;
  if (responseCode) return `HLS error: ${type} / ${details}. HTTP ${responseCode}.`;
  return `HLS error: ${type} / ${details}.`;
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
      style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--border-primary)" }}>
      <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "var(--brand-green)" }} />{status}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-5 rounded-2xl p-4 text-sm" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}>
      <div className="font-semibold">Playback issue</div><div className="mt-1">{message}</div>
    </div>
  );
}

function LoadingOverlay({ status }: { status: string }) {
  if (!status) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-black/80 px-5 py-4 text-center shadow-xl">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
        <p className="text-sm font-medium text-white">{status}</p>
      </div>
    </div>
  );
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
  const playbackStartedRef = useRef(false);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [epgData, setEpgData] = useState<EpgResponse | null>(null);
  const [error, setError] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [status, setStatus] = useState("Loading channel...");

  const programs = useMemo(() => {
    if (!epgData) return [];
    const data = epgData.js;
    return Array.isArray(data) ? data : data?.data || [];
  }, [epgData]);

  const currentProgram = programs[0];
  const channelTitle = channel?.name || `Channel ${channelId}`;

  // ============================================================
  // LOAD CHANNEL INFO (ONLY CHANGE: fetchChannelFromVps)
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    async function loadChannelInfo() {
      if (Number.isNaN(channelId)) {
        setError("Invalid channel selected.");
        setLoadingInfo(false);
        return;
      }

      try {
        setLoadingInfo(true);
        setStatus("Loading channel...");
        setError("");

        // Try VPS first, fall back to sessionStorage
        const vpsChannel = await fetchChannelFromVps(channelId);
        if (vpsChannel) {
          setChannel(vpsChannel);
        } else {
          // Fallback to old sessionStorage method
          try {
            const stored = sessionStorage.getItem(CHANNELS_CACHE_KEY);
            if (stored) {
              const channels = JSON.parse(stored);
              if (Array.isArray(channels)) {
                const cached = channels.find((c: Channel) => Number(c.id) === channelId);
                if (cached) { setChannel(cached); return; }
              }
            }
          } catch (e) {}
          setChannel({ id: channelId, name: `Channel ${channelId}` });
        }

        const [epgResult] = await Promise.allSettled([
          callWrapper("iptv:getShortEpg", { channelId, size: 8 }),
        ]);

        if (cancelled) return;

        if (epgResult.status === "fulfilled") {
          setEpgData(epgResult.value as EpgResponse);
        }
      } catch (e) {
        console.error("Failed to load channel information:", e);
        if (!cancelled) setChannel({ id: channelId, name: `Channel ${channelId}` });
      } finally {
        if (!cancelled) { setLoadingInfo(false); setStatus(""); }
      }
    }

    loadChannelInfo();

    return () => { cancelled = true; };
  }, [channelId]);

  // ============================================================
  // PLAY STREAM (COMPLETELY UNCHANGED)
  // ============================================================
  useEffect(() => {
    if (loadingInfo || !videoRef.current || Number.isNaN(channelId)) return;

    const video = videoRef.current;
    let cancelled = false;

    playbackStartedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const onLoadedMetadata = () => {
      console.log("Video loaded metadata:", { duration: video.duration, videoWidth: video.videoWidth, videoHeight: video.videoHeight, readyState: video.readyState, networkState: video.networkState });
    };
    const onCanPlay = () => {
      console.log("Video can play:", { readyState: video.readyState, networkState: video.networkState });
    };
    const onPlaying = () => {
      console.log("Video playing:", { currentTime: video.currentTime, readyState: video.readyState, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
      playbackStartedRef.current = true;
      setStatus("");
      setError("");
    };
    const onWaiting = () => {
      console.log("Video waiting/buffering:", { currentTime: video.currentTime, readyState: video.readyState, networkState: video.networkState });
      if (!playbackStartedRef.current) setStatus("Buffering live stream...");
    };
    const onVideoError = () => {
      console.error("Native video element error:", { error: video.error, readyState: video.readyState, networkState: video.networkState });
      setStatus("");
      setError("The browser video element failed to decode this stream. This usually means unsupported codec or invalid media segments.");
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onVideoError);

    async function play() {
      const playlistUrl = `${HLS_BASE}/hls/${channelId}.m3u8`;

      const tryStartPlayback = async (source: string) => {
        if (cancelled || !videoRef.current) return;
        console.log(`Trying video playback from: ${source}`);
        try {
          const played = await safePlay(video);
          if (played) { console.log(`Video playback started from: ${source}`); playbackStartedRef.current = true; setStatus(""); setError(""); }
          else { console.log(`Video play was interrupted safely from ${source}, probably due to channel switch.`); }
        } catch (err) { console.warn(`Playback attempt failed from ${source}:`, err); setStatus(""); setError("The stream loaded, but the browser could not start playback. Press play or check if this channel uses unsupported codecs."); }
      };

      try {
        setError(""); setStatus("Starting stream...");
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        try { if (!video.paused) video.pause(); video.removeAttribute("src"); video.load(); } catch (resetError) { console.warn("Safe video reset warning:", resetError); }

        const startRes = await fetch(`${HLS_BASE}/streams/${channelId}/start`, { method: "POST", cache: "no-store", signal: abortRef.current?.signal });
        let startText = ""; try { startText = await startRes.text(); } catch { startText = ""; }
        console.log("Stream start response:", { channelId, status: startRes.status, body: startText });
        if (!startRes.ok) throw new Error(`Failed to start stream. Server returned HTTP ${startRes.status}.`);
        if (cancelled) return;

        const readyPlaylistUrl = await waitForPlaylistReady(playlistUrl, { retries: 30, delayMs: 1500, signal: abortRef.current?.signal, onStatus: setStatus });
        if (cancelled || !videoRef.current) return;
        setStatus("Connecting to live stream...");

        const Hls = (await import("hls.js")).default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true, lowLatencyMode: false, backBufferLength: 30, maxBufferLength: 20, maxMaxBufferLength: 40,
            liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 8,
            manifestLoadingMaxRetry: 6, manifestLoadingRetryDelay: 1000,
            levelLoadingMaxRetry: 6, levelLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 6, fragLoadingRetryDelay: 1000,
          });
          hlsRef.current = hls;

          hls.on(Hls.Events.MEDIA_ATTACHED, () => console.log("HLS media attached."));
          hls.on(Hls.Events.MANIFEST_LOADING, () => console.log("HLS manifest loading:", readyPlaylistUrl));
          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => { console.log("HLS manifest parsed:", data); setStatus("Buffering live stream..."); tryStartPlayback("MANIFEST_PARSED"); });
          hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => console.log("HLS level loaded:", { level: data?.level, live: data?.details?.live, fragments: data?.details?.fragments?.length, targetduration: data?.details?.targetduration, totalduration: data?.details?.totalduration }));
          hls.on(Hls.Events.FRAG_LOADING, (_event, data) => console.log("HLS fragment loading:", { url: data?.frag?.url, sn: data?.frag?.sn, type: data?.frag?.type }));
          hls.on(Hls.Events.FRAG_LOADED, (_event, data) => console.log("HLS fragment loaded:", { url: data?.frag?.url, sn: data?.frag?.sn, stats: (data as any)?.stats }));
          hls.on(Hls.Events.FRAG_PARSED, (_event, data) => console.log("HLS fragment parsed:", { url: data?.frag?.url, sn: data?.frag?.sn, type: data?.frag?.type }));
          hls.on(Hls.Events.BUFFER_APPENDING, (_event, data) => console.log("HLS buffer appending:", { type: data?.type, length: data?.data?.length }));
          hls.on(Hls.Events.BUFFER_APPENDED, (_event, data) => { console.log("HLS buffer appended:", data); if (video.paused && !playbackStartedRef.current) tryStartPlayback("BUFFER_APPENDED"); });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.error("HLS error:", { type: data?.type, details: data?.details, fatal: data?.fatal, url: data?.url || data?.frag?.url, response: data?.response, error: data?.error });
            const readableError = getReadableHlsError(data);
            if (!data.fatal) { console.warn("Non-fatal HLS error:", readableError); return; }
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { setError("Network issue while loading this stream. Retrying..."); hls.startLoad(); return; }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { setError("Media decoding issue. Trying to recover..."); hls.recoverMediaError(); return; }
            hls.destroy(); hlsRef.current = null;
            setStatus(""); setError(`${readableError} This channel failed to play. The IPTV source may be offline, unsupported, or the HLS server failed to generate a browser-compatible stream.`);
          });

          hls.attachMedia(video);
          hls.loadSource(readyPlaylistUrl);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = readyPlaylistUrl; setStatus("Buffering live stream...");
          await tryStartPlayback("NATIVE_HLS");
        } else { setStatus(""); setError("Browser does not support HLS playback."); }
      } catch (e: any) {
        console.error("Failed to play stream:", e);
        if (cancelled) return;
        setStatus("");
        const message = e?.message || "Unknown playback error.";
        setError(`Could not play this channel. ${message} Check whether the HLS server generated a valid playlist and reachable segments for channel ${channelId}.`);
      }
    }

    play();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onVideoError);
      abortRef.current?.abort();
      abortRef.current = null;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [loadingInfo, channelId]);

  // ============================================================
  // RENDER (COMPLETELY UNCHANGED)
  // ============================================================
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--neu-bg-page)", color: "var(--text-primary)" }}>
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/iptv/channels" className="inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: "var(--neu-bg)", color: "var(--text-secondary)", boxShadow: "4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)" }}>
            <span aria-hidden="true">←</span> Back to Channels
          </Link>
          <StatusBadge status={error ? "" : status} />
        </div>

        <section className="overflow-hidden rounded-[28px]" style={{ backgroundColor: "var(--neu-bg)", color: "var(--text-secondary)", boxShadow: "8px 8px 18px var(--neu-shadow-dark), -8px -8px 18px var(--neu-shadow-light)" }}>
          <div className="px-5 py-5 sm:px-7" style={{ backgroundColor: "var(--surface-primary)", borderBottom: "1px solid var(--border-primary)" }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border-primary)" }}>
                  {channel?.logo ? <img src={channel.logo} alt={channel.name || "Channel logo"} className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span className="text-3xl">📺</span>}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--brand-red)" }}>Live TV</p>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>{loadingInfo ? "Loading channel..." : channelTitle}</h1>
                  {currentProgram && <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>Now playing: <span style={{ color: "var(--text-primary)" }}>{currentProgram.name || currentProgram.title}</span></p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {channel?.number && <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>Ch. {channel.number}</span>}
                {channel?.hd === 1 && <span className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">HD</span>}
                <span className="rounded-full px-3 py-1.5 text-xs" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-primary)" }}>ID: {channelId}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-3 sm:p-5">
              <ErrorBanner message={error} />
              <div className="relative overflow-hidden rounded-3xl bg-black" style={{ border: "1px solid var(--border-primary)", boxShadow: "0 15px 35px var(--shadow-color-heavy)" }}>
                {status && !error && <LoadingOverlay status={status} />}
                <video ref={videoRef} controls autoPlay muted playsInline preload="auto" className="aspect-video w-full bg-black" style={{ maxHeight: "72vh" }} />
              </div>
            </div>

            <aside className="p-4 lg:border-l" style={{ backgroundColor: "var(--surface-secondary)", borderColor: "var(--border-primary)" }}>
              <div className="mb-3 flex items-center justify-between">
                <div><h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Program Guide</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>Current and upcoming</p></div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}>EPG</span>
              </div>
              {programs.length > 0 ? (
                <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
                  {programs.map((program, i) => {
                    const title = program.name || program.title || "Untitled";
                    const isNow = i === 0;
                    return (
                      <div key={program.id || `${title}-${i}`} className="rounded-xl border p-2.5" style={{ backgroundColor: isNow ? "var(--error-bg)" : "var(--surface-primary)", borderColor: isNow ? "var(--brand-red)" : "var(--border-primary)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
                          {isNow && <span className="flex-shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">On Air</span>}
                        </div>
                        {(program.time || program.time_to) && <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{program.time || "--:--"} – {program.time_to || "--:--"}</p>}
                        {program.description && <p className="mt-1 line-clamp-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{program.description}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-center text-xs" style={{ backgroundColor: "var(--surface-primary)", borderColor: "var(--border-primary)", color: "var(--text-muted)" }}>No program guide available.</div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}