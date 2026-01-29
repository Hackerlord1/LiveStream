// src/lib/api/mock-data.ts

import { logger } from './logger';
import type { ApiChannel, ChannelsResponse, Match } from './types';

/**
 * Get mock channels data for fallback
 */
export function getMockChannels(): ChannelsResponse {
    logger.info('Using mock channels data');

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
            name: "SuperSport Cricket",
            code: "za",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=supersport+cricket&code=za&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/south-africa/supersport-cricket.webp",
            status: "online",
            viewers: 42,
            category: "Sports",
            language: "English",
            country: "South Africa"
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
        },
        {
            name: "CNN",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=cnn&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/cnn.png",
            status: "online",
            viewers: 156,
            category: "News",
            language: "English",
            country: "United States"
        },
        {
            name: "HBO",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=hbo&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/hbo.png",
            status: "online",
            viewers: 234,
            category: "Movies",
            language: "English",
            country: "United States"
        },
        {
            name: "Discovery Channel",
            code: "us",
            url: "https://cdn-live.tv/api/v1/channels/player/?name=discovery&code=us&user=cdnlivetv&plan=free",
            image: "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/discovery.png",
            status: "online",
            viewers: 98,
            category: "Documentary",
            language: "English",
            country: "United States"
        }
    ];

    return {
        total_channels: mockChannels.length,
        channels: mockChannels
    };
}

/**
 * Get mock matches data for fallback
 */
export function getMockMatches(): Match[] {
    logger.info('Using mock matches data');

    const now = new Date();
    const formatDate = (date: Date): string => {
        return date.toISOString().slice(0, 16).replace('T', ' ');
    };

    // Create dynamic mock data based on current time
    const liveMatchStart = new Date(now.getTime() - 45 * 60 * 1000); // Started 45 min ago
    const liveMatchEnd = new Date(now.getTime() + 60 * 60 * 1000); // Ends in 1 hour
    
    const upcomingMatch1Start = new Date(now.getTime() + 2 * 60 * 60 * 1000); // In 2 hours
    const upcomingMatch1End = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    
    const upcomingMatch2Start = new Date(now.getTime() + 5 * 60 * 60 * 1000); // In 5 hours
    const upcomingMatch2End = new Date(now.getTime() + 7 * 60 * 60 * 1000);

    const mockMatches: Match[] = [
        {
            gameID: 'mock-soccer-1',
            homeTeam: 'Manchester United',
            awayTeam: 'Liverpool',
            homeTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            awayTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            time: '45\'',
            tournament: 'Premier League',
            country: 'England',
            countryIMG: 'https://flagcdn.com/w40/gb.png',
            status: 'live',
            start: formatDate(liveMatchStart),
            end: formatDate(liveMatchEnd),
            channels: [
                {
                    channel_name: 'Sky Sports',
                    channel_code: 'uk',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=sky+sports&code=uk&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/united-kingdom/sky-sports.png',
                    viewers: 1250
                },
                {
                    channel_name: 'beIN SPORTS',
                    channel_code: 'us',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=bein+sports&code=us&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/united-states/bein-sports.webp',
                    viewers: 856
                }
            ],
            sport: 'SOCCER',
            score: { home: 2, away: 1 }
        },
        {
            gameID: 'mock-nba-1',
            homeTeam: 'Los Angeles Lakers',
            awayTeam: 'Golden State Warriors',
            homeTeamIMG: 'https://api.cdn-live.tv/api/v1/team/images/3424.png',
            awayTeamIMG: 'https://api.cdn-live.tv/api/v1/team/images/3421.png',
            time: '20:00',
            tournament: 'NBA',
            country: 'United States',
            countryIMG: 'https://flagcdn.com/w40/us.png',
            status: 'upcoming',
            start: formatDate(upcomingMatch1Start),
            end: formatDate(upcomingMatch1End),
            channels: [
                {
                    channel_name: 'ESPN',
                    channel_code: 'us',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/united-states/espn.png',
                    viewers: 0
                }
            ],
            sport: 'NBA'
        },
        {
            gameID: 'mock-soccer-2',
            homeTeam: 'Real Madrid',
            awayTeam: 'Barcelona',
            homeTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            awayTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            time: '21:00',
            tournament: 'La Liga',
            country: 'Spain',
            countryIMG: 'https://flagcdn.com/w40/es.png',
            status: 'upcoming',
            start: formatDate(upcomingMatch2Start),
            end: formatDate(upcomingMatch2End),
            channels: [
                {
                    channel_name: 'beIN SPORTS',
                    channel_code: 'us',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=bein+sports&code=us&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/united-states/bein-sports.webp',
                    viewers: 0
                }
            ],
            sport: 'SOCCER'
        },
        {
            gameID: 'mock-nfl-1',
            homeTeam: 'Kansas City Chiefs',
            awayTeam: 'San Francisco 49ers',
            homeTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            awayTeamIMG: 'https://api.cdn-live.tv/api/v1/team/logo.png',
            time: '18:30',
            tournament: 'NFL',
            country: 'United States',
            countryIMG: 'https://flagcdn.com/w40/us.png',
            status: 'upcoming',
            start: formatDate(upcomingMatch1Start),
            end: formatDate(upcomingMatch1End),
            channels: [
                {
                    channel_name: 'ESPN',
                    channel_code: 'us',
                    url: 'https://cdn-live.tv/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free',
                    image: 'https://api.cdn-live.tv/api/v1/channels/images6318/united-states/espn.png',
                    viewers: 0
                }
            ],
            sport: 'NFL'
        }
    ];

    return mockMatches;
}