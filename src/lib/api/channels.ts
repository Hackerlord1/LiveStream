// src/lib/api/channels.ts

import { API_CONFIG, CACHE_CONFIG } from './config';
import { logger } from './logger';
import { apiCache } from './cache';
import { fetchWithRetry, isAbortError } from './fetch-utils';
import { transformChannelData, enhanceChannel } from './transformers';
import type { ApiChannel, ChannelsResponse } from './types';

// ========== MAIN FETCH FUNCTION ==========

/**
 * Fetch all channels from API
 */
export async function fetchAllChannels(): Promise<ChannelsResponse> {
    logger.debug('Fetching all channels...');

    // Check cache first
    const cached = apiCache.get<ChannelsResponse>(CACHE_CONFIG.KEYS.CHANNELS);
    if (cached) {
        logger.debug('Using cached channels data');
        return cached;
    }

    try {
        const response = await fetchWithRetry(API_CONFIG.ENDPOINTS.CHANNELS);

        if (!response.ok) {
            logger.error(`Channels API responded with ${response.status}`);
            return emptyChannelsFallback();
        }

        const data: ChannelsResponse = await response.json();
        logger.debug(`Received ${data.total_channels} channels from API`);

        // Transform and enhance channels
        const enhancedChannels = data.channels.map(channel => {
            const transformed = transformChannelData(channel);
            return enhanceChannel(transformed);
        });

        const result: ChannelsResponse = {
            total_channels: data.total_channels,
            channels: enhancedChannels,
        };

        // Cache the results
        apiCache.set(CACHE_CONFIG.KEYS.CHANNELS, result);

        return result;
    } catch (error: unknown) {
        handleChannelsError(error);
        return emptyChannelsFallback();
    }
}

// ========== ERROR HANDLING ==========

function handleChannelsError(error: unknown): void {
    if (isAbortError(error)) {
        logger.warn('Channel fetch aborted due to timeout');
    } else if (error instanceof Error) {
        if (error.message.includes('timed out')) {
            logger.warn('Channel fetch timed out');
        } else if (error.message.includes('Network')) {
            logger.warn('Network error while fetching channels');
        } else {
            logger.error('Error fetching channels:', error.message);
        }
    } else {
        logger.error('Unknown error fetching channels:', error);
    }
}

function emptyChannelsFallback(): ChannelsResponse {
    logger.warn('API unavailable — returning empty channels');
    return {
        total_channels: 0,
        channels: []
    };
}

// ========== FILTER FUNCTIONS ==========

/**
 * Search channels by query
 */
export async function searchChannels(query: string): Promise<ApiChannel[]> {
    const allChannels = await fetchAllChannels();
    const lowerQuery = query.toLowerCase();
    
    return allChannels.channels.filter(channel =>
        channel.name.toLowerCase().includes(lowerQuery) ||
        channel.category?.toLowerCase().includes(lowerQuery) ||
        channel.country?.toLowerCase().includes(lowerQuery) ||
        channel.language?.toLowerCase().includes(lowerQuery)
    );
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get unique categories from channels
 */
export function getChannelCategories(channels: ApiChannel[]): string[] {
    const categories = new Set<string>();
    channels.forEach(channel => {
        if (channel.category) {
            categories.add(channel.category);
        }
    });
    return Array.from(categories).sort();
}

/**
 * Get unique countries from channels
 */
export function getChannelCountries(channels: ApiChannel[]): string[] {
    const countries = new Set<string>();
    channels.forEach(channel => {
        if (channel.country) {
            countries.add(channel.country);
        }
    });
    return Array.from(countries).sort();
}

/**
 * Get unique languages from channels
 */
export function getChannelLanguages(channels: ApiChannel[]): string[] {
    const languages = new Set<string>();
    channels.forEach(channel => {
        if (channel.language) {
            languages.add(channel.language);
        }
    });
    return Array.from(languages).sort();
}
