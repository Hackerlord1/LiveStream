// src/lib/api/mock-data.ts

import { logger } from './logger';
import type { ApiChannel, ChannelsResponse, Match } from './types';

/**
 * Returns empty channels — no more hardcoded fallback
 */
export function getMockChannels(): ChannelsResponse {
    logger.info('No live channel data available');
    return {
        total_channels: 0,
        channels: []
    };
}

/**
 * Returns empty matches — no more hardcoded fallback
 */
export function getMockMatches(): Match[] {
    logger.info('No live match data available');
    return [];
}