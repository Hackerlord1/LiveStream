// src/lib/match-utils.ts - SIMPLIFIED
import { Match, fetchAllMatches } from './api';

export async function getMatchById(gameID: string): Promise<Match | null> {
    try {
        console.log('🔍 Looking for match with ID:', gameID);

        const matches = await fetchAllMatches();
        console.log(`📊 Found ${matches.length} total matches`);

        // Clean the ID
        const cleanId = decodeURIComponent(gameID).trim();

        // 1. Try exact match
        let match = matches.find(m => m.gameID === cleanId);
        if (match) {
            console.log('✅ Exact match found');
            return match;
        }

        // 2. Try case-insensitive
        match = matches.find(m => m.gameID.toLowerCase() === cleanId.toLowerCase());
        if (match) {
            console.log('✅ Case-insensitive match found');
            return match;
        }

        // 3. Log available IDs for debugging
        console.log('Available match IDs (first 10):',
            matches.slice(0, 10).map(m => m.gameID)
        );

        return null;
    } catch (error) {
        console.error('Error finding match:', error);
        return null;
    }
}