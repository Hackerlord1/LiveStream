"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

// ============================================================
// CONFIGURATION
// ============================================================
const HLS_BASE = "http://57.129.106.133:3822";
const VPS_URL = "http://57.129.106.133:3822";
const PLAYLIST_TIMEOUT = 15000;
const PLAYLIST_RETRY_INTERVAL = 1000;
const MIN_SEGMENTS = 2;

// ============================================================
// TYPES
// ============================================================
interface Channel {
  id: string | number;
  name: string;
  number?: string | number;
  logo?: string;
  hd?: number;
}

type PlayerStatus = "loading" | "connecting" | "playing" | "retrying" | "error" | "offline";

// ============================================================
// UTILITY: Wait for HLS playlist to be ready
// ============================================================
async function waitForPlaylist(url: string, timeoutMs = PLAYLIST_TIMEOUT): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, PLAYLIST_RETRY_INTERVAL));
        continue;
      }

      const text = await res.text();
      const segmentCount = (text.match(/\.ts/g) || []).length;

      if (segmentCount >= MIN_SEGMENTS) {
        return true;
      }
    } catch {
      // Server may not be ready yet
    }

    await new Promise((r) => setTimeout(r, PLAYLIST_RETRY_INTERVAL));
  }

  return false;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function BackButton({ href = "/iptv/channels" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-white/5"
      style={{ backgroundColor: "#1a1a2e", color: "#a1a1aa", border: "1px solid #27272a" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back to Channels
    </Link>
  );
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  const config: Record<PlayerStatus, { color: string; bg: string; label: string; pulse: boolean }> = {
    loading: { color: "#a1a1aa", bg: "rgba(161, 161, 170, 0.1)", label: "Loading...", pulse: false },
    connecting: { color: "#fbbf24", bg: "rgba(245, 158, 11, 0.1)", label: "Connecting...", pulse: true },
    playing: { color: "#4ade80", bg: "rgba(34, 197, 94, 0.1)", label: "● LIVE", pulse: false },
    retrying: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", label: "Retrying...", pulse: true },
    error: { color: "#fca5a5", bg: "rgba(239, 68, 68, 0.1)", label: "Error", pulse: false },
    offline: { color: "#71717a", bg: "rgba(113, 113, 122, 0.1)", label: "Offline", pulse: false },
  };

  const { color, bg, label, pulse } = config[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: bg, color }}
    >
      {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />}
      {label}
    </span>
  );
}

function ChannelInfoCard({ channel }: { channel: Channel | null }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (!channel) {
    return (
      <div className="rounded-2xl p-5 mb-5 animate-pulse" style={{ backgroundColor: "#1a1a2e", border: "1px solid #27272a" }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl" style={{ backgroundColor: "#0a0a0f" }} />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 rounded-md" style={{ backgroundColor: "#27272a" }} />
            <div className="h-4 w-24 rounded-md" style={{ backgroundColor: "#27272a" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 mb-5 flex items-center gap-4 transition-all" style={{ backgroundColor: "#1a1a2e", border: "1px solid #27272a" }}>
      {/* Logo */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: "#0a0a0f" }}>
        {channel.logo && !logoFailed ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="max-h-full max-w-full object-contain p-1.5"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-2xl opacity-40">📺</span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-bold truncate">{channel.name}</h1>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {channel.number && (
            <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-medium" style={{ backgroundColor: "#27272a", color: "#a1a1aa" }}>
              Ch. {channel.number}
            </span>
          )}
          {channel.hd === 1 && (
            <span className="text-[11px] px-2 py-0.5 rounded-md font-bold" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
              HD
            </span>
          )}
          {channel.hd === 2 && (
            <span className="text-[11px] px-2 py-0.5 rounded-md font-bold" style={{ backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#a78bfa" }}>
              4K
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerOverlay({ status, error }: { status: PlayerStatus; error: string }) {
  if (status === "error" || status === "offline") {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}>
        <div className="text-center max-w-sm px-6">
          <div className="text-5xl mb-4">{status === "offline" ? "📡" : "⚠️"}</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#e4e4e7" }}>
            {status === "offline" ? "Channel Offline" : "Playback Error"}
          </h3>
          <p className="text-sm mb-4" style={{ color: "#a1a1aa" }}>
            {error || "Unable to play this channel. It may be temporarily unavailable."}
          </p>
          <Link
            href="/iptv/channels"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: "#ef4444", color: "#fff" }}
          >
            Browse Other Channels
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading" || status === "connecting" || status === "retrying") {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
        <div className="text-center">
          <div className="relative mx-auto mb-4 w-16 h-16">
            <div className="absolute inset-0 rounded-full border-[3px] border-red-600/20" />
            <div className="absolute inset-0 rounded-full border-[3px] border-t-red-600 animate-spin" />
          </div>
          <p className="text-sm font-medium" style={{ color: "#e4e4e7" }}>
            {status === "connecting" && "Establishing connection..."}
            {status === "loading" && "Preparing stream..."}
            {status === "retrying" && "Reconnecting..."}
          </p>
          <p className="text-xs mt-1" style={{ color: "#71717a" }}>This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function IptvWatchPage() {
  const params = useParams();
  const channelId = Number(params.id);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const cancelledRef = useRef(false);

  // State
  const [channel, setChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // ============================================================
  // LOAD CHANNEL INFO FROM VPS CACHE
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    async function loadChannelInfo() {
      try {
        const res = await fetch(`${VPS_URL}/api/channels-all`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();

        if (cancelled) return;

        const channels: Channel[] = data.channels || [];
        const found = channels.find((ch) => Number(ch.id) === channelId);

        setChannel(found || { id: channelId, name: `Channel ${channelId}` });
      } catch {
        if (!cancelled) {
          setChannel({ id: channelId, name: `Channel ${channelId}` });
        }
      }
    }

    loadChannelInfo();
    return () => { cancelled = true; };
  }, [channelId]);

  // ============================================================
  // HLS PLAYER
  // ============================================================
  useEffect(() => {
    if (!videoRef.current || Number.isNaN(channelId)) return;

    cancelledRef.current = false;
    let fallbackTried = false;
    const video = videoRef.current;

    async function startPlayer(forceTranscode = false) {
      if (cancelledRef.current) return;

      setErrorMessage("");
      setPlayerStatus("connecting");

      try {
        // Notify VPS server to start the stream
        await fetch(`${VPS_URL}/watch/${channelId}${forceTranscode ? "?forceTranscode=1" : ""}`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }).catch(() => {}); // Ignore errors — stream may already be running
      } catch {}

      const playlist = `${HLS_BASE}/hls/${channelId}.m3u8`;

      setPlayerStatus("connecting");
      const ready = await waitForPlaylist(playlist);

      if (!ready) {
        if (!cancelledRef.current) {
          setPlayerStatus("offline");
          setErrorMessage("This channel appears to be offline. Please try another.");
        }
        return;
      }

      if (cancelledRef.current) return;

      setPlayerStatus("loading");

      // Dynamically import hls.js
      const HlsModule = await import("hls.js");
      const Hls = HlsModule.default;

      // Destroy previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Reset video element
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}

      // Create HLS instance
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferHole: 1,
        liveSyncDurationCount: 6,
        liveMaxLatencyDurationCount: 15,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 4,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
      });

      hlsRef.current = hls;

      // Success handler
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelledRef.current) return;
        setPlayerStatus("playing");
        video.play().catch(() => {
          // Autoplay blocked — user needs to click play
          setPlayerStatus("playing");
        });
      });

      // Error handler
      hls.on(Hls.Events.ERROR, async (_event: string, data: any) => {
        if (!data.fatal) {
          // Non-fatal — let HLS.js handle it
          return;
        }

        if (cancelledRef.current) return;

        const errorType = data.type;

        // Network error — attempt recovery
        if (errorType === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn("[HLS] Network error — attempting recovery");
          hls.startLoad();
          return;
        }

        // Media error — attempt recovery
        if (errorType === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn("[HLS] Media error — recovering");
          hls.recoverMediaError();
          return;
        }

        // Fatal — try fallback with transcode
        if (!fallbackTried) {
          fallbackTried = true;
          console.warn("[HLS] Fatal error — retrying with transcode");
          setPlayerStatus("retrying");

          // Notify server to clean up
          await fetch(`${VPS_URL}/leave/${channelId}`).catch(() => {});

          // Wait 2 seconds then retry
          await new Promise((r) => setTimeout(r, 2000));
          startPlayer(true);
          return;
        }

        // Hard failure
        console.error("[HLS] Playback failed");
        hls.destroy();
        hlsRef.current = null;

        if (!cancelledRef.current) {
          setPlayerStatus("error");
          setErrorMessage("Playback failed after multiple attempts. The stream format may be unsupported.");
        }
      });

      // Attach and load
      hls.attachMedia(video);
      hls.loadSource(playlist);
    }

    startPlayer();

    // Cleanup
    return () => {
      cancelledRef.current = true;

      fetch(`${VPS_URL}/leave/${channelId}`).catch(() => {});

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelId]);

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const video = videoRef.current;
      if (!video) return;

      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "f":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            video.requestFullscreen().catch(() => {});
          }
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case " ":
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0f", color: "#e4e4e7" }}>
      <Header />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
        {/* ===== TOP BAR ===== */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <BackButton />
          <StatusBadge status={playerStatus} />
        </div>

        {/* ===== CHANNEL INFO ===== */}
        <ChannelInfoCard channel={channel} />

        {/* ===== VIDEO PLAYER ===== */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: "#000", border: "1px solid #27272a", boxShadow: "0 0 60px rgba(239, 68, 68, 0.05)" }}
        >
          <PlayerOverlay status={playerStatus} error={errorMessage} />

          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            className="w-full aspect-video block"
            style={{ minHeight: "360px" }}
            poster="/player-poster.png"
          />
        </div>

        {/* ===== PLAYER CONTROLS HINT ===== */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] sm:text-xs flex-wrap" style={{ color: "#52525b" }}>
          <span>Press <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#1a1a2e", border: "1px solid #27272a" }}>F</kbd> for fullscreen</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#1a1a2e", border: "1px solid #27272a" }}>M</kbd> to mute</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#1a1a2e", border: "1px solid #27272a" }}>Space</kbd> to play/pause</span>
        </div>

        {/* ===== FOOTER ===== */}
        <div className="mt-6 text-center pb-4">
          <p className="text-[11px]" style={{ color: "#3f3f46" }}>
            Stream via seatv.xyz &nbsp;•&nbsp; HLS delivery by bravestream.live
          </p>
        </div>
      </main>
    </div>
  );
}