// src/app/match/[id]/page.tsx - FIXED (No Suspense)
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

// Components
import MatchPlayer from './MatchPlayer';

// API - FIXED IMPORTS
import type { Match } from '@/lib/api';
import { getMatchById, getSportsConfig } from '@/lib/api';

// ========== TYPES ==========
interface PageProps {
    params: Promise<{ id: string }>;
}

// ========== DATA FETCHING ==========

async function getMatchData(id: string): Promise<Match | null> {
    console.log('🔍 [getMatchData] Looking for match with ID:', id);
    
    if (!id || id.trim() === '') {
        console.error('❌ Invalid match ID provided');
        return null;
    }

    try {
        // Use the updated getMatchById function
        const match = await getMatchById(id);
        
        if (!match) {
            console.warn(`❌ Match not found: ${id}`);
            
            // Try to suggest what might be wrong
            console.log('💡 Debug info:');
            console.log('   - ID might be a team slug (contains "vs")');
            console.log('   - API gameIDs change frequently');
            console.log('   - Try using team names in URLs');
            
            return null;
        }

        console.log(`✅ Found match: ${match.homeTeam} vs ${match.awayTeam} (${match.sport})`);
        return match;
    } catch (error) {
        console.error('❌ Failed to fetch match:', error);
        return null;
    }
}

// ========== METADATA ==========

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const match = await getMatchById(id);
    const sportsConfig = getSportsConfig();

    if (!match) {
        return {
            title: 'Match Not Found | BraveStream',
            description: 'The requested match could not be found.',
        };
    }

    const sportConfig = sportsConfig[match.sport];
    const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
    const statusText = match.status === 'live' ? '🔴 LIVE' : match.status === 'upcoming' ? '⏰ Upcoming' : '✅ Ended';

    return {
        title: `${statusText} ${matchTitle} | ${match.tournament} | BraveStream`,
        description: `Watch ${match.homeTeam} vs ${match.awayTeam} ${match.status === 'live' ? 'live' : ''} - ${match.tournament}. Stream ${sportConfig?.name || match.sport} matches free on BraveStream.`,
        keywords: [
            match.homeTeam,
            match.awayTeam,
            match.tournament,
            match.sport,
            'live stream',
            'watch online',
            'free sports streaming',
            sportConfig?.name || match.sport,
        ].filter(Boolean),
        openGraph: {
            title: `${matchTitle} - ${match.tournament}`,
            description: `Watch ${match.homeTeam} vs ${match.awayTeam} ${match.status === 'live' ? 'live now' : 'on BraveStream'}`,
            type: 'video.other',
            images: [
                { url: match.homeTeamIMG, alt: match.homeTeam },
                { url: match.awayTeamIMG, alt: match.awayTeam },
            ].filter(img => img.url),
        },
        twitter: {
            card: 'summary_large_image',
            title: `${statusText} ${matchTitle}`,
            description: `Watch ${match.tournament} - ${match.homeTeam} vs ${match.awayTeam}`,
        },
        robots: {
            index: match.status !== 'ended',
            follow: true,
        },
    };
}

// ========== MAIN PAGE COMPONENT ==========

export default async function MatchPage({ params }: PageProps) {
    const { id } = await params;
    
    // Validate ID
    if (!id || id.trim() === '') {
        notFound();
    }

    // Fetch match data
    const match = await getMatchData(id);

    // Handle not found
    if (!match) {
        notFound();
    }
    return <MatchPlayer match={match} />;
}

// ========== REVALIDATION ==========
export const revalidate = 60;