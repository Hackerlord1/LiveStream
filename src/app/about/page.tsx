// src/app/about/page.tsx
'use client';

import Header from "@/components/Header";
import {
    FaShieldAlt,
    FaUsers,
    FaHeart,
    FaTrophy,
    FaGlobe,
    FaPlayCircle,
} from "react-icons/fa";

const VALUES = [
    { icon: FaShieldAlt, color: "text-green-600 bg-green-50", title: "Reliable", description: "99.9% uptime, always on" },
    { icon: FaUsers, color: "text-blue-600 bg-blue-50", title: "Community", description: "Live chat with fellow fans" },
    { icon: FaHeart, color: "text-red-600 bg-red-50", title: "Passionate", description: "Built by fans, for fans" },
    { icon: FaTrophy, color: "text-yellow-600 bg-yellow-50", title: "HD Quality", description: "Crystal clear 1080p streams" },
    { icon: FaGlobe, color: "text-purple-600 bg-purple-50", title: "Global", description: "Watch from anywhere, any device" },
    { icon: FaPlayCircle, color: "text-orange-600 bg-orange-50", title: "Innovative", description: "New features every month" },
] as const;

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            <main className="max-w-3xl mx-auto px-4 py-12">

                {/* Hero */}
                <section className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                        About BraveStream
                    </h1>
                    <p className="text-gray-600 text-lg">
                        Free live sports streaming for fans worldwide.
                    </p>
                </section>

                {/* Mission & Vision */}
                <section className="grid md:grid-cols-2 gap-8 mb-16">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-red-50 rounded-xl">
                                <FaPlayCircle className="text-red-600 text-xl" />
                            </div>
                            <h2 className="text-xl font-bold">Mission</h2>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                            Make every game accessible to every fan, everywhere — no barriers, no blackouts.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-blue-50 rounded-xl">
                                <FaGlobe className="text-blue-600 text-xl" />
                            </div>
                            <h2 className="text-xl font-bold">Vision</h2>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                            Be the go-to destination for live sports — connecting millions of fans with the games they love.
                        </p>
                    </div>
                </section>

                <hr className="border-gray-300 mb-16" />

                {/* Values */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-8 text-center">What We Stand For</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {VALUES.map((v) => (
                            <div key={v.title} className="flex items-start gap-3">
                                <div className={`p-2.5 rounded-xl shrink-0 ${v.color}`}>
                                    <v.icon className="text-lg" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{v.title}</h3>
                                    <p className="text-gray-500 text-sm">{v.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer */}
                <section className="text-center">
                    <p className="text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} BraveStream. All rights reserved.
                    </p>
                </section>
            </main>
        </div>
    );
}