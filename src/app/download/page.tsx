// src/app/download/page.tsx
'use client';

import { useEffect, useState } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import { fetchIptv, IPTV_API_URL } from "@/lib/iptv-client";
import { FaAndroid, FaDownload, FaFutbol, FaTv, FaFilm, FaBroadcastTower } from "react-icons/fa";

type AppRelease = { versionName: string; size: number; notes?: string };

const APK_URL = `${IPTV_API_URL}/download/bravestream.apk`;

const FEATURES = [
    { icon: FaFutbol, title: "Live football", description: "Today's matches, one tap to watch" },
    { icon: FaTv, title: "Live TV", description: "Thousands of channels from around the world" },
    { icon: FaFilm, title: "Movies & series", description: "A large on-demand library" },
    { icon: FaBroadcastTower, title: "Radio", description: "Keeps playing while you browse" },
] as const;

const STEPS = [
    "Tap Download on your Android phone or TV box.",
    "Open the downloaded file (from the notification or your Downloads folder).",
    "If Android asks, allow your browser to install apps, then tap Install.",
    "Open BraveStream. The app tells you when a new version is ready.",
];

export default function DownloadPage() {
    const [release, setRelease] = useState<AppRelease | null>(null);

    useEffect(() => {
        fetchIptv<AppRelease>("/api/app/version").then(setRelease).catch(() => setRelease(null));
    }, []);

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-secondary)' }}>
            <Header />

            <main className="max-w-3xl mx-auto px-4 py-12">

                {/* Hero */}
                <section className="text-center mb-14">
                    <Image src="/app-icon.png" alt="BraveStream app icon" width={96} height={96} className="mx-auto mb-5 rounded-[22px]" />
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">
                        Get the BraveStream app
                    </h1>
                    <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
                        Football, live TV, movies and radio in one app for Android.
                    </p>
                    <a
                        href={APK_URL}
                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 font-semibold transition-colors"
                        // Inline so the site's global link colour can't override it
                        style={{ color: '#fff' }}
                    >
                        <FaDownload />
                        Download for Android
                    </a>
                    <p className="mt-3 text-sm flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        <FaAndroid className="text-green-600" />
                        {release
                            ? `Version ${release.versionName} · ${(release.size / 1024 / 1024).toFixed(0)} MB`
                            : "For Android phones and TV boxes"}
                    </p>
                </section>

                {/* Features */}
                <section className="grid sm:grid-cols-2 gap-6 mb-14">
                    {FEATURES.map((f) => (
                        <div key={f.title} className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl shrink-0 text-red-600" style={{ backgroundColor: 'var(--error-bg)' }}>
                                <f.icon className="text-lg" />
                            </div>
                            <div>
                                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{f.description}</p>
                            </div>
                        </div>
                    ))}
                </section>

                <hr style={{ borderColor: 'var(--border-primary)' }} className="mb-14" />

                {/* Install steps */}
                <section>
                    <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>How to install</h2>
                    <ol className="space-y-4">
                        {STEPS.map((step, i) => (
                            <li key={step} className="flex items-start gap-4">
                                <span className="w-8 h-8 shrink-0 rounded-full bg-red-600 text-white font-bold flex items-center justify-center">{i + 1}</span>
                                <span className="pt-1">{step}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                        The app is installed from this website rather than Google Play, which is why Android asks for permission the first time.
                    </p>
                </section>
            </main>
        </div>
    );
}
