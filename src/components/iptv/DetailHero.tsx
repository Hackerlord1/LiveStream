"use client";

import { useState, type ReactNode } from "react";
import { ImageOff, Star } from "lucide-react";
import { formatRating, formatYear, isHd, splitTag } from "@/lib/iptv-format";
import { Badge } from "./ui";

export interface DetailItem {
  name?: string;
  screenshot_uri?: string;
  year?: string;
  rating_kinopoisk?: string;
  rating_imdb?: string;
  genres_str?: string;
  description?: string;
  descr?: string;
  director?: string;
  actors?: string;
  age?: string;
  hd?: number | string;
}

/** Poster + backdrop + facts for a movie or series. */
export default function DetailHero({ item, children }: { item: DetailItem; children?: ReactNode }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const { tag, title } = splitTag(item.name);
  const year = formatYear(item.year);
  const rating = formatRating(item.rating_imdb) ?? formatRating(item.rating_kinopoisk);
  const genres = (item.genres_str || "").split(",").map((g) => g.trim()).filter(Boolean);
  const description = item.description || item.descr;
  const poster = item.screenshot_uri && !posterFailed ? item.screenshot_uri : null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl"
      style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-secondary)" }}
    >
      {poster && (
        <div
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-2xl"
          style={{ backgroundImage: `url("${poster}")` }}
        />
      )}
      <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:p-8">
        <div
          className="mx-auto w-44 flex-shrink-0 overflow-hidden rounded-2xl shadow-2xl sm:mx-0 sm:w-56"
          style={{ backgroundColor: "var(--surface-tertiary)" }}
        >
          <div className="aspect-[2/3]">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote posters on arbitrary hosts
              <img src={poster} alt="" className="h-full w-full object-cover" onError={() => setPosterFailed(true)} />
            ) : (
              <div className="flex h-full items-center justify-center" style={{ color: "var(--text-muted)" }}>
                <ImageOff className="h-10 w-10 opacity-40" />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {tag && <Badge>{tag}</Badge>}
            {isHd(item.hd) && <Badge tone="red">HD</Badge>}
            {item.age && <Badge>{item.age}</Badge>}
          </div>
          <h1 className="text-2xl font-bold leading-tight sm:text-4xl">{title || "Untitled"}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {rating && (
              <span className="flex items-center gap-1 font-semibold text-yellow-500">
                <Star className="h-4 w-4 fill-current" /> {rating}
              </span>
            )}
            {year && <span>{year}</span>}
          </div>

          {genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-secondary)" }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {description && (
            <p className="mt-5 max-w-3xl text-sm leading-relaxed sm:text-base" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>
          )}

          <dl className="mt-5 grid max-w-3xl gap-2 text-sm">
            {item.director && <Fact label="Director" value={item.director} />}
            {item.actors && <Fact label="Cast" value={item.actors} />}
          </dl>

          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 flex-shrink-0 font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="line-clamp-2" style={{ color: "var(--text-secondary)" }}>
        {value}
      </dd>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl p-5 sm:p-8" style={{ backgroundColor: "var(--surface-primary)" }} aria-hidden>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="mx-auto aspect-[2/3] w-44 rounded-2xl sm:mx-0 sm:w-56" style={{ backgroundColor: "var(--surface-tertiary)" }} />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-2/3 rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
          <div className="h-4 w-1/4 rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
          <div className="h-20 w-full rounded" style={{ backgroundColor: "var(--surface-tertiary)" }} />
        </div>
      </div>
    </div>
  );
}
