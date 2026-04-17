// src/app/channels/[id]/ChannelPlayer.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import type { ApiChannel } from '@/lib/api';
import { getEmbedUrl } from '@/lib/api';

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
    online: { color: 'bg-green-500', text: 'LIVE', pulseColor: 'bg-green-400' },
    offline: { color: 'bg-red-500', text: 'OFFLINE', pulseColor: 'bg-red-400' },
} as const;

// ========== HELPERS ==========
const getChannelKey = (channel: ApiChannel): string => `${channel.name}|${channel.code}`;

const formatViewers = (viewers: number): string => {
    if (viewers >= 1_000_000) return `${(viewers / 1_000_000).toFixed(1)}M`;
    if (viewers >= 1_000) return `${(viewers / 1_000).toFixed(1)}K`;
    return viewers.toString();
};

const getStatusConfig = (status: string) =>
    STATUS_CONFIG[status.toLowerCase() as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.offline;

// ========== SUB-COMPONENTS ==========

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

interface StreamErrorStateProps {
    isError: boolean;
    onRetry: () => void;
}

const StreamErrorState = ({ isError, onRetry }: StreamErrorStateProps) => (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center p-8">
            <div className="text-6xl mb-6">{isError ? '⚠️' : '📺'}</div>
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

interface ShareDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    shareOptions: ShareOption[];
}

const ShareDropdown = ({ isOpen, onClose, shareOptions }: ShareDropdownProps) => {
    if (!isOpen) return null;
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="absolute right-0 top-full mt-2 neumorphic-dropdown w-56 z-50">
                <div className="py-2">
                    <div
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Share this channel
                    </div>
                    {shareOptions.map((option, index) => (
                        <button
                            key={index}
                            onClick={option.action}
                            className="dropdown-item flex items-center gap-3"
                        >
                            {option.icon}
                            <span style={{ color: 'var(--text-secondary)' }}>{option.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};

interface InfoCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    iconColor?: string;
}

const InfoCard = ({ icon, label, value, iconColor = 'text-gray-500' }: InfoCardProps) => (
    <div className="neumorphic-card text-center p-4">
        <div className={`${iconColor} mx-auto mb-2 flex justify-center`}>{icon}</div>
        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
);

// ========== MAIN COMPONENT ==========
export default function ChannelPlayer({ channel }: ChannelPlayerProps) {
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [streamError, setStreamError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [favoriteChannels, setFavoriteChannels] = useState<string[]>([]);
    const [streamUrl, setStreamUrl] = useState(() => getEmbedUrl(channel));
    const [copied, setCopied] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const channelKey = getChannelKey(channel);
    const isFavorite = favoriteChannels.includes(channelKey);
    const statusConfig = getStatusConfig(channel.status);
    const isOnline = channel.status.toLowerCase() === 'online';

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setFavoriteChannels(JSON.parse(saved));
        } catch (error) { console.error('Failed to load favorites:', error); }
    }, []);

    const toggleFavorite = useCallback(() => {
        const newFavorites = isFavorite
            ? favoriteChannels.filter(f => f !== channelKey)
            : [...favoriteChannels, channelKey];
        setFavoriteChannels(newFavorites);
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
    }, [channelKey, isFavorite, favoriteChannels]);

    const handleReload = useCallback(() => {
        setIsLoading(true); setStreamError(false);
        setStreamUrl(`${getEmbedUrl(channel)}&_t=${Date.now()}`);
    }, [channel]);

    const handleFullScreen = useCallback(async () => {
        const container = videoContainerRef.current;
        if (!container) return;
        try {
            if (!document.fullscreenElement) { await container.requestFullscreen(); setIsFullScreen(true); }
            else { await document.exitFullscreen(); setIsFullScreen(false); }
        } catch {
            container.classList.toggle('fullscreen-fallback');
            setIsFullScreen(!isFullScreen);
        }
    }, [isFullScreen]);

    const handleShare = useCallback(async () => {
        if (typeof window === 'undefined') return;
        if (navigator.share) {
            try { await navigator.share({ title: `Watch ${channel.name} Live`, text: `Watching ${channel.name} on BraveStream`, url: window.location.href }); return; }
            catch { /* cancelled */ }
        }
        setShowShareOptions(!showShareOptions);
    }, [channel.name, showShareOptions]);

    const copyToClipboard = useCallback(async () => {
        if (typeof window === 'undefined') return;
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
            setShowShareOptions(false);
        } catch (error) { console.error('Failed to copy:', error); }
    }, []);

    const shareOptions: ShareOption[] = [
        {
            name: copied ? 'Copied!' : 'Copy Link',
            icon: <FaCopy className={`w-4 h-4 ${copied ? 'text-green-500' : ''}`} style={!copied ? { color: 'var(--text-muted)' } : undefined} />,
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

    const fixIframeSize = useCallback(() => {
        if (!iframeRef.current || !videoContainerRef.current) return;
        const container = videoContainerRef.current;
        const iframe = iframeRef.current;
        requestAnimationFrame(() => {
            iframe.style.width = `${container.clientWidth}px`;
            iframe.style.height = `${container.clientHeight}px`;
        });
    }, []);

    useEffect(() => {
        if (streamError) return;
        const timeoutId = setTimeout(fixIframeSize, 100);
        const handleResize = () => requestAnimationFrame(fixIframeSize);
        window.addEventListener('resize', handleResize);
        const observer = new ResizeObserver(handleResize);
        if (videoContainerRef.current) observer.observe(videoContainerRef.current);
        return () => { clearTimeout(timeoutId); window.removeEventListener('resize', handleResize); observer.disconnect(); };
    }, [streamError, fixIframeSize]);

    useEffect(() => {
        const handler = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement; target.src = '/channel-placeholder.svg';
    };

    const handleIframeLoad = useCallback(() => { fixIframeSize(); setIsLoading(false); }, [fixIframeSize]);
    const handleIframeError = useCallback(() => { setStreamError(true); setIsLoading(false); }, []);

    // ========== RENDER ==========
    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--neu-bg-page)', color: 'var(--text-secondary)' }}>

            {/* ===== HEADER ===== */}
            <header
                className="py-3 shadow-sm sticky top-0 z-40 transition-colors duration-300"
                style={{
                    backgroundColor: 'var(--neu-bg-page)',
                    borderBottom: '1px solid var(--border-primary)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <Link href="/channels" className="neumorphic-nav-item group">
                            <FaArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            <span className="hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>Back to Channels</span>
                        </Link>

                        <div className="flex items-center gap-3">
                            {/* Favorite */}
                            <button
                                onClick={toggleFavorite}
                                className="neumorphic-button p-2"
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <FaHeart
                                    className={`w-5 h-5 transition-colors ${isFavorite ? 'text-red-500 fill-current' : ''}`}
                                    style={!isFavorite ? { color: 'var(--text-secondary)' } : undefined}
                                />
                            </button>

                            {/* Share */}
                            <div className="relative">
                                <button onClick={handleShare} className="neumorphic-button p-2" title="Share channel">
                                    <FaShareAlt className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                </button>
                                <ShareDropdown isOpen={showShareOptions} onClose={() => setShowShareOptions(false)} shareOptions={shareOptions} />
                            </div>

                            {/* Status Badge */}
                            <div
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                style={{
                                    backgroundColor: 'var(--surface-primary)',
                                    border: '1px solid var(--border-primary)',
                                }}
                            >
                                <div className="relative">
                                    <div className={`w-2 h-2 rounded-full ${statusConfig.color}`}></div>
                                    {isOnline && (
                                        <div className={`absolute inset-0 w-2 h-2 rounded-full ${statusConfig.pulseColor} animate-ping`}></div>
                                    )}
                                </div>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    {statusConfig.text}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative">
                <div className="max-w-7xl mx-auto px-4 py-6">

                    {/* ===== CHANNEL HEADER ===== */}
                    <div className="neumorphic-card mb-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                            <div className="flex items-center gap-4 sm:gap-6">
                                {/* Logo */}
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                                    <div className="absolute inset-0 neumorphic-logo rounded-xl"></div>
                                    <Image
                                        src={channel.image} alt={channel.name} fill
                                        className="object-contain p-3 sm:p-4"
                                        onError={handleImageError} sizes="80px" priority
                                    />
                                </div>

                                {/* Info */}
                                <div>
                                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {channel.name}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <div className="flex items-center gap-1"><FaGlobe className="w-3 h-3 sm:w-4 sm:h-4" /><span>{channel.country}</span></div>
                                        <div className="flex items-center gap-1"><FaTv className="w-3 h-3 sm:w-4 sm:h-4" /><span>{channel.category}</span></div>
                                        {channel.language && (
                                            <div className="flex items-center gap-1"><FaLanguage className="w-3 h-3 sm:w-4 sm:h-4" /><span>{channel.language}</span></div>
                                        )}
                                        <div className="flex items-center gap-1"><FaEye className="w-3 h-3 sm:w-4 sm:h-4" /><span>{formatViewers(channel.viewers)} viewers</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Reload */}
                            <button onClick={handleReload} className="neumorphic-button p-3 self-end sm:self-auto" title="Reload stream">
                                <FaRedoAlt className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                        </div>
                    </div>

                    {/* ===== MAIN CONTENT GRID ===== */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Video Player */}
                        <div className="lg:col-span-2 space-y-6">
                            <div ref={videoContainerRef} className="neumorphic-video-container relative bg-black">
                                {isOnline && !streamError ? (
                                    <div className="absolute inset-0 w-full h-full">
                                        {isLoading && <LoadingOverlay />}
                                        <iframe
                                            ref={iframeRef}
                                            src={streamUrl}
                                            className="absolute inset-0 w-full h-full border-0 rounded-xl"
                                            allowFullScreen
                                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                            title={`${channel.name} - Live Stream`}
                                            loading="eager"
                                            onLoad={handleIframeLoad}
                                            onError={handleIframeError}
                                        />
                                        {/* Controls Overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex items-center justify-between text-white">
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                        <span className="font-medium">LIVE</span>
                                                    </div>
                                                    <div className="flex items-center gap-2"><FaSignal className="w-4 h-4" /><span>HD</span></div>
                                                    <div className="flex items-center gap-2"><FaEye className="w-4 h-4" /><span>{formatViewers(channel.viewers)}</span></div>
                                                </div>
                                                <button
                                                    onClick={handleFullScreen}
                                                    className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
                                                    title={isFullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                                >
                                                    {isFullScreen ? <FaCompress className="w-5 h-5" /> : <FaExpand className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <StreamErrorState isError={streamError} onRetry={handleReload} />
                                )}
                            </div>

                            {/* Stream Info Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <InfoCard icon={<FaSignal className="w-5 h-5" />} label="Quality" value="HD" iconColor="text-green-500" />
                                <InfoCard icon={<FaBroadcastTower className="w-5 h-5" />} label="Source" value="Official" iconColor="text-blue-500" />
                                <InfoCard icon={<FaGlobe className="w-5 h-5" />} label="Country" value={channel.country || 'International'} iconColor="text-purple-500" />
                                <InfoCard icon={<FaTv className="w-5 h-5" />} label="Category" value={channel.category || 'General'} iconColor="text-red-500" />
                            </div>
                        </div>

                        {/* ===== SIDEBAR ===== */}
                        <aside className="space-y-6">

                            {/* Channel Details */}
                            <div className="neumorphic-card p-6">
                                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                    Channel Details
                                </h3>
                                <div className="space-y-4 text-sm">
                                    {[
                                        { label: 'Status', value: statusConfig.text, dot: true },
                                        { label: 'Viewers', value: formatViewers(channel.viewers) },
                                        { label: 'Language', value: channel.language || 'Multiple' },
                                        { label: 'Category', value: channel.category },
                                        { label: 'Region Code', value: channel.code, mono: true },
                                    ].map((item) => (
                                        <div key={item.label} className="flex justify-between items-center">
                                            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                            <span
                                                className={`font-semibold flex items-center gap-2 ${item.mono ? 'font-mono uppercase' : ''}`}
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {item.dot && <div className={`w-2 h-2 rounded-full ${statusConfig.color}`}></div>}
                                                {item.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Troubleshooting */}
                            <div
                                className="neumorphic-card p-6"
                                style={{
                                    background: `linear-gradient(to bottom right, var(--error-bg), var(--warning-bg))`,
                                }}
                            >
                                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                                    Having Issues?
                                </h3>
                                <ul className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                                    {[
                                        'Try refreshing the stream',
                                        'Disable ad-blockers temporarily',
                                        'Use Chrome or Firefox browser',
                                        'Check your internet connection',
                                        'Try a VPN if geo-restricted',
                                    ].map((tip, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="text-red-500 mt-0.5">•</span>
                                            {tip}
                                        </li>
                                    ))}
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
                                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                    Quick Actions
                                </h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={toggleFavorite}
                                        className="w-full px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                        style={{
                                            backgroundColor: isFavorite ? 'var(--error-bg)' : 'var(--surface-secondary)',
                                            color: isFavorite ? 'var(--error-text)' : 'var(--text-secondary)',
                                        }}
                                    >
                                        <FaHeart className={isFavorite ? 'text-red-500' : ''} />
                                        {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                    </button>
                                    {[
                                        { onClick: handleShare, icon: <FaShareAlt />, label: 'Share Channel' },
                                    ].map((btn, i) => (
                                        <button
                                            key={i}
                                            onClick={btn.onClick}
                                            className="w-full px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                            style={{
                                                backgroundColor: 'var(--surface-secondary)',
                                                color: 'var(--text-secondary)',
                                            }}
                                        >
                                            {btn.icon}
                                            {btn.label}
                                        </button>
                                    ))}
                                    <Link
                                        href="/channels"
                                        className="w-full px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                        style={{
                                            backgroundColor: 'var(--surface-secondary)',
                                            color: 'var(--text-secondary)',
                                        }}
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
        </div>
    );
}