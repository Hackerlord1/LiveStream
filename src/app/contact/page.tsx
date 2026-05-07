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
    { q: "How do I report a broken stream?", a: "Use the 'Report Stream' button on the player page or contact support immediately." },
    { q: "Is BraveStream available in my country?", a: "We're available worldwide. Some content may have regional restrictions based on broadcasting rights." },
    { q: "How can I become a content partner?", a: "Email partnership@inbound.bravestream.live with details about your content." },
    { q: "Do you offer mobile apps?", a: "Yes! Our platform is fully responsive and works on all devices." },
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
        <div style={{ borderBottom: '1px solid var(--border-secondary)' }} className="last:border-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between py-4 text-left"
            >
                <span className="font-medium text-sm pr-4" style={{ color: 'var(--text-primary)' }}>{q}</span>
                {open
                    ? <FaChevronUp className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    : <FaChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                }
            </button>
            {open && (
                <p className="pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{a}</p>
            )}
        </div>
    );
}

export default function ContactPage() {
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const inputStyle: React.CSSProperties = {
        backgroundColor: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        color: 'var(--input-text)',
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-secondary)' }}>
            <Header />

            <main className="max-w-3xl mx-auto px-4 py-12">

                {/* Hero */}
                <section className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                        Contact Us
                    </h1>
                    <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
                        We&apos;re here to help. Reach out anytime.
                    </p>
                </section>

                {/* Quick Contact Info */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
                    {[
                        { icon: <FaEnvelope className="text-red-600 shrink-0" />, label: 'Email', value: 'support@inbound.bravestream.live' },
                        { icon: <FaPhone className="text-red-600 shrink-0" />, label: 'Phone', value: '+254 791 220 335' },
                        { icon: <FaClock className="text-red-600 shrink-0" />, label: 'Response Time', value: '~15 minutes' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="flex items-center gap-3 p-4 rounded-xl"
                            style={{
                                backgroundColor: 'var(--surface-primary)',
                                border: '1px solid var(--border-primary)',
                                opacity: 0.9,
                            }}
                        >
                            {item.icon}
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                            </div>
                        </div>
                    ))}
                </section>

                {/* Contact Form */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                        Send us a Message
                    </h2>

                    {status === 'success' && (
                        <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-text)', color: 'var(--success-text)' }}>
                            Thank you! We&apos;ll get back to you soon.
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-text)', color: 'var(--error-text)' }}>
                            Something went wrong. Please try again.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} required
                                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors"
                                    style={inputStyle} placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required
                                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors"
                                    style={inputStyle} placeholder="john@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject</label>
                            <select name="subject" value={formData.subject} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors"
                                style={inputStyle}
                            >
                                {SUBJECTS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Message</label>
                            <textarea name="message" value={formData.message} onChange={handleChange} required rows={5}
                                className="w-full px-4 py-2.5 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors"
                                style={inputStyle} placeholder="How can we help you?"
                            />
                        </div>

                        <button type="submit"
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <FaPaperPlane className="w-3.5 h-3.5" />
                            {status === 'sending' ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>
                </section>

                <hr style={{ borderColor: 'var(--border-primary)' }} className="mb-12" />

                {/* FAQ */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                        Frequently Asked Questions
                    </h2>
                    <div>
                        {FAQS.map((faq) => (<FaqItem key={faq.q} q={faq.q} a={faq.a} />))}
                    </div>
                </section>

                {/* Footer */}
                <section className="text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        &copy; {new Date().getFullYear()} BraveStream. All rights reserved.
                    </p>
                </section>
            </main>
        </div>
    );
}