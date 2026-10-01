"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { ArrowRight, Clapperboard, Film, Radio, Trophy, Tv, type LucideIcon } from "lucide-react";
import { useCatalogueStatus, type CatalogueKind } from "@/hooks/use-catalogue";
import { formatCount } from "@/lib/iptv-format";

interface Section {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
  /** Catalogue whose live count is shown on the card */
  kind?: CatalogueKind;
  noun?: string;
  fallbackStat: string;
}

const SECTIONS: Section[] = [
  {
    title: "Live Channels",
    description: "Live TV from around the world, with sports, news and entertainment.",
    href: "/iptv/channels",
    icon: Tv,
    gradient: "from-blue-500 to-cyan-400",
    kind: "channels",
    noun: "channels",
    fallbackStat: "Live TV",
  },
  {
    title: "Live Games",
    description: "Today's matches from the programme guide, one tap to watch.",
    href: "/iptv/games",
    icon: Trophy,
    gradient: "from-green-500 to-emerald-400",
    fallbackStat: "Today's schedule",
  },
  {
    title: "Movies",
    description: "A large on-demand library, searchable by title, genre and rating.",
    href: "/iptv/vod",
    icon: Film,
    gradient: "from-purple-500 to-fuchsia-400",
    kind: "vod",
    noun: "movies",
    fallbackStat: "On demand",
  },
  {
    title: "TV Series",
    description: "Full series with every season and episode in one place.",
    href: "/iptv/series",
    icon: Clapperboard,
    gradient: "from-orange-500 to-amber-400",
    kind: "series",
    noun: "series",
    fallbackStat: "Full seasons",
  },
  {
    title: "Radio",
    description: "Live radio stations you can keep playing while you browse.",
    href: "/iptv/radio",
    icon: Radio,
    gradient: "from-rose-500 to-pink-400",
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

      <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />
          <div className="absolute -left-24 top-48 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        <div className="relative mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--brand-red)" }}>
            BraveStream TV
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">What do you want to watch?</h1>
          <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
            Pick a section to start watching or listening.
          </p>
        </div>

        <section className="relative grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const count = section.kind ? status?.[section.kind]?.count : undefined;
            const stat = count ? `${formatCount(count)} ${section.noun}` : section.fallbackStat;

            return (
              <Link
                key={section.title}
                href={section.href}
                className="group relative overflow-hidden rounded-3xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${section.gradient}`} />

                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${section.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
                    style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
                  >
                    {stat}
                  </span>
                </div>

                <h2 className="mt-6 text-xl font-bold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  {section.description}
                </p>

                <div className="mt-6 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--brand-red)" }}>
                  Open
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>

                <div
                  className={`pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${section.gradient} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25`}
                />
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
