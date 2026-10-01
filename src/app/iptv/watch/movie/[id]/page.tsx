"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Film, Play, SearchX } from "lucide-react";
import { fetchIptv } from "@/lib/iptv-client";
import { splitTag } from "@/lib/iptv-format";
import { EmptyState, IptvPage, RetryButton } from "@/components/iptv/ui";
import DetailHero, { DetailSkeleton, type DetailItem } from "@/components/iptv/DetailHero";
import VodPlayer from "@/components/iptv/VodPlayer";

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = String(params.id);

  const [movie, setMovie] = useState<DetailItem | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIptv<{ movie: DetailItem }>(`/api/vod/${encodeURIComponent(movieId)}`)
      .then((data) => {
        if (cancelled) return;
        setMovie(data.movie);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId, attempt]);

  return (
    <IptvPage title="Movie" icon={<Film className="h-5 w-5" />} backHref="/iptv/vod">
      {movie ? (
        <div className="space-y-6">
          {playing && (
            <VodPlayer
              sourcePath={`/api/vod/${encodeURIComponent(movieId)}/source`}
              resumeId={`vod:${movieId}`}
              title={splitTag(movie.name).title}
            />
          )}
          <DetailHero item={movie}>
            {!playing && (
              <button
                type="button"
                onClick={() => {
                  setPlaying(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: "var(--brand-red)" }}
              >
                <Play className="h-5 w-5 fill-current" /> Play movie
              </button>
            )}
          </DetailHero>
        </div>
      ) : failed ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Movie not found"
          message="It may have been removed, or the catalogue is still loading."
          action={<RetryButton onClick={() => setAttempt((a) => a + 1)} />}
        />
      ) : (
        <DetailSkeleton />
      )}
    </IptvPage>
  );
}
