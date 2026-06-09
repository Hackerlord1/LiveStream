"use client";

import { useCallback } from "react";

const WRAPPER_URL =
  process.env.NEXT_PUBLIC_IPTV_CONVEX_ACTION_URL ||
  "https://neighborly-perch-272.convex.cloud/api/action";

export async function callWrapper(
  path: string,
  args: Record<string, any> = {}
) {
  const res = await fetch(WRAPPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });

  if (!res.ok) {
    throw new Error(`Wrapper request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.value;
}

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

export function useChannelById(channelId: number) {
  const fetch = useCallback(
    () => callWrapper("iptv:getChannelById", { channelId }),
    [channelId]
  );

  return { fetch };
}

export function useChannelsByIds(channelIds: number[]) {
  const fetch = useCallback(
    () => callWrapper("iptv:getChannelsByIds", { channelIds }),
    [JSON.stringify(channelIds)]
  );

  return { fetch };
}