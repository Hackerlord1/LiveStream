"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tv } from "lucide-react";
import { apiAsset, fetchIptv } from "@/lib/iptv-client";
import { splitTag } from "@/lib/iptv-format";
import ChannelLogo from "@/components/iptv/ChannelLogo";

interface LeagueChannel {
  id: string;
  number?: string;
  name: string;
  language: string;
}

interface League {
  key: string;
  name: string;
  logo: string;
  channels: LeagueChannel[];
}

/** "COMO VS MANCHESTER UNITED 17:45 CET" → { match: "COMO VS MANCHESTER UNITED", time: "17:45 CET" } */
function splitKickoff(title: string): { match: string; time: string | null } {
  const found = title.match(/^(.*?)\s+(\d{1,2}:\d{2}(?:\s*[A-Z]{2,4})?)\s*$/);
  return found ? { match: found[1], time: found[2] } : { match: title, time: null };
}

const chipStyle = {
  backgroundColor: "var(--surface-primary)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-primary)",
};

/**
 * Chips for the big football competitions (logo, name, channels showing a match); picking
 * one lists its channels, filterable by commentary language.
 */
export default function LeagueChannels() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [language, setLanguage] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchIptv<{ leagues: League[] }>("/api/leagues")
      .then((data) => {
        if (!cancelled) setLeagues(data.leagues);
      })
      .catch(() => {
        // League channels are optional on the home page
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const league = leagues.find((l) => l.key === selected) ?? null;

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of league?.channels ?? []) counts.set(ch.language, (counts.get(ch.language) || 0) + 1);
    return [...counts];
  }, [league]);

  const shown = (league?.channels ?? []).filter((ch) => language === "all" || ch.language === language);

  if (leagues.length === 0) return null;

  function choose(key: string) {
    setSelected((current) => (current === key ? null : key));
    setLanguage("all");
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        {leagues.map((l) => {
          const active = l.key === selected;
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => choose(l.key)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-sm transition-all duration-300 ${active ? "bg-red-600 text-white shadow-md" : ""}`}
              style={active ? undefined : chipStyle}
            >
              <ChannelLogo
                src={apiAsset(l.logo)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-md"
                style={{ backgroundColor: "var(--surface-secondary)" }}
                imgClassName="max-h-full max-w-full object-contain p-0.5"
                fallback={<Tv className="h-3.5 w-3.5" />}
              />
              <span className="font-medium">{l.name}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: active ? "rgba(255,255,255,0.3)" : "var(--surface-secondary)" }}
              >
                {l.channels.length}
              </span>
            </button>
          );
        })}
      </div>

      {league && (
        <section
          className="mt-3 rounded-2xl p-4"
          style={{ backgroundColor: "var(--surface-primary)", border: "1px solid var(--border-primary)" }}
          aria-label={`${league.name} channels`}
        >
          <h2 className="mb-3 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {league.name} channels
          </h2>

          {league.channels.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No {league.name} matches on these channels right now. They appear here when a match is scheduled.
            </p>
          ) : (
            <>
              {languages.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {[["all", league.channels.length] as const, ...languages].map(([value, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLanguage(value)}
                      aria-pressed={language === value}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${language === value ? "bg-red-600 text-white" : ""}`}
                      style={language === value ? undefined : chipStyle}
                    >
                      {value === "all" ? "All languages" : value} · {count}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.map((ch) => {
                  const { match, time } = splitKickoff(splitTag(ch.name).title);
                  return (
                    <Link
                      key={ch.id}
                      // from=home: the player's back button returns to the home page
                      href={`/iptv/watch/${ch.id}?from=home`}
                      title={ch.name}
                      className="group flex flex-col gap-1 rounded-xl p-3 transition-all hover:shadow-lg"
                      style={{ backgroundColor: "var(--surface-secondary)", border: "1px solid var(--border-secondary)" }}
                    >
                      <span className="flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <span className="rounded-md bg-red-600/10 px-1.5 py-0.5 font-semibold text-red-600">{ch.language}</span>
                        <span>{[time, ch.number && `CH ${ch.number}`].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="line-clamp-2 text-sm font-semibold group-hover:text-red-500" style={{ color: "var(--text-primary)" }}>
                        {match}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
