// src/app/channels/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
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
    FaSignal
} from 'react-icons/fa';
import {
    ApiChannel,
    fetchAllChannels,
    getChannelCategories,
    getChannelCountries,
    getChannelLanguages,
    getTopChannelsByViewers,
    getOnlineChannels
} from '@/lib/api';

export default function ChannelsPage() {
    const [channels, setChannels] = useState<ApiChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedCountry, setSelectedCountry] = useState<string>('all');
    const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'viewers' | 'country'>('name');

    // Initialize channels
    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        try {
            setLoading(true);
            const data = await fetchAllChannels();
            setChannels(data.channels);
        } catch (error) {
            console.error('Error loading channels:', error);
        } finally {
            setLoading(false);
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

    // Get top channels for featured section
    const topChannels = useMemo(() => {
        return getTopChannelsByViewers(channels, 8);
    }, [channels]);

    // Get online channels count
    const onlineChannels = useMemo(() => {
        return getOnlineChannels(channels);
    }, [channels]);

    // Filter channels
    const filteredChannels = useMemo(() => {
        return channels.filter(channel => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const searchMatch = searchTerm === '' ||
                channel.name.toLowerCase().includes(searchLower) ||
                channel.category?.toLowerCase().includes(searchLower) ||
                channel.country?.toLowerCase().includes(searchLower);

            // Category filter
            const categoryMatch = selectedCategory === 'all' || channel.category === selectedCategory;

            // Country filter
            const countryMatch = selectedCountry === 'all' || channel.country === selectedCountry;

            // Language filter
            const languageMatch = selectedLanguage === 'all' || channel.language === selectedLanguage;

            return searchMatch && categoryMatch && countryMatch && languageMatch;
        }).sort((a, b) => {
            // Sorting logic
            switch (sortBy) {
                case 'viewers':
                    return b.viewers - a.viewers;
                case 'country':
                    return (a.country || '').localeCompare(b.country || '');
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }, [channels, searchTerm, selectedCategory, selectedCountry, selectedLanguage, sortBy]);

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedCategory('all');
        setSelectedCountry('all');
        setSelectedLanguage('all');
    };

    const handleWatchChannel = (channel: ApiChannel) => {
        // Open channel in new tab or implement player
        window.open(channel.url, '_blank', 'noopener,noreferrer');
    };

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
                    {/* Page Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Live TV Channels</h1>
                        <p className="text-gray-600">
                            Browse {channels.length} channels from around the world
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-4">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-300">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium">{onlineChannels.length} Online</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-300">
                                <FaEye className="text-blue-500" />
                                <span className="text-sm font-medium">{topChannels.reduce((sum, ch) => sum + (ch.viewers || 0), 0).toLocaleString()} Total Viewers</span>
                            </div>
                        </div>
                    </div>

                    {/* Top Controls Row */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        {/* Search Bar */}
                        <div className="w-full md:w-auto md:flex-1">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search channels..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-3 bg-white rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
                                />
                                <FaSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                            </div>
                        </div>

                        {/* Sort and Filter Buttons */}
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'name' | 'viewers' | 'country')}
                                    className="px-4 py-3 bg-white rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm appearance-none pr-10"
                                >
                                    <option value="name">Sort by Name</option>
                                    <option value="viewers">Sort by Viewers</option>
                                    <option value="country">Sort by Country</option>
                                </select>
                                <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-100 rounded-xl transition-colors text-gray-700 border border-gray-300 shadow-sm"
                            >
                                <FaFilter className="w-4 h-4" />
                                {showFilters ? 'Hide Filters' : 'Filters'}
                                <FaChevronDown className={`w-3 h-3 transition-transform duration-200 ${showFilters ? 'transform rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {showFilters && (
                        <div className="mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-300">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                            </div>

                            {/* Reset Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={resetFilters}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <FaTimes className="w-4 h-4" />
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active Filters Display */}
                    {(selectedCategory !== 'all' || selectedCountry !== 'all' || selectedLanguage !== 'all' || searchTerm) && (
                        <div className="mb-6">
                            <div className="flex flex-wrap gap-2 mb-2">
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
                                        <button onClick={() => setSelectedLanguage('all')} className="text-gray-500 hover:text-gray-900">
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
                                Showing {filteredChannels.length} of {channels.length} channels
                            </p>
                        </div>
                    )}

                    {/* Featured Channels (Top by Viewers) */}
                    {topChannels.length > 0 && (
                        <section className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                    <FaStar className="mr-2 text-yellow-500" />
                                    Featured Channels
                                    <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                    Top by Viewers
                  </span>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {topChannels.map((channel) => (
                                    <div key={`${channel.name}-${channel.code}`} className="neumorphic-card group relative">
                                        {/* Featured Badge */}
                                        <div className="absolute top-3 left-3 z-10">
                                            <div className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                                <FaStar className="w-2 h-2" />
                                                TOP
                                            </div>
                                        </div>

                                        {/* Status Indicator */}
                                        <div className="absolute top-3 right-3 z-10">
                                            <div className={`w-3 h-3 rounded-full ${getStatusColor(channel.status)}`}></div>
                                        </div>

                                        {/* Channel Logo */}
                                        <div className="flex items-center justify-center h-32 mt-4">
                                            <div className="relative w-24 h-24 bg-white rounded-xl p-3 shadow-inner">
                                                <Image
                                                    src={channel.image}
                                                    alt={channel.name}
                                                    fill
                                                    className="object-contain p-1"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = '/channel-placeholder.svg';
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Channel Info */}
                                        <div className="text-center mt-4">
                                            <h3 className="font-bold text-gray-900 truncate">{channel.name}</h3>
                                            <div className="flex items-center justify-center gap-2 mt-1">
                                                <span className="text-xs text-gray-600">{channel.country}</span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-gray-600">{channel.category}</span>
                                            </div>
                                        </div>

                                        {/* Viewers and Action */}
                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-300">
                                            <div className="flex items-center gap-1">
                                                <FaEye className="w-3 h-3 text-gray-500" />
                                                <span className="text-xs text-gray-600">{channel.viewers.toLocaleString()}</span>
                                            </div>
                                            <button
                                                onClick={() => handleWatchChannel(channel)}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold text-white transition-all duration-300 shadow-sm hover:shadow-md group-hover:scale-105 flex items-center gap-1"
                                            >
                                                <FaPlay className="w-3 h-3" />
                                                Watch
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* All Channels Section */}
                    <section className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                All Channels ({filteredChannels.length})
                            </h2>
                        </div>

                        {filteredChannels.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border border-gray-300 shadow-sm">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                    <FaTv className="text-2xl text-gray-400" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2 text-gray-900">No Channels Found</h3>
                                <p className="text-gray-600 max-w-md mx-auto mb-6 text-sm">
                                    {searchTerm ? `No channels found for "${searchTerm}"` : 'No channels match your current filters'}
                                </p>
                                <button
                                    onClick={resetFilters}
                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors shadow-md text-sm"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filteredChannels.map((channel) => (
                                    <div key={`${channel.name}-${channel.code}`} className="neumorphic-card group">
                                        {/* Status Indicator */}
                                        <div className="absolute top-3 right-3">
                                            <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(channel.status)}`}></div>
                                        </div>

                                        {/* Channel Logo */}
                                        <div className="flex items-center justify-center h-20">
                                            <div className="relative w-16 h-16 bg-white rounded-lg p-2 shadow-inner">
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
                                        <div className="text-center mt-3">
                                            <h3 className="font-bold text-gray-900 text-sm truncate">{channel.name}</h3>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <span className="text-xs text-gray-600 truncate">{channel.category}</span>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-xs text-gray-500">{channel.country}</span>
                                                    <span className="text-xs text-gray-400">•</span>
                                                    <span className="text-xs text-gray-500">{channel.language}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Viewers and Action */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-300">
                                            <div className="flex items-center gap-1">
                                                <FaEye className="w-3 h-3 text-gray-500" />
                                                <span className="text-xs text-gray-600">{channel.viewers}</span>
                                            </div>
                                            <button
                                                onClick={() => handleWatchChannel(channel)}
                                                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold text-white transition-all duration-300 shadow-sm hover:shadow-md group-hover:scale-105"
                                                title={`Watch ${channel.name}`}
                                            >
                                                <FaPlay className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-300 mt-12 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <div className="mb-6">
              <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                StreamSports Channels
              </span>
                        </div>
                        <p className="text-gray-600">
                            © {new Date().getFullYear()} StreamSports. {channels.length} channels available.
                        </p>
                        <p className="text-sm text-gray-500 mt-4">
                            Watch live TV channels from around the world. All streams are provided by third-party sources.
                        </p>
                    </div>
                </div>
            </footer>

            {/* Global styles */}
            <style jsx global>{`
        /* Neumorphic card for channels */
        .neumorphic-card {
          background: #e0e0e0;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 6px 6px 12px #bebebe,
                    -6px -6px 12px #ffffff;
          transition: all 0.3s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          position: relative;
          min-height: 200px;
        }

        .neumorphic-card:hover {
          transform: translateY(-4px);
          box-shadow: 8px 8px 16px #bebebe,
                    -8px -8px 16px #ffffff;
        }

        /* Android-friendly touch targets */
        @media (max-width: 640px) {
          button, .neumorphic-card {
            min-height: 44px;
            min-width: 44px;
          }
          
          input, select {
            font-size: 16px;
            min-height: 44px;
          }
          
          .neumorphic-card {
            padding: 12px;
            min-height: 180px;
          }
        }

        /* Better image handling */
        .neumorphic-card img {
          max-width: 100%;
          height: auto;
          object-fit: contain;
        }

        /* Responsive grid adjustments */
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
      `}</style>
        </div>
    );
}