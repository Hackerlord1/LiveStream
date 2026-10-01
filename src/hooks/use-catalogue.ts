"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchIptv } from "@/lib/iptv-client";

export type CatalogueKind = "channels" | "radio" | "vod" | "series";

export interface CatalogueStatus {
  count: number;
  ready: boolean;
  loading: boolean;
  loaded: number;
  total: number;
  updatedAt: number | null;
}

export type StatusMap = Record<CatalogueKind, CatalogueStatus>;

const STATUS_POLL_MS = 3000;
// While the server is building a catalogue for the first time, re-fetch the
// (growing) list this often so the page fills in
const FIRST_LOAD_REFRESH_MS = 20000;

/** Reads the server's lightweight /api/status, polling while anything is still loading. */
export function useCatalogueStatus(poll = true) {
  const [status, setStatus] = useState<StatusMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      fetchIptv<StatusMap>("/api/status")
        .then((data) => {
          if (cancelled) return;
          setStatus(data);
          const stillLoading = Object.values(data).some((s) => !s.ready);
          if (poll && stillLoading) timer = setTimeout(tick, STATUS_POLL_MS);
        })
        .catch(() => {
          if (!cancelled && poll) timer = setTimeout(tick, STATUS_POLL_MS * 3);
        });
    }
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [poll]);

  return status;
}

/**
 * Loads a catalogue list and keeps it current while the server is still
 * building it (first run only; afterwards the server serves a complete cached list).
 */
export function useCatalogue<T>(kind: CatalogueKind, path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const status = useCatalogueStatus();
  const ready = status?.[kind]?.ready;

  // Remember if we watched this catalogue load, so we fetch once more when it
  // completes (adjusting state during render rather than in an effect)
  const [sawLoading, setSawLoading] = useState(false);
  if (ready === false && !sawLoading) setSawLoading(true);
  const completedWhileWatching = sawLoading && ready === true;

  useEffect(() => {
    let cancelled = false;
    fetchIptv<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [path, version, completedWhileWatching]);

  // Refresh periodically while the server is still building the list
  useEffect(() => {
    if (ready !== false) return;
    const timer = setInterval(() => setVersion((v) => v + 1), FIRST_LOAD_REFRESH_MS);
    return () => clearInterval(timer);
  }, [ready]);

  const retry = useCallback(() => setVersion((v) => v + 1), []);

  return { data, error, status: status?.[kind] ?? null, retry };
}
