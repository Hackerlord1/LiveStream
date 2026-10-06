"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SearchX, Tv, WifiOff } from "lucide-react";
import { useCatalogue } from "@/hooks/use-catalogue";
import { useListMemory } from "@/hooks/use-list-memory";
import { apiAsset } from "@/lib/iptv-client";
import { formatCount, isHd, splitTag } from "@/lib/iptv-format";
import { Badge, EmptyState, FilterChips, IptvPage, LoadProgress, RetryButton, SearchBox, SkeletonGrid } from "@/components/iptv/ui";

interface Channel {
  id: string;
  number?: string | number;
  name?: string;
  logo?: string;
  hd?: string | number;
  genreId?: string | number;
}

interface ChannelsResponse {
  channels: Channel[];
  genres: { id: string; title: string }[];
}

const MAX_GENRE_CHIPS = 40;
const MIN_TILE_WIDTH = 130;

export default function IptvChannelsPage() {
  const { data, error, status, retry } = useCatalogue<ChannelsResponse>("channels", "/api/channels-all");
  const channels = useMemo(() => data?.channels ?? [], [data]);

  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");

  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of channels) {
      const id = String(ch.genreId ?? "");
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    const named = (data?.genres ?? [])
      .filter((g) => g.id !== "*" && counts.has(String(g.id)))
      .map((g) => ({ id: String(g.id), label: g.title, count: counts.get(String(g.id)) }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, MAX_GENRE_CHIPS);
    return [{ id: "all", label: "All", count: channels.length }, ...named];
  }, [channels, data?.genres]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter(
      (ch) =>
        (genre === "all" || String(ch.genreId) === genre) &&
        (!q || (ch.name || "").toLowerCase().includes(q) || String(ch.number ?? "") === q)
    );
  }, [channels, search, genre]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setColumns(Math.max(2, Math.min(10, Math.floor(entry.contentRect.width / MIN_TILE_WIDTH))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is not compiler-compatible
  const virtualizer = useVirtualizer({
    count: Math.ceil(visible.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 4,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [search, genre]);

  // Coming back from a channel returns to the same spot, search and genre
  const { onScroll } = useListMemory({
    key: "channels",
    filters: { search, genre },
    applyFilters: (f) => {
      setSearch(f.search ?? "");
      setGenre(f.genre ?? "all");
    },
    virtualizer,
    scrollElement: parentRef,
    columns,
    itemCount: visible.length,
  });

  const subtitle = data
    ? visible.length === channels.length
      ? `${formatCount(channels.length)} live channels`
      : `${formatCount(visible.length)} of ${formatCount(channels.length)} channels`
    : undefined;

  let body;
  if (!data && error) {
    body = (
      <EmptyState
        icon={<WifiOff className="h-6 w-6" />}
        title="Can't reach the server"
        message="We couldn't load channels right now."
        action={<RetryButton onClick={retry} />}
      />
    );
  } else if (!data || (channels.length === 0 && !status?.ready)) {
    body = <SkeletonGrid variant="tile" count={24} />;
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={<SearchX className="h-6 w-6" />}
        title="No channels found"
        message={search ? `Nothing matches “${search}”.` : "Try another category."}
      />
    );
  } else {
    body = (
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full pb-3"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {visible.slice(row.index * columns, row.index * columns + columns).map((ch) => (
                <ChannelTile key={ch.id} channel={ch} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <IptvPage
      title="Live Channels"
      icon={<Tv className="h-5 w-5" />}
      subtitle={subtitle}
      fullHeight
      toolbar={
        <>
          <LoadProgress status={status} noun="channels" />
          <SearchBox value={search} onChange={setSearch} placeholder="Search by name or channel number…" />
          {genreOptions.length > 1 && <FilterChips options={genreOptions} value={genre} onChange={setGenre} />}
        </>
      }
    >
      <div ref={parentRef} onScroll={onScroll} className="h-full overflow-y-auto px-1 pt-1" style={{ scrollbarWidth: "thin" }}>
        {body}
      </div>
    </IptvPage>
  );
}

function ChannelTile({ channel }: { channel: Channel }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { tag, title } = splitTag(channel.name);

  return (
    <Link
      href={`/iptv/watch/${channel.id}`}
      title={channel.name}
      className="group block overflow-hidden rounded-xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center p-3" style={{ backgroundColor: "var(--surface-secondary)" }}>
        {channel.logo && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote logos on arbitrary hosts
          <img
            src={apiAsset(channel.logo)}
            alt=""
            loading="lazy"
            onError={() => setLogoFailed(true)}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-lg font-bold tracking-tight" style={{ color: "var(--text-muted)" }}>
            {title.slice(0, 3).toUpperCase()}
          </span>
        )}
        <div className="absolute right-1.5 top-1.5 flex gap-1">{isHd(channel.hd) && <Badge tone="red">HD</Badge>}</div>
      </div>
      <div className="p-2">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug group-hover:text-red-500">{title}</p>
        <p className="mt-0.5 truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
          {[channel.number && `CH ${channel.number}`, tag].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
