// src/app/about/page.tsx
'use client';

import React from 'react';
import Header from "@/components/Header";
import { FaUsers, FaGlobe, FaShieldAlt, FaHeart, FaTrophy, FaPlayCircle } from "react-icons/fa";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-8">
                {/* Hero Section */}
                <div className="neumorphic-card mb-8 text-center">
                    <div className="max-w-4xl mx-auto">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                            About BraveStream
                        </h1>
                        <p className="text-lg text-gray-700 mb-6">
                            The world's leading platform for live sports streaming. Bringing fans together from every corner of the globe.
                        </p>
                    </div>
                </div>

                {/* Mission & Vision */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="neumorphic-card">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-100 rounded-xl">
                                <FaPlayCircle className="text-red-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Our Mission</h3>
                                <p className="text-gray-700">
                                    To provide seamless, high-quality sports streaming to fans worldwide, breaking down geographical barriers and making every game accessible.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="neumorphic-card">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <FaGlobe className="text-blue-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Our Vision</h3>
                                <p className="text-gray-700">
                                    To become the global hub for sports entertainment, connecting millions of fans with their favorite teams and creating unforgettable viewing experiences.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Section */}


                {/* Values */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">Our Values</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            {
                                icon: <FaShieldAlt className="text-green-600 text-2xl" />,
                                title: "Reliability",
                                description: "99.9% uptime with consistent, high-quality streams"
                            },
                            {
                                icon: <FaUsers className="text-blue-600 text-2xl" />,
                                title: "Community",
                                description: "Bringing fans together through interactive features"
                            },
                            {
                                icon: <FaHeart className="text-red-600 text-2xl" />,
                                title: "Passion",
                                description: "Built by sports fans, for sports fans"
                            },
                            {
                                icon: <FaTrophy className="text-yellow-600 text-2xl" />,
                                title: "Excellence",
                                description: "Premium viewing experience in 1080p HD"
                            },
                            {
                                icon: <FaGlobe className="text-purple-600 text-2xl" />,
                                title: "Accessibility",
                                description: "Available on all devices, anywhere"
                            },
                            {
                                icon: <FaPlayCircle className="text-orange-600 text-2xl" />,
                                title: "Innovation",
                                description: "Constantly improving with new features"
                            }
                        ].map((value, index) => (
                            <div key={index} className="neumorphic-card">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                        {value.icon}
                                    </div>
                                    <h3 className="font-bold text-gray-900">{value.title}</h3>
                                </div>
                                <p className="text-gray-700 text-sm">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Team */}
                <div className="neumorphic-card">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">The Team Behind BraveStream</h2>
                    <p className="text-gray-700 mb-6 text-center max-w-3xl mx-auto">
                        We're a diverse team of sports enthusiasts, tech experts, and content specialists working together to deliver the best streaming experience.
                    </p>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {[
                            { name: "Tech Innovation", desc: "Cutting-edge streaming technology" },
                            { name: "Content Curation", desc: "Curating the best sports events" },
                            { name: "User Experience", desc: "Intuitive and seamless interface" },
                            { name: "Global Support", desc: "24/7 multilingual support" },
                            { name: "Partnerships", desc: "Working with leagues and teams" },
                            { name: "Community", desc: "Engaging with our global fanbase" }
                        ].map((team, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-gray-900 mb-2">{team.name}</h4>
                                <p className="text-gray-600 text-sm">{team.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Global Styles */}
            <style jsx global>{`
                .neumorphic-card {
                    background: #e0e0e0;
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 8px 8px 16px #bebebe,
                                -8px -8px 16px #ffffff;
                    transition: all 0.3s ease;
                }
                
                .neumorphic-card:hover {
                    box-shadow: 12px 12px 24px #bebebe,
                                -12px -12px 24px #ffffff;
                }
            `}</style>
        </div>
    );
}