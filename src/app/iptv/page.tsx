"use client";

import Link from "next/link";
import Header from "@/components/Header";
import {
  Tv,
  Trophy,
  Film,
  Clapperboard,
  Radio,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const portalItems = [
  {
    title: "Live Channels",
    description: "Browse 28,386 live channels with EPG support.",
    href: "/iptv/channels",
    icon: Tv,
    gradient: "from-blue-500 to-cyan-400",
    stat: "28,386 Channels",
  },
  {
    title: "Live Games",
    description: "Follow 4,600+ live sports matches from around the world.",
    href: "/iptv/games",
    icon: Trophy,
    gradient: "from-green-500 to-emerald-400",
    stat: "4,600+ Matches",
  },
  {
    title: "Movies VOD",
    description: "Explore a large video-on-demand movie library.",
    href: "/iptv/vod",
    icon: Film,
    gradient: "from-purple-500 to-fuchsia-400",
    stat: "On Demand",
  },
  {
    title: "TV Series",
    description: "Watch full TV series collections in one place.",
    href: "/iptv/series",
    icon: Clapperboard,
    gradient: "from-orange-500 to-amber-400",
    stat: "Full Seasons",
  },
  {
    title: "Radio",
    description: "Listen to live radio stations anytime.",
    href: "/iptv/radio",
    icon: Radio,
    gradient: "from-rose-500 to-pink-400",
    stat: "Live Radio",
  },
];

const stats = [
  {
    label: "Live Channels",
    value: "28,386",
  },
  {
    label: "With EPG",
    value: "5,761",
  },
  {
    label: "Sports Matches",
    value: "4,600+",
  },
];

export default function IptvPage() {
  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--neu-bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <Header />

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        {/* Background decorations */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute top-48 -left-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
      
        {/* Section Header */}
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Explore IPTV Categories
            </h2>
            <p
              className="mt-2 text-sm sm:text-base"
              style={{ color: "var(--text-muted)" }}
            >
              Choose a section below to start watching or listening.
            </p>
          </div>
        </div>

        {/* Cards Grid */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {portalItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-2xl"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.gradient}`}
                />

                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold">
                    {item.stat}
                  </span>
                </div>

                <div className="mt-7">
                  <h3 className="text-2xl font-bold">{item.title}</h3>
                  <p
                    className="mt-3 leading-6"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.description}
                  </p>
                </div>

                <div className="mt-7 flex items-center gap-2 font-semibold text-blue-400">
                  Open section
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>

                <div
                  className={`pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${item.gradient} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20`}
                />
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}