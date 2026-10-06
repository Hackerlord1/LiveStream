"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ImageOff, SearchX, WifiOff } from "lucide-react";
import { useCatalogue } from "@/hooks/use-catalogue";
import { useListMemory } from "@/hooks/use-list-memory";
import { formatCount, formatRating, formatYear, isHd, splitTag } from "@/lib/iptv-format";
import type { IptvCategory } from "@/lib/api/iptv-types";
import { Badge, EmptyState, FilterChips, IptvPage, LoadProgress, RetryButton, SearchBox, SkeletonGrid } from "./ui";

export interface CatalogueItem {
  id: string;
  name: string;
  screenshot_uri?: string;
  rating_kinopoisk?: string;
  genres_str?: string;
  year?: string;
  hd?: number | string;
  category_id?: string;
}

type SortKey = "added" | "rating" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "added", label: "Newest" },
  { id: "rating", label: "Top rated" },
  { id: "name", label: "A–Z" },
];

const MAX_CATEGORY_CHIPS = 30;
const MIN_CARD_WIDTH = 160;

interface CatalogueBrowserProps {
  kind: "vod" | "series";
  /** Key of the list in the API response ("movies" / "series") */
  listKey: "movies" | "series";
  title: string;
  icon: ReactNode;
  noun: string;
  hrefFor: (item: CatalogueItem) => string;
}

export default function CatalogueBrowser({ kind, listKey, title, icon, noun, hrefFor }: CatalogueBrowserProps) {
  const { data, error, status, retry } = useCatalogue<Record<string, unknown>>(kind, `/api/${kind}/all`);
  const items = useMemo(() => (data?.[listKey] as CatalogueItem[] | undefined) ?? [], [data, listKey]);
  const categories = useMemo(() => (data?.categories as IptvCategory[] | undefined) ?? [], [data]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("added");

  // Category chips: only categories that actually have items, biggest first
  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.category_id) counts.set(item.category_id, (counts.get(item.category_id) || 0) + 1);
    }
    const named = categories
      .filter((c) => c.id !== "*" && counts.has(String(c.id)))
      .map((c) => ({ id: String(c.id), label: splitTag(c.title).title || c.title, count: counts.get(String(c.id)) }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, MAX_CATEGORY_CHIPS);
    return [{ id: "all", label: "All", count: items.length }, ...named];
  }, [items, categories]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter(
      (item) =>
        (category === "all" || item.category_id === category) &&
        (!q || (item.name || "").toLowerCase().includes(q))
    );
    if (sort === "rating") {
      return [...filtered].sort((a, b) => (Number(b.rating_kinopoisk) || 0) - (Number(a.rating_kinopoisk) || 0));
    }
    if (sort === "name") {
      return [...filtered].sort((a, b) => splitTag(a.name).title.localeCompare(splitTag(b.name).title));
    }
    return filtered; // server order is newest first
  }, [items, search, category, sort]);

  // Responsive column count from the grid's actual width
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(Math.max(2, Math.min(8, Math.floor(width / MIN_CARD_WIDTH))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data]);

  const rowCount = Math.ceil(visible.length / columns);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is not compiler-compatible
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 3,
  });

  // Jump back to the top when the filter changes
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [search, category, sort]);

  // Coming back from a movie/series returns to the same spot, search, category and sort
  const { onScroll } = useListMemory({
    key: kind,
    filters: { search, category, sort },
    applyFilters: (f) => {
      setSearch(f.search ?? "");
      setCategory(f.category ?? "all");
      if (f.sort === "added" || f.sort === "rating" || f.sort === "name") setSort(f.sort);
    },
    virtualizer,
    scrollElement: parentRef,
    columns,
    itemCount: visible.length,
  });

  const subtitle = data
    ? visible.length === items.length
      ? `${formatCount(items.length)} ${noun}`
      : `${formatCount(visible.length)} of ${formatCount(items.length)} ${noun}`
    : undefined;

  let body: ReactNode;
  if (!data && error) {
    body = (
      <EmptyState
        icon={<WifiOff className="h-6 w-6" />}
        title="Can't reach the server"
        message={`We couldn't load ${noun} right now.`}
        action={<RetryButton onClick={retry} />}
      />
    );
  } else if (!data || (items.length === 0 && !status?.ready)) {
    body = <SkeletonGrid variant="poster" />;
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={<SearchX className="h-6 w-6" />}
        title={`No ${noun} found`}
        message={search ? `Nothing matches “${search}”.` : "Try another category."}
      />
    );
  } else {
    body = (
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const rowItems = visible.slice(row.index * columns, row.index * columns + columns);
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full pb-3"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {rowItems.map((item) => (
                  <PosterCard key={item.id} item={item} href={hrefFor(item)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <IptvPage
      title={title}
      icon={icon}
      subtitle={subtitle}
      fullHeight
      toolbar={
        <>
          <LoadProgress status={status} noun={noun} />
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchBox value={search} onChange={setSearch} placeholder={`Search ${noun}…`} />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort"
              className="rounded-xl px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-600/40"
              style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--input-text)" }}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {chipOptions.length > 1 && <FilterChips options={chipOptions} value={category} onChange={setCategory} />}
        </>
      }
    >
      <div ref={parentRef} onScroll={onScroll} className="h-full overflow-y-auto px-1 pt-1" style={{ scrollbarWidth: "thin" }}>
        {body}
      </div>
    </IptvPage>
  );
}

function PosterCard({ item, href }: { item: CatalogueItem; href: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { tag, title } = splitTag(item.name);
  const year = formatYear(item.year);
  const rating = formatRating(item.rating_kinopoisk);
  const genre = item.genres_str?.split(",")[0]?.trim();

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
    >
      <div className="relative aspect-[2/3] overflow-hidden" style={{ backgroundColor: "var(--surface-tertiary)" }}>
        {item.screenshot_uri && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote posters on arbitrary hosts
          <img
            src={item.screenshot_uri}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <ImageOff className="h-8 w-8 opacity-40" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute left-1.5 top-1.5 flex gap-1">{rating && <Badge tone="gold">★ {rating}</Badge>}</div>
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          {tag && <Badge>{tag}</Badge>}
          {isHd(item.hd) && <Badge tone="red">HD</Badge>}
        </div>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-snug group-hover:text-red-500" title={title}>
          {title}
        </p>
        <p className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {[year, genre].filter(Boolean).join(" · ") || " "}
        </p>
      </div>
    </Link>
  );
}
