// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from "next/link";
import Image from "next/image";
import { createTeamSlug } from '@/lib/api/team-normalization';

import {
    fetchAllMatches,
    getSportsCounts,
    getLiveMatches
} from "@/lib/api";
import type { Match, SportType } from "@/lib/api";

import {
    FaFire,
    FaClock,
    FaTv,
    FaPlay,
    FaFilter,
    FaSearch,
    FaTimes,
    FaChevronDown,
    FaCalendarDay,
    FaFutbol,
    FaBasketballBall,
    FaFootballBall,
    FaHockeyPuck,
    FaEye,
    FaHeart,
    FaPaypal
} from "react-icons/fa";

import Header from "@/components/Header";

// ========== TYPES ==========
type FilterStatus = 'all' | 'live' | 'upcoming';

// ========== HELPER FUNCTIONS ==========
const getSportIconSmall = (sport: string) => {
    const iconMap: Record<string, React.ReactNode> = {
        'SOCCER': <FaFutbol className="text-emerald-500 w-4 h-4" />,
        'NBA': <FaBasketballBall className="text-orange-500 w-4 h-4" />,
        'NFL': <FaFootballBall className="text-red-500 w-4 h-4" />,
        'NHL': <FaHockeyPuck className="text-blue-500 w-4 h-4" />,
    };
    return iconMap[sport] || <FaTv className="text-purple-500 w-4 h-4" />;
};

const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) {
        return "Live";
    } else if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
        return "Tomorrow";
    } else {
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }
};

const formatDateString = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

// ========== LOADING COMPONENT ==========
const LoadingSpinner = () => (
    <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-primary)' }}
    >
        <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading matches...</p>
        </div>
    </div>
);

// ========== NO DATA / SERVICE UNAVAILABLE STATE ==========
const NoDataState = ({ onRetry }: { onRetry: () => void }) => (
    <div
        className="text-center py-16 rounded-2xl shadow-sm"
        style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-primary)',
        }}
    >
        <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--warning-bg)' }}
        >
            <span className="text-4xl">🛠️</span>
        </div>
        <h3
            className="text-2xl font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
        >
            We&apos;re Working on the Games
        </h3>
        <p
            className="max-w-lg mx-auto mb-2 text-base"
            style={{ color: 'var(--text-secondary)' }}
        >
            Our team is currently updating the match schedule. Live games and upcoming fixtures will appear here shortly.
        </p>
        <p
            className="max-w-md mx-auto mb-8 text-sm"
            style={{ color: 'var(--text-muted)' }}
        >
            This usually takes just a few minutes. Thanks for your patience!
        </p>
        <div className="flex flex-wrap justify-center gap-4">
            <button
                onClick={onRetry}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-medium transition-colors shadow-md flex items-center gap-2"
            >
                <FaFire className="w-4 h-4" />
                Try Again
            </button>
            <Link
                href="/channels"
                className="px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                style={{
                    backgroundColor: 'var(--surface-primary)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-secondary)',
                }}
            >
                <FaTv className="w-4 h-4" />
                Browse Channels
            </Link>
        </div>
    </div>
);

// ========== EMPTY STATE COMPONENT ==========
const EmptyState = ({
    searchTerm,
    onReset
}: {
    searchTerm: string;
    onReset: () => void;
}) => (
    <div
        className="text-center py-12 rounded-xl shadow-sm"
        style={{
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-primary)',
        }}
    >
        <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface-secondary)' }}
        >
            <FaTv className="text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
        <h3
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
        >
            No Matches Found
        </h3>
        <p
            className="max-w-md mx-auto mb-6 text-sm"
            style={{ color: 'var(--text-secondary)' }}
        >
            {searchTerm
                ? `No matches found for "${searchTerm}"`
                : 'No matches match your current filters'}
        </p>
        <button
            onClick={onReset}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors shadow-md text-sm"
        >
            Reset All Filters
        </button>
    </div>
);

// ========== MATCH CARD COMPONENT ==========
const MatchCard = ({ match }: { match: Match }) => {
    const createMatchSlug = (match: Match): string => {
        try {
            const homeSlug = createTeamSlug(match.homeTeam);
            const awaySlug = createTeamSlug(match.awayTeam);
            const cleanTournament = match.tournament
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            return encodeURIComponent(`${homeSlug}-vs-${awaySlug}-${cleanTournament}`);
        } catch (error) {
            console.error('Error creating match slug:', error);
            return encodeURIComponent(
                `${match.gameID}-${match.tournament.toLowerCase().replace(/\s+/g, '-')}`
            );
        }
    };

    const matchSlug = createMatchSlug(match);

    return (
        <Link href={`/match/${matchSlug}`} className="block h-full">
            <div className="neumorphic-card group w-full overflow-hidden">

                {/* Card Header */}
                <div className="flex justify-between items-center mb-2.5 flex-shrink-0 w-full">
                    <div className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide flex-shrink-0 ${
                        match.status === 'live'
                            ? 'bg-red-500/15 text-red-600'
                            : match.status === 'upcoming'
                                ? 'bg-blue-500/15 text-blue-600'
                                : 'bg-gray-500/15 text-gray-500'
                    }`}>
                        {match.status === 'live' ? '● LIVE' :
                            match.status === 'upcoming' ? 'UPCOMING' : 'ENDED'}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        <FaEye className="w-3 h-3" />
                        <span className="text-[11px]">{match.channels?.length || 0}</span>
                    </div>
                </div>

                {/* Teams Section */}
                <div className="flex items-center w-full mb-3 flex-shrink-0 overflow-hidden">
                    {/* Home Team */}
                    <div className="flex flex-col items-center overflow-hidden min-w-0" style={{ width: '35%', maxWidth: '35%' }}>
                        <div className="w-9 h-9 sm:w-11 sm:h-11 mb-1 flex-shrink-0">
                            <Image
                                src={match.homeTeamIMG || '/team-placeholder.svg'}
                                alt={match.homeTeam}
                                width={44}
                                height={44}
                                className="object-contain w-full h-full"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/team-placeholder.svg';
                                }}
                            />
                        </div>
                        <span
                            className="text-[10px] sm:text-[11px] font-bold text-center leading-tight w-full overflow-hidden"
                            style={{
                                color: 'var(--text-primary)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'break-all',
                                hyphens: 'auto',
                            }}
                            title={match.homeTeam}
                        >
                            {match.homeTeam}
                        </span>
                    </div>

                    {/* Score / Time */}
                    <div className="flex flex-col items-center flex-shrink-0 px-1" style={{ width: '30%', minWidth: '55px' }}>
                        <div className="text-[10px] mb-0.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {formatTime(match.start)}
                        </div>
                        {match.score && match.score.home !== undefined && match.score.away !== undefined ? (
                            <div
                                className="text-sm sm:text-base font-extrabold whitespace-nowrap"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {match.score.home} - {match.score.away}
                            </div>
                        ) : match.status === 'live' ? (
                            <div className="text-sm sm:text-base font-extrabold text-red-600 whitespace-nowrap animate-pulse">
                                LIVE
                            </div>
                        ) : (
                            <div
                                className="text-sm sm:text-base font-extrabold"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                VS
                            </div>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center overflow-hidden min-w-0" style={{ width: '35%', maxWidth: '35%' }}>
                        <div className="w-9 h-9 sm:w-11 sm:h-11 mb-1 flex-shrink-0">
                            <Image
                                src={match.awayTeamIMG || '/team-placeholder.svg'}
                                alt={match.awayTeam}
                                width={44}
                                height={44}
                                className="object-contain w-full h-full"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/team-placeholder.svg';
                                }}
                            />
                        </div>
                        <span
                            className="text-[10px] sm:text-[11px] font-bold text-center leading-tight w-full overflow-hidden"
                            style={{
                                color: 'var(--text-primary)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'break-all',
                                hyphens: 'auto',
                            }}
                            title={match.awayTeam}
                        >
                            {match.awayTeam}
                        </span>
                    </div>
                </div>

                {/* Tournament Info */}
                <div className="mb-2.5 flex-shrink-0 w-full overflow-hidden">
                    <div className="flex items-center justify-center gap-1.5 w-full overflow-hidden">
                        {match.countryIMG && (
                            <div className="w-4 h-3 relative flex-shrink-0">
                                <Image
                                    src={match.countryIMG}
                                    alt=""
                                    width={16}
                                    height={12}
                                    className="object-cover rounded-sm w-full h-full"
                                />
                            </div>
                        )}
                        <span className="text-[11px] truncate min-w-0" style={{ color: 'var(--text-muted)' }}>
                            {match.tournament}
                        </span>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div
                    className="flex items-center justify-between pt-2.5 mt-auto flex-shrink-0 w-full overflow-hidden"
                    style={{ borderTop: '1px solid var(--border-secondary)' }}
                >
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                        <span className="flex-shrink-0">{getSportIconSmall(match.sport)}</span>
                        <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                            {match.sport}
                        </span>
                    </div>
                    <button className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-[11px] font-semibold text-white transition-all duration-200 shadow-sm flex-shrink-0 whitespace-nowrap flex items-center gap-1">
                        <FaPlay className="w-2 h-2" />
                        Watch
                    </button>
                </div>
            </div>
        </Link>
    );
};

// ========== MAIN COMPONENT ==========
export default function Home() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSport, setSelectedSport] = useState<string>('all');
    const [selectedTournament, setSelectedTournament] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
    const [showDonateBanner, setShowDonateBanner] = useState(true);

    const paypalDonateUrl = `https://www.paypal.com/donate?business=txthkm1%40gmail.com&currency_code=USD&item_name=Support+BraveStream`;

    useEffect(() => {
        loadMatches();
    }, []);

    const loadMatches = async () => {
    try {
        setLoading(true);
        setError(null);

        console.log('🔄 Fetching matches...');
        const data = await fetchAllMatches();

        if (Array.isArray(data)) {
            // DEDUPLICATE: Extra safety check
            const uniqueData = data.filter((match, index, self) => 
                index === self.findIndex(m => m.gameID === match.gameID)
            );
            
            if (uniqueData.length !== data.length) {
                console.warn(`⚠️ Removed ${data.length - uniqueData.length} duplicate matches`);
            }
            
            console.log(`✅ Setting ${uniqueData.length} matches`);
            setMatches(uniqueData);
        } else {
            console.error('❌ fetchAllMatches did not return an array:', data);
            setMatches([]);
            setError('Invalid data received from server');
        }
    } catch (err) {
        console.error('💥 Error loading matches:', err);
        setError('Failed to load matches. Please try again.');
        setMatches([]);
    } finally {
        setLoading(false);
    }
};

    const tournaments = useMemo(() => {
        if (!Array.isArray(matches)) return [];
        const uniqueTournaments = new Set<string>();
        matches.forEach(match => {
            if (match?.tournament) uniqueTournaments.add(match.tournament);
        });
        return Array.from(uniqueTournaments).sort();
    }, [matches]);

    const dates = useMemo(() => {
        if (!Array.isArray(matches)) return [];
        const uniqueDates = new Set<string>();
        matches.forEach(match => {
            if (match?.start) uniqueDates.add(formatDateString(match.start));
        });
        return Array.from(uniqueDates).sort((a, b) =>
            new Date(a).getTime() - new Date(b).getTime()
        );
    }, [matches]);

    const filteredMatches = useMemo(() => {
        if (!Array.isArray(matches)) return [];

        return matches.filter(match => {
            if (!match) return false;

            const searchLower = searchTerm.toLowerCase();
            const searchMatch = searchTerm === '' ||
                match.homeTeam?.toLowerCase().includes(searchLower) ||
                match.awayTeam?.toLowerCase().includes(searchLower) ||
                match.tournament?.toLowerCase().includes(searchLower) ||
                match.country?.toLowerCase().includes(searchLower);

            const sportMatch = selectedSport === 'all' || match.sport === selectedSport;
            const tournamentMatch = selectedTournament === 'all' || match.tournament === selectedTournament;
            const dateMatch = selectedDate === 'all' ||
                (match.start && formatDateString(match.start) === selectedDate);
            const statusMatch = activeFilter === 'all' ||
                (activeFilter === 'live' && match.status === 'live') ||
                (activeFilter === 'upcoming' && match.status === 'upcoming');

            return searchMatch && sportMatch && tournamentMatch && dateMatch && statusMatch;
        });
    }, [matches, searchTerm, selectedSport, selectedTournament, selectedDate, activeFilter]);

    const liveMatches = useMemo(() => {
        if (!Array.isArray(matches)) return [];
        return getLiveMatches(matches);
    }, [matches]);

    const sportsCounts = useMemo(() => {
        if (!Array.isArray(matches)) return {} as Record<SportType, number>;
        return getSportsCounts(matches);
    }, [matches]);

    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setSelectedSport('all');
        setSelectedTournament('all');
        setSelectedDate('all');
        setActiveFilter('all');
    }, []);

    const hasActiveFilters = selectedSport !== 'all' ||
        selectedTournament !== 'all' ||
        selectedDate !== 'all' ||
        searchTerm !== '';

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-secondary)' }}>
            <Header />

            {/* ===== DONATION BANNER ===== */}
            {showDonateBanner && (
                <div className="w-full bg-gradient-to-r from-[#0070ba] via-[#003087] to-[#0070ba] relative" style={{ zIndex: 50 }}>
                    <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6">
                        <div className="flex items-center justify-center py-3 gap-3 sm:gap-4">
                            <FaHeart className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0 hidden sm:block" />
                            {/* ✅ FIXED — Added inline style to force white */}
                            <p
                                className="text-sm sm:text-base font-medium text-center"
                                style={{ color: '#ffffff' }}
                            >
                                Enjoy free streams? Help us keep going!
                            </p>
                            <a
                                href={paypalDonateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 font-bold text-sm sm:text-base px-5 py-2 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex-shrink-0"
                                style={{
                                    backgroundColor: '#ffc439',
                                    color: '#003087',
                                }}
                            >
                                <FaPaypal className="w-5 h-5" />
                                <span>Donate with PayPal</span>
                            </a>
                            <button
                                onClick={() => setShowDonateBanner(false)}
                                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 transition-colors p-1"
                                style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                                aria-label="Close donation banner"
                            >
                                <FaTimes className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Container */}
            <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-4">

                {/* Error Message */}
                {error && (
                    <div
                        className="mb-6 p-4 rounded-xl"
                        style={{
                            backgroundColor: 'var(--error-bg)',
                            border: '1px solid var(--brand-red)',
                            color: 'var(--error-text)',
                        }}
                    >
                        <p>{error}</p>
                        <button
                            onClick={loadMatches}
                            className="mt-2 text-sm underline hover:no-underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* NO DATA STATE */}
                {matches.length === 0 && !error ? (
                    <NoDataState onRetry={loadMatches} />
                ) : matches.length > 0 && (
                    <>
                        {/* Filter Bar */}
                        <div
                            className="mb-6 rounded-xl p-4 shadow-sm"
                            style={{
                                backgroundColor: 'var(--surface-primary)',
                                border: '1px solid var(--border-primary)',
                            }}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-wrap gap-2">
                                    {/* All Button */}
                                    <button
                                        onClick={() => setActiveFilter('all')}
                                        className={`px-3 py-2 text-sm sm:text-base rounded-lg transition-all ${
                                            activeFilter === 'all'
                                                ? 'bg-red-600 text-white shadow-md'
                                                : ''
                                        }`}
                                        style={activeFilter !== 'all' ? {
                                            backgroundColor: 'var(--surface-secondary)',
                                            color: 'var(--text-secondary)',
                                        } : undefined}
                                    >
                                        All ({matches.length})
                                    </button>

                                    {/* Live Button */}
                                    <button
                                        onClick={() => setActiveFilter('live')}
                                        className={`px-3 py-2 text-sm sm:text-base rounded-lg transition-all flex items-center gap-2 ${
                                            activeFilter === 'live'
                                                ? 'bg-red-600 text-white shadow-md'
                                                : ''
                                        }`}
                                        style={activeFilter !== 'live' ? {
                                            backgroundColor: 'var(--surface-secondary)',
                                            color: 'var(--text-secondary)',
                                        } : undefined}
                                    >
                                        <FaFire className="w-3 h-3 sm:w-4 sm:h-4" />
                                        Live ({liveMatches.length})
                                    </button>

                                    {/* Upcoming Button */}
                                    <button
                                        onClick={() => setActiveFilter('upcoming')}
                                        className={`px-3 py-2 text-sm sm:text-base rounded-lg transition-all flex items-center gap-2 ${
                                            activeFilter === 'upcoming'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : ''
                                        }`}
                                        style={activeFilter !== 'upcoming' ? {
                                            backgroundColor: 'var(--surface-secondary)',
                                            color: 'var(--text-secondary)',
                                        } : undefined}
                                    >
                                        <FaClock className="w-3 h-3 sm:w-4 sm:h-4" />
                                        Upcoming
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                                        style={{
                                            backgroundColor: 'var(--surface-secondary)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        <FaFilter className="w-3 h-3 sm:w-4 sm:h-4" />
                                        Filters
                                        <FaChevronDown className={`w-2 h-2 sm:w-3 sm:h-3 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                    </button>
                                    <button
                                        onClick={resetFilters}
                                        className="flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <FaTimes className="w-2 h-2 sm:w-3 sm:h-3" />
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {/* Advanced Filters */}
                            {showFilters && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Sport
                                        </label>
                                        <select
                                            value={selectedSport}
                                            onChange={(e) => setSelectedSport(e.target.value)}
                                            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            style={{
                                                backgroundColor: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                color: 'var(--input-text)',
                                            }}
                                        >
                                            <option value="all">All Sports</option>
                                            {Object.keys(sportsCounts).map((sport) => (
                                                <option key={sport} value={sport}>
                                                    {sport} ({sportsCounts[sport as SportType]})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            League/Cup
                                        </label>
                                        <select
                                            value={selectedTournament}
                                            onChange={(e) => setSelectedTournament(e.target.value)}
                                            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            style={{
                                                backgroundColor: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                color: 'var(--input-text)',
                                            }}
                                        >
                                            <option value="all">All Tournaments</option>
                                            {tournaments.map((tournament) => (
                                                <option key={tournament} value={tournament}>
                                                    {tournament}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Date
                                        </label>
                                        <select
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            style={{
                                                backgroundColor: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                color: 'var(--input-text)',
                                            }}
                                        >
                                            <option value="all">All Dates</option>
                                            {dates.map((date) => (
                                                <option key={date} value={date}>
                                                    {date}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Active Filters Display */}
                        {hasActiveFilters && (
                            <div className="mb-6">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {selectedSport !== 'all' && (
                                        <span
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                                            style={{
                                                backgroundColor: 'var(--surface-primary)',
                                                border: '1px solid var(--border-primary)',
                                                color: 'var(--text-secondary)',
                                            }}
                                        >
                                            {getSportIconSmall(selectedSport)}
                                            {selectedSport}
                                            <button
                                                onClick={() => setSelectedSport('all')}
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <FaTimes className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )}
                                    {selectedTournament !== 'all' && (
                                        <span
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                                            style={{
                                                backgroundColor: 'var(--surface-primary)',
                                                border: '1px solid var(--border-primary)',
                                                color: 'var(--text-secondary)',
                                            }}
                                        >
                                            <FaFutbol className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                            {selectedTournament}
                                            <button
                                                onClick={() => setSelectedTournament('all')}
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <FaTimes className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )}
                                    {selectedDate !== 'all' && (
                                        <span
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                                            style={{
                                                backgroundColor: 'var(--surface-primary)',
                                                border: '1px solid var(--border-primary)',
                                                color: 'var(--text-secondary)',
                                            }}
                                        >
                                            <FaCalendarDay className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                            {selectedDate}
                                            <button
                                                onClick={() => setSelectedDate('all')}
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <FaTimes className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )}
                                    {searchTerm && (
                                        <span
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                                            style={{
                                                backgroundColor: 'var(--surface-primary)',
                                                border: '1px solid var(--border-primary)',
                                                color: 'var(--text-secondary)',
                                            }}
                                        >
                                            <FaSearch className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                            &quot;{searchTerm}&quot;
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <FaTimes className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Showing {filteredMatches.length} of {matches.length} matches
                                </p>
                            </div>
                        )}

                        {/* Sports Quick Filter */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            <button
                                onClick={() => setSelectedSport('all')}
                                className={`px-3 py-2 text-sm rounded-lg transition-all ${
                                    selectedSport === 'all'
                                        ? 'bg-red-600 text-white shadow-md'
                                        : ''
                                }`}
                                style={selectedSport !== 'all' ? {
                                    backgroundColor: 'var(--surface-primary)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-primary)',
                                } : undefined}
                            >
                                All Sports
                            </button>
                            {Object.entries(sportsCounts).map(([sport, count]) => (
                                <button
                                    key={sport}
                                    onClick={() => setSelectedSport(sport)}
                                    className={`px-3 py-2 text-sm rounded-lg transition-all duration-300 flex items-center gap-2 ${
                                        selectedSport === sport
                                            ? 'bg-red-600 text-white shadow-md'
                                            : ''
                                    }`}
                                    style={selectedSport !== sport ? {
                                        backgroundColor: 'var(--surface-primary)',
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--border-primary)',
                                    } : undefined}
                                >
                                    {getSportIconSmall(sport)}
                                    <span className="font-medium">{sport}</span>
                                    <span
                                        className="text-xs px-1.5 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: selectedSport === sport
                                                ? 'rgba(255,255,255,0.3)'
                                                : 'var(--surface-secondary)',
                                        }}
                                    >
                                        {count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Matches Section */}
                        <section className="mb-12">
                            <div className="flex items-center justify-between mb-4">
                                <h2
                                    className="text-xl sm:text-2xl font-bold"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {activeFilter === 'all' ? 'All Matches' :
                                        activeFilter === 'live' ? 'Live Matches' : 'Upcoming Matches'}
                                    <span
                                        className="ml-2 px-2 py-1 text-xs sm:text-sm rounded-full"
                                        style={{
                                            backgroundColor: 'var(--error-bg)',
                                            color: 'var(--error-text)',
                                        }}
                                    >
                                        {filteredMatches.length}
                                    </span>
                                </h2>
                            </div>

                            {filteredMatches.length === 0 ? (
                                <EmptyState searchTerm={searchTerm} onReset={resetFilters} />
                            ) : (
                                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 md:gap-6">
                                    {filteredMatches.map((match) => (
                                        <MatchCard key={match.gameID} match={match} />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}