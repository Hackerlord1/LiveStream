// src/lib/api/config.ts

// ========== API CONFIGURATION ==========
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.cdn-live.tv/api/v1';
const API_USER = process.env.NEXT_PUBLIC_API_USER || 'cdnlivetv';
const API_PLAN = process.env.NEXT_PUBLIC_API_PLAN || 'free';

export const API_CONFIG = {
    BASE_URL: API_BASE_URL,
    USER: API_USER,
    PLAN: API_PLAN,
    ENDPOINTS: {
        SPORTS: `${API_BASE_URL}/events/sports/?user=${API_USER}&plan=${API_PLAN}`,
        CHANNELS: `${API_BASE_URL}/channels/?user=${API_USER}&plan=${API_PLAN}`,
        PLAYER: `${API_BASE_URL}/channels/player/`,
        EMBED: `${API_BASE_URL}/channels/embed/`,
    },
} as const;

// ========== TIMEOUT CONFIGURATION ==========
export const TIMEOUT_CONFIG = {
    CHANNELS: 45000,  // 45 seconds for channels
    SPORTS: 30000,    // 30 seconds for sports
    STREAM_TEST: 10000, // 10 seconds for stream testing
    DEFAULT: 30000,
} as const;

// ========== CACHE CONFIGURATION ==========
export const CACHE_CONFIG = {
    DURATION: 300 * 1000, // 5 minutes in milliseconds
    KEYS: {
        MATCHES: 'matches-cache',
        CHANNELS: 'channels-cache',
    },
} as const;

// ========== RETRY CONFIGURATION ==========
export const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 1000,
    RATE_LIMIT_DELAY: 2000,
} as const;

// ========== DEFAULT VALUES ==========
export const DEFAULTS = {
    IMAGES: {
        TEAM_LOGO: 'https://api.cdn-live.tv/api/v1/team/logo.png',
        CHANNEL: 'https://api.cdn-live.tv/api/v1/channels/images6318/default.png',
    },
    CHANNEL: {
        NAME: 'Unknown Channel',
        STATUS: 'offline' as const,
        VIEWERS: 0,
    },
    MATCH: {
        TEAM: 'TBD',
        TIME: '00:00',
        TOURNAMENT: 'Unknown Tournament',
    },
} as const;

// ========== HTTP STATUS CODES ==========
export const HTTP_STATUS = {
    OK: 200,
    RATE_LIMITED: 429,
    SERVER_ERROR: 500,
} as const;

// ========== SPORTS CONFIGURATION ==========
export const SPORTS_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
    SOCCER: {
        name: "Football",
        color: "#3B82F6",
        icon: "⚽"
    },
    NBA: {
        name: "Basketball",
        color: "#F97316",
        icon: "🏀"
    },
    NFL: {
        name: "American Football",
        color: "#EF4444",
        icon: "🏈"
    },
    NHL: {
        name: "Ice Hockey",
        color: "#06B6D4",
        icon: "🏒"
    }
} as const;

// ========== COUNTRY CODE MAPPINGS ==========
export const COUNTRY_CODE_MAP: Record<string, string> = {
    'us': 'United States',
    'united-states': 'United States',
    'usa': 'United States',
    'uk': 'United Kingdom',
    'united-kingdom': 'United Kingdom',
    'gb': 'United Kingdom',
    'za': 'South Africa',
    'south-africa': 'South Africa',
    'es': 'Spain',
    'spain': 'Spain',
    'fr': 'France',
    'france': 'France',
    'de': 'Germany',
    'germany': 'Germany',
    'it': 'Italy',
    'italy': 'Italy',
    'br': 'Brazil',
    'brazil': 'Brazil',
    'ar': 'Argentina',
    'argentina': 'Argentina',
    'mx': 'Mexico',
    'mexico': 'Mexico',
    'ca': 'Canada',
    'canada': 'Canada',
    'au': 'Australia',
    'australia': 'Australia',
    'in': 'India',
    'india': 'India',
    'jp': 'Japan',
    'japan': 'Japan',
    'cn': 'China',
    'china': 'China',
} as const;

// ========== LANGUAGE CODE MAPPINGS ==========
export const CODE_TO_LANGUAGE: Record<string, string> = {
    us: 'English',
    uk: 'English',
    au: 'English',
    ca: 'English',
    za: 'English',
    es: 'Spanish',
    mx: 'Spanish',
    ar: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    br: 'Portuguese',
    ru: 'Russian',
    ae: 'Arabic',
    zh: 'Chinese',
    cn: 'Chinese',
    jp: 'Japanese',
    ja: 'Japanese',
    kr: 'Korean',
    in: 'Hindi',
} as const;

// ========== CATEGORY PATTERNS ==========
export const CATEGORY_PATTERNS: [RegExp, string][] = [
    [/\b(sports?|espn|bein|sky\s?sports|fox\s?sports|nbc\s?sports|cbs\s?sports|acc\s?network|bt\s?sport|tnt\s?sports|super\s?sport|cricket)\b/i, 'Sports'],
    [/\b(news|cnn|bbc|fox\s?news|msnbc|al\s?jazeera|reuters|bloomberg|cnbc|sky\s?news)\b/i, 'News'],
    [/\b(movie|cinema|film|hbo|showtime|starz|cinemax|amc|netflix)\b/i, 'Movies'],
    [/\b(music|mtv|vibe|vmusic|cmt|bet|vh1)\b/i, 'Music'],
    [/\b(kids?|cartoon|disney|nickelodeon|cartoon\s?network|pbs\s?kids|boomerang)\b/i, 'Kids'],
    [/\b(documentary|natgeo|national\s?geographic|discovery|history|science|animal\s?planet)\b/i, 'Documentary'],
    [/\b(comedy|reality|tlc|bravo|e!|entertainment|variety)\b/i, 'Entertainment'],
];

export function getSportsConfig() {
    return SPORTS_CONFIG;
}