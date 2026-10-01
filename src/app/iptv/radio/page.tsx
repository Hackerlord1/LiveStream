"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Radio, SearchX, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useCatalogue } from "@/hooks/use-catalogue";
import { IPTV_API_URL } from "@/lib/iptv-client";
import { formatCount, splitTag } from "@/lib/iptv-format";
import { EmptyState, IptvPage, RetryButton, SearchBox, SkeletonGrid } from "@/components/iptv/ui";

interface Station {
  id: string;
  number?: string | number;
  name?: string;
  logo?: string;
}

type PlayState = "idle" | "buffering" | "playing" | "error";

export default function RadioPage() {
  const { data, error, retry } = useCatalogue<{ stations: Station[] }>("radio", "/api/radio");
  const stations = useMemo(() => data?.stations ?? [], [data]);
  const [search, setSearch] = useState("");

  const [current, setCurrent] = useState<Station | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? stations.filter((s) => (s.name || "").toLowerCase().includes(q)) : stations;
  }, [stations, search]);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setCurrent(null);
    setPlayState("idle");
  }

  function toggle(station: Station) {
    if (current?.id === station.id) {
      stop();
      return;
    }
    audioRef.current?.pause();

    // The server converts the station to MP3 and serves it over HTTPS
    const audio = new Audio(`${IPTV_API_URL}/api/radio/${station.id}/listen`);
    audio.volume = volume;
    audio.muted = muted;
    audio.addEventListener("waiting", () => setPlayState("buffering"));
    audio.addEventListener("playing", () => setPlayState("playing"));
    audio.addEventListener("error", () => setPlayState("error"));
    audioRef.current = audio;
    setCurrent(station);
    setPlayState("buffering");
    audio.play().catch(() => setPlayState("error"));
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Stop audio when leaving the page
  useEffect(() => () => audioRef.current?.pause(), []);

  let body;
  if (!data && error) {
    body = (
      <EmptyState
        icon={<WifiOff className="h-6 w-6" />}
        title="Can't reach the server"
        message="We couldn't load radio stations right now."
        action={<RetryButton onClick={retry} />}
      />
    );
  } else if (!data) {
    body = <SkeletonGrid variant="tile" count={12} />;
  } else if (visible.length === 0) {
    body = <EmptyState icon={<SearchX className="h-6 w-6" />} title="No stations found" message={search ? `Nothing matches “${search}”.` : undefined} />;
  } else {
    body = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((station) => {
          const { tag, title } = splitTag(station.name);
          const active = current?.id === station.id;
          return (
            <button
              key={station.id}
              type="button"
              onClick={() => toggle(station)}
              className="group flex items-center gap-3 rounded-2xl p-3 text-left transition-colors"
              style={{
                backgroundColor: "var(--surface-primary)",
                border: `1px solid ${active ? "var(--brand-red)" : "var(--border-secondary)"}`,
              }}
            >
              <span
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
                style={active ? { backgroundColor: "var(--brand-red)", color: "#fff" } : { backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)" }}
              >
                {active && playState === "buffering" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : active ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 translate-x-px" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold group-hover:text-red-500">{title}</span>
                <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {[tag, active ? stateLabel(playState) : null].filter(Boolean).join(" · ") || "Radio"}
                </span>
              </span>
              {active && playState === "playing" && <Equalizer />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <IptvPage
      title="Radio"
      icon={<Radio className="h-5 w-5" />}
      subtitle={data ? `${formatCount(stations.length)} stations` : undefined}
      toolbar={<SearchBox value={search} onChange={setSearch} placeholder="Search stations…" />}
    >
      <div className={current ? "pb-24" : undefined}>{body}</div>

      {current && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6">
          <div
            className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl p-3 shadow-2xl backdrop-blur"
            style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-primary)" }}
          >
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "var(--brand-red)" }}
            >
              {playState === "buffering" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Pause className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{splitTag(current.name).title}</p>
              <p className="text-xs" style={{ color: playState === "error" ? "var(--error-text)" : "var(--text-muted)" }}>
                {playState === "error" ? "Couldn't play this station. Try another." : stateLabel(playState)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: "var(--text-secondary)" }}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setMuted(false);
              }}
              aria-label="Volume"
              className="hidden w-28 accent-red-600 sm:block"
            />
          </div>
        </div>
      )}
    </IptvPage>
  );
}

function stateLabel(state: PlayState) {
  return state === "buffering" ? "Connecting…" : state === "playing" ? "Live" : state === "error" ? "Unavailable" : "";
}

function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="w-1 animate-pulse rounded-sm bg-red-500" style={{ height: "100%", animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
