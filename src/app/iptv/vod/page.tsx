"use client";

import { Film } from "lucide-react";
import CatalogueBrowser from "@/components/iptv/CatalogueBrowser";

export default function VodPage() {
  return (
    <CatalogueBrowser
      kind="vod"
      listKey="movies"
      title="Movies"
      icon={<Film className="h-5 w-5" />}
      noun="movies"
      hrefFor={(movie) => `/iptv/watch/movie/${encodeURIComponent(movie.id)}`}
    />
  );
}
