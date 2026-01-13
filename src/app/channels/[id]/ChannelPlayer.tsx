'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ApiChannel, getEmbedUrl } from '@/lib/api';
import {
    FaExpand,
    FaRedoAlt,
    FaArrowLeft,
    FaGlobe,
    FaTv,
    FaEye,
    FaSignal,
    FaShareAlt,
    FaHeart,
    FaLanguage,
    FaBroadcastTower
} from 'react-icons/fa';

interface ChannelPlayerProps {
    channel: ApiChannel;
}

export default function ChannelPlayer({ channel }: ChannelPlayerProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [streamError, setStreamError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [favoriteChannels, setFavoriteChannels] = useState<string[]>([]);
    const [streamUrl, setStreamUrl] = useState(getEmbedUrl(channel));

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Load favorites
    useEffect(() => {
        const saved = localStorage.getItem('favorite-channels');
        if (saved) setFavoriteChannels(JSON.parse(saved));
    }, []);

    // Toggle favorite
    const toggleFavorite = useCallback(() => {
        const key = `${channel.name}|${channel.code}`;
        let newFavorites: string[];
        if (favoriteChannels.includes(key)) {
            newFavorites = favoriteChannels.filter(f => f !== key);
        } else {
            newFavorites = [...favoriteChannels, key];
        }
        setFavoriteChannels(newFavorites);
        localStorage.setItem('favorite-channels', JSON.stringify(newFavorites));
    }, [channel, favoriteChannels]);

    // Reload stream with cache-buster
    const handleReload = useCallback(() => {
        setIsLoading(true);
        setStreamError(false);
        setStreamUrl(`${getEmbedUrl(channel)}?t=${Date.now()}`);
    }, [channel]);

    // Fullscreen
    const handleFullScreen = useCallback(async () => {
        if (!iframeRef.current) return;
        try {
            if (!document.fullscreenElement) {
                await iframeRef.current.requestFullscreen();
                setIsFullScreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullScreen(false);
            }
        } catch (err) {
            iframeRef.current.classList.toggle('fullscreen-fallback');
        }
    }, []);

    // Share
    const handleShare = useCallback(() => {
        if (navigator.share) {
            navigator.share({
                title: `Watch ${channel.name} Live`,
                text: `Watching ${channel.name} on BraveStream`,
                url: window.location.href,
            }).catch(() => {});
        } else {
            setShowShareOptions(!showShareOptions);
        }
    }, [channel, showShareOptions]);

    const copyToClipboard = useCallback(() => {
        navigator.clipboard.writeText(window.location.href);
        setShowShareOptions(false);
    }, []);

    // Fix iframe size
    const fixIframeSize = useCallback(() => {
        if (iframeRef.current && videoContainerRef.current) {
            const container = videoContainerRef.current;
            const iframe = iframeRef.current;
            requestAnimationFrame(() => {
                iframe.style.width = `${container.clientWidth}px`;
                iframe.style.height = `${container.clientHeight}px`;
            });
        }
    }, []);

    useEffect(() => {
        if (!streamError) {
            setTimeout(fixIframeSize, 100);
            const handleResize = () => requestAnimationFrame(fixIframeSize);
            window.addEventListener('resize', handleResize);
            const observer = new ResizeObserver(handleResize);
            if (videoContainerRef.current) observer.observe(videoContainerRef.current);
            return () => {
                window.removeEventListener('resize', handleResize);
                observer.disconnect();
            };
        }
    }, [streamError, fixIframeSize]);

    useEffect(() => {
        const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);

    const formatViewers = (viewers: number) => {
        if (viewers >= 1_000_000) return `${(viewers / 1_000_000).toFixed(1)}M`;
        if (viewers >= 1_000) return `${(viewers / 1_000).toFixed(1)}K`;
        return viewers.toString();
    };

    const isFavorite = favoriteChannels.includes(`${channel.name}|${channel.code}`);
    const statusColor = channel.status.toLowerCase() === 'online' ? 'bg-green-500' : 'bg-red-500';
    const statusText = channel.status.toLowerCase() === 'online' ? 'LIVE' : 'OFFLINE';

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        (e.target as HTMLImageElement).src = '/channel-placeholder.svg';
    };

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            {/* Header */}
            <header className="bg-[#e8e8e8] border-b border-gray-300 py-3 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <Link href="/channels" className="neumorphic-nav-item group">
                            <FaArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to Channels</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <button onClick={toggleFavorite} className="neumorphic-button p-2">
                                <FaHeart className={`w-5 h-5 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-700'}`} />
                            </button>
                            <div className="relative">
                                <button onClick={handleShare} className="neumorphic-button p-2">
                                    <FaShareAlt className="w-5 h-5 text-gray-700" />
                                </button>
                                {showShareOptions && (
                                    <div className="absolute right-0 top-full mt-2 neumorphic-dropdown w-48 z-50">
                                        <div className="py-2">
                                            <button onClick={copyToClipboard} className="dropdown-item">Copy Link</button>
                                            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Watch ${channel.name} live!`)}`}
                                               target="_blank" rel="noopener noreferrer" className="dropdown-item">Share on Twitter</a>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300">
                                <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                                <span className="text-sm text-gray-700">{statusText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Channel Header */}
                    <div className="neumorphic-card mb-6">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="relative w-20 h-20">
                                    <div className="absolute inset-0 neumorphic-logo rounded-xl"></div>
                                    <Image
                                        src={channel.image}
                                        alt={channel.name}
                                        fill
                                        className="object-contain p-4"
                                        onError={handleImageError}
                                        sizes="80px"
                                        priority
                                    />
                                </div>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{channel.name}</h1>
                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                                        <div className="flex items-center gap-1"><FaGlobe className="w-4 h-4" /> {channel.country}</div>
                                        <div className="flex items-center gap-1"><FaTv className="w-4 h-4" /> {channel.category}</div>
                                        {channel.language && <div className="flex items-center gap-1"><FaLanguage className="w-4 h-4" /> {channel.language}</div>}
                                        <div className="flex items-center gap-1"><FaEye className="w-4 h-4" /> {formatViewers(channel.viewers)}</div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleReload} className="neumorphic-button p-3">
                                <FaRedoAlt className="w-6 h-6 text-gray-700" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Player */}
                        <div className="lg:col-span-2 space-y-6">
                            <div ref={videoContainerRef} className="neumorphic-video-container relative bg-black">
                                {channel.status.toLowerCase() === 'online' && !streamError ? (
                                    <div className="absolute inset-0 w-full h-full">
                                        {/* Full loading overlay */}
                                        {isLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 rounded-xl">
                                                <div className="text-center">
                                                    <div className="animate-spin rounded-full h-16 w-16 border-t-4言语 border-b-4 border-red-600 mx-auto mb-4"></div>
                                                    <p className="text-white text-lg font-medium">Loading stream...</p>
                                                </div>
                                            </div>
                                        )}

                                        <iframe
                                            ref={iframeRef}
                                            src={streamUrl}
                                            className="absolute inset-0 w-full h-full border-0 rounded-xl"
                                            allowFullScreen
                                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                            title={`${channel.name} - Live Stream`}
                                            sandbox="allow-scripts allow-same-origin allow-presentation"
                                            loading="eager"
                                            onLoad={() => {
                                                fixIframeSize();
                                                setIsLoading(false);
                                            }}
                                            onError={() => {
                                                setStreamError(true);
                                                setIsLoading(false);
                                            }}
                                        />

                                        {/* Bottom controls */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                                            <div className="flex items-center justify-between text-white">
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <FaSignal className="w-4 h-4" />
                                                        <span>HD</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <FaEye className="w-4 h-4" />
                                                        <span>{formatViewers(channel.viewers)}</span>
                                                    </div>
                                                </div>
                                                <button onClick={handleFullScreen} className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                                    <FaExpand className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center p-8">
                                            <div className="text-6xl mb-6 text-gray-400">📺</div>
                                            <h3 className="text-2xl font-bold text-white mb-4">
                                                {streamError ? 'Stream Unavailable' : 'Channel Offline'}
                                            </h3>
                                            <button onClick={handleReload} className="neumorphic-button px-6 py-3 text-white font-semibold flex items-center gap-3 mx-auto">
                                                <FaRedoAlt /> Try Again
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Stream Info Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="neumorphic-card text-center p-4">
                                    <FaSignal className="text-green-500 mx-auto mb-2" />
                                    <div className="text-sm text-gray-600">Quality</div>
                                    <div className="font-bold">HD</div>
                                </div>
                                <div className="neumorphic-card text-center p-4">
                                    <FaBroadcastTower className="text-blue-500 mx-auto mb-2" />
                                    <div className="text-sm text-gray-600">Source</div>
                                    <div className="font-bold">Official</div>
                                </div>
                                <div className="neumorphic-card text-center p-4">
                                    <FaGlobe className="text-purple-500 mx-auto mb-2" />
                                    <div className="text-sm text-gray-600">Country</div>
                                    <div className="font-bold">{channel.country}</div>
                                </div>
                                <div className="neumorphic-card text-center p-4">
                                    <FaTv className="text-red-500 mx-auto mb-2" />
                                    <div className="text-sm text-gray-600">Category</div>
                                    <div className="font-bold">{channel.category}</div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <aside className="space-y-6">
                            <div className="neumorphic-card p-6">
                                <h3 className="text-lg font-bold mb-4">Channel Details</h3>
                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-600">Status</span><span className="font-semibold flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${statusColor}`}></div>{statusText}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Viewers</span><span className="font-semibold">{formatViewers(channel.viewers)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Language</span><span className="font-semibold">{channel.language || 'Multiple'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Code</span><span className="font-mono font-semibold">{channel.code}</span></div>
                                </div>
                            </div>

                            <div className="neumorphic-card p-6 bg-gradient-to-br from-red-50 to-orange-50">
                                <h3 className="text-lg font-bold mb-3">Having Issues?</h3>
                                <ul className="text-sm space-y-2 text-gray-700">
                                    <li>• Try refreshing the stream</li>
                                    <li>• Disable ad-blockers temporarily</li>
                                    <li>• Use Chrome or Firefox</li>
                                    <li>• Check your internet connection</li>
                                </ul>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            {/* Styles (same as MatchPlayer) */}
            <style jsx global>{`
                .neumorphic-card { background: #e0e0e0; border-radius: 20px; padding: 20px; box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff; }
                .neumorphic-video-container { background: #e0e0e0; border-radius: 20px; box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff; position: relative; overflow: hidden; height: 65vh; min-height: 450px; max-height: 700px; }
                .neumorphic-nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px; background: #e0e0e0; box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff; transition: all 0.2s; }
                .neumorphic-nav-item:hover { box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff; }
                .neumorphic-button { border-radius: 12px; background: #e0e0e0; box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .neumorphic-button:hover { box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff; }
                .neumorphic-logo { background: #e0e0e0; box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff; }
                .neumorphic-dropdown { background: #e8e8e8; border-radius: 12px; box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff, 0 10px 30px rgba(0,0,0,0.1); }
                .dropdown-item { display: block; padding: 10px 16px; color: #4b5563; width: 100%; text-align: left; cursor: pointer; transition: background 0.2s; }
                .dropdown-item:hover { background: rgba(0,0,0,0.05); }
                .fullscreen-fallback { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999 !important; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
                @media (max-width: 768px) { .neumorphic-video-container { height: 50vh; min-height: 300px; } }
                @media (max-width: 640px) { .neumorphic-video-container { height: 40vh; min-height: 250px; } }
            `}</style>
        </div>
    );
}