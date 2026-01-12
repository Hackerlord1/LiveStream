// src/app/page.tsx - Fixed Container Layout
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from "next/link";
import Image from "next/image";
import { Match, fetchAllMatches, getSportsCounts, getLiveMatches } from "@/lib/api";
import { FaFire, FaClock, FaTv, FaUsers, FaStar, FaPlay, FaCalendarAlt, FaFilter, FaSearch, FaTimes, FaChevronDown, FaCalendarDay, FaFutbol, FaBasketballBall, FaFootballBall, FaHockeyPuck, FaEye } from "react-icons/fa";
import { GiSoccerBall, GiBasketballBall, GiAmericanFootballBall, GiHockey } from "react-icons/gi";
import Header from "@/components/Header";

export default function Home() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSport, setSelectedSport] = useState<string>('all');
    const [selectedTournament, setSelectedTournament] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming'>('all');

    // Initialize matches
    useEffect(() => {
        loadMatches();
    }, []);

    const loadMatches = async () => {
        try {
            setLoading(true);
            const data = await fetchAllMatches();
            setMatches(data);
        } catch (error) {
            console.error('Error loading matches:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get unique tournaments
    const tournaments = useMemo(() => {
        const uniqueTournaments = new Set<string>();
        matches.forEach(match => {
            if (match.tournament) uniqueTournaments.add(match.tournament);
        });
        return Array.from(uniqueTournaments).sort();
    }, [matches]);

    // Get unique dates
    const dates = useMemo(() => {
        const uniqueDates = new Set<string>();
        matches.forEach(match => {
            const date = new Date(match.start);
            const dateString = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            uniqueDates.add(dateString);
        });
        return Array.from(uniqueDates).sort((a, b) => {
            return new Date(a).getTime() - new Date(b).getTime();
        });
    }, [matches]);

    // Filter matches
    const filteredMatches = useMemo(() => {
        return matches.filter(match => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const searchMatch = searchTerm === '' ||
                match.homeTeam.toLowerCase().includes(searchLower) ||
                match.awayTeam.toLowerCase().includes(searchLower) ||
                match.tournament.toLowerCase().includes(searchLower) ||
                match.country?.toLowerCase().includes(searchLower);

            // Sport filter
            const sportMatch = selectedSport === 'all' || match.sport === selectedSport;

            // Tournament filter
            const tournamentMatch = selectedTournament === 'all' || match.tournament === selectedTournament;

            // Date filter
            const dateMatch = selectedDate === 'all' ||
                new Date(match.start).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                }) === selectedDate;

            // Status filter
            const statusMatch = activeFilter === 'all' ||
                (activeFilter === 'live' && match.status === 'live') ||
                (activeFilter === 'upcoming' && match.status === 'upcoming');

            return searchMatch && sportMatch && tournamentMatch && dateMatch && statusMatch;
        });
    }, [matches, searchTerm, selectedSport, selectedTournament, selectedDate, activeFilter]);

    // Live matches
    const liveMatches = useMemo(() => {
        return getLiveMatches(matches);
    }, [matches]);

    // Sports counts
    const sportsCounts = useMemo(() => {
        return getSportsCounts(matches);
    }, [matches]);

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffHours < 48) {
            return "Tomorrow";
        } else {
            return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        }
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedSport('all');
        setSelectedTournament('all');
        setSelectedDate('all');
        setActiveFilter('all');
    };

    const getSportIconSmall = (sport: string) => {
        switch (sport) {
            case 'SOCCER': return <FaFutbol className="text-emerald-500 w-4 h-4" />;
            case 'NBA': return <FaBasketballBall className="text-orange-500 w-4 h-4" />;
            case 'NFL': return <FaFootballBall className="text-red-500 w-4 h-4" />;
            case 'NHL': return <FaHockeyPuck className="text-blue-500 w-4 h-4" />;
            default: return <FaTv className="text-purple-500 w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#e8e8e8] text-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-700">Loading matches...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            {/* Main Container with proper padding */}
            <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-4">
                {/* Hero Section - Now properly contained */}

                {/* Filter Bar - Now properly contained */}
                <div className="mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveFilter('all')}
                                className={`px-3 py-2 text-sm sm:text-base rounded-lg transition-all ${activeFilter === 'all' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                All ({matches.length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('live')}
                                className={`px-3 py-2 text-sm sm:text-base rounded-lg transition-all flex items-center gap-2 ${activeFilter === 'live' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                <FaFire className="w-3 h-3 sm:w-4 sm:h-4" />
                                Live ({liveMatches.length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('upcoming')}
                                className={`px-3 py-2 text-sm sm:text-base rounded-lg transition-all flex items-center gap-2 ${activeFilter === 'upcoming' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                <FaClock className="w-3 h-3 sm:w-4 sm:h-4" />
                                Upcoming
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
                            >
                                <FaFilter className="w-3 h-3 sm:w-4 sm:h-4" />
                                Filters
                                {showFilters ? <FaChevronDown className="w-2 h-2 sm:w-3 sm:h-3 transform rotate-180" /> : <FaChevronDown className="w-2 h-2 sm:w-3 sm:h-3" />}
                            </button>
                            <button
                                onClick={resetFilters}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <FaTimes className="w-2 h-2 sm:w-3 sm:h-3" />
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Advanced Filters - Responsive */}
                    {showFilters && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
                                <select
                                    value={selectedSport}
                                    onChange={(e) => setSelectedSport(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                >
                                    <option value="all">All Sports</option>
                                    {Object.keys(sportsCounts).map((sport) => (
                                        <option key={sport} value={sport}>
                                            {sport} ({sportsCounts[sport as keyof typeof sportsCounts]})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">League/Cup</label>
                                <select
                                    value={selectedTournament}
                                    onChange={(e) => setSelectedTournament(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <select
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                {(selectedSport !== 'all' || selectedTournament !== 'all' || selectedDate !== 'all' || searchTerm) && (
                    <div className="mb-6">
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedSport !== 'all' && (
                                <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                    {getSportIconSmall(selectedSport)}
                                    {selectedSport}
                                    <button onClick={() => setSelectedSport('all')} className="text-gray-500 hover:text-gray-900">
                                        <FaTimes className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {selectedTournament !== 'all' && (
                                <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                    <FaFutbol className="w-3 h-3 text-gray-500" />
                                    {selectedTournament}
                                    <button onClick={() => setSelectedTournament('all')} className="text-gray-500 hover:text-gray-900">
                                        <FaTimes className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {selectedDate !== 'all' && (
                                <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                    <FaCalendarDay className="w-3 h-3 text-gray-500" />
                                    {selectedDate}
                                    <button onClick={() => setSelectedDate('all')} className="text-gray-500 hover:text-gray-900">
                                        <FaTimes className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {searchTerm && (
                                <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                    <FaSearch className="w-3 h-3 text-gray-500" />
                                    "{searchTerm}"
                                    <button onClick={() => setSearchTerm('')} className="text-gray-500 hover:text-gray-900">
                                        <FaTimes className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600">
                            Showing {filteredMatches.length} of {matches.length} matches
                        </p>
                    </div>
                )}

                {/* Sports Quick Filter */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setSelectedSport('all')}
                        className={`px-3 py-2 text-sm rounded-lg transition-all ${selectedSport === 'all' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'}`}
                    >
                        All Sports
                    </button>
                    {Object.entries(sportsCounts).map(([sport, count]) => (
                        <button
                            key={sport}
                            onClick={() => setSelectedSport(sport)}
                            className={`px-3 py-2 text-sm rounded-lg transition-all duration-300 flex items-center gap-2 ${selectedSport === sport ? 'bg-red-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'}`}
                        >
                            {getSportIconSmall(sport)}
                            <span className="font-medium">{sport}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedSport === sport ? 'bg-white/30' : 'bg-gray-200'}`}>
                                {count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* All Matches Section with Uiverse-style cards */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                            {activeFilter === 'all' ? 'All Matches' : activeFilter === 'live' ? 'Live Matches' : 'Upcoming Matches'}
                            <span className="ml-2 px-2 py-1 text-xs sm:text-sm bg-red-100 text-red-700 rounded-full">
                                {filteredMatches.length}
                            </span>
                        </h2>
                    </div>

                    {filteredMatches.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-gray-300 shadow-sm">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                <FaTv className="text-2xl text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900">No Matches Found</h3>
                            <p className="text-gray-600 max-w-md mx-auto mb-6 text-sm">
                                {searchTerm ? `No matches found for "${searchTerm}"` : 'No matches match your current filters'}
                            </p>
                            <button
                                onClick={resetFilters}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors shadow-md text-sm"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 md:gap-6">
                            {filteredMatches.map((match) => (
                                <Link href={`/match/${match.gameID}`} key={match.gameID} className="block">
                                    {/* Uiverse.io Card Design - Now responsive */}
                                    <div className="neumorphic-card group">
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                                                match.status === 'live' ? 'bg-red-500/20 text-red-700' :
                                                    match.status === 'upcoming' ? 'bg-blue-500/20 text-blue-700' :
                                                        'bg-gray-500/20 text-gray-700'
                                            }`}>
                                                {match.status === 'live' ? 'LIVE' :
                                                    match.status === 'upcoming' ? 'UPCOMING' : 'ENDED'}
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-600">
                                                <FaEye className="w-3 h-3" />
                                                <span className="text-xs">{match.channels.length}</span>
                                            </div>
                                        </div>

                                        {/* Teams Section */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex flex-col items-center flex-1">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 mb-1 sm:mb-2">
                                                    <Image
                                                        src={match.homeTeamIMG}
                                                        alt={match.homeTeam}
                                                        width={48}
                                                        height={48}
                                                        className="object-contain w-full h-full"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.src = '/team-placeholder.svg';
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-900 text-center truncate w-full px-1">
                                                    {match.homeTeam}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-center mx-2">
                                                <div className="text-xs text-gray-500 mb-1">
                                                    {formatTime(match.start)}
                                                </div>
                                                {match.score ? (
                                                    <div className="text-base sm:text-lg font-bold text-gray-900">
                                                        {match.score.home} - {match.score.away}
                                                    </div>
                                                ) : (
                                                    <div className="text-base sm:text-lg font-bold text-gray-900">VS</div>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-center flex-1">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 mb-1 sm:mb-2">
                                                    <Image
                                                        src={match.awayTeamIMG}
                                                        alt={match.awayTeam}
                                                        width={48}
                                                        height={48}
                                                        className="object-contain w-full h-full"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.src = '/team-placeholder.svg';
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-900 text-center truncate w-full px-1">
                                                    {match.awayTeam}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Tournament Info */}
                                        <div className="mb-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {match.countryIMG && (
                                                    <div className="w-4 h-3 sm:w-5 sm:h-4">
                                                        <Image
                                                            src={match.countryIMG}
                                                            alt=""
                                                            width={20}
                                                            height={16}
                                                            className="object-cover rounded w-full h-full"
                                                        />
                                                    </div>
                                                )}
                                                <span className="text-xs text-gray-700 truncate max-w-[120px] sm:max-w-[140px]">
                                                    {match.tournament}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Sport and Action Section */}
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-300">
                                            <div className="flex items-center gap-1">
                                                {getSportIconSmall(match.sport)}
                                                <span className="text-xs text-gray-600 ml-1">{match.sport}</span>
                                            </div>
                                            <button className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold text-white transition-all duration-300 shadow-sm hover:shadow-md group-hover:scale-105">
                                                <FaPlay className="inline mr-1" /> Watch
                                            </button>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Footer */}
                <footer className="bg-white rounded-xl border border-gray-300 mt-8 p-6">
                    <div className="text-center">
                        <div className="mb-4">
                            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                BraveStream
                            </span>
                        </div>
                        <p className="text-gray-600 text-sm">
                            © {new Date().getFullYear()} BraveStream. All rights reserved.
                        </p>
                        <p className="text-xs text-gray-500 mt-3">
                            Just click & play. Watch HD sports events from around the world.
                        </p>
                    </div>
                </footer>
            </div>

            {/* Add global styles for the neumorphic cards */}
            <style jsx global>{`
                /* Ensure proper container behavior */
                .container {
                    max-width: 100%;
                    width: 100%;
                }

                /* Responsive grid breakpoints */
                @media (min-width: 375px) {
                    .xs\\:grid-cols-2 {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                /* Uiverse.io neumorphic card - responsive */
                .neumorphic-card {
                    background: #e0e0e0;
                    border-radius: 20px;
                    padding: 16px;
                    box-shadow: 8px 8px 16px #bebebe,
                                -8px -8px 16px #ffffff;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    min-height: 180px;
                    display: flex;
                    flex-direction: column;
                }

                /* Hover effect */
                .neumorphic-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 12px 12px 24px #bebebe,
                                -12px -12px 24px #ffffff;
                }

                /* Make sure text doesn't overflow */
                .neumorphic-card * {
                    max-width: 100%;
                }

                /* Ensure images stay within bounds */
                .neumorphic-card img {
                    max-width: 100%;
                    height: auto;
                    object-fit: contain;
                }

                /* Responsive adjustments */
                @media (min-width: 640px) {
                    .neumorphic-card {
                        padding: 20px;
                        min-height: 200px;
                    }
                }

                @media (min-width: 768px) {
                    .neumorphic-card {
                        min-height: 220px;
                    }
                }

                /* Fix for text truncation */
                .truncate {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* Ensure grid items stay within container */
                .grid > * {
                    min-width: 0;
                }
            `}</style>
        </div>
    );
}