// src/app/dmca/page.tsx
'use client';

import React from 'react';
import Header from "@/components/Header";
import { FaCopyright, FaExclamationTriangle, FaEnvelope, FaFileAlt, FaBalanceScale } from "react-icons/fa";

export default function DMCAPage() {
    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-8">
                {/* Hero Section */}
                <div className="neumorphic-card mb-8">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-red-100 rounded-full">
                                <FaCopyright className="text-red-600 text-3xl" />
                            </div>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
                            Digital Millennium Copyright Act (DMCA) Policy
                        </h1>
                        <p className="text-lg text-gray-700">
                            StreamSports respects intellectual property rights and complies with the DMCA.
                        </p>
                    </div>
                </div>

                {/* Important Notice */}
                <div className="neumorphic-card mb-6 bg-yellow-50 border-l-4 border-yellow-500">
                    <div className="flex items-start gap-4">
                        <FaExclamationTriangle className="text-yellow-600 text-2xl mt-1 flex-shrink-0" />
                        <div>
                            <h3 className="text-xl font-bold mb-2 text-gray-900">Important Notice</h3>
                            <p className="text-gray-700">
                                StreamSports is a platform that aggregates and indexes sports streaming links from various sources. We do not host or store any video content on our servers.
                            </p>
                        </div>
                    </div>
                </div>

                {/* DMCA Takedown Procedure */}
                <div className="neumorphic-card mb-6">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 flex items-center gap-3">
                        <FaFileAlt className="text-red-600" />
                        DMCA Takedown Procedure
                    </h2>

                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-lg mb-2 text-gray-900">1. Infringement Notification</h3>
                            <p className="text-gray-700 mb-3">
                                To file a DMCA takedown notice, you must provide the following information in writing:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-gray-700">
                                <li>A physical or electronic signature of the copyright owner or authorized agent</li>
                                <li>Identification of the copyrighted work claimed to have been infringed</li>
                                <li>Identification of the material that is claimed to be infringing</li>
                                <li>Contact information of the complaining party</li>
                                <li>A statement that the complaining party has a good faith belief that use of the material is unauthorized</li>
                                <li>A statement that the information in the notification is accurate</li>
                            </ul>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-lg mb-2 text-gray-900">2. Counter-Notification</h3>
                            <p className="text-gray-700 mb-3">
                                If you believe your content was removed in error, you may submit a counter-notification containing:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-gray-700">
                                <li>Your physical or electronic signature</li>
                                <li>Identification of the material that has been removed</li>
                                <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake</li>
                                <li>Your name, address, and telephone number</li>
                                <li>A statement consenting to jurisdiction in your district</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Contact for DMCA */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="neumorphic-card">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <FaEnvelope className="text-blue-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">DMCA Contact</h3>
                                <p className="text-gray-700 mb-3">
                                    Send all DMCA notices and counter-notices to our designated agent:
                                </p>
                                <div className="bg-white p-4 rounded-lg border border-gray-300">
                                    <p className="font-semibold text-gray-900">DMCA Agent</p>
                                    <p className="text-gray-700">StreamSports Legal Department</p>
                                    <p className="text-gray-700">Email: dmca@streamsports.com</p>
                                    <p className="text-gray-700 text-sm mt-2">Response Time: 24-48 hours</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="neumorphic-card">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-100 rounded-xl">
                                <FaBalanceScale className="text-green-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Repeat Infringers</h3>
                                <p className="text-gray-700 mb-3">
                                    StreamSports maintains a policy for terminating repeat infringers in appropriate circumstances.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                        <span className="text-gray-700">Three-strike policy for repeat violations</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                        <span className="text-gray-700">Account suspension for serious violations</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                        <span className="text-gray-700">Permanent ban for persistent infringement</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="neumorphic-card">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900">Disclaimer</h2>
                    <div className="space-y-4 text-gray-700">
                        <p>
                            StreamSports acts as an intermediary service provider under the DMCA. We respond expeditiously to claims of copyright infringement.
                        </p>
                        <p>
                            The information provided on this page is for informational purposes only and does not constitute legal advice. For legal advice regarding DMCA compliance, please consult with an attorney.
                        </p>
                        <p>
                            We reserve the right to modify this DMCA policy at any time without prior notice.
                        </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-gray-300">
                        <p className="text-sm text-gray-600">
                            Last Updated: {new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                        </p>
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