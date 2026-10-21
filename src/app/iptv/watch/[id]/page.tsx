"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Loader2, Maximize, MessageCircle, Minimize, RefreshCw, Tv, VolumeX, WifiOff } from "lucide-react";
import IptvChat from "@/components/iptv/IptvChat";
import { splitTag } from "@/lib/iptv-format";
import { Badge, IptvPage, SpeedNotice } from "@/components/iptv/ui";
import RelatedChannels from "@/components/iptv/RelatedChannels";
import ChannelGuide from "@/components/iptv/ChannelGuide";
import ChannelLogo from "@/components/iptv/ChannelLogo";

// ============================================================
// CONFIGURATION
// ============================================================
import { apiAsset, IPTV_API_URL } from "@/lib/iptv-client";
// A channel's first start can take ~15-20 s (longer when it falls back to re-encoding), so allow well over that
const PLAYLIST_TIMEOUT = 45000;
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
  hd?: number | string;
}

type PlayerStatus = "loading" | "connecting" | "playing" | "retrying" | "error" | "offline";

/**
 * Start playback with sound if the browser allows it (it usually does after the viewer
 * clicked a channel); otherwise fall back to muted playback, and the page shows a
 * "Tap for sound" button.
 */
function playWithSound(video: HTMLVideoElement) {
  video.muted = false;
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => {});
  });
}

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
function StatusBadge({ status }: { status: PlayerStatus }) {
  const config: Record<PlayerStatus, { label: string; live?: boolean; tone: "muted" | "warn" | "live" | "error" }> = {
    loading: { label: "Preparing…", tone: "muted" },
    connecting: { label: "Connecting…", tone: "warn" },
    playing: { label: "LIVE", tone: "live", live: true },
    retrying: { label: "Reconnecting…", tone: "warn" },
    error: { label: "Error", tone: "error" },
    offline: { label: "Offline", tone: "muted" },
  };
  const { label, tone, live } = config[status];
  const styles = {
    muted: { backgroundColor: "var(--surface-secondary)", color: "var(--text-muted)" },
    warn: { backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" },
    live: { backgroundColor: "#dc2626", color: "#fff" },
    error: { backgroundColor: "var(--error-bg)", color: "var(--error-text)" },
  } as const;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={styles[tone]}>
      {(live || tone === "warn") && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  );
}

function ChannelInfo({ channel, status }: { channel: Channel | null; status: PlayerStatus }) {
  const { tag, title } = splitTag(channel?.name);

  return (
    <div
      className="mt-4 flex items-center gap-4 rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
    >
      <ChannelLogo
        src={apiAsset(channel?.logo)}
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--surface-secondary)" }}
        imgClassName="max-h-full max-w-full object-contain p-1.5"
        fallback={<Tv className="h-6 w-6" style={{ color: "var(--text-muted)" }} />}
      />
      <div className="min-w-0 flex-1">
        {channel ? (
          <>
            <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {channel.number && (
                <span className="rounded-md px-2 py-0.5 font-mono text-[11px]" style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-muted)" }}>
                  CH {channel.number}
                </span>
              )}
              {tag && <Badge>{tag}</Badge>}
              {String(channel.hd) === "1" && <Badge tone="red">HD</Badge>}
            </div>
          </>
        ) : (
          <div className="space-y-2" aria-hidden>
            <div className="h-5 w-48 animate-pulse rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
            <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
          </div>
        )}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function PlayerOverlay({ status, error, onRetry }: { status: PlayerStatus; error: string; onRetry: () => void }) {
  if (status === "error" || status === "offline") {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 px-6">
        <div className="max-w-sm text-center text-white">
          {status === "offline" ? (
            <WifiOff className="mx-auto mb-3 h-10 w-10 text-white/60" />
          ) : (
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-yellow-400" />
          )}
          <h3 className="mb-1 text-lg font-semibold">{status === "offline" ? "Channel offline" : "Playback error"}</h3>
          <p className="mb-5 text-sm text-white/70">
            {error || "Unable to play this channel. It may be temporarily unavailable."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link
              href="/iptv/channels"
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20"
            >
              Other channels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === "loading" || status === "connecting" || status === "retrying") {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
        <div className="text-center text-white">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-red-500" />
          <p className="text-sm font-medium">
            {status === "connecting" && "Starting the stream…"}
            {status === "loading" && "Preparing video…"}
            {status === "retrying" && "Reconnecting…"}
          </p>
          <p className="mt-1 text-xs text-white/50">This can take up to 30 seconds the first time</p>
        </div>
      </div>
    );
  }

  return null;
}

/** True from the `lg` breakpoint up (sidebar layout); false until mounted. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

function PlayerButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/85"
    >
      {children}
    </button>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function IptvWatchPage() {
  const params = useParams();
  // Opened from the home page's channels (?from=home): the back button returns there
  const fromHome = useSearchParams().get("from") === "home";
  const channelId = Number(params.id);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const cancelledRef = useRef(false);

  // State
  const [channel, setChannel] = useState<Channel | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  // Bumped by "Try again" to restart the player
  const [attempt, setAttempt] = useState(0);
  const [muted, setMuted] = useState(false);

  // Fullscreen covers the player *and* the chat beside it (stageRef), not just the video
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenChat, setFullscreenChat] = useState(true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(stageRef.current) && document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (stage?.requestFullscreen) {
      // Narrow portrait phones start with the chat hidden, so the video gets the screen
      setFullscreenChat(window.innerWidth >= 640);
      stage.requestFullscreen().then(() => {
        // Landscape suits a match; browsers that can't lock orientation just ignore this
        (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape").catch(() => {});
      }).catch(() => {});
    } else {
      // iPhone Safari can only put the video itself in fullscreen
      video?.webkitEnterFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onVolume = () => setMuted(video.muted || video.volume === 0);
    video.addEventListener("volumechange", onVolume);
    return () => video.removeEventListener("volumechange", onVolume);
  }, []);

  // ============================================================
  // LOAD CHANNEL INFO FROM VPS CACHE
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    async function loadChannelInfo() {
      try {
        const res = await fetch(`${IPTV_API_URL}/api/channel/${channelId}`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = res.ok ? await res.json() : null;

        if (cancelled) return;

        const found: Channel | undefined = data?.channel;
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

      // Ask the server to start the stream. A refusal (e.g. busy, or ffmpeg missing)
      // is reported straight away instead of waiting for a playlist that won't come.
      const startRes = await fetch(`${IPTV_API_URL}/watch/${channelId}${forceTranscode ? "?forceTranscode=1" : ""}`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      if (startRes && !startRes.ok) {
        const body = await startRes.json().catch(() => null);
        if (!cancelledRef.current) {
          setPlayerStatus("error");
          setErrorMessage(body?.error || "The server couldn't start this channel.");
        }
        return;
      }

      const playlist = `${IPTV_API_URL}/hls/${channelId}.m3u8`;

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

      // Older iPhones/iPads can't run hls.js; Safari plays HLS itself
      if (!Hls.isSupported() && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playlist;
        video.addEventListener("error", () => {
          if (cancelledRef.current) return;
          setPlayerStatus("error");
          setErrorMessage("Playback failed. Please try again.");
        }, { once: true });
        setPlayerStatus("playing");
        playWithSound(video);
        return;
      }

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
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
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
        playWithSound(video);
      });

      // Error handler
      hls.on(Hls.Events.ERROR, async (_event, data) => {
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
          await fetch(`${IPTV_API_URL}/leave/${channelId}`).catch(() => {});

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

      fetch(`${IPTV_API_URL}/leave/${channelId}`).catch(() => {});

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelId, attempt]);

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
          toggleFullscreen();
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case " ":
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <IptvPage title="Live TV" icon={<Tv className="h-5 w-5" />} backHref={fromHome ? "/" : "/iptv/channels"}>
      {/* grid-cols-1 caps the column at the screen width (long channel names overflowed phones) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div ref={stageRef} className={fullscreen ? "flex h-full w-full bg-black" : ""}>
        <div className={`relative min-w-0 flex-1 overflow-hidden bg-black ${fullscreen ? "" : "rounded-2xl shadow-2xl"}`}>
          <PlayerOverlay status={playerStatus} error={errorMessage} onRetry={() => setAttempt((a) => a + 1)} />
          <video
            ref={videoRef}
            controls
            // The fullscreen button below also brings the chat; the native one would show only the video
            controlsList="nofullscreen"
            autoPlay
            playsInline
            className={fullscreen ? "block h-full w-full object-contain" : "block aspect-video w-full"}
          />
          {/* Shown each time a channel is opened; fades once it plays */}
          <SpeedNotice key={channelId} started={playerStatus === "playing"} />
          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <PlayerButton label="Refresh stream" onClick={() => setAttempt((a) => a + 1)}>
              <RefreshCw className="h-4 w-4" />
            </PlayerButton>
            {fullscreen && (
              <PlayerButton label={fullscreenChat ? "Hide chat" : "Show chat"} onClick={() => setFullscreenChat((v) => !v)}>
                <MessageCircle className="h-4 w-4" />
              </PlayerButton>
            )}
            <PlayerButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </PlayerButton>
          </div>
          {muted && playerStatus === "playing" && (
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = false;
                if (video.volume === 0) video.volume = 1;
              }}
              className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur hover:bg-black/90"
            >
              <VolumeX className="h-4 w-4" /> Tap for sound
            </button>
          )}
        </div>
        {fullscreen && fullscreenChat && (
          <div className="h-full w-[clamp(240px,28vw,360px)] flex-shrink-0 p-2">
            <IptvChat dark />
          </div>
        )}
        </div>

        {/* Phones: the chat folds away under the player */}
        {!isDesktop && !fullscreen && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setMobileChatOpen((open) => !open)}
              aria-expanded={mobileChatOpen}
              className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
            >
              <MessageCircle className="h-4 w-4 text-red-500" />
              <span className="flex-1 text-left">{mobileChatOpen ? "Hide live chat" : "Open live chat"}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileChatOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileChatOpen && (
              <div className="mt-2 h-[60vh] max-h-[480px]">
                <IptvChat />
              </div>
            )}
          </div>
        )}

        <ChannelInfo channel={channel} status={playerStatus} />
        <ChannelGuide channelId={channelId} />

        <div className="mt-3 hidden flex-wrap items-center justify-center gap-4 text-xs sm:flex" style={{ color: "var(--text-muted)" }}>
          <Shortcut keyLabel="F" action="fullscreen" />
          <Shortcut keyLabel="M" action="mute" />
          <Shortcut keyLabel="Space" action="play / pause" />
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {isDesktop && !fullscreen && (
          <div className="h-[520px]">
            <IptvChat />
          </div>
        )}
        <RelatedChannels channelId={channelId} fromHome={fromHome} />
      </div>
      </div>
    </IptvPage>
  );
}

function Shortcut({ keyLabel, action }: { keyLabel: string; action: string }) {
  return (
    <span>
      <kbd
        className="mr-1 rounded px-1.5 py-0.5 font-mono text-[10px]"
        style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-primary)" }}
      >
        {keyLabel}
      </kbd>
      {action}
    </span>
  );
}
