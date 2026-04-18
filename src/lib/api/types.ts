// src/lib/api/types.ts

// ========== CHANNEL TYPES ==========
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
    status: ChannelStatus;
    viewers: number;
    category?: string;
    language?: string;
    country?: string;
}

export type ChannelStatus = 'online' | 'offline';

export interface ChannelsResponse {
    total_channels: number;
    channels: ApiChannel[];
}

// ========== MATCH TYPES ==========
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

// ========== API RESPONSE TYPES ==========
export interface SportsData {
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
}

export interface ApiResponse {
    "cdnlivetv.tv": SportsData;
}

// ========== FILTER TYPES ==========
export interface MatchFilters {
    sport?: SportType;
    status?: MatchStatus;
    tournament?: string;
    team?: string;
    date?: Date;
}

// ========== CACHE TYPES ==========
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// ========== RAW API TYPES (for transformation) ==========
export interface RawChannel {
    name?: string;
    code?: string;
    url?: string;
    image?: string;
    status?: string;
    viewers?: number;
    category?: string;
    language?: string;
    country?: string;
}

export interface RawMatch {
    gameID: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamIMG?: string;
    awayTeamIMG?: string;
    time?: string;
    tournament?: string;
    country?: string;
    countryIMG?: string;
    status?: string;
    start: string;
    end: string;
    channels?: Channel[];
    score?: {
        home: number;
        away: number;
    };
}