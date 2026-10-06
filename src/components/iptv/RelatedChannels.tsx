"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tv } from "lucide-react";
import { apiAsset, fetchIptv } from "@/lib/iptv-client";
import { isHd, splitTag } from "@/lib/iptv-format";
import { Badge } from "./ui";

interface RelatedChannel {
  id: string;
  number?: string | number;
  name?: string;
  logo?: string;
  hd?: string | number;
}

/** Sidebar of channels similar to the one being watched (same brand, genre, name words). */
export default function RelatedChannels({ channelId }: { channelId: number }) {
  const [channels, setChannels] = useState<RelatedChannel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIptv<{ related: RelatedChannel[] }>(`/api/channel/${channelId}/related`)
      .then((data) => {
        if (!cancelled) setChannels(data.related);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  if (channels && channels.length === 0) return null;

  return (
    <aside
      className="rounded-2xl p-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)", scrollbarWidth: "thin" }}
      aria-label="Related channels"
    >
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Related channels
      </h2>
      {!channels ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl" style={{ backgroundColor: "var(--surface-secondary)" }} />
          ))}
        </div>
      ) : (
        <ul className="space-y-1">
          {channels.map((ch) => (
            <li key={ch.id}>
              <RelatedItem channel={ch} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function RelatedItem({ channel }: { channel: RelatedChannel }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { tag, title } = splitTag(channel.name);
  return (
    <Link
      href={`/iptv/watch/${channel.id}`}
      className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      title={channel.name}
    >
      <span
        className="flex h-10 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ backgroundColor: "var(--surface-secondary)" }}
      >
        {channel.logo && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- logos come from the stream server's logo proxy
          <img src={apiAsset(channel.logo)} alt="" loading="lazy" onError={() => setLogoFailed(true)} className="max-h-full max-w-full object-contain p-1" />
        ) : (
          <Tv className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold group-hover:text-red-500">{title}</span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {channel.number && <span>CH {channel.number}</span>}
          {tag && <span>· {tag}</span>}
        </span>
      </span>
      {isHd(channel.hd) && <Badge tone="red">HD</Badge>}
    </Link>
  );
}
