// src/lib/api/matches.ts

import { API_CONFIG, CACHE_CONFIG } from './config';
import { logger } from './logger';
import { apiCache } from './cache';
import { fetchWithRetry } from './fetch-utils';
import { transformMatchData, sortMatchesByRelevance } from './transformers';
import { getMockMatches } from './mock-data';
import type { Match, SportType, ApiResponse, MatchFilters } from './types';
import { 
        normalizeTeamName, 
        findMatchByTeams,
        getTeamSearchVariations 
    } from './team-normalization';
    

// ========== MAIN FETCH FUNCTION ==========

/**
 * Fetch all matches from API
 * ALWAYS returns an array (empty array on error)
 */
export async function fetchAllMatches(): Promise<Match[]> {
    logger.debug('Fetching all sports matches...');

    // Check cache first
    const cached = apiCache.get<Match[]>(CACHE_CONFIG.KEYS.MATCHES);
    if (cached && Array.isArray(cached)) {
        logger.debug(`Using cached matches data (${cached.length} matches)`);
        return cached;
    }

    try {
        logger.debug(`Fetching from: ${API_CONFIG.ENDPOINTS.SPORTS}`);
        const response = await fetchWithRetry(API_CONFIG.ENDPOINTS.SPORTS);

        if (!response.ok) {
            logger.error(`Sports API responded with ${response.status}`);
            return useFallbackMatches();
        }

        const data: ApiResponse = await response.json();
        logger.debug('API response received');

        // Validate response structure
        if (!data || typeof data !== 'object') {
            logger.error('Invalid API response structure');
            return useFallbackMatches();
        }

        const allMatches = extractAllMatches(data);

        // Ensure we have an array
        if (!Array.isArray(allMatches)) {
            logger.error('extractAllMatches did not return an array');
            return useFallbackMatches();
        }

        const sortedMatches = sortMatchesByRelevance(allMatches);

        // Final array check
        if (!Array.isArray(sortedMatches)) {
            logger.error('sortMatchesByRelevance did not return an array');
            return allMatches; // Return unsorted but valid array
        }

        // Cache the results
        apiCache.set(CACHE_CONFIG.KEYS.MATCHES, sortedMatches);

        logger.info(`Total matches fetched: ${sortedMatches.length}`);
        return sortedMatches;
    } catch (error: unknown) {
        logger.error('Error fetching matches:', error);
        return useFallbackMatches();
    }
}

// ========== HELPER FUNCTIONS ==========

function extractAllMatches(data: ApiResponse): Match[] {
    const allMatches: Match[] = [];

    // Safely access cdn-live-tv property
    const sportsData = data?.["cdn-live-tv"];

    if (!sportsData || typeof sportsData !== 'object') {
        logger.warn('No sports data in API response');
        logger.debug('API response keys:', Object.keys(data || {}));
        return allMatches;
    }

    // Log available sports data
    logger.debug('Available sports in response:', Object.keys(sportsData));

    // Process each sport
    const sportMappings: [string, SportType][] = [
        ['Soccer', 'SOCCER'],
        ['NBA', 'NBA'],
        ['NFL', 'NFL'],
        ['NHL', 'NHL'],
    ];

    for (const [key, sportType] of sportMappings) {
        const matches = (sportsData as unknown as Record<string, unknown>)[key];
        if (Array.isArray(matches)) {
            try {
                // Log first match structure for debugging
                if (matches.length > 0 && matches[0]) {
                    logger.debug(`First ${key} match keys:`, Object.keys(matches[0]));
                    logger.debug(`First ${key} match gameID:`, matches[0].gameID);
                }

                const transformed = matches.map(match => transformMatchData(match, sportType));
                allMatches.push(...transformed);
                logger.debug(`Added ${transformed.length} ${sportType} matches`);
            } catch (error) {
                logger.error(`Error transforming ${sportType} matches:`, error);
            }
        } else {
            logger.debug(`No ${key} matches found or invalid format`);
        }
    }

    // Log summary
    logger.info(`Total matches extracted: ${allMatches.length}`);
    if (allMatches.length > 0) {
        logger.debug('Sample gameIDs:', allMatches.slice(0, 3).map(m => m.gameID));
    }

    return allMatches;
}

function useFallbackMatches(): Match[] {
    try {
        const mockData = getMockMatches();
        if (Array.isArray(mockData)) {
            logger.info(`Using fallback mock data (${mockData.length} matches)`);
            apiCache.set(CACHE_CONFIG.KEYS.MATCHES, mockData);
            return mockData;
        }
    } catch (error) {
        logger.error('Error getting mock matches:', error);
    }
    logger.warn('Returning empty matches array');
    return []; // Always return an array
}

// ========== FILTER FUNCTIONS ==========

/**
 * Filter matches by sport type
 */
export function filterMatchesBySport(matches: Match[], sport: SportType): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('filterMatchesBySport: matches is not an array');
        return [];
    }
    return matches.filter(match => match?.sport === sport);
}

/**
 * Get live matches only
 */
export function getLiveMatches(matches: Match[]): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('getLiveMatches: matches is not an array');
        return [];
    }
    return matches.filter(match => match?.status === 'live');
}

/**
 * Get upcoming matches only
 */
export function getUpcomingMatches(matches: Match[]): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('getUpcomingMatches: matches is not an array');
        return [];
    }
    const now = new Date();
    return matches.filter(
        match => match?.status === 'upcoming' && new Date(match.start) > now
    );
}

/**
 * Get matches by team name
 */
export function getMatchesByTeam(matches: Match[], teamName: string): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('getMatchesByTeam: matches is not an array');
        return [];
    }
    if (!teamName || typeof teamName !== 'string') {
        return [];
    }
    const searchTerm = teamName.toLowerCase();
    return matches.filter(
        match =>
            match?.homeTeam?.toLowerCase().includes(searchTerm) ||
            match?.awayTeam?.toLowerCase().includes(searchTerm)
    );
}

/**
 * Filter matches by multiple criteria
 */
export function filterMatches(matches: Match[], filters: MatchFilters): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('filterMatches: matches is not an array');
        return [];
    }

    return matches.filter(match => {
        if (!match) return false;

        if (filters.sport && match.sport !== filters.sport) return false;
        if (filters.status && match.status !== filters.status) return false;
        if (filters.tournament && match.tournament !== filters.tournament) return false;

        if (filters.team) {
            const teamLower = filters.team.toLowerCase();
            const matchesTeam =
                match.homeTeam?.toLowerCase().includes(teamLower) ||
                match.awayTeam?.toLowerCase().includes(teamLower);
            if (!matchesTeam) return false;
        }

        if (filters.date) {
            const matchDate = new Date(match.start);
            if (matchDate.toDateString() !== filters.date.toDateString()) {
                return false;
            }
        }

        return true;
    });
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get counts per sport
 */
export function getSportsCounts(matches: Match[]): Record<SportType, number> {
    const counts = {} as Record<SportType, number>;

    if (!Array.isArray(matches)) {
        logger.warn('getSportsCounts: matches is not an array');
        return counts;
    }

    matches.forEach(match => {
        if (match?.sport) {
            counts[match.sport] = (counts[match.sport] || 0) + 1;
        }
    });

    return counts;
}

/**
 * Get featured matches (live or with channels)
 */
export function getFeaturedMatches(matches: Match[], limit = 4): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('getFeaturedMatches: matches is not an array');
        return [];
    }
    return matches
        .filter(match => match?.status === 'live' || (match?.channels?.length || 0) > 0)
        .slice(0, limit);
}

/**
 * Get popular live matches (sorted by total viewers)
 */
export function getPopularLiveMatches(matches: Match[]): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('getPopularLiveMatches: matches is not an array');
        return [];
    }
    return matches
        .filter(match => match?.status === 'live')
        .sort((a, b) => {
            const aViewers = (a?.channels || []).reduce((sum, ch) => sum + (ch?.viewers || 0), 0);
            const bViewers = (b?.channels || []).reduce((sum, ch) => sum + (ch?.viewers || 0), 0);
            return bViewers - aViewers;
        });
}

/**
 * Get matches starting within the next hour
 */
export function getMatchesStartingSoon(matches: Match[]): Match[] {
    if (!Array.isArray(matches)) {
        logger.warn('getMatchesStartingSoon: matches is not an array');
        return [];
    }
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    return matches.filter(match => {
        if (!match?.start) return false;
        const matchStart = new Date(match.start);
        return (
            match.status === 'upcoming' &&
            matchStart > now &&
            matchStart <= oneHourFromNow
        );
    });
}

/**
 * Get unique tournaments from matches
 */
export function getTournaments(matches: Match[]): string[] {
    if (!Array.isArray(matches)) {
        logger.warn('getTournaments: matches is not an array');
        return [];
    }
    const tournaments = new Set<string>();
    matches.forEach(match => {
        if (match?.tournament) {
            tournaments.add(match.tournament);
        }
    });
    return Array.from(tournaments).sort();
}

/**
 * Group matches by sport
 */
export function groupMatchesBySport(matches: Match[]): Record<SportType, Match[]> {
    const grouped = {} as Record<SportType, Match[]>;

    if (!Array.isArray(matches)) {
        logger.warn('groupMatchesBySport: matches is not an array');
        return grouped;
    }

    matches.forEach(match => {
        if (!match?.sport) return;
        if (!grouped[match.sport]) {
            grouped[match.sport] = [];
        }
        grouped[match.sport].push(match);
    });

    return grouped;
}

/**
 * Group matches by date
 */
export function groupMatchesByDate(matches: Match[]): Record<string, Match[]> {
    const grouped: Record<string, Match[]> = {};

    if (!Array.isArray(matches)) {
        logger.warn('groupMatchesByDate: matches is not an array');
        return grouped;
    }

    matches.forEach(match => {
        if (!match?.start) return;
        const date = new Date(match.start).toDateString();
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(match);
    });

    return grouped;
}

export async function getMatchById(id: string): Promise<Match | null> {
    console.log('🔍 [getMatchById] Searching for:', id);
    
    
    try {
        const matches = await fetchAllMatches();
        
        // Decode URL
        const decodedId = decodeURIComponent(id).trim();
        
        // PHASE 1: Try exact gameID
        let match = matches.find(m => m.gameID?.toLowerCase() === decodedId.toLowerCase());
        if (match) return match;
        
        // PHASE 2: If it's a team slug, parse it
        if (decodedId.includes('-vs-')) {
            console.log('🔍 Parsing team slug with normalization...');
            
            const parts = decodedId.split('-vs-');
            if (parts.length >= 2) {
                const homePart = parts[0].replace(/-/g, ' ');
                const awayRest = parts[1];
                
                // Try to extract away team (1-3 words)
                const awayWords = awayRest.split('-');
                
                for (let i = 1; i <= Math.min(3, awayWords.length); i++) {
                    const awayPart = awayWords.slice(0, i).join(' ');
                    const tournamentPart = awayWords.slice(i).join(' ');
                    
                    console.log(`🔧 Attempt ${i}: Home="${homePart}", Away="${awayPart}"`);
                    
                    // Try to find using normalization
                    let match: Match | null | undefined;
                    match = findMatchByTeams(homePart, awayPart, matches);
                    
                    if (match) {
                        console.log(`✅ Found match using normalization`);
                        return match;
                    }
                }
            }
        }
        
        // PHASE 3: Try search with variations
        console.log('🔍 Trying search variations...');
        const searchTerms = decodedId.toLowerCase().split('-').filter(term => term.length > 2);
        
        if (searchTerms.length >= 2) {
            // Try to find matches where search terms appear in team names
            match = matches.find(m => {
                const homeVariations = getTeamSearchVariations(m.homeTeam);
                const awayVariations = getTeamSearchVariations(m.awayTeam);
                
                // Check if search terms match any variations
                const homeMatches = searchTerms.filter(term => 
                    homeVariations.some(v => v.includes(term) || term.includes(v))
                ).length;
                
                const awayMatches = searchTerms.filter(term => 
                    awayVariations.some(v => v.includes(term) || term.includes(v))
                ).length;
                
                return homeMatches >= 1 && awayMatches >= 1;
            });
            
            if (match) {
                console.log('✅ Found using search variations');
                return match;
            }
        }
        
        // PHASE 4: Last resort - tournament search
        console.log('🔍 Last resort: tournament search');
        
        // Look for tournament keywords
        const tournamentKeywords = ['uefa', 'champions', 'europa', 'conference', 'league', 'cup'];
        const tournamentPart = decodedId.split('-').find(part => 
            tournamentKeywords.some(keyword => part.toLowerCase().includes(keyword))
        );
        
        if (tournamentPart) {
            match = matches.find(m => 
                m.tournament.toLowerCase().includes(tournamentPart.toLowerCase())
            );
            
            if (match) {
                console.log(`⚠️ Found match by tournament: ${match.tournament}`);
                return match;
            }
        }
        
        console.warn(`❌ No match found for: ${decodedId}`);
        return null;
        
    } catch (error) {
        console.error('Error finding match:', error);
        return null;
    }
}