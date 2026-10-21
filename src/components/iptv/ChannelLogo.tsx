"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type Tone = "light" | "dark" | null;

// Backgrounds for logos that would vanish on the theme's own tile colour
const TILE_FOR_LIGHT_LOGO = "#1e293b";
const TILE_FOR_DARK_LOGO = "#f1f5f9";

// Logos repeat across pages and lists: analyse each one once per page load
const toneCache = new Map<string, Tone>();

/**
 * "light" when a logo is nearly all white/pale on a transparent background (invisible on
 * a light tile), "dark" when nearly all black (invisible on a dark tile), otherwise null.
 * Logos with their own solid background, or in colour, are fine on any tile.
 */
function measureTone(img: HTMLImageElement): Tone {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  // Throws if the image isn't CORS-enabled; the caller treats that as "no change"
  const { data } = ctx.getImageData(0, 0, size, size);

  let opaque = 0;
  let light = 0;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    opaque++;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const grey = max - min < 40; // colourful pixels stay visible on any tile
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (grey && luminance > 0.8) light++;
    if (grey && luminance < 0.2) dark++;
  }
  const pixels = size * size;
  // A mostly opaque logo brings its own background
  if (opaque === 0 || opaque > pixels * 0.9) return null;
  if (light > opaque * 0.7) return "light";
  if (dark > opaque * 0.7) return "dark";
  return null;
}

/**
 * A channel logo inside its tile. The tile turns dark behind white logos and light behind
 * black ones, so they stay visible in both themes; otherwise it keeps `style`'s colours.
 */
export default function ChannelLogo({ src, className, style, imgClassName, loading, fallback, children }: {
  src: string;
  className?: string;
  style?: CSSProperties;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  fallback: ReactNode;
  /** Extra content on the tile, e.g. badges */
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [tone, setTone] = useState<Tone>(() => toneCache.get(src) ?? null);

  const background = tone === "light" ? TILE_FOR_LIGHT_LOGO : tone === "dark" ? TILE_FOR_DARK_LOGO : undefined;

  return (
    <span className={className} style={background ? { ...style, backgroundColor: background } : style}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from the stream server's logo proxy
        <img
          src={src}
          alt=""
          loading={loading}
          // Needed to read the pixels; the logo proxy allows any origin
          crossOrigin="anonymous"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            if (toneCache.has(src)) return;
            let measured: Tone = null;
            try {
              measured = measureTone(e.currentTarget);
            } catch {
              // pixels not readable: keep the default tile
            }
            toneCache.set(src, measured);
            setTone(measured);
          }}
          className={imgClassName}
        />
      ) : (
        fallback
      )}
      {children}
    </span>
  );
}
