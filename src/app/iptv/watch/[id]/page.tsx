"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const HLS_BASE =
  process.env.NEXT_PUBLIC_HLS_BASE || "https://hls.bravestream.live";


const WRAPPER_URL = "https://neighborly-perch-272.convex.cloud/api/action";

async function callWrapper(path: string, args: Record<string, any> = {}) {
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

export default function IptvWatchPage() {
  const params = useParams();
  const channelId = Number(params.id);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const [channelName, setChannelName] = useState("");
  const [epgData, setEpgData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    async function loadInfo() {
      try {
        const epg = await callWrapper("iptv:getShortEpg", {
          channelId,
          size: 1,
        });

        setEpgData(epg);

        const programs = (epg as any)?.js?.data || [];
        if (programs.length > 0) {
          setChannelName(programs[0].name || "");
        }
      } catch (e) {
        console.error("Failed to load EPG:", e);
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isNaN(channelId)) {
      loadInfo();
    }
  }, [channelId]);

  useEffect(() => {
    if (loading || !videoRef.current || Number.isNaN(channelId)) return;

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

      // Wait for HLS playlist/segments to be generated
      await new Promise((resolve) => setTimeout(resolve, 4000));

      if (cancelled || !videoRef.current) return;

      setStatus("Connecting...");

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

          hls.on(Hls.Events.ERROR, (event, data) => {
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
  }, [loading, channelId]);

  const programs = (epgData as any)?.js?.data || [];

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0a0a0a", color: "#fff" }}
    >
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-4">
        <Link
          href="/iptv/channels"
          className="text-sm hover:underline mb-4 inline-block"
          style={{ color: "#aaa" }}
        >
          ← Back to Channels
        </Link>

        <h2 className="text-2xl font-bold mb-4">
          {channelName || `Channel ${channelId}`}
        </h2>

        {status && !error && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{ backgroundColor: "#1a1a2e", color: "#aaa" }}
          >
            {status}
          </div>
        )}

        {error && (
          <div
            className="mb-4 p-4 rounded-lg"
            style={{ backgroundColor: "#2d0000", color: "#ff8888" }}
          >
            {error}
          </div>
        )}

        <div className="rounded-xl overflow-hidden bg-black mb-6">
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            className="w-full aspect-video"
            style={{ maxHeight: "70vh" }}
          />
        </div>

        {programs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">📅 Now Playing</h3>

            {programs.map((program: any, i: number) => (
              <div
                key={i}
                className="p-4 rounded-lg mb-2"
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                }}
              >
                <p className="font-semibold">{program.name}</p>
                <p className="text-sm mt-1" style={{ color: "#aaa" }}>
                  {program.time} – {program.time_to}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
