// src/app/contact/page.tsx
'use client';

import { useState } from 'react';
import Header from "@/components/Header";
import {
    FaEnvelope,
    FaPhone,
    FaClock,
    FaPaperPlane,
    FaChevronDown,
    FaChevronUp,
} from "react-icons/fa";

const FAQS = [
    {
        q: "How do I report a broken stream?",
        a: "Use the 'Report Stream' button on the player page or contact support immediately.",
    },
    {
        q: "Is BraveStream available in my country?",
        a: "We're available worldwide. Some content may have regional restrictions based on broadcasting rights.",
    },
    {
        q: "How can I become a content partner?",
        a: "Email partnership@bravestream.live with details about your content.",
    },
    {
        q: "Do you offer mobile apps?",
        a: "Yes! Our platform is fully responsive and works on all devices.",
    },
] as const;

const SUBJECTS = [
    { value: "", label: "Select a topic" },
    { value: "technical", label: "Technical Support" },
    { value: "account", label: "Account Issues" },
    { value: "streaming", label: "Streaming Problems" },
    { value: "partnership", label: "Partnership Inquiry" },
    { value: "feedback", label: "Feedback & Suggestions" },
    { value: "other", label: "Other" },
] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-gray-200 last:border-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between py-4 text-left"
            >
                <span className="font-medium text-gray-900 text-sm pr-4">{q}</span>
                {open
                    ? <FaChevronUp className="w-3 h-3 text-gray-400 shrink-0" />
                    : <FaChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                }
            </button>
            {open && (
                <p className="pb-4 text-gray-500 text-sm leading-relaxed">{a}</p>
            )}
        </div>
    );
}

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    // ✅ NEW (replace with this)
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        if (!res.ok) throw new Error('Failed to send');

        setStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setStatus('idle'), 5000);
    } catch {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
    }
};

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const inputClass =
        "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-colors";

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            <main className="max-w-3xl mx-auto px-4 py-12">

                {/* Hero */}
                <section className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                        Contact Us
                    </h1>
                    <p className="text-gray-600 text-lg">
                        We&apos;re here to help. Reach out anytime.
                    </p>
                </section>

                {/* Quick Contact Info */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/40 border border-gray-200">
                        <FaEnvelope className="text-red-600 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium text-gray-900">support@bravestream.live</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/40 border border-gray-200">
                        <FaPhone className="text-red-600 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm font-medium text-gray-900">+254 791 220 335</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/40 border border-gray-200">
                        <FaClock className="text-red-600 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500">Response Time</p>
                            <p className="text-sm font-medium text-gray-900">~15 minutes</p>
                        </div>
                    </div>
                </section>

                {/* Contact Form */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-6 text-gray-900">
                        Send us a Message
                    </h2>

                    {status === 'success' && (
                        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                            Thank you! We&apos;ll get back to you soon.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className={inputClass}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className={inputClass}
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Subject
                            </label>
                            <select
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                required
                                className={inputClass}
                            >
                                {SUBJECTS.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Message
                            </label>
                            <textarea
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                required
                                rows={5}
                                className={`${inputClass} resize-none`}
                                placeholder="How can we help you?"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <FaPaperPlane className="w-3.5 h-3.5" />
                            Send Message
                        </button>
                    </form>
                </section>

                {/* Divider */}
                <hr className="border-gray-300 mb-12" />

                {/* FAQ */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-6 text-gray-900">
                        Frequently Asked Questions
                    </h2>
                    <div>
                        {FAQS.map((faq) => (
                            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
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