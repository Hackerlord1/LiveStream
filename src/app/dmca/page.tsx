// src/app/dmca/page.tsx
'use client';

import React from 'react';
import Header from "@/components/Header";
import { FaCopyright, FaExclamationTriangle, FaEnvelope, FaFileAlt, FaBalanceScale } from "react-icons/fa";

export default function DMCAPage() {
    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-secondary)' }}>
            <Header />

            <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-8">

                {/* Hero */}
                <div className="neumorphic-card mb-8">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 rounded-full" style={{ backgroundColor: 'var(--error-bg)' }}>
                                <FaCopyright className="text-red-600 text-3xl" />
                            </div>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                            Digital Millennium Copyright Act (DMCA) Policy
                        </h1>
                        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                            BraveStream respects intellectual property rights and complies with the DMCA.
                        </p>
                    </div>
                </div>

                {/* Important Notice */}
                <div
                    className="neumorphic-card mb-6 border-l-4 border-yellow-500"
                    style={{ background: `linear-gradient(to right, var(--warning-bg), var(--neu-bg))` }}
                >
                    <div className="flex items-start gap-4">
                        <FaExclamationTriangle className="text-yellow-600 text-2xl mt-1 flex-shrink-0" />
                        <div>
                            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Important Notice</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                BraveStream is a platform that aggregates and indexes sports streaming links from various sources. We do not host or store any video content on our servers.
                            </p>
                        </div>
                    </div>
                </div>

                {/* DMCA Takedown Procedure */}
                <div className="neumorphic-card mb-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        <FaFileAlt className="text-red-600" />
                        DMCA Takedown Procedure
                    </h2>

                    <div className="space-y-4">
                        {[
                            {
                                title: '1. Infringement Notification',
                                description: 'To file a DMCA takedown notice, you must provide the following information in writing:',
                                items: [
                                    'A physical or electronic signature of the copyright owner or authorized agent',
                                    'Identification of the copyrighted work claimed to have been infringed',
                                    'Identification of the material that is claimed to be infringing',
                                    'Contact information of the complaining party',
                                    'A statement that the complaining party has a good faith belief that use of the material is unauthorized',
                                    'A statement that the information in the notification is accurate',
                                ],
                            },
                            {
                                title: '2. Counter-Notification',
                                description: 'If you believe your content was removed in error, you may submit a counter-notification containing:',
                                items: [
                                    'Your physical or electronic signature',
                                    'Identification of the material that has been removed',
                                    'A statement under penalty of perjury that you have a good faith belief the material was removed by mistake',
                                    'Your name, address, and telephone number',
                                    'A statement consenting to jurisdiction in your district',
                                ],
                            },
                        ].map((section) => (
                            <div key={section.title} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>{section.title}</h3>
                                <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>{section.description}</p>
                                <ul className="list-disc pl-5 space-y-2" style={{ color: 'var(--text-secondary)' }}>
                                    {section.items.map((item, i) => (<li key={i}>{item}</li>))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact & Repeat Infringers */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="neumorphic-card">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--info-bg)' }}>
                                <FaEnvelope className="text-blue-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>DMCA Contact</h3>
                                <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
                                    Send all DMCA notices and counter-notices to our designated agent:
                                </p>
                                <div
                                    className="p-4 rounded-lg"
                                    style={{
                                        backgroundColor: 'var(--surface-primary)',
                                        border: '1px solid var(--border-primary)',
                                    }}
                                >
                                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>DMCA Agent</p>
                                    <p style={{ color: 'var(--text-secondary)' }}>BraveStream Legal Department</p>
                                    <p style={{ color: 'var(--text-secondary)' }}>Email: dmca@bravestream.live</p>
                                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Response Time: 24-48 hours</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="neumorphic-card">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--success-bg)' }}>
                                <FaBalanceScale className="text-green-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Repeat Infringers</h3>
                                <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
                                    BraveStream maintains a policy for terminating repeat infringers in appropriate circumstances.
                                </p>
                                <div className="space-y-3">
                                    {[
                                        'Three-strike policy for repeat violations',
                                        'Account suspension for serious violations',
                                        'Permanent ban for persistent infringement',
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                            <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="neumorphic-card">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Disclaimer</h2>
                    <div className="space-y-4" style={{ color: 'var(--text-secondary)' }}>
                        <p>BraveStream acts as an intermediary service provider under the DMCA. We respond expeditiously to claims of copyright infringement.</p>
                        <p>The information provided on this page is for informational purposes only and does not constitute legal advice.</p>
                        <p>We reserve the right to modify this DMCA policy at any time without prior notice.</p>
                    </div>
                    <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}