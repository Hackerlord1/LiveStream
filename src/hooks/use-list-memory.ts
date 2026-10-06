"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

type Filters = Record<string, string>;

interface Saved {
  filters: Filters;
  /** Index of the first item visible at the top of the list */
  firstItem: number;
}

const PREFIX = "iptv-list:";
const SAVE_DELAY_MS = 150;

function read(key: string): Saved | null {
  try {
    return JSON.parse(sessionStorage.getItem(PREFIX + key) || "null");
  } catch {
    return null;
  }
}

function write(key: string, value: Saved) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode): the list just won't be remembered
  }
}

/**
 * Remembers a virtualized list page's filters and scroll position for this browser tab,
 * so opening a channel/movie and coming back lands exactly where the viewer was.
 *
 * Stores the first visible *item* (not pixels), so it still lands right if the
 * column count changed.
 */
export function useListMemory({
  key,
  filters,
  applyFilters,
  virtualizer,
  scrollElement,
  columns,
  itemCount,
}: {
  key: string;
  /** Current filter values (search text, category, sort...) */
  filters: Filters;
  /** Called once with the saved filters, to restore them */
  applyFilters: (filters: Filters) => void;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scrollElement: React.RefObject<HTMLDivElement | null>;
  columns: number;
  /** Number of items currently listed (0 while loading) */
  itemCount: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const pendingItem = useRef<number | null>(null);
  const positionRestored = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<Saved>({ filters, firstItem: 0 });

  // Read the saved state after mount (sessionStorage doesn't exist during server rendering)
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = read(key);
      if (saved) {
        latest.current = saved;
        pendingItem.current = saved.firstItem;
        applyFilters(saved.filters);
      } else {
        positionRestored.current = true; // nothing to restore
      }
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
    // applyFilters is only needed once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist filter changes (only after the saved ones were applied, so defaults don't overwrite them)
  const filtersJson = JSON.stringify(filters);
  useEffect(() => {
    if (!loaded) return;
    latest.current = { ...latest.current, filters: JSON.parse(filtersJson) };
    write(key, latest.current);
  }, [key, loaded, filtersJson]);

  // Restore the scroll position once the list has its items
  useEffect(() => {
    if (!loaded || positionRestored.current || itemCount === 0) return;
    const item = pendingItem.current ?? 0;
    positionRestored.current = true;
    if (item <= 0) return;
    const row = Math.floor(Math.min(item, itemCount - 1) / columns);
    // Next frame: after the list has laid out (and after any "scroll to top on filter change")
    requestAnimationFrame(() => virtualizer.scrollToIndex(row, { align: "start" }));
  }, [loaded, itemCount, columns, virtualizer]);

  const lastTop = useRef(0);
  const savePosition = useCallback(() => {
    saveTimer.current = undefined;
    const row = virtualizer.getVirtualItemForOffset(lastTop.current)?.index ?? 0;
    latest.current = { ...latest.current, firstItem: row * columns };
    write(key, latest.current);
  }, [key, columns, virtualizer]);

  /** Attach to the list's scroll container: records which item is at the top. */
  const onScroll = useCallback(() => {
    if (!positionRestored.current) return; // don't overwrite the saved spot while restoring
    lastTop.current = scrollElement.current?.scrollTop ?? 0;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(savePosition, SAVE_DELAY_MS);
  }, [savePosition, scrollElement]);

  // Leaving the page (e.g. clicking a channel) right after scrolling: save immediately
  const flush = useRef(savePosition);
  useEffect(() => {
    flush.current = savePosition;
  }, [savePosition]);
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        flush.current();
      }
    },
    []
  );

  return { onScroll };
}
