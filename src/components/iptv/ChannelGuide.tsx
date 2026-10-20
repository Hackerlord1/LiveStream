"use client";

import { useEffect, useState } from "react";
import { fetchIptv } from "@/lib/iptv-client";

interface Programme {
  title: string;
  description: string;
  /** Milliseconds since the epoch */
  start: number;
  stop: number;
}

const REFRESH_MS = 5 * 60 * 1000;

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** What's on now (with progress) and next, from the portal's programme guide. Hidden when the channel has none. */
export default function ChannelGuide({ channelId }: { channelId: number }) {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchIptv<{ programmes: Programme[] }>(`/api/channel/${channelId}/epg`)
        .then((data) => {
          if (!cancelled) setProgrammes(data.programmes);
        })
        .catch(() => {
          if (!cancelled) setProgrammes([]);
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [channelId]);

  // Keeps the progress bar and "now" moving between refreshes
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const upcoming = programmes.filter((p) => p.stop > now);
  const current = upcoming[0] && upcoming[0].start <= now ? upcoming[0] : null;
  const later = upcoming.slice(current ? 1 : 0, current ? 4 : 3);
  if (!current && later.length === 0) return null;

  const progress = current ? Math.min(100, ((now - current.start) / (current.stop - current.start)) * 100) : 0;

  return (
    <section
      className="mt-3 rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
      aria-label="Programme guide"
    >
      {current && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-red-600">Now</span>
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              {formatTime(current.start)} – {formatTime(current.stop)}
            </span>
          </div>
          <h2 className="mt-1 font-semibold">{current.title}</h2>
          <div className="mt-2 h-1 w-full rounded-full" style={{ backgroundColor: "var(--surface-tertiary)" }}>
            <div className="h-full rounded-full bg-red-600" style={{ width: `${progress}%` }} />
          </div>
          {current.description && (
            <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {current.description}
            </p>
          )}
        </div>
      )}

      {later.length > 0 && (
        <ul className={current ? "mt-3 space-y-1.5 border-t pt-3" : "space-y-1.5"} style={{ borderColor: "var(--border-secondary)" }}>
          {later.map((p) => (
            <li key={p.start} className="flex gap-3 text-sm">
              <span className="w-12 flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                {formatTime(p.start)}
              </span>
              <span className="min-w-0 truncate">{p.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
