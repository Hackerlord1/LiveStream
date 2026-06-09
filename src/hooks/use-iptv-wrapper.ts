"use client";

import { useCallback, useEffect, useState } from "react";

const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";
const CHANNELS_CACHE_KEY = "iptv-channels-cache-v2";

async function callWrapper(path: string, args: Record<string, any> = {}) {
  const res = await fetch(WRAPPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  return data.value;
}

// ============================================================
// MODULE-LEVEL CHANNEL CACHE (shared across all hook instances)
// ============================================================
let channelMapCache: Record<string, any> | null = null;
let channelMapLoading = false;

export function useChannelMap() {
  const [channelMap, setChannelMap] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. Module-level cache (instant, survives re-renders)
      if (channelMapCache) {
        if (!cancelled) {
          setChannelMap(channelMapCache);
          setLoaded(true);
        }
        return;
      }

      // 2. SessionStorage cache (instant, survives navigation)
      try {
        const stored = sessionStorage.getItem(CHANNELS_CACHE_KEY);
        if (stored) {
          const channels = JSON.parse(stored);
          if (Array.isArray(channels) && channels.length > 100) {
            const map: Record<string, any> = {};
            for (const ch of channels) {
              if (ch.id) map[String(ch.id)] = ch;
            }
            channelMapCache = map;
            if (!cancelled) {
              setChannelMap(map);
              setLoaded(true);
            }
            return;
          }
        }
      } catch {
        // sessionStorage unavailable
      }

      // 3. Wait if another instance is already fetching
      if (channelMapLoading) {
        while (channelMapLoading) {
          await new Promise((r) => setTimeout(r, 300));
        }
        if (channelMapCache && !cancelled) {
          setChannelMap(channelMapCache);
          setLoaded(true);
        }
        return;
      }

      // 4. Fetch from API
      channelMapLoading = true;
      try {
        const data = await callWrapper("iptv:getAllChannels", {});
        const channels = data?.js?.data || [];
        const map: Record<string, any> = {};
        for (const ch of channels) {
          if (ch.id) map[String(ch.id)] = ch;
        }
        channelMapCache = map;

        if (!cancelled) {
          setChannelMap(map);
        }

        // Save to sessionStorage for other pages
        if (channels.length > 0) {
          try {
            sessionStorage.setItem(
              CHANNELS_CACHE_KEY,
              JSON.stringify(channels.slice(0, 5000))
            );
          } catch {
            // Storage full
          }
        }
      } catch (e) {
        console.error("Failed to load channel map:", e);
      } finally {
        channelMapLoading = false;
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { channelMap, loaded };
}

// ============================================================
// EXISTING HOOKS (unchanged)
// ============================================================
export function useIptvChannels(page = 0, genre?: string) {
  const fetch = useCallback(
    () => callWrapper("iptv:getOrderedList", { page, genre }),
    [page, genre]
  );
  return { fetch };
}

export function useIptvGenres() {
  const fetch = useCallback(() => callWrapper("iptv:getGenres", {}), []);
  return { fetch };
}

export function useIptvEpg(period = 1) {
  const fetch = useCallback(
    () => callWrapper("iptv:getEpgInfo", { period }),
    [period]
  );
  return { fetch };
}

export function useIptvShortEpg(channelId: number, size = 10) {
  const fetch = useCallback(
    () => callWrapper("iptv:getShortEpg", { channelId, size }),
    [channelId, size]
  );
  return { fetch };
}

export function useLiveGames(period = 1, page = 0, pageSize = 20) {
  const fetch = useCallback(
    () => callWrapper("iptv:getLiveGames", { period, page, pageSize }),
    [period, page, pageSize]
  );
  return { fetch };
}

export function useStreamUrl(channelId: number) {
  const fetch = useCallback(
    () => callWrapper("iptv:getLiveStreamUrl", { channelId }),
    [channelId]
  );
  return { fetch };
}