// src/lib/api.ts - Clean and Organized Version
export interface Channel {
    channel_name: string;
    channel_code: string;
    url: string;
    image: string;
    viewers: number;
}

export interface ApiChannel {
    name: string;
    code: string;
    url: string;
    image: string;
    status: string;
    viewers: number;
    category?: string;
    language?: string;
    country?: string;
}

export interface ChannelsResponse {
    total_channels: number;
    channels: ApiChannel[];
}

export type SportType = 'SOCCER' | 'NBA' | 'NFL' | 'NHL';
export type MatchStatus = 'live' | 'upcoming' | 'ended';

export interface Match {
    gameID: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamIMG: string;
    awayTeamIMG: string;
    time: string;
    tournament: string;
    country?: string;
    countryIMG?: string;
    status: MatchStatus;
    start: string;
    end: string;
    channels: Channel[];
    sport: SportType;
    league?: string;
    score?: {
        home: number;
        away: number;
    };
    highlight?: string;
}

export interface ApiResponse {
    "cdn-live-tv": {
        Soccer: Match[];
        NFL: Match[];
        NBA: Match[];
        NHL: Match[];
        total_events: number;
        total_events_soccer: number;
        total_events_nfl: number;
        total_events_nba: number;
        total_events_nhl: number;
        cached: boolean;
        timestamp: number;
    };
}

// API Endpoints
const SPORTS_API_URL = "https://api.cdn-live.tv/api/v1/events/sports/?user=cdnlivetv&plan=free";
const CHANNELS_API_URL = "https://api.cdn-live.tv/api/v1/channels/?user=cdnlivetv&plan=free";

// Sports configuration
const SPORTS_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
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
};

const CACHE_DURATION = 30; // seconds

// ========== UTILITY FUNCTIONS ==========
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                },
                cache: 'default'
            });

            clearTimeout(timeoutId);

            if (response.ok) return response;

            if (response.status >= 500 && i < retries - 1) {
                await new Promise(resolve =>
                    setTimeout(resolve, 1000 * Math.pow(2, i))
                );
                continue;
            }

            console.error(`HTTP ${response.status} for API`);
            return response;
        } catch (error: any) {
            console.error(`Attempt ${i + 1} failed:`, error.message);

            if (i === retries - 1) {
                console.error('Failed to fetch API after retries:', error);
                throw error;
            }
            await new Promise(resolve =>
                setTimeout(resolve, 1000 * Math.pow(2, i))
            );
        }
    }
    throw new Error('Max retries exceeded');
}



// ========== CHANNEL DATA TRANSFORMERS ==========
function transformChannelData(channel: any): ApiChannel {
    const defaultImage = "https://api.cdn-live.tv/api/v1/channels/images6318/default.png";

    // Ensure image URL is valid
    let imageUrl = channel.image || defaultImage;
    if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = defaultImage;
    }

    return {
        name: channel.name || "Unknown Channel",
        code: channel.code || "us",
        url: channel.url || "",
        image: imageUrl,
        status: channel.status || "offline",
        viewers: channel.viewers || 0,
        category: channel.category,
        language: channel.language,
        country: channel.country
    };
}

function extractCountryFromImage(imageUrl: string): string {
    try {
        if (!imageUrl || imageUrl.trim() === '') {
            return "International";
        }

        // Try to extract country from URL pattern
        const patterns = [
            /images6318\/([^\/]+)/i,
            /\/([a-z]{2}(?:-[a-z]+)?)\/[^\/]+\.(?:png|jpg|jpeg|webp|svg)/i
        ];

        let countryMatch = null;
        for (const pattern of patterns) {
            const match = imageUrl.match(pattern);
            if (match && match[1]) {
                countryMatch = match[1];
                break;
            }
        }

        if (countryMatch) {
            const countryCode = countryMatch.toLowerCase();

            // Country code to name mapping
            const countryMap: Record<string, string> = {
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
                'china': 'China'
            };

            if (countryMap[countryCode]) {
                return countryMap[countryCode];
            }

            // Convert hyphenated to proper case
            return countryCode.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        // Try to guess from common patterns
        if (imageUrl.includes('/us/')) return "United States";
        if (imageUrl.includes('/uk/')) return "United Kingdom";
        if (imageUrl.includes('/ca/')) return "Canada";
        if (imageUrl.includes('/au/')) return "Australia";

    } catch (error) {
        console.warn('Could not extract country from URL:', imageUrl);
    }

    return "International";
}

function extractCategoryFromName(name: string): string {
    if (!name) return "Entertainment";

    const lowerName = name.toLowerCase();

    // Sports
    const sportsKeywords = [
        'sports', 'sport', 'espn', 'bein', 'sky sports', 'fox sports',
        'nbc sports', 'cbs sports', 'acc network', 'bt sport', 'tnt sports',
        'super sport', 'supersport'
    ];
    if (sportsKeywords.some(keyword => lowerName.includes(keyword))) {
        return "Sports";
    }

    // News
    const newsKeywords = [
        'news', 'cnn', 'bbc', 'fox news', 'msnbc', 'al jazeera',
        'reuters', 'bloomberg', 'cnbc', 'sky news'
    ];
    if (newsKeywords.some(keyword => lowerName.includes(keyword))) {
        return "News";
    }

    // Movies
    const movieKeywords = [
        'movie', 'cinema', 'film', 'hbo', 'showtime', 'starz',
        'cinemax', 'amc', 'netflix'
    ];
    if (movieKeywords.some(keyword => lowerName.includes(keyword))) {
        return "Movies";
    }

    // Music
    const musicKeywords = [
        'music', 'mtv', 'vibe', 'vmusic', 'cmt', 'bet', 'vh1'
    ];
    if (musicKeywords.some(keyword => lowerName.includes(keyword))) {
        return "Music";
    }

    // Kids
    const kidsKeywords = [
        'kids', 'cartoon', 'disney', 'nickelodeon', 'cartoon network',
        'pbs kids', 'boomerang'
    ];
    if (kidsKeywords.some(keyword => lowerName.includes(keyword))) {
        return "Kids";
    }

    // Documentary
    const docKeywords = [
        'documentary', 'natgeo', 'national geographic', 'discovery',
        'history', 'science', 'animal planet'
    ];
    if (docKeywords.some(keyword => lowerName.includes(keyword))) {
        return "Documentary";
    }

    // Entertainment
    const entKeywords = [
        'comedy', 'reality', 'tlc', 'bravo', 'e!', 'entertainment',
        'variety', 'abc', 'cbs', 'nbc', 'fox'
    ];
    if (entKeywords.some(keyword => lowerName.includes(keyword))) {
        return "Entertainment";
    }

    return "Entertainment";
}

// ========== MATCH DATA TRANSFORMERS ==========
function transformMatchData(match: any, sport: SportType): Match {
    return {
        gameID: match.gameID,
        homeTeam: match.homeTeam || "TBD",
        awayTeam: match.awayTeam || "TBD",
        homeTeamIMG: match.homeTeamIMG || "https://api.cdn-live.tv/api/v1/team/logo.png",
        awayTeamIMG: match.awayTeamIMG || "https://api.cdn-live.tv/api/v1/team/logo.png",
        time: match.time || "00:00",
        tournament: match.tournament || "Unknown Tournament",
        country: match.country,
        countryIMG: match.countryIMG,
        status: (match.status?.toLowerCase() as MatchStatus) || 'upcoming',
        start: match.start,
        end: match.end,
        channels: match.channels || [],
        sport: sport,
        score: match.score || (match.status === 'live' ? { home: 0, away: 0 } : undefined)
    };
}

// ========== MAIN API FUNCTIONS ==========
export async function fetchAllMatches(): Promise<Match[]> {
    console.log('Fetching all sports from single endpoint...');

    try {
        const response = await fetchWithRetry(SPORTS_API_URL);

        if (!response.ok) {
            console.error(`API responded with ${response.status}: ${response.statusText}`);
            return getMockMatches(); // Fallback to mock data
        }

        const data: ApiResponse = await response.json();
        console.log('API response received');

        // Extract all matches from all sports
        const allMatches: Match[] = [];

        // Process Soccer matches
        if (data["cdn-live-tv"]?.Soccer) {
            const soccerMatches = data["cdn-live-tv"].Soccer.map(match =>
                transformMatchData(match, 'SOCCER')
            );
            allMatches.push(...soccerMatches);
            console.log(`Added ${soccerMatches.length} Soccer matches`);
        }

        // Process NBA matches
        if (data["cdn-live-tv"]?.NBA) {
            const nbaMatches = data["cdn-live-tv"].NBA.map(match =>
                transformMatchData(match, 'NBA')
            );
            allMatches.push(...nbaMatches);
            console.log(`Added ${nbaMatches.length} NBA matches`);
        }

        // Process NFL matches
        if (data["cdn-live-tv"]?.NFL) {
            const nflMatches = data["cdn-live-tv"].NFL.map(match =>
                transformMatchData(match, 'NFL')
            );
            allMatches.push(...nflMatches);
            console.log(`Added ${nflMatches.length} NFL matches`);
        }

        // Process NHL matches
        if (data["cdn-live-tv"]?.NHL) {
            const nhlMatches = data["cdn-live-tv"].NHL.map(match =>
                transformMatchData(match, 'NHL')
            );
            allMatches.push(...nhlMatches);
            console.log(`Added ${nhlMatches.length} NHL matches`);
        }

        console.log(`Total matches fetched: ${allMatches.length}`);

        // Enhanced sorting
        const sortedMatches = allMatches.sort((a, b) => {
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

        // Cache the results
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem('matches-cache', JSON.stringify(sortedMatches));
                sessionStorage.setItem('matches-timestamp', Date.now().toString());
            } catch (error) {
                console.warn('Cache write failed:', error);
            }
        }

        return sortedMatches;
    } catch (error) {
        console.error("Error fetching matches:", error);
        return getMockMatches(); // Fallback to mock data
    }
}

export async function fetchAllChannels(): Promise<ChannelsResponse> {
    console.log('Fetching all channels...');

    try {
        const response = await fetchWithRetry(CHANNELS_API_URL);

        if (!response.ok) {
            console.error(`Channels API responded with ${response.status}: ${response.statusText}`);
            return getMockChannels(); // Fallback to mock data
        }

        const data: ChannelsResponse = await response.json();
        console.log('Channels API response received');

        // Enhance channels with additional data
        const enhancedChannels = data.channels.map(channel => {
            const enhanced = transformChannelData(channel);

            // Add extracted information with better error handling
            try {
                enhanced.country = extractCountryFromImage(channel.image);
                enhanced.category = extractCategoryFromName(channel.name);

                // Determine language from country code or name
                if (channel.language) {
                    enhanced.language = channel.language;
                } else {
                    enhanced.language = enhanced.code === 'us' ? 'English' :
                        enhanced.code === 'es' ? 'Spanish' :
                            enhanced.code === 'fr' ? 'French' :
                                enhanced.code === 'de' ? 'German' :
                                    enhanced.code === 'it' ? 'Italian' :
                                        enhanced.code === 'pt' ? 'Portuguese' :
                                            enhanced.code === 'ru' ? 'Russian' :
                                                enhanced.code === 'ar' ? 'Arabic' :
                                                    enhanced.code === 'zh' ? 'Chinese' :
                                                        enhanced.code === 'ja' ? 'Japanese' :
                                                            'Various';
                }
            } catch (error) {
                console.error('Error enhancing channel data:', channel.name, error);
                // Set default values
                enhanced.country = enhanced.country || "International";
                enhanced.category = enhanced.category || "Entertainment";
                enhanced.language = enhanced.language || "Various";
            }

            return enhanced;
        });

        return {
            total_channels: data.total_channels,
            channels: enhancedChannels
        };
    } catch (error) {
        console.error("Error fetching channels:", error);
        return getMockChannels(); // Fallback to mock data
    }
}

// ========== CHANNEL UTILITY FUNCTIONS ==========
export async function fetchChannelsByCategory(category: string): Promise<ApiChannel[]> {
    const allChannels = await fetchAllChannels();
    return allChannels.channels.filter(channel =>
        channel.category?.toLowerCase() === category.toLowerCase()
    );
}

export async function fetchChannelsByCountry(country: string): Promise<ApiChannel[]> {
    const allChannels = await fetchAllChannels();
    return allChannels.channels.filter(channel =>
        channel.country?.toLowerCase().includes(country.toLowerCase())
    );
}

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

export function getChannelCategories(channels: ApiChannel[]): string[] {
    const categories = new Set<string>();
    channels.forEach(channel => {
        if (channel.category) {
            categories.add(channel.category);
        }
    });
    return Array.from(categories).sort();
}

export function getChannelCountries(channels: ApiChannel[]): string[] {
    const countries = new Set<string>();
    channels.forEach(channel => {
        if (channel.country) {
            countries.add(channel.country);
        }
    });
    return Array.from(countries).sort();
}

export function getChannelLanguages(channels: ApiChannel[]): string[] {
    const languages = new Set<string>();
    channels.forEach(channel => {
        if (channel.language) {
            languages.add(channel.language);
        }
    });
    return Array.from(languages).sort();
}

export function getTopChannelsByViewers(channels: ApiChannel[], limit = 10): ApiChannel[] {
    return [...channels]
        .sort((a, b) => b.viewers - a.viewers)
        .slice(0, limit);
}

export function getOnlineChannels(channels: ApiChannel[]): ApiChannel[] {
    return channels.filter(channel => channel.status === 'online');
}

// ========== MATCH UTILITY FUNCTIONS ==========
export function filterMatchesBySport(matches: Match[], sport: SportType): Match[] {
    return matches.filter(match => match.sport === sport);
}

export function getLiveMatches(matches: Match[]): Match[] {
    return matches.filter(match => match.status === 'live');
}

export function getUpcomingMatches(matches: Match[]): Match[] {
    const now = new Date();
    return matches.filter(match =>
        match.status === 'upcoming' &&
        new Date(match.start) > now
    );
}

export function getMatchesByTeam(matches: Match[], teamName: string): Match[] {
    const searchTerm = teamName.toLowerCase();
    return matches.filter(match =>
        match.homeTeam.toLowerCase().includes(searchTerm) ||
        match.awayTeam.toLowerCase().includes(searchTerm)
    );
}

export function getSportsCounts(matches: Match[]): Record<SportType, number> {
    const counts = {} as Record<SportType, number>;
    matches.forEach(match => {
        counts[match.sport] = (counts[match.sport] || 0) + 1;
    });
    return counts;
}

export function getFeaturedMatches(matches: Match[], limit = 4): Match[] {
    return matches
        .filter(match => match.status === 'live' || match.channels.length > 0)
        .slice(0, limit);
}

export function getSportsConfig() {
    return SPORTS_CONFIG;
}

// ========== MOCK DATA ==========
function getMockChannels(): ChannelsResponse {
    console.log('Using mock channels data');

    const mockChannels: ApiChannel[] = [
        {
            name: "ABC",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=abc&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/abc.png",
            status: "online",
            viewers: 125,
            category: "Entertainment",
            language: "English",
            country: "United States"
        },
        {
            name: "ACC Network",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=acc+network&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/acc-network.png",
            status: "online",
            viewers: 89,
            category: "Sports",
            language: "English",
            country: "United States"
        },
        {
            name: "beIN SPORTS",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=bein+sports&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/bein-sports.webp",
            status: "online",
            viewers: 318,
            category: "Sports",
            language: "English",
            country: "United States"
        },
        {
            name: "SuperSport Variety 1",
            code: "za",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=supersport+variety+1&code=za&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/south-africa/supersport-variety-1.webp",
            status: "online",
            viewers: 42,
            category: "Sports",
            language: "English",
            country: "South Africa"
        },
        {
            name: "ESPN",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/espn.png",
            status: "online",
            viewers: 256,
            category: "Sports",
            language: "English",
            country: "United States"
        },
        {
            name: "Sky Sports",
            code: "uk",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=sky+sports&code=uk&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-kingdom/sky-sports.png",
            status: "online",
            viewers: 189,
            category: "Sports",
            language: "English",
            country: "United Kingdom"
        }
    ];

    return {
        total_channels: mockChannels.length,
        channels: mockChannels
    };
}

function getMockMatches(): Match[] {
    console.log('Using mock matches data');

    const mockMatches: Match[] = [
        {
            gameID: '0YcqUK97',
            homeTeam: 'Egypt',
            awayTeam: 'Benin',
            homeTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            awayTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            time: '16:00',
            tournament: 'Africa Cup of Nations',
            country: 'Africa',
            countryIMG: 'https://i.ibb.co/V0wcngL7/world-b7d16db.png',
            status: 'live',
            start: '2026-01-05 16:00',
            end: '2026-01-05 18:39',
            channels: [
                {
                    channel_name: 'beIN SPORTS',
                    channel_code: 'us',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=bein+sports&code=us&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/united-states/bein-sports.webp',
                    viewers: 318
                }
            ],
            sport: 'SOCCER'
        },
        {
            gameID: 'TMYZU5Db',
            homeTeam: 'Detroit Pistons',
            awayTeam: 'New York Knicks',
            homeTeamIMG: 'https://api.cdn-live.tv/api/v1/team/images/3424.png',
            awayTeamIMG: 'https://api.cdn-live.tv/api/v1/team/images/3421.png',
            time: '00:00',
            tournament: 'NBA',
            country: 'United States',
            countryIMG: 'https://flagcdn.com/w40/us.png',
            status: 'upcoming',
            start: '2026-01-06 00:00',
            end: '2026-01-06 02:40',
            channels: [
                {
                    channel_name: 'SuperSport Variety 1',
                    channel_code: 'za',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=supersport+variety+1&code=za&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/south-africa/supersport-variety-1.webp',
                    viewers: 0
                }
            ],
            sport: 'NBA'
        }
    ];

    return mockMatches;
}

// ========== NEW FEATURES ==========
// Get matches that are live and have the most viewers
export function getPopularLiveMatches(matches: Match[]): Match[] {
    return matches
        .filter(match => match.status === 'live')
        .sort((a, b) => {
            const aViewers = a.channels.reduce((sum, ch) => sum + ch.viewers, 0);
            const bViewers = b.channels.reduce((sum, ch) => sum + ch.viewers, 0);
            return bViewers - aViewers;
        });
}

// Get matches starting soon (within next hour)
export function getMatchesStartingSoon(matches: Match[]): Match[] {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    return matches.filter(match => {
        const matchStart = new Date(match.start);
        return match.status === 'upcoming' &&
            matchStart > now &&
            matchStart <= oneHourFromNow;
    });
}

// Group channels by country for easier filtering
export function groupChannelsByCountry(channels: ApiChannel[]): Record<string, ApiChannel[]> {
    const grouped: Record<string, ApiChannel[]> = {};

    channels.forEach(channel => {
        const country = channel.country || 'Unknown';
        if (!grouped[country]) {
            grouped[country] = [];
        }
        grouped[country].push(channel);
    });

    return grouped;
}

// Filter matches by multiple criteria
export function filterMatches(
    matches: Match[],
    filters: {
        sport?: SportType;
        status?: MatchStatus;
        tournament?: string;
        team?: string;
        date?: Date;
    }
): Match[] {
    return matches.filter(match => {
        if (filters.sport && match.sport !== filters.sport) return false;
        if (filters.status && match.status !== filters.status) return false;
        if (filters.tournament && match.tournament !== filters.tournament) return false;
        if (filters.team) {
            const teamLower = filters.team.toLowerCase();
            if (!match.homeTeam.toLowerCase().includes(teamLower) &&
                !match.awayTeam.toLowerCase().includes(teamLower)) {
                return false;
            }
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