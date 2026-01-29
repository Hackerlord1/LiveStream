// src/lib/api/transformers.ts

import { 
    DEFAULTS, 
    COUNTRY_CODE_MAP, 
    CODE_TO_LANGUAGE, 
    CATEGORY_PATTERNS 
} from './config';
import { logger } from './logger';
import type { 
    ApiChannel, 
    Match, 
    MatchStatus, 
    SportType, 
    RawChannel, 
    RawMatch,
    ChannelStatus
} from './types';

// ========== CHANNEL TRANSFORMERS ==========

/**
 * Transform raw channel data to ApiChannel
 */
export function transformChannelData(channel: RawChannel): ApiChannel {
    // Validate and fix image URL
    let imageUrl = channel.image || DEFAULTS.IMAGES.CHANNEL;
    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = DEFAULTS.IMAGES.CHANNEL;
    }

    const code = channel.code || 'us';
    
    return {
        name: channel.name || DEFAULTS.CHANNEL.NAME,
        code,
        url: channel.url || '',
        image: imageUrl,
        status: (channel.status as ChannelStatus) || DEFAULTS.CHANNEL.STATUS,
        viewers: channel.viewers || DEFAULTS.CHANNEL.VIEWERS,
        category: channel.category || extractCategoryFromName(channel.name || ''),
        language: channel.language || CODE_TO_LANGUAGE[code] || 'Various',
        country: channel.country || extractCountryFromImage(channel.image || ''),
    };
}

/**
 * Enhance channel with extracted metadata
 */
export function enhanceChannel(channel: ApiChannel): ApiChannel {
    try {
        return {
            ...channel,
            country: channel.country || extractCountryFromImage(channel.image),
            category: channel.category || extractCategoryFromName(channel.name),
            language: channel.language || CODE_TO_LANGUAGE[channel.code] || 'Various',
        };
    } catch (error) {
        logger.error('Error enhancing channel:', channel.name, error);
        return {
            ...channel,
            country: channel.country || 'International',
            category: channel.category || 'Entertainment',
            language: channel.language || 'Various',
        };
    }
}

/**
 * Extract country name from image URL
 */
export function extractCountryFromImage(imageUrl: string): string {
    if (!imageUrl || imageUrl.trim() === '') {
        return 'International';
    }

    try {
        // Try to extract country from URL patterns
        const patterns = [
            /images6318\/([^/]+)/i,
            /\/([a-z]{2}(?:-[a-z]+)?)\/[^/]+\.(?:png|jpg|jpeg|webp|svg)/i,
        ];

        for (const pattern of patterns) {
            const match = imageUrl.match(pattern);
            if (match?.[1]) {
                const countryCode = match[1].toLowerCase();
                
                // Check mapping
                if (COUNTRY_CODE_MAP[countryCode]) {
                    return COUNTRY_CODE_MAP[countryCode];
                }

                // Convert hyphenated to proper case (e.g., "south-africa" -> "South Africa")
                return countryCode
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }
        }

        // Try common path patterns
        const pathPatterns: [string, string][] = [
            ['/us/', 'United States'],
            ['/uk/', 'United Kingdom'],
            ['/ca/', 'Canada'],
            ['/au/', 'Australia'],
            ['/za/', 'South Africa'],
        ];

        for (const [pattern, country] of pathPatterns) {
            if (imageUrl.includes(pattern)) {
                return country;
            }
        }
    } catch (error) {
        logger.warn('Could not extract country from URL:', imageUrl);
    }

    return 'International';
}

/**
 * Extract category from channel name using regex patterns
 */
export function extractCategoryFromName(name: string): string {
    if (!name) return 'Entertainment';

    for (const [pattern, category] of CATEGORY_PATTERNS) {
        if (pattern.test(name)) {
            return category;
        }
    }

    return 'Entertainment';
}

// ========== MATCH TRANSFORMERS ==========

/**
 * Transform raw match data to Match type
 */
export function transformMatchData(match: RawMatch, sport: SportType): Match {
    const status = parseMatchStatus(match.status);
    
    return {
        gameID: match.gameID,
        homeTeam: match.homeTeam || DEFAULTS.MATCH.TEAM,
        awayTeam: match.awayTeam || DEFAULTS.MATCH.TEAM,
        homeTeamIMG: match.homeTeamIMG || DEFAULTS.IMAGES.TEAM_LOGO,
        awayTeamIMG: match.awayTeamIMG || DEFAULTS.IMAGES.TEAM_LOGO,
        time: match.time || DEFAULTS.MATCH.TIME,
        tournament: match.tournament || DEFAULTS.MATCH.TOURNAMENT,
        country: match.country,
        countryIMG: match.countryIMG,
        status,
        start: match.start,
        end: match.end,
        channels: match.channels || [],
        sport,
        score: match.score || (status === 'live' ? { home: 0, away: 0 } : undefined),
    };
}

/**
 * Parse and validate match status
 */
function parseMatchStatus(status?: string): MatchStatus {
    const normalized = status?.toLowerCase();
    
    if (normalized === 'live') return 'live';
    if (normalized === 'ended' || normalized === 'finished') return 'ended';
    return 'upcoming';
}

/**
 * Sort matches by relevance (live first, then upcoming by time, ended last)
 */
export function sortMatchesByRelevance(matches: Match[]): Match[] {
    return [...matches].sort((a, b) => {
        // Live matches first
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;

        // Upcoming matches by start time (closest first)
        if (a.status !== 'ended' && b.status !== 'ended') {
            return new Date(a.start).getTime() - new Date(b.start).getTime();
        }

        // Ended matches last
        return a.status === 'ended' ? 1 : -1;
    });
}