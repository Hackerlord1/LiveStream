// src/lib/api/index.ts
// Main entry point - re-exports everything for easy imports

// ========== TYPES ==========
export type {
    Channel,
    ApiChannel,
    ChannelStatus,
    ChannelsResponse,
    SportType,
    MatchStatus,
    Match,
    MatchFilters,
    SportsData,
    ApiResponse,
    CacheEntry,
    RawChannel,
    RawMatch,
} from './types';

// ========== CONFIG ==========
export {
    API_CONFIG,
    TIMEOUT_CONFIG,
    CACHE_CONFIG,
    RETRY_CONFIG,
    DEFAULTS,
    HTTP_STATUS,
    SPORTS_CONFIG,
    COUNTRY_CODE_MAP,
    CODE_TO_LANGUAGE,
    CATEGORY_PATTERNS,
    getSportsConfig,
} from './config';

// ========== CACHE ==========
export { apiCache, clearApiCache, ApiCache } from './cache';

// ========== LOGGER ==========
export { logger, Logger } from './logger';

// ========== FETCH UTILITIES ==========
export {
    fetchWithRetry,
    isAbortError,
    isNetworkError,
    safeParseJSON,
    buildUrl,
} from './fetch-utils';

// ========== TRANSFORMERS ==========
export {
    transformChannelData,
    transformMatchData,
    enhanceChannel,
    extractCountryFromImage,
    extractCategoryFromName,
    sortMatchesByRelevance,
} from './transformers';

// ========== CHANNELS ==========
export {
    fetchAllChannels,
    fetchChannelsByCategory,
    fetchChannelsByCountry,
    searchChannels,
    getChannelCategories,
    getChannelCountries,
    getChannelLanguages,
    getTopChannelsByViewers,
    getOnlineChannels,
    groupChannelsByCountry,
    groupChannelsByCategory,
} from './channels';

// ========== MATCHES ==========
export {
    fetchAllMatches,
    getMatchById,
    filterMatchesBySport,
    getLiveMatches,
    getUpcomingMatches,
    getMatchesByTeam,
    filterMatches,
    getSportsCounts,
    getFeaturedMatches,
    getPopularLiveMatches,
    getMatchesStartingSoon,
    getTournaments,
    groupMatchesBySport,
    groupMatchesByDate,
} from './matches';

// ========== STREAMING ==========
export {
    getEmbedUrl,
    getIframeEmbedUrl,
    isProperlyFormatted,
    getSafeEmbedUrl,
    testStreamUrl,
    getBestStreamUrl,
} from './streaming';

// ========== MOCK DATA (for testing) ==========
export { getMockChannels, getMockMatches } from './mock-data';