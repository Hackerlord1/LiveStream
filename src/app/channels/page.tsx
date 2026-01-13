'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import {
    FaSearch,
    FaFilter,
    FaTimes,
    FaChevronDown,
    FaEye,
    FaGlobe,
    FaLanguage,
    FaTv,
    FaPlay,
    FaStar,
    FaSignal,
    FaHeart,
    FaFire,
    FaCrown,
    FaWifi,
    FaBroadcastTower,
    FaHistory,
    FaRandom,
    FaBookmark,
    FaArrowRight,
    FaUserFriends,
    FaChartLine
} from 'react-icons/fa';
import {
    ApiChannel,
    fetchAllChannels,
    getChannelCategories,
    getChannelCountries,
    getChannelLanguages,
    getTopChannelsByViewers,
    getOnlineChannels,
    searchChannels,
    groupChannelsByCountry
} from '@/lib/api';

export default function ChannelsPage() {
    const router = useRouter();
    const [channels, setChannels] = useState<ApiChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedCountry, setSelectedCountry] = useState<string>('all');
    const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'viewers' | 'country' | 'recent' | 'favorites' | 'trending'>('viewers');
    const [favoriteChannels, setFavoriteChannels] = useState<string[]>([]);
    const [searchResults, setSearchResults] = useState<ApiChannel[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSearching, setIsSearching] = useState(false);
    const [showTrending, setShowTrending] = useState(false);

    // Initialize channels and load user data
    useEffect(() => {
        loadChannels();
        loadUserData();
    }, []);

    const loadChannels = async () => {
        try {
            setLoading(true);
            const data = await fetchAllChannels();
            setChannels(data.channels);
            setSearchResults(data.channels); // Initialize search results
        } catch (error) {
            console.error('Error loading channels:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserData = () => {
        // Load favorites from localStorage
        const savedFavorites = localStorage.getItem('favorite-channels');
        if (savedFavorites) {
            setFavoriteChannels(JSON.parse(savedFavorites));
        }

        // Load recently viewed
        const savedRecent = localStorage.getItem('recently-viewed-channels');
        if (savedRecent) {
            setRecentlyViewed(JSON.parse(savedRecent));
        }
    };

    // Get unique values for filters
    const categories = useMemo(() => {
        return getChannelCategories(channels);
    }, [channels]);

    const countries = useMemo(() => {
        return getChannelCountries(channels);
    }, [channels]);

    const languages = useMemo(() => {
        return getChannelLanguages(channels);
    }, [channels]);

    // Search functionality
    useEffect(() => {
        const search = async () => {
            if (searchTerm.trim() === '') {
                setSearchResults(channels);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchChannels(searchTerm);
                setSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults(channels);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(search, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchTerm, channels]);

    // Get channels by category for quick access
    const sportsChannels = useMemo(() => {
        return channels.filter(ch => ch.category === 'Sports').slice(0, 8);
    }, [channels]);

    const newsChannels = useMemo(() => {
        return channels.filter(ch => ch.category === 'News').slice(0, 8);
    }, [channels]);

    const entertainmentChannels = useMemo(() => {
        return channels.filter(ch => ch.category === 'Entertainment').slice(0, 8);
    }, [channels]);

    // Get top channels for featured section
    const topChannels = useMemo(() => {
        return getTopChannelsByViewers(channels, 12);
    }, [channels]);

    // Get online channels count
    const onlineChannels = useMemo(() => {
        return getOnlineChannels(channels);
    }, [channels]);

    // Get favorite channel objects
    const favoriteChannelObjects = useMemo(() => {
        return channels.filter(ch =>
            favoriteChannels.includes(`${ch.name}|${ch.code}`)
        );
    }, [channels, favoriteChannels]);

    // Get recently viewed channel objects
    const recentlyViewedChannels = useMemo(() => {
        return channels.filter(ch =>
            recentlyViewed.includes(`${ch.name}|${ch.code}`)
        ).slice(0, 8);
    }, [channels, recentlyViewed]);

    // Get trending channels (by viewers growth)
    const trendingChannels = useMemo(() => {
        return [...channels]
            .sort((a, b) => b.viewers - a.viewers)
            .slice(0, 8);
    }, [channels]);

    // Group channels by country
    const channelsByCountry = useMemo(() => {
        return groupChannelsByCountry(channels);
    }, [channels]);

    // Get top countries
    const topCountries = useMemo(() => {
        const countryCounts: Record<string, number> = {};
        channels.forEach(channel => {
            if (channel.country) {
                countryCounts[channel.country] = (countryCounts[channel.country] || 0) + 1;
            }
        });

        return Object.entries(countryCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 12)
            .map(([country]) => country);
    }, [channels]);

    // Filter channels
    const filteredChannels = useMemo(() => {
        const channelsToFilter = searchTerm ? searchResults : channels;

        let filtered = channelsToFilter.filter(channel => {
            // Category filter
            const categoryMatch = selectedCategory === 'all' || channel.category === selectedCategory;

            // Country filter
            const countryMatch = selectedCountry === 'all' || channel.country === selectedCountry;

            // Language filter
            const languageMatch = selectedLanguage === 'all' || channel.language === selectedLanguage;

            return categoryMatch && countryMatch && languageMatch;
        });

        // Apply special filters based on sortBy
        if (sortBy === 'favorites') {
            filtered = filtered.filter(channel =>
                favoriteChannels.includes(`${channel.name}|${channel.code}`)
            );
        } else if (sortBy === 'recent') {
            filtered = filtered.filter(channel =>
                recentlyViewed.includes(`${channel.name}|${channel.code}`)
            );
        } else if (sortBy === 'trending') {
            // Show trending channels (top by viewers)
            filtered = [...filtered]
                .sort((a, b) => b.viewers - a.viewers)
                .slice(0, 50); // Limit to top 50 trending
        }

        // Sorting logic
        switch (sortBy) {
            case 'viewers':
                return filtered.sort((a, b) => b.viewers - a.viewers);
            case 'country':
                return filtered.sort((a, b) => (a.country || '').localeCompare(b.country || ''));
            case 'name':
                return filtered.sort((a, b) => a.name.localeCompare(b.name));
            case 'recent':
                // Sort by most recently viewed first
                return filtered.sort((a, b) => {
                    const aIndex = recentlyViewed.indexOf(`${a.name}|${a.code}`);
                    const bIndex = recentlyViewed.indexOf(`${b.name}|${b.code}`);
                    if (aIndex === -1 && bIndex === -1) return 0;
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                });
            case 'favorites':
            case 'trending':
            default:
                return filtered;
        }
    }, [channels, searchResults, searchTerm, selectedCategory, selectedCountry, selectedLanguage, sortBy, favoriteChannels, recentlyViewed]);

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedCategory('all');
        setSelectedCountry('all');
        setSelectedLanguage('all');
        setSortBy('viewers');
        setShowTrending(false);
        setSearchResults(channels);
    };

    const handleWatchChannel = useCallback((channel: ApiChannel) => {
        // Encode channel name and code in URL
        const channelId = encodeURIComponent(`${channel.name}|${channel.code}`);

        // Save to recently viewed
        const channelKey = `${channel.name}|${channel.code}`;
        const updatedRecent = [
            channelKey,
            ...recentlyViewed.filter(key => key !== channelKey)
        ].slice(0, 20); // Keep only last 20

        setRecentlyViewed(updatedRecent);
        localStorage.setItem('recently-viewed-channels', JSON.stringify(updatedRecent));

        // Navigate to player page
        router.push(`/channels/${channelId}`);
    }, [router, recentlyViewed]);

    const toggleFavorite = useCallback((channel: ApiChannel, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const channelKey = `${channel.name}|${channel.code}`;
        let newFavorites: string[];

        if (favoriteChannels.includes(channelKey)) {
            newFavorites = favoriteChannels.filter(fav => fav !== channelKey);
        } else {
            newFavorites = [...favoriteChannels, channelKey];
        }

        setFavoriteChannels(newFavorites);
        localStorage.setItem('favorite-channels', JSON.stringify(newFavorites));
    }, [favoriteChannels]);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'online':
                return 'bg-green-500';
            case 'offline':
                return 'bg-gray-500';
            default:
                return 'bg-yellow-500';
        }
    };

    const getStatusText = (status: string) => {
        switch (status.toLowerCase()) {
            case 'online':
                return 'Live Now';
            case 'offline':
                return 'Offline';
            default:
                return 'Unknown';
        }
    };

    const formatViewers = (viewers: number) => {
        if (viewers >= 1000000) {
            return `${(viewers / 1000000).toFixed(1)}M`;
        }
        if (viewers >= 1000) {
            return `${(viewers / 1000).toFixed(1)}K`;
        }
        return viewers.toString();
    };

    const getQualityIndicator = (viewers: number) => {
        if (viewers > 1000) return 'HD';
        if (viewers > 500) return 'SD';
        return 'Low';
    };

    const getQualityColor = (viewers: number) => {
        if (viewers > 1000) return 'bg-green-100 text-green-800';
        if (viewers > 500) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    };

    const ChannelCard = ({ channel, featured = false }: { channel: ApiChannel; featured?: boolean }) => {
        const isFavorite = favoriteChannels.includes(`${channel.name}|${channel.code}`);

        return (
            <Link
                href={`/channels/${encodeURIComponent(`${channel.name}|${channel.code}`)}`}
                className="block"
            >
                <div className={`neumorphic-card group relative ${featured ? 'featured-card' : ''}`}>
                    {/* Favorite Button */}
                    <button
                        onClick={(e) => toggleFavorite(channel, e)}
                        className="absolute top-3 right-3 z-20 p-2 bg-white/80 hover:bg-white rounded-full shadow-md transition-all hover:scale-110"
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                        <FaHeart
                            className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                        />
                    </button>

                    {/* Featured Badge */}
                    {featured && (
                        <div className="absolute top-3 left-3 z-10">
                            <div className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-md">
                                <FaCrown className="w-2 h-2" />
                                TRENDING
                            </div>
                        </div>
                    )}

                    {/* Status Indicator */}
                    <div className="absolute top-3 right-12 z-10">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(channel.status)}`}></div>
                    </div>

                    {/* Channel Logo */}
                    <div className="flex items-center justify-center h-32 mt-4">
                        <div className="relative w-24 h-24 bg-white rounded-2xl p-3 shadow-inner group-hover:shadow-lg transition-all duration-300">
                            <Image
                                src={channel.image}
                                alt={channel.name}
                                fill
                                className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/channel-placeholder.svg';
                                }}
                            />
                        </div>
                    </div>

                    {/* Channel Info */}
                    <div className="text-center mt-4">
                        <h3 className="font-bold text-gray-900 truncate text-lg group-hover:text-red-600 transition-colors">
                            {channel.name}
                        </h3>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-xs text-gray-600">{channel.country}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-600">{channel.category}</span>
                        </div>
                    </div>

                    {/* Quality Indicator */}
                    <div className="flex justify-center mt-3">
                        <span className={`text-xs px-3 py-1 rounded-full ${getQualityColor(channel.viewers)}`}>
                            {getQualityIndicator(channel.viewers)}
                        </span>
                    </div>

                    {/* Viewers and Action */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-300">
                        <div className="flex items-center gap-1">
                            <FaEye className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-600">{formatViewers(channel.viewers)}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                handleWatchChannel(channel);
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold text-white transition-all duration-300 shadow-sm hover:shadow-md group-hover:scale-105 flex items-center gap-1"
                        >
                            <FaPlay className="w-3 h-3" />
                            Watch
                        </button>
                    </div>
                </div>
            </Link>
        );
    };

    const ChannelRow = ({ channel }: { channel: ApiChannel }) => {
        const isFavorite = favoriteChannels.includes(`${channel.name}|${channel.code}`);

        return (
            <div className="neumorphic-card group hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4">
                    {/* Channel Logo */}
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <div className="absolute inset-0 bg-white rounded-xl p-2 shadow-inner">
                            <Image
                                src={channel.image}
                                alt={channel.name}
                                fill
                                className="object-contain"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/channel-placeholder.svg';
                                }}
                            />
                        </div>
                    </div>

                    {/* Channel Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg group-hover:text-red-600 transition-colors">
                                    {channel.name}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-sm text-gray-600">{channel.category}</span>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-sm text-gray-600">{channel.country}</span>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-sm text-gray-600">{channel.language}</span>
                                </div>
                            </div>

                            {/* Status Indicator */}
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(channel.status)}`}></div>
                                <span className="text-xs text-gray-600">{getStatusText(channel.status)}</span>
                            </div>
                        </div>

                        {/* Description and Stats */}
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <FaEye className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs text-gray-600">{formatViewers(channel.viewers)} viewers</span>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded ${getQualityColor(channel.viewers)}`}>
                                    {getQualityIndicator(channel.viewers)}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => toggleFavorite(channel, e)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                    <FaHeart
                                        className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                                    />
                                </button>
                                <button
                                    onClick={() => handleWatchChannel(channel)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition-all duration-300 shadow-sm hover:shadow-md flex items-center gap-2"
                                >
                                    <FaPlay className="w-3 h-3" />
                                    Watch Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#e8e8e8] text-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-700">Loading channels...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            <Header />

            <main className="relative z-10">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-4">
                    {/* Search and Filter Section - Now at the top */}
                    <div className="sticky top-16 z-30 bg-[#e8e8e8] py-4 mb-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search Bar */}
                            <div className="w-full md:w-auto md:flex-1">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search channels by name, category, or country..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-4 py-3 bg-white rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm text-sm"
                                    />
                                    <FaSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                    {isSearching && (
                                        <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* View Toggle */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`px-3 py-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'bg-white text-gray-700'}`}
                                >
                                    Grid
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-red-600 text-white' : 'bg-white text-gray-700'}`}
                                >
                                    List
                                </button>
                            </div>

                            {/* Sort and Filter Buttons */}
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                        className="px-4 py-3 bg-white rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm appearance-none pr-10 text-sm"
                                    >
                                        <option value="viewers">Most Viewed</option>
                                        <option value="trending">Trending Now</option>
                                        <option value="recent">Recently Viewed</option>
                                        <option value="favorites">Favorites</option>
                                        <option value="name">Name A-Z</option>
                                        <option value="country">By Country</option>
                                    </select>
                                    <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
                                </div>

                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-100 rounded-xl transition-colors text-gray-700 border border-gray-300 shadow-sm text-sm"
                                >
                                    <FaFilter className="w-4 h-4" />
                                    {showFilters ? 'Hide Filters' : 'Filters'}
                                    <FaChevronDown className={`w-3 h-3 transition-transform duration-200 ${showFilters ? 'transform rotate-180' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                            <div className="mt-4 bg-white rounded-xl p-4 shadow-sm border border-gray-300">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                    {/* Category Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <FaTv className="inline mr-2" />
                                            Category
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                                            >
                                                <option value="all">All Categories</option>
                                                {categories.map((category) => (
                                                    <option key={category} value={category}>
                                                        {category}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Country Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <FaGlobe className="inline mr-2" />
                                            Country
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedCountry}
                                                onChange={(e) => setSelectedCountry(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                                            >
                                                <option value="all">All Countries</option>
                                                {countries.map((country) => (
                                                    <option key={country} value={country}>
                                                        {country}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Language Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <FaLanguage className="inline mr-2" />
                                            Language
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedLanguage}
                                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                                            >
                                                <option value="all">All Languages</option>
                                                {languages.map((language) => (
                                                    <option key={language} value={language}>
                                                        {language}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Status Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <FaSignal className="inline mr-2" />
                                            Status
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="online">Online Only</option>
                                                <option value="offline">Offline</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Actions */}
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={resetFilters}
                                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                                    >
                                        <FaTimes className="w-4 h-4" />
                                        Clear All Filters
                                    </button>

                                    <div className="text-sm text-gray-600">
                                        Showing {filteredChannels.length} of {channels.length} channels
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Active Filters Display */}
                    {(selectedCategory !== 'all' || selectedCountry !== 'all' || selectedLanguage !== 'all' || searchTerm || sortBy === 'favorites' || sortBy === 'recent' || sortBy === 'trending') && (
                        <div className="mb-6">
                            <div className="flex flex-wrap gap-2 mb-3">
                                <div className="text-sm font-medium text-gray-700">Active filters:</div>
                                {selectedCategory !== 'all' && (
                                    <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                        <FaTv className="w-3 h-3 text-gray-500" />
                                        {selectedCategory}
                                        <button onClick={() => setSelectedCategory('all')} className="text-gray-500 hover:text-gray-900">
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                                {selectedCountry !== 'all' && (
                                    <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                        <FaGlobe className="w-3 h-3 text-gray-500" />
                                        {selectedCountry}
                                        <button onClick={() => setSelectedCountry('all')} className="text-gray-500 hover:text-gray-900">
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                                {selectedLanguage !== 'all' && (
                                    <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                        <FaLanguage className="w-3 h-3 text-gray-500" />
                                        {selectedLanguage}
                                        <button onClick={() => setSelectedLanguage('all')} className="text-gray500 hover:text-gray-900">
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
                                {sortBy === 'favorites' && (
                                    <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                        <FaHeart className="w-3 h-3 text-red-500" />
                                        Favorites
                                        <button onClick={() => setSortBy('viewers')} className="text-gray-500 hover:text-gray-900">
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                                {sortBy === 'recent' && (
                                    <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                        <FaHistory className="w-3 h-3 text-blue-500" />
                                        Recently Viewed
                                        <button onClick={() => setSortBy('viewers')} className="text-gray-500 hover:text-gray-900">
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                                {sortBy === 'trending' && (
                                    <span className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm border border-gray-300">
                                        <FaFire className="w-3 h-3 text-orange-500" />
                                        Trending Now
                                        <button onClick={() => setSortBy('viewers')} className="text-gray-500 hover:text-gray-900">
                                            <FaTimes className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Quick Category Navigation */}
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Browse by Category</h2>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => setSelectedCategory('Sports')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedCategory === 'Sports' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                ⚽ Sports
                            </button>
                            <button
                                onClick={() => setSelectedCategory('News')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedCategory === 'News' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                📰 News
                            </button>
                            <button
                                onClick={() => setSelectedCategory('Entertainment')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedCategory === 'Entertainment' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                🎬 Entertainment
                            </button>
                            <button
                                onClick={() => setSelectedCategory('Movies')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedCategory === 'Movies' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                🎥 Movies
                            </button>
                            <button
                                onClick={() => setSelectedCategory('Music')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedCategory === 'Music' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                🎵 Music
                            </button>
                            <button
                                onClick={() => setSortBy('trending')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${sortBy === 'trending' ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                <FaFire className="w-4 h-4" />
                                Trending Now
                            </button>
                            <button
                                onClick={() => setSortBy('recent')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${sortBy === 'recent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                <FaHistory className="w-4 h-4" />
                                Recently Viewed
                            </button>
                            <button
                                onClick={() => setSortBy('favorites')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${sortBy === 'favorites' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                                <FaHeart className="w-4 h-4" />
                                Favorites
                            </button>
                        </div>
                    </div>



                    {/* All Channels Section */}
                    <section className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {searchTerm ? `Search Results for "${searchTerm}"` :
                                    sortBy === 'favorites' ? 'Your Favorite Channels' :
                                        sortBy === 'recent' ? 'Recently Viewed Channels' :
                                            sortBy === 'trending' ? 'Trending Now' :
                                                'All Channels'}
                                <span className="text-lg font-normal text-gray-600 ml-3">
                                    ({filteredChannels.length} channels)
                                </span>
                            </h2>

                            <div className="flex items-center gap-3">
                                <div className="text-sm text-gray-600">
                                    {viewMode === 'grid' ? 'Grid View' : 'List View'}
                                </div>
                            </div>
                        </div>

                        {filteredChannels.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-gray-300 shadow-sm">
                                <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                                    {sortBy === 'favorites' ? (
                                        <FaHeart className="text-4xl text-gray-400" />
                                    ) : sortBy === 'recent' ? (
                                        <FaHistory className="text-4xl text-gray-400" />
                                    ) : sortBy === 'trending' ? (
                                        <FaFire className="text-4xl text-gray-400" />
                                    ) : (
                                        <FaTv className="text-4xl text-gray-400" />
                                    )}
                                </div>
                                <h3 className="text-2xl font-semibold mb-3 text-gray-900">
                                    {sortBy === 'favorites' ? 'No Favorite Channels' :
                                        sortBy === 'recent' ? 'No Recently Viewed Channels' :
                                            sortBy === 'trending' ? 'No Trending Channels' :
                                                'No Channels Found'}
                                </h3>
                                <p className="text-gray-600 max-w-md mx-auto mb-8 text-lg">
                                    {sortBy === 'favorites' ? 'Add channels to your favorites to see them here.' :
                                        sortBy === 'recent' ? 'Watch some channels to see them here.' :
                                            searchTerm ? `No channels found for "${searchTerm}"` : 'No channels match your current filters'}
                                </p>
                                <div className="flex flex-wrap justify-center gap-4">
                                    <button
                                        onClick={resetFilters}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-medium transition-colors shadow-md"
                                    >
                                        {sortBy === 'favorites' ? 'Browse All Channels' : 'Reset All Filters'}
                                    </button>
                                    {sortBy === 'favorites' && (
                                        <button
                                            onClick={() => router.push('/channels')}
                                            className="px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl text-gray-700 font-medium transition-colors"
                                        >
                                            Browse All Channels
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filteredChannels.map((channel) => (
                                    <ChannelCard
                                        key={`${channel.name}-${channel.code}`}
                                        channel={channel}
                                        featured={sortBy === 'trending'}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredChannels.map((channel) => (
                                    <ChannelRow key={`${channel.name}-${channel.code}`} channel={channel} />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Load More Button */}
                    {filteredChannels.length > 0 && filteredChannels.length < channels.length && (
                        <div className="text-center mb-12">
                            <button
                                onClick={() => {
                                    // Implement load more logic here
                                    console.log('Load more channels');
                                }}
                                className="px-8 py-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl text-gray-700 font-medium transition-colors shadow-sm hover:shadow-md"
                            >
                                Load More Channels
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-300 mt-12 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <div className="mb-6">
                            <span className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                BraveStream Channels
                            </span>
                        </div>
                        <p className="text-gray-600 mb-4">
                            Watch {channels.length} live TV channels from around the world
                        </p>
                        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
                            <span>⚡ Instant Streaming</span>
                            <span>🌍 {countries.length} Countries</span>
                            <span>📺 {categories.length} Categories</span>
                            <span>🎯 HD Quality</span>
                        </div>
                        <div className="mt-8 flex justify-center gap-6">
                            <button className="text-sm text-gray-500 hover:text-gray-700">Terms of Service</button>
                            <button className="text-sm text-gray-500 hover:text-gray-700">Privacy Policy</button>
                            <button className="text-sm text-gray-500 hover:text-gray-700">Contact Support</button>
                            <button className="text-sm text-gray-500 hover:text-gray-700">FAQ</button>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Global styles */}
            <style jsx global>{`
                /* Neumorphic styles */
                .neumorphic-card {
                    background: #e0e0e0;
                    border-radius: 20px;
                    padding: 16px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    min-height: 260px;
                }

                .neumorphic-card.featured-card {
                    border: 2px solid #fbbf24;
                }

                .neumorphic-stats-card {
                    background: #e0e0e0;
                    border-radius: 16px;
                    padding: 16px 24px;
                    box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    min-width: 180px;
                }

                .neumorphic-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 12px 12px 24px #bebebe, -12px -12px 24px #ffffff;
                }

                .neumorphic-stats-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;
                }

                /* Responsive adjustments */
                @media (max-width: 640px) {
                    .neumorphic-card {
                        min-height: 220px;
                        padding: 12px;
                    }

                    .neumorphic-stats-card {
                        min-width: 140px;
                        padding: 12px 16px;
                    }
                }

                @media (max-width: 375px) {
                    .xs\\:grid-cols-2 {
                        grid-template-columns: 1fr;
                    }
                }

                @media (min-width: 376px) and (max-width: 639px) {
                    .xs\\:grid-cols-2 {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (min-width: 640px) and (max-width: 767px) {
                    .sm\\:grid-cols-3 {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (min-width: 768px) and (max-width: 1023px) {
                    .md\\:grid-cols-4 {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }

                /* Smooth scrolling */
                html {
                    scroll-behavior: smooth;
                }

                /* Better focus states */
                button:focus, input:focus, select:focus {
                    outline: 2px solid #ef4444;
                    outline-offset: 2px;
                }

                /* Animation for new cards */
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .neumorphic-card {
                    animation: fadeIn 0.5s ease-out;
                }
            `}</style>
        </div>
    );
}