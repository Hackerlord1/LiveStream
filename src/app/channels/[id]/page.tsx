// src/app/channels/[id]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

// Components
import ChannelPlayer from './ChannelPlayer';

// API
import type { ApiChannel } from '@/lib/api';
import { fetchAllChannels } from '@/lib/api';

// ========== DATA FETCHING ==========

function parseChannelId(id: string): { name: string; code: string } | null {
    try {
        const decoded = decodeURIComponent(id);
        const [name, code] = decoded.split('|');
        if (!name || !code) {
            console.error('Invalid channel ID format:', decoded);
            return null;
        }
        return { name, code };
    } catch (error) {
        console.error('Failed to parse channel ID:', error);
        return null;
    }
}

async function getChannelData(id: string): Promise<ApiChannel | null> {
    const parsed = parseChannelId(id);
    if (!parsed) return null;

    try {
        const data = await fetchAllChannels();
        const channel = data.channels.find(
            ch => ch.name === parsed.name && ch.code === parsed.code
        );
        if (!channel) {
            console.warn(`Channel not found: ${parsed.name} (${parsed.code})`);
        }
        return channel || null;
    } catch (error) {
        console.error('Failed to fetch channel:', error);
        return null;
    }
}

// ========== METADATA ==========

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const channel = await getChannelData(id);

    if (!channel) {
        return {
            title: 'Channel Not Found | BraveStream',
            description: 'The requested channel could not be found.',
        };
    }

    return {
        title: `Watch ${channel.name} Live | BraveStream`,
        description: `Stream ${channel.name} live from ${channel.country}. Watch ${channel.category} content in ${channel.language} on BraveStream.`,
        keywords: [
            channel.name,
            channel.category || 'TV',
            channel.country || 'International',
            'live streaming',
            'watch online',
            'free TV',
        ].filter(Boolean),
        openGraph: {
            title: `Watch ${channel.name} Live`,
            description: `Stream ${channel.name} live from ${channel.country}`,
            type: 'video.other',
            images: channel.image ? [{ url: channel.image, alt: channel.name }] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title: `Watch ${channel.name} Live`,
            description: `Stream ${channel.name} live from ${channel.country}`,
        },
    };
}

// ========== LOADING COMPONENT ==========

function ChannelLoadingSkeleton() {
    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{ backgroundColor: 'var(--neu-bg-page)' }}
        >
            <div className="text-center">
                {/* Animated spinner */}
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto mb-4"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-red-600 rounded-full animate-pulse"></div>
                    </div>
                </div>

                {/* Loading text */}
                <p
                    className="text-lg font-medium mt-4"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Loading channel...
                </p>
                <p
                    className="text-sm mt-2"
                    style={{ color: 'var(--text-muted)' }}
                >
                    Please wait while we connect to the stream
                </p>

                {/* Skeleton preview */}
                <div className="mt-8 max-w-md mx-auto">
                    <div
                        className="rounded-xl h-48 animate-pulse"
                        style={{ backgroundColor: 'var(--surface-tertiary)' }}
                    ></div>
                    <div className="mt-4 space-y-2">
                        <div
                            className="rounded h-6 w-3/4 mx-auto animate-pulse"
                            style={{ backgroundColor: 'var(--surface-tertiary)' }}
                        ></div>
                        <div
                            className="rounded h-4 w-1/2 mx-auto animate-pulse"
                            style={{ backgroundColor: 'var(--surface-tertiary)' }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ========== ERROR COMPONENT ==========

function ChannelError({ message }: { message?: string }) {
    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{ backgroundColor: 'var(--neu-bg-page)' }}
        >
            <div className="text-center max-w-md">
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                    style={{ backgroundColor: 'var(--error-bg)' }}
                >
                    <svg
                        className="w-10 h-10"
                        style={{ color: 'var(--brand-red)' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <h1
                    className="text-2xl font-bold mb-2"
                    style={{ color: 'var(--text-primary)' }}
                >
                    Channel Not Found
                </h1>
                <p
                    className="mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {message || "The channel you're looking for doesn't exist or is currently unavailable."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                        href="/channels"
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-md"
                    >
                        Browse All Channels
                    </a>
                    <a
                        href="/"
                        className="px-6 py-3 rounded-xl font-medium transition-colors"
                        style={{
                            backgroundColor: 'var(--surface-primary)',
                            border: '1px solid var(--border-primary)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        Go to Homepage
                    </a>
                </div>
            </div>
        </div>
    );
}

// ========== MAIN PAGE COMPONENT ==========

export default async function ChannelPage({ params }: PageProps) {
    const { id } = await params;

    if (!id || id.trim() === '') {
        notFound();
    }

    const channel = await getChannelData(id);

    if (!channel) {
        notFound();
    }

    return (
        <Suspense fallback={<ChannelLoadingSkeleton />}>
            <ChannelPlayer channel={channel} />
        </Suspense>
    );
}