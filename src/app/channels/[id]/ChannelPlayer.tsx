// src/app/channels/[id]/ChannelPlayer.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// API - separate type import
import type { ApiChannel } from '@/lib/api';
import { getEmbedUrl } from '@/lib/api';

// Icons
import {
    FaExpand,
    FaCompress,
    FaRedoAlt,
    FaArrowLeft,
    FaGlobe,
    FaTv,
    FaEye,
    FaSignal,
    FaShareAlt,
    FaHeart,
    FaLanguage,
    FaBroadcastTower,
    FaCopy,
    FaTwitter,
    FaFacebook,
    FaWhatsapp,
} from 'react-icons/fa';

// ========== TYPES ==========
interface ChannelPlayerProps {
    channel: ApiChannel;
}

interface ShareOption {
    name: string;
    icon: React.ReactNode;
    action: () => void;
}

// ========== CONSTANTS ==========
const STORAGE_KEY = 'favorite-channels';

const STATUS_CONFIG = {
    online: {
        color: 'bg-green-500',
        text: 'LIVE',
        pulseColor: 'bg-green-400',
    },
    offline: {
        color: 'bg-red-500',
        text: 'OFFLINE',
        pulseColor: 'bg-red-400',
    },
} as const;

// ========== HELPER FUNCTIONS ==========
const getChannelKey = (channel: ApiChannel): string => {
    return `${channel.name}|${channel.code}`;
};

const formatViewers = (viewers: number): string => {
    if (viewers >= 1_000_000) return `${(viewers / 1_000_000).toFixed(1)}M`;
    if (viewers >= 1_000) return `${(viewers / 1_000).toFixed(1)}K`;
    return viewers.toString();
};

const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status.toLowerCase() as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.offline;
};

// ========== SUB-COMPONENTS ==========

// Loading Overlay
const LoadingOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 rounded-xl">
        <div className="text-center">
            <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto mb-4"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <FaBroadcastTower className="w-6 h-6 text-red-500 animate-pulse" />
                </div>
            </div>
            <p className="text-white text-lg font-medium">Connecting to stream...</p>
            <p className="text-gray-400 text-sm mt-2">Please wait</p>
        </div>
    </div>
);

// Error/Offline State
interface StreamErrorStateProps {
    isError: boolean;
    onRetry: () => void;
}

const StreamErrorState = ({ isError, onRetry }: StreamErrorStateProps) => (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center p-8">
            <div className="text-6xl mb-6">
                {isError ? '⚠️' : '📺'}
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
                {isError ? 'Stream Unavailable' : 'Channel Offline'}
            </h3>
            <p className="text-gray-400 mb-6 max-w-sm">
                {isError
                    ? 'There was a problem loading the stream. Please try again.'
                    : 'This channel is currently offline. Check back later.'}
            </p>
            <button
                onClick={onRetry}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-semibold flex items-center gap-3 mx-auto transition-colors"
            >
                <FaRedoAlt className="w-4 h-4" />
                Try Again
            </button>
        </div>
    </div>
);

// Share Dropdown
interface ShareDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    shareOptions: ShareOption[];
}

const ShareDropdown = ({ isOpen, onClose, shareOptions }: ShareDropdownProps) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-40" 
                onClick={onClose}
            />
            
            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 neumorphic-dropdown w-56 z-50">
                <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Share this channel
                    </div>
                    {shareOptions.map((option, index) => (
                        <button
                            key={index}
                            onClick={option.action}
                            className="dropdown-item flex items-center gap-3"
                        >
                            {option.icon}
                            {option.name}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};

// Info Card
interface InfoCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    iconColor?: string;
}

const InfoCard = ({ icon, label, value, iconColor = 'text-gray-500' }: InfoCardProps) => (
    <div className="neumorphic-card text-center p-4">
        <div className={`${iconColor} mx-auto mb-2 flex justify-center`}>
            {icon}
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="font-bold text-gray-900 mt-1">{value}</div>
    </div>
);

// ========== MAIN COMPONENT ==========
export default function ChannelPlayer({ channel }: ChannelPlayerProps) {
    const router = useRouter();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [streamError, setStreamError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [favoriteChannels, setFavoriteChannels] = useState<string[]>([]);
    const [streamUrl, setStreamUrl] = useState(() => getEmbedUrl(channel));
    const [copied, setCopied] = useState(false);

    // Refs
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Derived state
    const channelKey = getChannelKey(channel);
    const isFavorite = favoriteChannels.includes(channelKey);
    const statusConfig = getStatusConfig(channel.status);
    const isOnline = channel.status.toLowerCase() === 'online';

    // Load favorites from localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setFavoriteChannels(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load favorites:', error);
        }
    }, []);

    // Toggle favorite
    const toggleFavorite = useCallback(() => {
        const newFavorites = isFavorite
            ? favoriteChannels.filter(f => f !== channelKey)
            : [...favoriteChannels, channelKey];

        setFavoriteChannels(newFavorites);

        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
        }
    }, [channelKey, isFavorite, favoriteChannels]);

    // Reload stream
    const handleReload = useCallback(() => {
        setIsLoading(true);
        setStreamError(false);
        // Add cache-buster to force reload
        setStreamUrl(`${getEmbedUrl(channel)}&_t=${Date.now()}`);
    }, [channel]);

    // Fullscreen toggle
    const handleFullScreen = useCallback(async () => {
        const container = videoContainerRef.current;
        if (!container) return;

        try {
            if (!document.fullscreenElement) {
                await container.requestFullscreen();
                setIsFullScreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullScreen(false);
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
            // Fallback for browsers that don't support fullscreen API
            container.classList.toggle('fullscreen-fallback');
            setIsFullScreen(!isFullScreen);
        }
    }, [isFullScreen]);

    // Share functionality
    const handleShare = useCallback(async () => {
        if (typeof window === 'undefined') return;

        // Try native share first
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Watch ${channel.name} Live`,
                    text: `Watching ${channel.name} on BraveStream`,
                    url: window.location.href,
                });
                return;
            } catch (error) {
                // User cancelled or share failed, fall through to dropdown
            }
        }

        setShowShareOptions(!showShareOptions);
    }, [channel.name, showShareOptions]);

    // Copy to clipboard
    const copyToClipboard = useCallback(async () => {
        if (typeof window === 'undefined') return;

        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            setShowShareOptions(false);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }, []);

    // Share options
    const shareOptions: ShareOption[] = [
        {
            name: copied ? 'Copied!' : 'Copy Link',
            icon: <FaCopy className={`w-4 h-4 ${copied ? 'text-green-500' : 'text-gray-500'}`} />,
            action: copyToClipboard,
        },
        {
            name: 'Share on Twitter',
            icon: <FaTwitter className="w-4 h-4 text-blue-400" />,
            action: () => {
                const url = encodeURIComponent(window.location.href);
                const text = encodeURIComponent(`Watch ${channel.name} live on BraveStream! 📺`);
                window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
                setShowShareOptions(false);
            },
        },
        {
            name: 'Share on Facebook',
            icon: <FaFacebook className="w-4 h-4 text-blue-600" />,
            action: () => {
                const url = encodeURIComponent(window.location.href);
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
                setShowShareOptions(false);
            },
        },
        {
            name: 'Share on WhatsApp',
            icon: <FaWhatsapp className="w-4 h-4 text-green-500" />,
            action: () => {
                const url = encodeURIComponent(window.location.href);
                const text = encodeURIComponent(`Watch ${channel.name} live on BraveStream!`);
                window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
                setShowShareOptions(false);
            },
        },
    ];

    // Fix iframe size
    const fixIframeSize = useCallback(() => {
        if (!iframeRef.current || !videoContainerRef.current) return;

        const container = videoContainerRef.current;
        const iframe = iframeRef.current;

        requestAnimationFrame(() => {
            iframe.style.width = `${container.clientWidth}px`;
            iframe.style.height = `${container.clientHeight}px`;
        });
    }, []);

    // Resize observer effect
    useEffect(() => {
        if (streamError) return;

        // Initial fix
        const timeoutId = setTimeout(fixIframeSize, 100);

        // Window resize handler
        const handleResize = () => requestAnimationFrame(fixIframeSize);
        window.addEventListener('resize', handleResize);

        // Container resize observer
        const observer = new ResizeObserver(handleResize);
        if (videoContainerRef.current) {
            observer.observe(videoContainerRef.current);
        }

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [streamError, fixIframeSize]);

    // Fullscreen change listener
    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);

    // Image error handler
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        target.src = '/channel-placeholder.svg';
    };

    // Iframe handlers
    const handleIframeLoad = useCallback(() => {
        fixIframeSize();
        setIsLoading(false);
    }, [fixIframeSize]);

    const handleIframeError = useCallback(() => {
        setStreamError(true);
        setIsLoading(false);
    }, []);

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            {/* Header */}
            <header className="bg-[#e8e8e8] border-b border-gray-300 py-3 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        {/* Back Button */}
                        <Link href="/channels" className="neumorphic-nav-item group">
                            <FaArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to Channels</span>
                        </Link>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            {/* Favorite Button */}
                            <button
                                onClick={toggleFavorite}
                                className="neumorphic-button p-2"
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <FaHeart
                                    className={`w-5 h-5 transition-colors ${
                                        isFavorite ? 'text-red-500 fill-current' : 'text-gray-700'
                                    }`}
                                />
                            </button>

                            {/* Share Button */}
                            <div className="relative">
                                <button
                                    onClick={handleShare}
                                    className="neumorphic-button p-2"
                                    title="Share channel"
                                >
                                    <FaShareAlt className="w-5 h-5 text-gray-700" />
                                </button>

                                <ShareDropdown
                                    isOpen={showShareOptions}
                                    onClose={() => setShowShareOptions(false)}
                                    shareOptions={shareOptions}
                                />
                            </div>

                            {/* Status Badge */}
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300">
                                <div className="relative">
                                    <div className={`w-2 h-2 rounded-full ${statusConfig.color}`}></div>
                                    {isOnline && (
                                        <div className={`absolute inset-0 w-2 h-2 rounded-full ${statusConfig.pulseColor} animate-ping`}></div>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-gray-700">
                                    {statusConfig.text}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Channel Header */}
                    <div className="neumorphic-card mb-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                            <div className="flex items-center gap-4 sm:gap-6">
                                {/* Channel Logo */}
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                                    <div className="absolute inset-0 neumorphic-logo rounded-xl"></div>
                                    <Image
                                        src={channel.image}
                                        alt={channel.name}
                                        fill
                                        className="object-contain p-3 sm:p-4"
                                        onError={handleImageError}
                                        sizes="80px"
                                        priority
                                    />
                                </div>

                                {/* Channel Info */}
                                <div>
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                                        {channel.name}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <FaGlobe className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>{channel.country}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <FaTv className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>{channel.category}</span>
                                        </div>
                                        {channel.language && (
                                            <div className="flex items-center gap-1">
                                                <FaLanguage className="w-3 h-3 sm:w-4 sm:h-4" />
                                                <span>{channel.language}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                            <FaEye className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>{formatViewers(channel.viewers)} viewers</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Reload Button */}
                            <button
                                onClick={handleReload}
                                className="neumorphic-button p-3 self-end sm:self-auto"
                                title="Reload stream"
                            >
                                <FaRedoAlt className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Video Player */}
                        <div className="lg:col-span-2 space-y-6">
                            <div
                                ref={videoContainerRef}
                                className="neumorphic-video-container relative bg-black"
                            >
                                {isOnline && !streamError ? (
                                    <div className="absolute inset-0 w-full h-full">
                                        {/* Loading Overlay */}
                                        {isLoading && <LoadingOverlay />}

                                        {/* Video Iframe */}
                                        <iframe
                                            ref={iframeRef}
                                            src={streamUrl}
                                            className="absolute inset-0 w-full h-full border-0 rounded-xl"
                                            allowFullScreen
                                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                            title={`${channel.name} - Live Stream`}                                            loading="eager"
                                            onLoad={handleIframeLoad}
                                            onError={handleIframeError}
                                        />

                                        {/* Bottom Controls Overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex items-center justify-between text-white">
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                        <span className="font-medium">LIVE</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <FaSignal className="w-4 h-4" />
                                                        <span>HD</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <FaEye className="w-4 h-4" />
                                                        <span>{formatViewers(channel.viewers)}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleFullScreen}
                                                    className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
                                                    title={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                                >
                                                    {isFullScreen ? (
                                                        <FaCompress className="w-5 h-5" />
                                                    ) : (
                                                        <FaExpand className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <StreamErrorState
                                        isError={streamError}
                                        onRetry={handleReload}
                                    />
                                )}
                            </div>

                            {/* Stream Info Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <InfoCard
                                    icon={<FaSignal className="w-5 h-5" />}
                                    label="Quality"
                                    value="HD"
                                    iconColor="text-green-500"
                                />
                                <InfoCard
                                    icon={<FaBroadcastTower className="w-5 h-5" />}
                                    label="Source"
                                    value="Official"
                                    iconColor="text-blue-500"
                                />
                                <InfoCard
                                    icon={<FaGlobe className="w-5 h-5" />}
                                    label="Country"
                                    value={channel.country || 'International'}
                                    iconColor="text-purple-500"
                                />
                                <InfoCard
                                    icon={<FaTv className="w-5 h-5" />}
                                    label="Category"
                                    value={channel.category || 'General'}
                                    iconColor="text-red-500"
                                />
                            </div>
                        </div>

                        {/* Sidebar */}
                        <aside className="space-y-6">
                            {/* Channel Details Card */}
                            <div className="neumorphic-card p-6">
                                <h3 className="text-lg font-bold mb-4 text-gray-900">
                                    Channel Details
                                </h3>
                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Status</span>
                                        <span className="font-semibold flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${statusConfig.color}`}></div>
                                            {statusConfig.text}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Viewers</span>
                                        <span className="font-semibold">
                                            {formatViewers(channel.viewers)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Language</span>
                                        <span className="font-semibold">
                                            {channel.language || 'Multiple'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Category</span>
                                        <span className="font-semibold">
                                            {channel.category}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Region Code</span>
                                        <span className="font-mono font-semibold uppercase">
                                            {channel.code}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Troubleshooting Card */}
                            <div className="neumorphic-card p-6 bg-gradient-to-br from-red-50 to-orange-50">
                                <h3 className="text-lg font-bold mb-3 text-gray-900">
                                    Having Issues?
                                </h3>
                                <ul className="text-sm space-y-2 text-gray-700">
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        Try refreshing the stream
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        Disable ad-blockers temporarily
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        Use Chrome or Firefox browser
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        Check your internet connection
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        Try a VPN if geo-restricted
                                    </li>
                                </ul>
                                <button
                                    onClick={handleReload}
                                    className="w-full mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <FaRedoAlt className="w-4 h-4" />
                                    Reload Stream
                                </button>
                            </div>

                            {/* Quick Actions */}
                            <div className="neumorphic-card p-6">
                                <h3 className="text-lg font-bold mb-4 text-gray-900">
                                    Quick Actions
                                </h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={toggleFavorite}
                                        className={`w-full px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                                            isFavorite
                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <FaHeart className={isFavorite ? 'text-red-500' : ''} />
                                        {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FaShareAlt />
                                        Share Channel
                                    </button>
                                    <Link
                                        href="/channels"
                                        className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FaTv />
                                        Browse All Channels
                                    </Link>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            {/* Global Styles */}
            <style jsx global>{`
                .neumorphic-card {
                    background: #e0e0e0;
                    border-radius: 20px;
                    padding: 20px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;
                }

                .neumorphic-video-container {
                    background: #1a1a1a;
                    border-radius: 20px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;
                    position: relative;
                    overflow: hidden;
                    height: 65vh;
                    min-height: 450px;
                    max-height: 700px;
                }

                .neumorphic-nav-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    transition: all 0.2s ease;
                    color: #374151;
                    font-weight: 500;
                }

                .neumorphic-nav-item:hover {
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                }

                .neumorphic-button {
                    border-radius: 12px;
                    background: #e0e0e0;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: none;
                }

                .neumorphic-button:hover {
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                }

                .neumorphic-button:active {
                    box-shadow: inset 6px 6px 12px #bebebe, inset -6px -6px 12px #ffffff;
                }

                .neumorphic-logo {
                    background: #e0e0e0;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                }

                .neumorphic-dropdown {
                    background: #e8e8e8;
                    border-radius: 12px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff, 0 10px 30px rgba(0, 0, 0, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                }

                .dropdown-item {
                    display: block;
                    padding: 10px 16px;
                    color: #4b5563;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                    transition: background 0.2s ease;
                    border: none;
                    background: none;
                    font-size: 14px;
                }

                .dropdown-item:hover {
                    background: rgba(0, 0, 0, 0.05);
                }

                .fullscreen-fallback {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 9999 !important;
                    border-radius: 0 !important;
                }

                @keyframes ping {
                    75%, 100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }

                .animate-ping {
                    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
                }

                @media (max-width: 768px) {
                    .neumorphic-video-container {
                        height: 50vh;
                        min-height: 300px;
                    }
                }

                @media (max-width: 640px) {
                    .neumorphic-video-container {
                        height: 40vh;
                        min-height: 250px;
                    }

                    .neumorphic-card {
                        padding: 16px;
                    }
                }
            `}</style>
        </div>
    );
}