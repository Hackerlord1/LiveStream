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

function parseChannelId(id: string): { name: string; code: string; index?: number } | null {
    try {
        const decoded = decodeURIComponent(id);
        const [name, code, indexValue] = decoded.split('|');

        if (!name || !code) {
            console.error('Invalid channel ID format:', decoded);
            return null;
        }

        const index =
            indexValue !== undefined && indexValue !== ''
                ? Number(indexValue)
                : undefined;

        return {
            name,
            code,
            index: Number.isInteger(index) ? index : undefined,
        };
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

        const matchingChannels = data.channels.filter(
            (channel) => channel.name === parsed.name && channel.code === parsed.code
        );

        if (matchingChannels.length === 0) {
            console.warn(`Channel not found: ${parsed.name} (${parsed.code})`);
            return null;
        }

        if (parsed.index !== undefined && matchingChannels[parsed.index]) {
            return matchingChannels[parsed.index];
        }

        return matchingChannels[0] || null;
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
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto mb-4"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-red-600 rounded-full animate-pulse"></div>
                    </div>
                </div>

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