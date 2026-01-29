// src/lib/match-utils.ts
import { Match, fetchAllMatches, logger } from './api';

/**
 * Find a match by its game ID
 * @param gameID - The unique identifier for the match
 * @returns The match if found, null otherwise
 */
export async function getMatchById(gameID: string): Promise<Match | null> {
    if (!gameID || typeof gameID !== 'string') {
        logger.warn('Invalid gameID provided to getMatchById');
        return null;
    }

    try {
        logger.debug(`Looking for match with ID: ${gameID}`);

        const matches = await fetchAllMatches();
        logger.debug(`Found ${matches.length} total matches`);

        // Clean the ID
        const cleanId = decodeURIComponent(gameID).trim();

        // 1. Try exact match
        let match = matches.find((m) => m.gameID === cleanId);
        if (match) {
            logger.debug('Exact match found');
            return match;
        }

        // 2. Try case-insensitive
        match = matches.find(
            (m) => m.gameID.toLowerCase() === cleanId.toLowerCase()
        );
        if (match) {
            logger.debug('Case-insensitive match found');
            return match;
        }

        // 3. Log available IDs for debugging (only in development)
        if (matches.length > 0) {
            logger.debug(
                'Available match IDs (first 10):',
                matches.slice(0, 10).map((m) => m.gameID)
            );
        }

        logger.warn(`Match not found for ID: ${cleanId}`);
        return null;
    } catch (error) {
        logger.error('Error finding match:', error);
        return null;
    }
}