"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import { useAllChannels } from "@/hooks/use-iptv";
import type { IptvChannel } from "@/lib/api/iptv-types";
import {
  FaPlay,
  FaPause,
  FaExpand,
  FaCompress,
  FaVolumeUp,
  FaVolumeMute,
  FaArrowLeft,
  FaTv,
  FaGlobe,
  FaStar,
  FaCalendar,
  FaClock,
} from "react-icons/fa";

const STREAM_BASE = "http://seatv.xyz/B2X4MX4S65WNTPY/bc65CNzbec";

export default function IptvPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { channels, loading } = useAllChannels();

  const [channel, setChannel] = useState<IptvChannel | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find channel by ID
  useEffect(() => {
    if (!loading && channels.length > 0 && id) {
      const found = channels.find((ch) => ch.id === id);
      if (found) {
        setChannel(found);
        setStreamUrl(`${STREAM_BASE}/${found.id}`);
      } else {
        setError("Channel not found.");
      }
    }
  }, [loading, channels, id]);

  // Play/Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Mute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Fullscreen
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#000" }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p style={{ color: "#aaa" }}>Loading channel...</p>
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error || !channel) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="text-center max-w-md px-4">
          <FaTv className="text-6xl mx-auto mb-4" style={{ color: "#666" }} />
          <h2 className="text-2xl font-bold mb-2 text-white">
            {error || "Channel Not Found"}
          </h2>
          <p className="mb-6" style={{ color: "#aaa" }}>
            The channel you&apos;re looking for is not available. It may have been removed or
            is temporarily offline.
          </p>
          <button
            onClick={() => router.push("/iptv")}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-medium transition-colors"
          >
            <FaArrowLeft className="inline mr-2" />
            Back to Channels
          </button>
        </div>
      </div>
    );
  }

  // ---- MAIN PLAYER ----
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.push("/iptv")}
          className="flex items-center gap-2 mb-4 text-sm hover:text-red-500 transition-colors"
          style={{ color: "#aaa" }}
        >
          <FaArrowLeft />
          Back to Channels
        </button>

        {/* Player Container */}
        <div
          ref={containerRef}
          className="relative w-full bg-black rounded-2xl overflow-hidden mb-6"
          style={{ aspectRatio: "16/9" }}
        >
          {/* Video */}
          <video
            ref={videoRef}
            src={streamUrl}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => setError("Failed to load stream. The channel may be offline.")}
          />

          {/* Video overlay for click-to-play/pause */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          />

          {/* Controls Bar */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3"
            style={{
              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
            }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
              >
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
            >
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </button>
          </div>

          {/* Play overlay when paused */}
          {!isPlaying && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(220,38,38,0.8)" }}
              >
                <FaPlay className="text-white text-2xl ml-1" />
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
              <div className="text-center px-4">
                <FaTv className="text-5xl mx-auto mb-3" style={{ color: "#666" }} />
                <p className="text-white font-medium mb-2">Stream Unavailable</p>
                <p className="text-sm mb-4" style={{ color: "#aaa" }}>
                  {error}
                </p>
                <button
                  onClick={() => {
                    setError(null);
                    videoRef.current?.load();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Channel Info */}
        <div
          className="p-6 rounded-2xl"
          style={{
            backgroundColor: "var(--surface-primary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <div className="flex items-start gap-4 flex-wrap">
            <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--surface-secondary)" }}
            >
              <Image
                src={channel.logo || channel.icon || "/channel-placeholder.svg"}
                alt={channel.name}
                fill
                className="object-contain p-1"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {channel.name}
                {channel.isHd && (
                  <span
                    className="ml-2 px-2 py-0.5 rounded text-xs align-middle"
                    style={{ backgroundColor: "var(--brand-red)", color: "#fff" }}
                  >
                    HD
                  </span>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1">
                  <FaGlobe className="w-3 h-3" />
                  {channel.region || "Unknown"}
                </span>
                <span className="flex items-center gap-1">
                  <FaStar className="w-3 h-3" />
                  {channel.genre || "General"}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: "var(--success-bg)",
                    color: "var(--success-text)",
                  }}
                >
                  {channel.quality || "SD"}
                </span>
                <span>Channel #{channel.number}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}