"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const CACHE_KEY = "iptv-channels-cache-v3";

interface Channel {
  id: number;
  name: string;
  number: string;
  logo?: string;
}

export default function WorldCupChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Try VPS first
        const vpsRes = await fetch("http://129.106.133.57:3499/api/channels/range?start=1&end=140");
        const vpsData = await vpsRes.json();
        if (vpsData.channels && vpsData.channels.length > 0) {
          setChannels(vpsData.channels);
          setLoading(false);
          return;
        }
      } catch (e) {}

      // Fallback: get from sessionStorage cache
      try {
        const stored = sessionStorage.getItem(CACHE_KEY);
        if (stored) {
          const allChannels = JSON.parse(stored);
          if (Array.isArray(allChannels)) {
            const filtered = allChannels.filter((ch: any) => {
              const num = parseInt(ch.number);
              return num >= 1 && num <= 140;
            });
            setChannels(filtered);
          }
        }
      } catch (e) {
        console.error("Cache fallback error:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return null;
  if (channels.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🏆</span>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          World Cup Channels
        </h2>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          (Ch. 1-140)
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {channels.map((ch) => (
          <Link
            key={ch.id}
            href={`/iptv/watch/${ch.id}`}
            className="p-2 rounded-xl text-center hover:shadow-lg transition-all"
            style={{ backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-primary)' }}
          >
            {ch.logo ? (
              <img src={ch.logo} alt={ch.name} className="h-10 mx-auto mb-1 object-contain" loading="lazy" />
            ) : (
              <span className="text-xl block mb-1">📺</span>
            )}
            <p className="text-[10px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {ch.name}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Ch. {ch.number}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}