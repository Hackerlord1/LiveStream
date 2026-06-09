"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE =
  process.env.NEXT_PUBLIC_HLS_BASE || "https://hls.bravestream.live";

const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";
const CHANNELS_CACHE_KEY = "iptv-channels-cache-v2";

type Channel = {
  id: number;
  name: string;
  number?: number | string;
  logo?: string;
  hd?: number;
  censored?: number;
};

type EpgProgram = {
  id?: string | number;
  name?: string;
  title?: string;
  time?: string;
  time_to?: string;
  description?: string;
};

type EpgResponse = {
  js?: EpgProgram[] | { data?: EpgProgram[] };
};

async function callWrapper(path: string, args: Record<string, unknown> = {}) {
  const res = await fetch(WRAPPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });

  if (!res.ok) {
    throw new Error(`Wrapper request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.value;
}

function getCachedChannel(channelId: number): Channel | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(CHANNELS_CACHE_KEY);
    if (!stored) return null;

    const channels = JSON.parse(stored);
    if (!Array.isArray(channels)) return null;

    return (
      channels.find((channel: Channel) => Number(channel.id) === channelId) ||
      null
    );
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: "var(--success-bg)",
        color: "var(--success-text)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <span
        className="h-2 w-2 animate-pulse rounded-full"
        style={{ backgroundColor: "var(--brand-green)" }}
      />
      {status}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      className="mb-5 rounded-2xl p-4 text-sm"
      style={{
        backgroundColor: "var(--error-bg)",
        color: "var(--error-text)",
        border: "1px solid var(--brand-red)",
      }}
    >
      <div className="font-semibold">Playback issue</div>
      <div className="mt-1">{message}</div>
    </div>
  );
}

function LoadingOverlay({ status }: { status: string }) {
  if (!status) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-black/80 px-5 py-4 text-center shadow-xl">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
        <p className="text-sm font-medium text-white">{status}</p>
      </div>
    </div>
  );
}

export default function IptvWatchPage() {
  const params = useParams();
  const channelId = Number(params.id);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [epgData, setEpgData] = useState<EpgResponse | null>(null);
  const [error, setError] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [status, setStatus] = useState("Loading channel...");

  const programs = useMemo(() => {
  if (!epgData) return [];
  // The response has programs directly in js array
  const data = epgData.js;
  return Array.isArray(data) ? data : data?.data || [];
}, [epgData]);

  const currentProgram = programs[0];
  const channelTitle = channel?.name || `Channel ${channelId}`;

  useEffect(() => {
    let cancelled = false;

    async function loadChannelInfo() {
  if (Number.isNaN(channelId)) {
    setError("Invalid channel selected.");
    setLoadingInfo(false);
    return;
  }

  try {
    setLoadingInfo(true);
    setStatus("Loading channel...");
    setError("");

    const cachedChannel = getCachedChannel(channelId);

    if (cachedChannel) {
      setChannel(cachedChannel);
    } else {
      setChannel({
        id: channelId,
        name: `Channel ${channelId}`,
      });
    }

    const [epgResult] = await Promise.allSettled([
      callWrapper("iptv:getShortEpg", { channelId, size: 8 }),
    ]);

    if (cancelled) return;

    if (epgResult.status === "fulfilled") {
      setEpgData(epgResult.value as EpgResponse);
    }
  } catch (e) {
    console.error("Failed to load channel information:", e);

    if (!cancelled) {
      setChannel({
        id: channelId,
        name: `Channel ${channelId}`,
      });
    }
  } finally {
    if (!cancelled) {
      setLoadingInfo(false);
      setStatus("");
    }
  }
}

    loadChannelInfo();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  useEffect(() => {
    if (loadingInfo || !videoRef.current || Number.isNaN(channelId)) return;

    const video = videoRef.current;
    let cancelled = false;

    async function play() {
      try {
        setError("");
        setStatus("Starting stream...");

        const startRes = await fetch(`${HLS_BASE}/streams/${channelId}/start`, {
          method: "POST",
        });

        if (!startRes.ok) {
          throw new Error(`Failed to start stream: ${startRes.status}`);
        }
      } catch (e) {
        console.error("Failed to start stream:", e);
        setError("Could not start the stream. Please check the HLS server.");
        setStatus("");
        return;
      }

      if (cancelled) return;

      await new Promise((resolve) => setTimeout(resolve, 4000));

      if (cancelled || !videoRef.current) return;

      setStatus("Connecting to live stream...");

      const hlsUrl = `${HLS_BASE}/hls/${channelId}.m3u8`;

      try {
        const Hls = (await import("hls.js")).default;

        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
          });

          hls.loadSource(hlsUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setStatus("");
            setError("");

            video.play().catch((err) => {
              console.warn("Autoplay blocked or failed:", err);
            });
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.log("HLS error:", data);

            if (data.fatal) {
              setError("Stream interrupted. Trying to recover...");

              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              } else {
                hls.destroy();

                setTimeout(() => {
                  if (!cancelled && videoRef.current) {
                    setError("");
                    window.location.reload();
                  }
                }, 3000);
              }
            }
          });

          hlsRef.current = hls;
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hlsUrl;
          setStatus("");

          video.play().catch((err) => {
            console.warn("Autoplay blocked or failed:", err);
          });
        } else {
          setStatus("");
          setError("Browser does not support HLS playback.");
        }
      } catch (e) {
        console.error("Failed to initialize HLS:", e);
        setStatus("");
        setError("Failed to initialize video player.");
      }
    }

    play();

    return () => {
      cancelled = true;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [loadingInfo, channelId]);

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--neu-bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <Header />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/iptv/channels"
            className="inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--neu-bg)",
              color: "var(--text-secondary)",
              boxShadow:
                "4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)",
            }}
          >
            <span aria-hidden="true">←</span>
            Back to Channels
          </Link>

          <StatusBadge status={error ? "" : status} />
        </div>

        <section
          className="overflow-hidden rounded-[28px]"
          style={{
            backgroundColor: "var(--neu-bg)",
            color: "var(--text-secondary)",
            boxShadow:
              "8px 8px 18px var(--neu-shadow-dark), -8px -8px 18px var(--neu-shadow-light)",
          }}
        >
          <div
            className="px-5 py-5 sm:px-7"
            style={{
              backgroundColor: "var(--surface-primary)",
              borderBottom: "1px solid var(--border-primary)",
            }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
                  style={{
                    backgroundColor: "var(--surface-secondary)",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  {channel?.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name || "Channel logo"}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-3xl">📺</span>
                  )}
                </div>

                <div>
                  <p
                    className="mb-1 text-xs font-semibold uppercase tracking-[0.25em]"
                    style={{ color: "var(--brand-red)" }}
                  >
                    Live TV
                  </p>

                  <h1
                    className="text-2xl font-bold tracking-tight sm:text-4xl"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {loadingInfo ? "Loading channel..." : channelTitle}
                  </h1>

                  {currentProgram && (
                    <p
                      className="mt-2 max-w-2xl text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Now playing:{" "}
                      <span style={{ color: "var(--text-primary)" }}>
                        {currentProgram.name || currentProgram.title}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {channel?.number && (
                  <span
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--surface-secondary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-primary)",
                    }}
                  >
                    Ch. {channel.number}
                  </span>
                )}

                {channel?.hd === 1 && (
                  <span className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
                    HD
                  </span>
                )}

                <span
                  className="rounded-full px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--surface-secondary)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  ID: {channelId}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-3 sm:p-5">
              <ErrorBanner message={error} />

              <div
                className="relative overflow-hidden rounded-3xl bg-black"
                style={{
                  border: "1px solid var(--border-primary)",
                  boxShadow: "0 15px 35px var(--shadow-color-heavy)",
                }}
              >
                {status && !error && <LoadingOverlay status={status} />}

                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full bg-black"
                  style={{ maxHeight: "72vh" }}
                />
              </div>
            </div>

            <aside
  className="p-4 lg:border-l"
  style={{
    backgroundColor: "var(--surface-secondary)",
    borderColor: "var(--border-primary)",
  }}
>
  <div className="mb-3 flex items-center justify-between">
    <div>
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Program Guide
      </h2>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Current and upcoming
      </p>
    </div>
    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--brand-red)" }}>
      EPG
    </span>
  </div>

  {programs.length > 0 ? (
    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
      {programs.map((program, i) => {
        const title = program.name || program.title || "Untitled";
        const isNow = i === 0;

        return (
          <div
            key={program.id || `${title}-${i}`}
            className="rounded-xl border p-2.5 transition hover:scale-[1.01]"
            style={{
              backgroundColor: isNow ? "var(--error-bg)" : "var(--surface-primary)",
              borderColor: isNow ? "var(--brand-red)" : "var(--border-primary)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold line-clamp-2" style={{ color: "var(--text-primary)" }}>
                {title}
              </p>
              {isNow && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white flex-shrink-0">
                  On Air
                </span>
              )}
            </div>

            {(program.time || program.time_to) && (
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {program.time || "--:--"} – {program.time_to || "--:--"}
              </p>
            )}

            {program.description && (
              <p className="mt-1 line-clamp-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {program.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed p-4 text-center text-xs"
      style={{ backgroundColor: "var(--surface-primary)", borderColor: "var(--border-primary)", color: "var(--text-muted)" }}>
      No program guide available.
    </div>
  )}
</aside>
          </div>
        </section>
      </main>
    </div>
  );
}