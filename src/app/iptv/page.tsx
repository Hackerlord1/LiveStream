"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { ChevronRight, Clapperboard, Film, Radio, Trophy, Tv, type LucideIcon } from "lucide-react";
import { useCatalogueStatus, type CatalogueKind } from "@/hooks/use-catalogue";
import { formatCount } from "@/lib/iptv-format";

interface Section {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Catalogue whose live count is shown on the card */
  kind?: CatalogueKind;
  noun?: string;
  fallbackStat: string;
}

const SECTIONS: Section[] = [
  {
    title: "Live Channels",
    description: "Sports, news and entertainment from around the world.",
    href: "/iptv/channels",
    icon: Tv,
    kind: "channels",
    noun: "channels",
    fallbackStat: "Live TV",
  },
  {
    title: "Live Games",
    description: "Today's matches from the TV guide.",
    href: "/iptv/games",
    icon: Trophy,
    fallbackStat: "Today's schedule",
  },
  {
    title: "Movies",
    description: "Search by title, genre or rating.",
    href: "/iptv/vod",
    icon: Film,
    kind: "vod",
    noun: "movies",
    fallbackStat: "On demand",
  },
  {
    title: "TV Series",
    description: "Every season and episode.",
    href: "/iptv/series",
    icon: Clapperboard,
    kind: "series",
    noun: "series",
    fallbackStat: "Full seasons",
  },
  {
    title: "Radio",
    description: "Keeps playing while you browse.",
    href: "/iptv/radio",
    icon: Radio,
    kind: "radio",
    noun: "stations",
    fallbackStat: "Live radio",
  },
];

export default function IptvPage() {
  const status = useCatalogueStatus(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--neu-bg-page)", color: "var(--text-primary)" }}>
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">BraveStream TV</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Live channels, today&apos;s games, movies, series and radio.
        </p>

        <section className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const count = section.kind ? status?.[section.kind]?.count : undefined;
            const stat = count ? `${formatCount(count)} ${section.noun}` : section.fallbackStat;

            return (
              <Link
                key={section.title}
                href={section.href}
                className="group flex items-center gap-3 rounded-xl p-3 transition-colors sm:p-4"
                style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{section.title}</span>
                  <span className="block truncate text-sm" style={{ color: "var(--text-muted)" }}>
                    {section.description}
                  </span>
                </span>
                <span className="hidden flex-shrink-0 text-xs tabular-nums min-[400px]:block" style={{ color: "var(--text-muted)" }}>
                  {stat}
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
