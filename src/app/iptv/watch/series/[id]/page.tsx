"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Clapperboard, Play, SearchX } from "lucide-react";
import { fetchIptv } from "@/lib/iptv-client";
import { EmptyState, IptvPage, RetryButton } from "@/components/iptv/ui";
import { splitTag } from "@/lib/iptv-format";
import DetailHero, { DetailSkeleton, type DetailItem } from "@/components/iptv/DetailHero";
import VodPlayer from "@/components/iptv/VodPlayer";

/** The portal returns one entry per season, with its episode numbers in `series`. */
interface Season {
  id: string;
  name?: string;
  series?: number[];
}

export default function SeriesDetailPage() {
  const params = useParams();
  // Series ids look like "47441:47441"
  const seriesId = decodeURIComponent(String(params.id));

  const [series, setSeries] = useState<DetailItem | null>(null);
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openSeason, setOpenSeason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<{ season: Season; episode: number } | null>(null);

  function play(season: Season, episode: number) {
    setNowPlaying({ season, episode });
    setOpenSeason(season.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    let cancelled = false;
    const id = encodeURIComponent(seriesId);
    Promise.all([
      fetchIptv<{ series: DetailItem }>(`/api/series/${id}`),
      fetchIptv<{ episodes: Season[] }>(`/api/series/${id}/episodes`).catch(() => ({ episodes: [] as Season[] })),
    ])
      .then(([info, list]) => {
        if (cancelled) return;
        const sorted = [...list.episodes].sort((a, b) => seasonNumber(a) - seasonNumber(b));
        setSeries(info.series);
        setSeasons(sorted);
        setOpenSeason(sorted[0]?.id ?? null);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId, attempt]);

  if (failed) {
    return (
      <IptvPage title="TV Series" icon={<Clapperboard className="h-5 w-5" />} backHref="/iptv/series">
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Series not found"
          message="It may have been removed, or the catalogue is still loading."
          action={<RetryButton onClick={() => setAttempt((a) => a + 1)} />}
        />
      </IptvPage>
    );
  }

  return (
    <IptvPage title="TV Series" icon={<Clapperboard className="h-5 w-5" />} backHref="/iptv/series">
      {!series ? (
        <DetailSkeleton />
      ) : (
        <div className="space-y-6">
          {nowPlaying && (
            <div>
              <VodPlayer
                sourcePath={`/api/series/${encodeURIComponent(seriesId)}/source?${new URLSearchParams({ season: nowPlaying.season.id, episode: String(nowPlaying.episode) })}`}
                resumeId={`ep:${nowPlaying.season.id}:${nowPlaying.episode}`}
                title={`${splitTag(series.name).title} S${seasonNumber(nowPlaying.season)} E${nowPlaying.episode}`}
              />
              <p className="mt-3 text-sm font-semibold">
                {nowPlaying.season.name || `Season ${seasonNumber(nowPlaying.season)}`} · Episode {nowPlaying.episode}
              </p>
            </div>
          )}
          <DetailHero item={series}>
            {!nowPlaying && seasons?.[0]?.series?.length ? (
              <button
                type="button"
                onClick={() => play(seasons[0], seasons[0].series![0])}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: "var(--brand-red)" }}
              >
                <Play className="h-5 w-5 fill-current" /> Play S{seasonNumber(seasons[0])} E{seasons[0].series![0]}
              </button>
            ) : null}
          </DetailHero>

          {seasons && seasons.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                {seasons.length} {seasons.length === 1 ? "season" : "seasons"}
              </h2>
              <div className="space-y-2">
                {seasons.map((season) => {
                  const open = openSeason === season.id;
                  const episodes = season.series ?? [];
                  return (
                    <div
                      key={season.id}
                      className="overflow-hidden rounded-2xl"
                      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenSeason(open ? null : season.id)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <span className="font-semibold">{season.name || `Season ${seasonNumber(season)}`}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {episodes.length} {episodes.length === 1 ? "episode" : "episodes"} {open ? "▴" : "▾"}
                        </span>
                      </button>
                      {open && episodes.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4 lg:grid-cols-6">
                          {episodes.map((ep) => {
                            const current = nowPlaying?.season.id === season.id && nowPlaying.episode === ep;
                            return (
                              <button
                                key={ep}
                                type="button"
                                onClick={() => play(season, ep)}
                                aria-current={current || undefined}
                                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:opacity-80"
                                style={
                                  current
                                    ? { backgroundColor: "var(--brand-red)", color: "#fff" }
                                    : { backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)" }
                                }
                              >
                                <Play className="h-3.5 w-3.5 flex-shrink-0 fill-current" /> Episode {ep}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </IptvPage>
  );
}

function seasonNumber(season: Season): number {
  return Number(String(season.id).split(":")[1]) || Number(season.name?.match(/\d+/)?.[0]) || 0;
}
