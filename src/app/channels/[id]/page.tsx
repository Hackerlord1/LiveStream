import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ChannelPlayer from './ChannelPlayer';
import { fetchAllChannels, ApiChannel } from '@/lib/api';

async function getChannelData(id: string): Promise<ApiChannel | null> {
    try {
        const data = await fetchAllChannels();
        const [name, code] = decodeURIComponent(id).split('|');
        const channel = data.channels.find(ch => ch.name === name && ch.code === code);
        return channel || null;
    } catch (error) {
        console.error('Failed to fetch channel:', error);
        return null;
    }
}

function ChannelLoadingSkeleton() {
    return (
        <div className="min-h-screen bg-[#e8e8e8] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-700 text-lg">Loading channel...</p>
            </div>
        </div>
    );
}

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
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