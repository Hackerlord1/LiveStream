"use client";

import { Clapperboard } from "lucide-react";
import CatalogueBrowser from "@/components/iptv/CatalogueBrowser";

export default function SeriesPage() {
  return (
    <CatalogueBrowser
      kind="series"
      listKey="series"
      title="TV Series"
      icon={<Clapperboard className="h-5 w-5" />}
      noun="series"
      hrefFor={(series) => `/iptv/watch/series/${encodeURIComponent(series.id)}`}
    />
  );
}
