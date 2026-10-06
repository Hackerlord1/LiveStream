"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw, Tv, WifiOff } from "lucide-react";
import { splitTag } from "@/lib/iptv-format";
import { Badge, IptvPage, QualityPicker } from "@/components/iptv/ui";
import { readLiveQuality, writeLiveQuality } from "@/lib/quality";

// ============================================================
// CONFIGURATION
// ============================================================
import { apiAsset, IPTV_API_URL } from "@/lib/iptv-client";
// A channel's very first start also probes its resolution, so allow well over the ~15-20 s it can take
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

      let text = await res.text();
      // With several qualities this is a master playlist: check a quality's own playlist
      if (text.includes("#EXT-X-STREAM-INF")) {
        const variants = text.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
        const variant = variants[variants.length - 1]; // lowest quality is listed last
        const variantRes = variant ? await fetch(new URL(variant, url), { cache: "no-store" }) : null;
        text = variantRes?.ok ? await variantRes.text() : "";
      }
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
  const [logoFailed, setLogoFailed] = useState(false);
  const { tag, title } = splitTag(channel?.name);

  return (
    <div
      className="mt-4 flex items-center gap-4 rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
    >
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--surface-secondary)" }}
      >
        {channel?.logo && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote logos on arbitrary hosts
          <img src={apiAsset(channel.logo)} alt="" className="max-h-full max-w-full object-contain p-1.5" onError={() => setLogoFailed(true)} />
        ) : (
          <Tv className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
        )}
      </div>
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
  // Bumped by "Try again" to restart the player
  const [attempt, setAttempt] = useState(0);
  // Qualities the stream offers (highest first), the viewer's choice, and what's playing now
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [quality, setQuality] = useState("auto");
  const [activeHeight, setActiveHeight] = useState<number | null>(null);

  function chooseQuality(value: string) {
    setQuality(value);
    writeLiveQuality(value);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = value === "auto" ? -1 : levels.find((l) => String(l.height) === value)?.index ?? -1;
  }

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

      // Older iPhones/iPads can't run hls.js; Safari plays HLS itself (and adapts quality on its own)
      if (!Hls.isSupported() && video.canPlayType("application/vnd.apple.mpegurl")) {
        setLevels([]);
        video.src = playlist;
        video.addEventListener("error", () => {
          if (cancelledRef.current) return;
          setPlayerStatus("error");
          setErrorMessage("Playback failed. Please try again.");
        }, { once: true });
        setPlayerStatus("playing");
        video.play().catch(() => {});
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
        // Auto quality never picks more pixels than the player shows (phones skip 1080p)
        capLevelToPlayerSize: true,
      });

      hlsRef.current = hls;

      // Success handler
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelledRef.current) return;
        const available = hls.levels
          .map((level, index) => ({ index, height: level.height }))
          .sort((a, b) => b.height - a.height);
        setLevels(available);
        // Viewer's saved choice: "auto", a height this channel offers, or (default) the best
        const saved = readLiveQuality();
        const match = available.find((l) => String(l.height) === saved);
        const chosen = saved === "auto" ? null : match ?? available[0];
        hls.currentLevel = chosen ? chosen.index : -1;
        setQuality(chosen ? String(chosen.height) : "auto");
        setPlayerStatus("playing");
        video.play().catch(() => {
          // Autoplay blocked — user needs to click play
          setPlayerStatus("playing");
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setActiveHeight(hls.levels[data.level]?.height ?? null);
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
          if (video.paused) video.play();
          else video.pause();
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
    <IptvPage title="Live TV" icon={<Tv className="h-5 w-5" />} backHref="/iptv/channels">
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl">
          <PlayerOverlay status={playerStatus} error={errorMessage} onRetry={() => setAttempt((a) => a + 1)} />
          <video ref={videoRef} controls autoPlay muted playsInline className="block aspect-video w-full" />
        </div>

        {levels.length > 1 && (
          <QualityPicker
            options={[{ value: "auto", label: "Auto" }, ...levels.map((l) => ({ value: String(l.height), label: `${l.height}p` }))]}
            value={quality}
            onChange={chooseQuality}
            note={quality === "auto"
              ? (activeHeight ? `Playing ${activeHeight}p` : undefined)
              : "Buffering? Choose Auto or a lower quality"}
          />
        )}

        <ChannelInfo channel={channel} status={playerStatus} />

        <div className="mt-3 hidden flex-wrap items-center justify-center gap-4 text-xs sm:flex" style={{ color: "var(--text-muted)" }}>
          <Shortcut keyLabel="F" action="fullscreen" />
          <Shortcut keyLabel="M" action="mute" />
          <Shortcut keyLabel="Space" action="play / pause" />
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
