"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { fetchIptv, IptvError, IPTV_API_URL } from "@/lib/iptv-client";

interface Source {
  /** "direct": the file plays as-is (native seeking). "remux": the server repackages it; seeking restarts at ?start= */
  mode: "direct" | "remux";
  duration: number | null;
  stream: string;
}

const RESUME_MIN_SECONDS = 30;
const SAVE_EVERY_MS = 10000;
const SKIP_SECONDS = 10;

function resumeKey(key: string) {
  return `iptv-resume:${key}`;
}

function readResume(key: string): number {
  try {
    return Number(localStorage.getItem(resumeKey(key))) || 0;
  } catch {
    return 0;
  }
}

function writeResume(key: string, seconds: number) {
  try {
    if (seconds > 0) localStorage.setItem(resumeKey(key), String(Math.floor(seconds)));
    else localStorage.removeItem(resumeKey(key));
  } catch {
    // storage unavailable (private mode): resume just won't work
  }
}

function formatTime(total: number) {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Plays a movie or episode from the stream server.
 * `sourcePath` is the server's …/source endpoint; `resumeId` keys the saved position.
 */
export default function VodPlayer({ sourcePath, resumeId, title }: { sourcePath: string; resumeId: string; title: string }) {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIptv<Source>(sourcePath)
      .then((s) => {
        if (!cancelled) setSource(s);
      })
      .catch((err) => {
        if (cancelled) return;
        const serverMessage = err instanceof IptvError ? err.serverMessage : null;
        setError(serverMessage || "This title can't be played right now. Please try again later.");
      });
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
      {error ? (
        <PlayerMessage icon={<AlertTriangle className="h-8 w-8 text-yellow-400" />} text={error} />
      ) : !source ? (
        <PlayerMessage icon={<Loader2 className="h-8 w-8 animate-spin text-white/80" />} text="Preparing video…" />
      ) : source.mode === "direct" ? (
        <DirectVideo key={source.stream} source={source} resumeId={resumeId} title={title} />
      ) : (
        <RemuxVideo key={source.stream} source={source} resumeId={resumeId} title={title} />
      )}
    </div>
  );
}

function PlayerMessage({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
      {icon}
      <p>{text}</p>
    </div>
  );
}

/** Browser-playable file: native controls and seeking. */
function DirectVideo({ source, resumeId, title }: { source: Source; resumeId: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => {
      const saved = readResume(resumeId);
      if (saved > RESUME_MIN_SECONDS && saved < video.duration - 60) video.currentTime = saved;
    };
    const timer = setInterval(() => {
      if (!video.paused) writeResume(resumeId, video.currentTime);
    }, SAVE_EVERY_MS);
    const onEnded = () => writeResume(resumeId, 0);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("ended", onEnded);
    return () => {
      clearInterval(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("ended", onEnded);
    };
  }, [resumeId]);

  if (failed) {
    return <PlayerMessage icon={<AlertTriangle className="h-8 w-8 text-yellow-400" />} text="Playback failed. Please try again later." />;
  }

  return (
    <video
      ref={videoRef}
      src={`${IPTV_API_URL}${source.stream}`}
      title={title}
      controls
      autoPlay
      playsInline
      onError={() => setFailed(true)}
      className="h-full w-full"
    />
  );
}

/**
 * Repackaged stream: the server can't serve byte ranges, so the video element only
 * sees the stream from `offset` onwards. These controls present the full timeline
 * and reload the stream at the chosen time when seeking.
 */
function RemuxVideo({ source, resumeId, title }: { source: Source; resumeId: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = source.duration || 0;

  const [offset, setOffset] = useState(() => {
    const saved = readResume(resumeId);
    return saved > RESUME_MIN_SECONDS && (!duration || saved < duration - 60) ? saved : 0;
  });
  const [elapsed, setElapsed] = useState(0);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const position = offset + elapsed;
  const separator = source.stream.includes("?") ? "&" : "?";
  const src = `${IPTV_API_URL}${source.stream}${separator}start=${Math.floor(offset)}`;

  function seekTo(seconds: number) {
    const target = Math.max(0, duration ? Math.min(seconds, duration - 5) : seconds);
    setOffset(target);
    setElapsed(0);
    setBuffering(true);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => setFailed(true));
    else video.pause();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }

  function showControls() {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted, src]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Save the position for "resume", at most every SAVE_EVERY_MS
  const lastSaved = useRef(0);
  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const current = e.currentTarget.currentTime;
    setElapsed(current);
    if (Date.now() - lastSaved.current > SAVE_EVERY_MS) {
      lastSaved.current = Date.now();
      writeResume(resumeId, offset + current);
    }
  }

  if (failed) {
    return <PlayerMessage icon={<AlertTriangle className="h-8 w-8 text-yellow-400" />} text="Playback failed. Please try again later." />;
  }

  const shown = scrubbing ?? position;
  const percent = duration ? (shown / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full bg-black"
      onMouseMove={showControls}
      onTouchStart={showControls}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
        if (e.key === "ArrowRight") seekTo(position + SKIP_SECONDS);
        if (e.key === "ArrowLeft") seekTo(position - SKIP_SECONDS);
        if (e.key === "f") toggleFullscreen();
        if (e.key === "m") setMuted((m) => !m);
      }}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={src}
        title={title}
        autoPlay
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onPlaying={() => { setBuffering(false); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onEnded={() => { setPlaying(false); writeResume(resumeId, 0); }}
        onError={() => setFailed(true)}
        className="h-full w-full"
      />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" />
        </div>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-10 transition-opacity duration-300 sm:px-4 ${
          controlsVisible || !playing ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Timeline */}
        <div className="relative flex h-5 items-center">
          <div className="h-1 w-full rounded-full bg-white/25">
            <div className="h-full rounded-full bg-red-600" style={{ width: `${percent}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={1}
            value={shown}
            disabled={!duration}
            aria-label="Seek"
            onChange={(e) => setScrubbing(Number(e.target.value))}
            onPointerUp={() => {
              if (scrubbing !== null) seekTo(scrubbing);
              setScrubbing(null);
            }}
            onKeyUp={() => {
              if (scrubbing !== null) seekTo(scrubbing);
              setScrubbing(null);
            }}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="mt-1 flex items-center gap-1 text-white sm:gap-2">
          <IconButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </IconButton>
          <IconButton label="Back 10 seconds" onClick={() => seekTo(position - SKIP_SECONDS)}>
            <RotateCcw className="h-5 w-5" />
          </IconButton>
          <IconButton label="Forward 10 seconds" onClick={() => seekTo(position + SKIP_SECONDS)}>
            <RotateCw className="h-5 w-5" />
          </IconButton>
          <IconButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </IconButton>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
            aria-label="Volume"
            className="hidden w-20 accent-red-600 sm:block"
          />
          <span className="ml-1 text-xs tabular-nums text-white/90">
            {formatTime(shown)} {duration ? `/ ${formatTime(duration)}` : ""}
          </span>
          <div className="flex-1" />
          <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
    >
      {children}
    </button>
  );
}
