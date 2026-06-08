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
  js?: {
    data?: EpgProgram[];
  };
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
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {status}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-950/50 p-4 text-sm text-red-100 shadow-lg shadow-red-950/20">
      <div className="font-semibold">Playback issue</div>
      <div className="mt-1 text-red-200/90">{message}</div>
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
    return epgData?.js?.data || [];
  }, [epgData]);

  const currentProgram = programs[0];

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
        }

        const [channelResult, epgResult] = await Promise.allSettled([
          callWrapper("iptv:getChannelById", { channelId }),
          callWrapper("iptv:getShortEpg", {
            channelId,
            size: 8,
          }),
        ]);

        if (cancelled) return;

        if (channelResult.status === "fulfilled") {
          const remoteChannel = channelResult.value?.js?.data;

          if (remoteChannel) {
            setChannel(remoteChannel);
          } else if (!cachedChannel) {
            setChannel({
              id: channelId,
              name: `Channel ${channelId}`,
            });
          }
        } else if (!cachedChannel) {
          setChannel({
            id: channelId,
            name: `Channel ${channelId}`,
          });
        }

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

  const channelTitle = channel?.name || `Channel ${channelId}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#27272a_0,_#09090b_45%,_#020617_100%)] text-white">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/iptv/channels"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to Channels
          </Link>

          <StatusBadge status={!error ? status : ""} />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/75 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-white/10 via-white/[0.04] to-transparent px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
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
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-red-400">
                    Live TV
                  </p>

                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                    {loadingInfo ? "Loading channel..." : channelTitle}
                  </h1>

                  {currentProgram && (
                    <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                      Now playing:{" "}
                      <span className="text-zinc-200">
                        {currentProgram.name || currentProgram.title}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {channel?.number && (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-white/10">
                    Ch. {channel.number}
                  </span>
                )}

                {channel?.hd === 1 && (
                  <span className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
                    HD
                  </span>
                )}

                <span className="rounded-full bg-black/30 px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10">
                  ID: {channelId}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-3 sm:p-5">
              <ErrorBanner message={error} />

              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
                {status && !error && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/90 px-5 py-4 text-center shadow-xl">
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
                      <p className="text-sm font-medium text-zinc-200">
                        {status}
                      </p>
                    </div>
                  </div>
                )}

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

            <aside className="border-t border-white/10 bg-white/[0.03] p-5 lg:border-l lg:border-t-0">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Program Guide
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Current and upcoming shows
                  </p>
                </div>

                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/20">
                  EPG
                </span>
              </div>

              {programs.length > 0 ? (
                <div className="space-y-3">
                  {programs.map((program, i) => {
                    const title =
                      program.name || program.title || "Untitled program";
                    const isNow = i === 0;

                    return (
                      <div
                        key={program.id || `${title}-${i}`}
                        className={`rounded-2xl border p-4 transition ${
                          isNow
                            ? "border-red-500/30 bg-red-500/10"
                            : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="font-semibold text-zinc-100">
                            {title}
                          </p>

                          {isNow && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Live
                            </span>
                          )}
                        </div>

                        {(program.time || program.time_to) && (
                          <p className="text-sm text-zinc-400">
                            {program.time || "--:--"} –{" "}
                            {program.time_to || "--:--"}
                          </p>
                        )}

                        {program.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                            {program.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-zinc-400">
                  No program guide available for this channel.
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}