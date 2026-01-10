// src/app/contact/page.tsx
'use client';

import React, { useState } from 'react';
import Header from "@/components/Header";
import {
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaClock,
    FaPaperPlane,
    FaHeadset,
    FaTwitter,
    FaFacebook,
    FaInstagram,
    FaReddit
} from "react-icons/fa";

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle form submission
        console.log('Form submitted:', formData);
        alert('Thank you for your message! We will get back to you soon.');
        setFormData({ name: '', email: '', subject: '', message: '' });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-8">
                {/* Hero Section */}
                <div className="neumorphic-card mb-8 text-center">
                    <div className="max-w-4xl mx-auto">
                        <h1 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                            Contact Us
                        </h1>
                        <p className="text-lg text-gray-700">
                            We're here to help! Reach out to us for support, partnerships, or just to say hello.
                        </p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mb-8">
                    {/* Contact Info */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="neumorphic-card">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-red-100 rounded-xl">
                                    <FaHeadset className="text-red-600 text-2xl" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Support Hours</h3>
                                    <p className="text-gray-700">24/7 Live Support</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <FaClock className="text-gray-500" />
                                    <span className="text-gray-700">Average Response Time: <strong>15 minutes</strong></span>
                                </div>
                            </div>
                        </div>

                        <div className="neumorphic-card">
                            <h3 className="text-xl font-bold mb-4 text-gray-900">Get in Touch</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <FaEnvelope className="text-red-600 mt-1" />
                                    <div>
                                        <p className="font-medium text-gray-900">Email</p>
                                        <p className="text-gray-700">support@streamsports.com</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaPhone className="text-red-600 mt-1" />
                                    <div>
                                        <p className="font-medium text-gray-900">Phone</p>
                                        <p className="text-gray-700">+254 791 220 335</p>
                                    </div>
                                </div>

                            </div>
                        </div>



                    </div>

                    {/* Contact Form */}
                    <div className="lg:col-span-2">
                        <div className="neumorphic-card">
                            <h2 className="text-2xl font-bold mb-6 text-gray-900">Send us a Message</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Your Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subject *
                                    </label>
                                    <select
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    >
                                        <option value="">Select a topic</option>
                                        <option value="technical">Technical Support</option>
                                        <option value="account">Account Issues</option>
                                        <option value="streaming">Streaming Problems</option>
                                        <option value="partnership">Partnership Inquiry</option>
                                        <option value="feedback">Feedback & Suggestions</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Message *
                                    </label>
                                    <textarea
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        rows={5}
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                        placeholder="How can we help you?"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors duration-300 flex items-center justify-center gap-2"
                                >
                                    <FaPaperPlane />
                                    Send Message
                                </button>
                            </form>
                        </div>

                        {/* FAQ Section */}
                        <div className="neumorphic-card mt-6">
                            <h3 className="text-xl font-bold mb-4 text-gray-900">Frequently Asked Questions</h3>
                            <div className="space-y-4">
                                {[
                                    {
                                        q: "How do I report a broken stream?",
                                        a: "Use the 'Report Stream' button on the player page or contact support immediately."
                                    },
                                    {
                                        q: "Is StreamSports available in my country?",
                                        a: "We're available worldwide. Some content may have regional restrictions based on broadcasting rights."
                                    },
                                    {
                                        q: "How can I become a content partner?",
                                        a: "Email partnerships@streamsports.com with details about your content."
                                    },
                                    {
                                        q: "Do you offer mobile apps?",
                                        a: "Yes! Our platform is fully responsive and works on all devices."
                                    }
                                ].map((faq, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                        <h4 className="font-bold text-gray-900 mb-2">{faq.q}</h4>
                                        <p className="text-gray-700">{faq.a}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
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