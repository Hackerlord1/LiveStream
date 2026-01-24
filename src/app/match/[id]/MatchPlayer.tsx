// src/app/match/[id]/MatchPlayer.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Match, Channel } from '@/lib/api';
import { useAdBlock } from '@/hooks/useAdBlock';
import {
    FaExpand,
    FaRedoAlt,
    FaTv,
    FaArrowLeft,
    FaBroadcastTower,
    FaFire,
    FaGlobe,
    FaClock,
    FaFutbol,
    FaBasketballBall,
    FaFootballBall,
    FaHockeyPuck,
    FaPlay,
    FaEye,
    FaSignal,
    FaWifi,
    FaDesktop,
    FaMobileAlt,
    FaShareAlt,
    FaUser,
    FaPaperPlane,
    FaUsers,
    FaSmile,
    FaRobot,
    FaCrown,
    FaFlag,
    FaShieldAlt,
    FaBan,
    FaCheckCircle
} from 'react-icons/fa';

interface MatchPlayerProps {
    match: Match;
}

// WebSocket URL
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://serverstream.onrender.com';

// Constants
const MAX_MESSAGE_LENGTH = 200;
const MAX_USERNAME_LENGTH = 20;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

interface ChatMessage {
    id: string;
    username: string;
    message: string;
    timestamp: Date | string;
    color: string;
    isAdmin?: boolean;
}

interface ChatUser {
    username: string;
    isAdmin: boolean;
    color: string;
}

interface WebSocketMessage {
    type: 'message' | 'user_count' | 'history' | 'system' | 'typing' | 'rate_limit' | 'error' | 'welcome' | 'user_list' | 'pong';
    message?: any;
    messages?: ChatMessage[];
    count?: number;
    username?: string;
    isTyping?: boolean;
    color?: string;
    isAdmin?: boolean;
    timestamp?: string;
    users?: ChatUser[];
    retryAfter?: number;
}

export default function MatchPlayer({ match }: MatchPlayerProps) {
    const [activeStream, setActiveStream] = useState<Channel | null>(
        match.channels?.[0] || null
    );
    const [streamError, setStreamError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [iframeKey, setIframeKey] = useState<string>(`iframe-${Date.now()}`);

    // Ad-Block Hook
    const {
        isActive: adBlockActive,
        isChecking: adBlockChecking,
        stats: { blockedAds, adSegmentsRemoved },
        activate: activateAdBlock,
        forceSkip: forceSkipAds,
        notifyStreamChange,
    } = useAdBlock();

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [username, setUsername] = useState('');
    const [isUsernameSet, setIsUsernameSet] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<number>(0);
    const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Generate random username if not set
    useEffect(() => {
        const savedUsername = localStorage.getItem(`chat-username-${match.gameID}`);
        if (savedUsername) {
            setUsername(savedUsername);
            setIsUsernameSet(true);
        } else {
            generateRandomUsername();
        }
    }, [match.gameID]);

    const generateRandomUsername = () => {
        const adjectives = ['Swift', 'Clever', 'Brave', 'Fast', 'Smart', 'Cool', 'Epic', 'Mighty', 'Golden', 'Silver'];
        const animals = ['Lion', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Panther', 'Falcon', 'Shark', 'Dragon'];
        const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
        const randomNum = Math.floor(Math.random() * 999) + 1;
        const generatedUsername = `${randomAdj}${randomAnimal}${randomNum}`;
        setUsername(generatedUsername);
    };

    // Generate unique message ID
    const generateMessageId = () => {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    };

    // Get user color
    const getUserColor = (username: string): string => {
        const colors = [
            '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B',
            '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
        ];
        const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    // Sanitize chat messages
    const sanitizeMessage = useCallback((text: string): string => {
        let sanitized = text.trim().substring(0, MAX_MESSAGE_LENGTH);

        // Basic HTML escaping
        sanitized = sanitized
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        return sanitized;
    }, []);

    // Add message with throttling
    const addMessage = useCallback((message: ChatMessage) => {
        setMessages(prev => {
            const newMessages = [...prev, {
                ...message,
                id: message.id || generateMessageId(),
                timestamp: typeof message.timestamp === 'string'
                    ? new Date(message.timestamp)
                    : message.timestamp
            }];
            // Limit to last 200 messages for performance
            return newMessages.slice(-200);
        });
    }, []);

    // WebSocket Connection
    useEffect(() => {
        if (!isUsernameSet || !match?.gameID) return;

        let ws: WebSocket | null = null;
        let connectionAttempts = 0;

        const connectWebSocket = () => {
            // Clear any existing connection
            if (ws) {
                ws.close();
                ws = null;
            }

            // Validate WebSocket URL
            if (!WS_URL) {
                console.error('WebSocket URL not configured');
                setConnectionError('Chat server not configured');
                return;
            }

            try {
                // Construct WebSocket URL with parameters
                const url = new URL(WS_URL);
                url.searchParams.append('matchId', match.gameID);
                url.searchParams.append('username', username);

                console.log('🔗 Connecting to WebSocket:', url.toString());
                ws = new WebSocket(url.toString());

                ws.onopen = () => {
                    console.log('✅ WebSocket connected successfully');
                    setIsConnected(true);
                    setConnectionError(null);
                    setReconnectAttempts(0);
                    connectionAttempts = 0;

                    // Start heartbeat
                    heartbeatIntervalRef.current = setInterval(() => {
                        if (ws?.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                        }
                    }, 25000);
                };

                ws.onmessage = (event) => {
                    try {
                        const data: WebSocketMessage = JSON.parse(event.data);

                        switch (data.type) {
                            case 'welcome':
                                console.log('👋 Welcome message:', data.message);
                                addMessage({
                                    id: generateMessageId(),
                                    username: 'System',
                                    message: data.message,
                                    timestamp: new Date(),
                                    color: '#3B82F6',
                                    isAdmin: true
                                });
                                break;

                            case 'message':
                                if (data.message) {
                                    addMessage({
                                        id: data.message.id || generateMessageId(),
                                        username: data.message.username,
                                        message: data.message.message,
                                        timestamp: new Date(data.message.timestamp),
                                        color: data.message.color || getUserColor(data.message.username),
                                        isAdmin: data.message.isAdmin || false
                                    });
                                }
                                break;

                            case 'user_count':
                                setOnlineUsers(data.count || 0);
                                break;

                            case 'user_list':
                                // We receive user list but don't need to display it
                                break;

                            case 'history':
                                if (data.messages) {
                                    const historyMessages = data.messages.map((msg: ChatMessage) => ({
                                        id: msg.id || generateMessageId(),
                                        username: msg.username,
                                        message: msg.message,
                                        timestamp: new Date(msg.timestamp as string),
                                        color: msg.color || getUserColor(msg.username),
                                        isAdmin: msg.isAdmin || false
                                    }));
                                    setMessages(historyMessages);
                                }
                                break;

                            case 'system':
                                addMessage({
                                    id: generateMessageId(),
                                    username: 'System',
                                    message: data.message || '',
                                    timestamp: new Date(),
                                    color: '#3B82F6',
                                    isAdmin: true
                                });
                                break;

                            case 'rate_limit':
                                addMessage({
                                    id: generateMessageId(),
                                    username: 'System',
                                    message: data.message || 'Rate limit exceeded. Please wait.',
                                    timestamp: new Date(),
                                    color: '#F59E0B',
                                    isAdmin: true
                                });

                                // Disable input temporarily
                                if (data.retryAfter) {
                                    const input = inputRef.current;
                                    if (input) {
                                        input.disabled = true;
                                        setTimeout(() => {
                                            input.disabled = false;
                                            input.focus();
                                        }, data.retryAfter * 1000);
                                    }
                                }
                                break;

                            case 'error':
                                console.error('❌ Server error:', data.message);
                                addMessage({
                                    id: generateMessageId(),
                                    username: 'System',
                                    message: data.message || 'Server error occurred',
                                    timestamp: new Date(),
                                    color: '#EF4444',
                                    isAdmin: true
                                });
                                break;

                            case 'typing':
                                if (data.username && data.username !== username) {
                                    setIsTyping(data.isTyping || false);
                                }
                                break;

                            case 'pong':
                                // Heartbeat response, no action needed
                                break;
                        }
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error, event.data);
                    }
                };

                ws.onclose = (event) => {
                    console.log('🔌 WebSocket disconnected:', {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean
                    });

                    setIsConnected(false);
                    setIsTyping(false);

                    // Clear heartbeat
                    if (heartbeatIntervalRef.current) {
                        clearInterval(heartbeatIntervalRef.current);
                    }

                    // Only reconnect if not a normal closure and under max attempts
                    if (event.code !== 1000 && connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                        connectionAttempts++;
                        setReconnectAttempts(connectionAttempts);

                        // Exponential backoff with jitter
                        const delay = Math.min(
                            BASE_RECONNECT_DELAY * Math.pow(2, connectionAttempts - 1),
                            30000
                        ) + Math.random() * 1000;

                        console.log(`🔄 Reconnecting in ${Math.round(delay/1000)}s... Attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

                        reconnectTimeoutRef.current = setTimeout(() => {
                            connectWebSocket();
                        }, delay);
                    } else if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
                        console.error('❌ Max reconnection attempts reached');
                        setConnectionError('Failed to connect to chat. Please refresh the page.');
                        addMessage({
                            id: generateMessageId(),
                            username: 'System',
                            message: 'Chat connection lost. Please refresh the page to reconnect.',
                            timestamp: new Date(),
                            color: '#EF4444',
                            isAdmin: true
                        });
                    }
                };

                ws.onerror = (event: Event) => {
                    console.error('❌ WebSocket error event:', event);
                    setConnectionError('Connection error. Trying to reconnect...');
                };

                setWsConnection(ws);
            } catch (error) {
                console.error('❌ Error creating WebSocket connection:', error);
                setConnectionError('Failed to connect to chat server');
            }
        };

        connectWebSocket();

        return () => {
            // Clear timers
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }

            // Close WebSocket connection
            if (ws) {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close(1000, 'Component unmounting');
                }
                setWsConnection(null);
            }
        };
    }, [isUsernameSet, match.gameID, username, addMessage]);

    // Auto-scroll to bottom only for new messages from others
    useEffect(() => {
        if (messages.length === 0) return;

        const lastMessage = messages[messages.length - 1];
        // Only auto-scroll if the last message is not from current user
        if (lastMessage.username !== username) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, username]);

    const handleTyping = useCallback((typing: boolean) => {
        if (wsConnection && isConnected) {
            // Safely clear any existing timeout
            if (typingTimeout.current !== null) {
                clearTimeout(typingTimeout.current);
                typingTimeout.current = null;
            }

            if (typing) {
                // Send typing started
                wsConnection.send(JSON.stringify({
                    type: 'typing',
                    username: username,
                    isTyping: true
                }));

                // Set new timeout to auto-send typing stopped after 3 seconds
                typingTimeout.current = setTimeout(() => {
                    if (wsConnection && isConnected) {
                        wsConnection.send(JSON.stringify({
                            type: 'typing',
                            username: username,
                            isTyping: false
                        }));
                    }
                }, 3000);
            } else {
                // Send typing stopped immediately
                wsConnection.send(JSON.stringify({
                    type: 'typing',
                    username: username,
                    isTyping: false
                }));
            }
        }
    }, [wsConnection, isConnected, username]);

    const sendMessage = useCallback(() => {
        if (!newMessage.trim() || !wsConnection || !isConnected) return;

        const sanitizedMessage = sanitizeMessage(newMessage.trim());

        // Prepare message in server format
        const messageData = {
            id: generateMessageId(),
            username: username,
            message: sanitizedMessage,
            timestamp: new Date().toISOString(),
            color: getUserColor(username)
        };

        // Send in format expected by server
        try {
            wsConnection.send(JSON.stringify({
                type: 'message',
                message: messageData
            }));

            // Clear input
            setNewMessage('');
            if (inputRef.current) {
                inputRef.current.focus();
            }

            // Clear typing indicator
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
                handleTyping(false);
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            addMessage({
                id: generateMessageId(),
                username: 'System',
                message: 'Failed to send message. Please try again.',
                timestamp: new Date(),
                color: '#EF4444',
                isAdmin: true
            });
        }
    }, [newMessage, wsConnection, isConnected, username, sanitizeMessage, handleTyping, addMessage]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    const saveUsername = useCallback(() => {
        const trimmedUsername = username.trim();
        if (trimmedUsername && trimmedUsername.length >= 3 && trimmedUsername.length <= MAX_USERNAME_LENGTH) {
            localStorage.setItem(`chat-username-${match.gameID}`, trimmedUsername);
            setIsUsernameSet(true);
        }
    }, [username, match.gameID]);

    // Enhanced embed URL with ad-block bypass
    const getEmbedUrl = useCallback((channel: Channel): string => {
        const baseUrl = channel.url;

        // Add parameters to help DNS ad-blocking
        const params = new URLSearchParams();
        params.append('ref', 'bravestream.com');
        params.append('ts', Date.now().toString());
        params.append('v', '2');
        params.append('nocache', Math.random().toString(36).substr(2, 8));

        // Add headers to help service worker identify stream
        params.append('stream-type', 'hls');
        params.append('content-type', 'video');

        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}${params.toString()}`;
    }, []);

    const handleStreamChange = useCallback((channel: Channel) => {
        setActiveStream(channel);
        setStreamError(false);
        setIsLoading(true);

        // Force iframe reload with new key
        setIframeKey(`iframe-${Date.now()}`);

        // Notify service worker about stream change
        notifyStreamChange(channel.url);
    }, [notifyStreamChange]);

    const handleStreamError = useCallback(() => {
        setStreamError(true);
        setIsLoading(false);
        console.error('Stream failed to load');
    }, []);

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
            console.error('Fullscreen error:', err);
            // Fallback for mobile/tablet
            iframeRef.current.classList.toggle('fullscreen-fallback');
        }
    }, []);

    const handleShare = useCallback(() => {
        if (navigator.share) {
            navigator.share({
                title: `${match.homeTeam} vs ${match.awayTeam}`,
                text: `Watch ${match.homeTeam} vs ${match.awayTeam} live on BraveStream`,
                url: window.location.href,
            }).catch(err => console.error('Error sharing:', err));
        } else {
            setShowShareOptions(!showShareOptions);
        }
    }, [match, showShareOptions]);

    const copyToClipboard = useCallback(() => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => {
                setShowShareOptions(false);
            })
            .catch(err => console.error('Failed to copy:', err));
    }, []);

    const fixIframeSize = useCallback(() => {
        if (iframeRef.current && videoContainerRef.current) {
            const container = videoContainerRef.current;
            const iframe = iframeRef.current;

            requestAnimationFrame(() => {
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;

                iframe.style.width = `${containerWidth}px`;
                iframe.style.height = `${containerHeight}px`;
            });
        }
    }, []);

    useEffect(() => {
        if (activeStream && !streamError) {
            setTimeout(fixIframeSize, 100);

            const handleResize = () => {
                requestAnimationFrame(fixIframeSize);
            };

            window.addEventListener('resize', handleResize);

            const observer = new ResizeObserver(handleResize);
            if (videoContainerRef.current) {
                observer.observe(videoContainerRef.current);
            }

            return () => {
                window.removeEventListener('resize', handleResize);
                observer.disconnect();
            };
        }
    }, [activeStream, streamError, fixIframeSize]);

    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
        document.addEventListener('mozfullscreenchange', handleFullScreenChange);
        document.addEventListener('MSFullscreenChange', handleFullScreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
        };
    }, []);

    const getSportIcon = (sport: string) => {
        switch (sport) {
            case 'SOCCER': return <FaFutbol className="text-emerald-500" />;
            case 'NBA': return <FaBasketballBall className="text-orange-500" />;
            case 'NFL': return <FaFootballBall className="text-red-500" />;
            case 'NHL': return <FaHockeyPuck className="text-blue-500" />;
            default: return <FaTv className="text-purple-500" />;
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

    const getMatchStatusColor = (status: string) => {
        switch (status) {
            case 'live': return 'bg-red-500 text-white';
            case 'upcoming': return 'bg-blue-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const getMatchStatusText = (status: string) => {
        switch (status) {
            case 'live': return 'LIVE';
            case 'upcoming': return 'UPCOMING';
            default: return 'ENDED';
        }
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Handle image errors properly
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        target.src = '/team-placeholder.svg';
        target.onerror = null;
    };

    // DNS Ad-Block Status Component
    const DNSAdBlockStatus = () => (
        <div className="fixed top-4 left-4 z-50">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${
                adBlockActive
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : adBlockChecking
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
                {adBlockActive ? (
                    <FaShieldAlt className="w-4 h-4" />
                ) : adBlockChecking ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                ) : (
                    <FaBan className="w-4 h-4" />
                )}
                <span className="text-sm font-semibold">
                    {adBlockActive
                        ? `DNS Ad-Block Active (${blockedAds} blocked${adSegmentsRemoved > 0 ? ` • ${adSegmentsRemoved} segments` : ''})`
                        : adBlockChecking
                            ? 'Checking Ad-Block...'
                            : 'DNS Ad-Block Inactive'
                    }
                </span>
                {!adBlockActive && !adBlockChecking && (
                    <button
                        onClick={activateAdBlock}
                        className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Activate
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            {/* DNS Ad-Block Status */}
            <DNSAdBlockStatus />

            {/* Header */}
            <header className="bg-[#e8e8e8] border-b border-gray-300 py-3 shadow-sm">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="neumorphic-nav-item group"
                            aria-label="Back to matches"
                        >
                            <FaArrowLeft className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Back to Matches</span>
                        </Link>

                        <div className="flex items-center gap-3">
                            {/* Ad-Block Status Badge */}
                            {adBlockActive && (
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg border border-green-300">
                                    <FaShieldAlt className="w-4 h-4" />
                                    <span className="text-sm font-medium">Ad-Free</span>
                                </div>
                            )}

                            <button
                                onClick={handleShare}
                                className="neumorphic-button p-2 relative"
                                aria-label="Share match"
                                aria-expanded={showShareOptions}
                            >
                                <FaShareAlt className="w-5 h-5 text-gray-700" aria-hidden="true" />
                                {showShareOptions && (
                                    <div className="absolute right-0 top-full mt-2 neumorphic-dropdown w-48 z-50">
                                        <div className="py-2">
                                            <button
                                                onClick={copyToClipboard}
                                                className="dropdown-item"
                                                aria-label="Copy link to clipboard"
                                            >
                                                Copy Link
                                            </button>
                                            <a
                                                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Watch ${match.homeTeam} vs ${match.awayTeam}`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="dropdown-item"
                                                aria-label="Share on Twitter"
                                            >
                                                Share on Twitter
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </button>

                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300">
                                <div className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></div>
                                <span className="text-sm text-gray-700">LIVE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Match Header */}
                    <div className="neumorphic-card mb-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center justify-center gap-4 md:gap-8 flex-1">
                                <div className="text-center">
                                    <div className="relative w-16 h-16 mx-auto mb-3">
                                        <div className="absolute inset-0 neumorphic-logo rounded-full"></div>
                                        <Image
                                            src={match.homeTeamIMG}
                                            alt={match.homeTeam}
                                            fill
                                            className="object-contain p-2"
                                            onError={handleImageError}
                                            sizes="64px"
                                        />
                                    </div>
                                    <div className="font-bold text-gray-900 text-sm md:text-base">
                                        {match.homeTeam}
                                    </div>
                                    <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                                        {match.score?.home || '0'}
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div
                                        className={`px-3 py-1 rounded-full text-xs font-bold mb-2 ${getMatchStatusColor(match.status)}`}
                                        aria-label={`Match status: ${getMatchStatusText(match.status)}`}
                                    >
                                        {getMatchStatusText(match.status)}
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 mb-1">VS</div>
                                    <div className="text-sm text-gray-600">
                                        {formatDateTime(match.start)}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        {getSportIcon(match.sport)}
                                        <span className="text-xs text-gray-600">{match.sport}</span>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="relative w-16 h-16 mx-auto mb-3">
                                        <div className="absolute inset-0 neumorphic-logo rounded-full"></div>
                                        <Image
                                            src={match.awayTeamIMG}
                                            alt={match.awayTeam}
                                            fill
                                            className="object-contain p-2"
                                            onError={handleImageError}
                                            sizes="64px"
                                        />
                                    </div>
                                    <div className="font-bold text-gray-900 text-sm md:text-base">
                                        {match.awayTeam}
                                    </div>
                                    <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                                        {match.score?.away || '0'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {match.countryIMG && (
                                    <div className="relative w-8 h-6">
                                        <Image
                                            src={match.countryIMG}
                                            alt={match.country || ""}
                                            fill
                                            className="object-cover rounded"
                                            sizes="32px"
                                            onError={handleImageError}
                                        />
                                    </div>
                                )}
                                <div className="text-center">
                                    <div className="font-semibold text-gray-900">{match.tournament}</div>
                                    <div className="text-sm text-gray-600">{match.country}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Video Player Section */}
                        <div
                            ref={videoContainerRef}
                            className="neumorphic-video-container relative"
                            tabIndex={streamError ? 0 : -1}
                        >
                            {activeStream && !streamError ? (
                                <div className="absolute inset-0 w-full h-full">
                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 z-10">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                                            <span className="ml-4 text-gray-700">
            {adBlockActive ? 'Loading ad-free stream...' : 'Loading stream...'}
          </span>
                                        </div>
                                    )}

                                    {/* Client-only iframe to avoid hydration mismatch */}
                                    {typeof window !== 'undefined' && (
                                        <iframe
                                            ref={iframeRef}
                                            key={iframeKey}
                                            src={getEmbedUrl(activeStream)}
                                            className="absolute inset-0 w-full h-full border-0 rounded-xl"
                                            allowFullScreen
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            onError={handleStreamError}
                                            onLoad={() => {
                                                fixIframeSize();
                                                setIsLoading(false);
                                                setTimeout(forceSkipAds, 2000);
                                            }}
                                            title={`${match.homeTeam} vs ${match.awayTeam} - ${activeStream.channel_name}`}
                                            sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation allow-popups"
                                            referrerPolicy="no-referrer"
                                            data-stream="true"
                                            data-player="main"
                                            data-ad-block="active"
                                            loading="eager"
                                            name={`player_${Math.random().toString(36).substr(2, 8)}`}
                                        />
                                    )}

                                        {/* Ad-Block Status Overlay */}
                                        {adBlockActive && (
                                            <div className="absolute top-4 left-4 z-20">
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600/90 text-white rounded-lg backdrop-blur-sm">
                                                    <FaShieldAlt className="w-4 h-4" />
                                                    <span className="text-sm font-semibold">DNS Ad-Block Active</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Manual Ad Skip Button */}
                                        <div className="absolute top-4 right-4 z-20">
                                            <button
                                                onClick={forceSkipAds}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/90 text-white rounded-lg backdrop-blur-sm hover:bg-red-700/90 transition"
                                            >
                                                <FaCheckCircle className="w-4 h-4" />
                                                <span className="text-sm font-semibold">Skip Ads</span>
                                            </button>
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-2 text-white">
                                                        <FaSignal className="w-4 h-4" aria-hidden="true" />
                                                        <span className="text-sm">1080p HD</span>
                                                    </div>
                                                    {activeStream.viewers > 0 && (
                                                        <div className="flex items-center gap-2 text-white">
                                                            <FaEye className="w-4 h-4" aria-hidden="true" />
                                                            <span className="text-sm">{formatViewers(activeStream.viewers)} watching</span>
                                                        </div>
                                                    )}
                                                    {adBlockActive && (blockedAds > 0 || adSegmentsRemoved > 0) && (
                                                        <div className="flex items-center gap-2 text-green-300">
                                                            <FaShieldAlt className="w-4 h-4" aria-hidden="true" />
                                                            <span className="text-sm">
                                                                {blockedAds} blocked{adSegmentsRemoved > 0 ? ` • ${adSegmentsRemoved} segments` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handleFullScreen}
                                                    className="neumorphic-button p-2 bg-white/10 backdrop-blur-sm border border-white/20"
                                                    aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
                                                    aria-expanded={isFullScreen}
                                                >
                                                    <FaExpand className="w-5 h-5 text-white" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center neumorphic-card">
                                        <div className="text-center p-8">
                                            <div className="text-6xl mb-6 text-gray-400">📺</div>
                                            {streamError ? (
                                                <>
                                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Stream Unavailable</h3>
                                                    <p className="text-gray-600 mb-8 max-w-md">
                                                        {adBlockActive
                                                            ? "Try selecting another server from the list below."
                                                            : "Try activating DNS Ad-Block for better streaming."}
                                                    </p>
                                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                                        <button
                                                            onClick={() => {
                                                                setStreamError(false);
                                                                setIsLoading(true);
                                                            }}
                                                            className="neumorphic-button px-6 py-3 text-gray-700 font-semibold flex items-center gap-3"
                                                            aria-label="Retry loading stream"
                                                        >
                                                            <FaRedoAlt aria-hidden="true" />
                                                            Try Again
                                                        </button>
                                                        {!adBlockActive && (
                                                            <button
                                                                onClick={activateAdBlock}
                                                                className="neumorphic-button px-6 py-3 bg-green-600 text-white font-semibold flex items-center gap-3"
                                                            >
                                                                <FaShieldAlt aria-hidden="true" />
                                                                Activate DNS Ad-Block
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                                                        {match.channels.length > 0 ? 'Ready to Watch' : 'No Streams Available'}
                                                    </h3>
                                                    <p className="text-gray-600">
                                                        {match.channels.length > 0
                                                            ? `Select from ${match.channels.length} available servers`
                                                            : 'Check back later for available streams'
                                                        }
                                                    </p>
                                                    {adBlockActive && (
                                                        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                                                            <div className="flex items-center gap-2 text-green-800">
                                                                <FaShieldAlt className="w-5 h-5" />
                                                                <span className="font-medium">DNS Ad-Block is active</span>
                                                            </div>
                                                            <p className="text-sm text-green-600 mt-1">
                                                                Ads will be blocked at the network level
                                                            </p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Stream Servers */}
                            {match.channels.length > 0 && (
                                <div className="neumorphic-card">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 neumorphic-button">
                                            <FaBroadcastTower className="text-red-500" aria-hidden="true" />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">Available Streams</h2>
                                        <span className="neumorphic-badge bg-red-100 text-red-700">
                                            {match.channels.length} SERVERS
                                        </span>
                                        {adBlockActive && (
                                            <span className="neumorphic-badge bg-green-100 text-green-700">
                                                DNS AD-BLOCK
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {match.channels.map((channel, index) => (
                                            <button
                                                key={`${channel.channel_code}-${index}-${iframeKey}`}
                                                onClick={() => handleStreamChange(channel)}
                                                className={`neumorphic-server-item ${
                                                    activeStream?.channel_code === channel.channel_code
                                                        ? 'neumorphic-server-active'
                                                        : ''
                                                } ${adBlockActive ? 'border-2 border-green-400' : ''}`}
                                                aria-label={`Switch to server ${index + 1}: ${channel.channel_name}`}
                                                aria-pressed={activeStream?.channel_code === channel.channel_code}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-3 h-3 rounded-full ${
                                                            activeStream?.channel_code === channel.channel_code
                                                                ? 'bg-green-500'
                                                                : adBlockActive
                                                                    ? 'bg-green-400'
                                                                    : 'bg-gray-400'
                                                        }`}
                                                        aria-hidden="true"
                                                    ></div>
                                                    <div className="text-left flex-1">
                                                        <div className="font-medium text-gray-900">
                                                            Server {index + 1}
                                                        </div>
                                                        <div className="text-xs text-gray-600 truncate">
                                                            {channel.channel_name}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {channel.viewers > 0 && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-600">
                                                            <FaEye className="w-3 h-3" aria-hidden="true" />
                                                            {formatViewers(channel.viewers)}
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`text-xs px-2 py-1 rounded ${
                                                            activeStream?.channel_code === channel.channel_code
                                                                ? 'bg-green-100 text-green-700'
                                                                : adBlockActive
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                        aria-label={index === 0 ? 'High Definition' : 'Standard Definition'}
                                                    >
                                                        {index === 0 ? 'HD' : 'SD'}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* DNS Ad-Block Info */}
                                    <div className={`mt-4 p-3 rounded-lg border ${
                                        adBlockActive
                                            ? 'bg-green-50 border-green-200'
                                            : adBlockChecking
                                                ? 'bg-yellow-50 border-yellow-200'
                                                : 'bg-red-50 border-red-200'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            {adBlockActive ? (
                                                <>
                                                    <FaShieldAlt className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-800">
                                                        DNS Ad-Block Active
                                                    </span>
                                                    <span className="text-xs text-green-600 ml-auto">
                                                        {blockedAds} blocked{adSegmentsRemoved > 0 ? ` • ${adSegmentsRemoved} segments` : ''}
                                                    </span>
                                                </>
                                            ) : adBlockChecking ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                                    <span className="text-sm font-medium text-yellow-800">
                                                        Checking DNS Ad-Block...
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <FaBan className="w-4 h-4 text-red-600" />
                                                    <span className="text-sm font-medium text-red-800">
                                                        DNS Ad-Block Inactive
                                                    </span>
                                                    <button
                                                        onClick={activateAdBlock}
                                                        className="ml-auto text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                                    >
                                                        Activate
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-xs mt-1">
                                            {adBlockActive
                                                ? 'Ads are being blocked at the DNS level before they reach your browser'
                                                : adBlockChecking
                                                    ? 'Verifying ad-block status...'
                                                    : 'Activate for ad-free streaming experience'
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Stream Quality Info */}
                            <div className="neumorphic-card">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Stream Quality</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="neumorphic-info-item">
                                        <FaSignal className="text-blue-500 mb-2" aria-hidden="true" />
                                        <div className="text-sm text-gray-600">Quality</div>
                                        <div className="font-semibold text-gray-900">1080p HD</div>
                                    </div>
                                    <div className="neumorphic-info-item">
                                        <FaWifi className="text-green-500 mb-2" aria-hidden="true" />
                                        <div className="text-sm text-gray-600">Bitrate</div>
                                        <div className="font-semibold text-gray-900">Adaptive</div>
                                    </div>
                                    <div className="neumorphic-info-item">
                                        <FaDesktop className="text-purple-500 mb-2" aria-hidden="true" />
                                        <div className="text-sm text-gray-600">Platform</div>
                                        <div className="font-semibold text-gray-900">Web</div>
                                    </div>
                                    <div className="neumorphic-info-item">
                                        <FaMobileAlt className="text-orange-500 mb-2" aria-hidden="true" />
                                        <div className="text-sm text-gray-600">Device</div>
                                        <div className="font-semibold text-gray-900">All Devices</div>
                                    </div>
                                </div>

                                {/* DNS Ad-Block Status */}
                                <div className="mt-4 pt-4 border-t border-gray-300">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-700">
                                            {adBlockActive ? (
                                                <FaShieldAlt className="w-4 h-4 text-green-600" />
                                            ) : adBlockChecking ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                            ) : (
                                                <FaBan className="w-4 h-4 text-red-600" />
                                            )}
                                            <span className="text-sm">DNS Ad-Block:</span>
                                        </div>
                                        <span className={`font-semibold ${
                                            adBlockActive
                                                ? 'text-green-600'
                                                : adBlockChecking
                                                    ? 'text-yellow-600'
                                                    : 'text-red-600'
                                        }`}>
                                            {adBlockActive
                                                ? 'ACTIVE'
                                                : adBlockChecking
                                                    ? 'CHECKING'
                                                    : 'INACTIVE'
                                            }
                                        </span>
                                    </div>
                                    {adBlockActive && (
                                        <p className="text-xs text-green-600 mt-2">
                                            ✓ Ads blocked at DNS level • {blockedAds} blocked so far{adSegmentsRemoved > 0 ? ` • ${adSegmentsRemoved} segments removed` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar - MODERN DARK CHAT */}
                        <aside className="lg:col-span-1 space-y-6">
                            <div className="relative">
                                {/* Username Setup Overlay */}
                                {!isUsernameSet && (
                                    <div className="absolute inset-0 z-10 bg-[#343541] rounded-xl flex flex-col p-6 shadow-2xl">
                                        <h3 className="text-white text-lg font-semibold mb-6">Join Live Chat</h3>
                                        <div className="flex gap-3 mb-4">
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && saveUsername()}
                                                placeholder="Choose a username"
                                                maxLength={MAX_USERNAME_LENGTH}
                                                className="flex-1 bg-[#40414F] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                aria-label="Enter username"
                                            />
                                            <button
                                                onClick={saveUsername}
                                                disabled={username.trim().length < 3 || username.trim().length > MAX_USERNAME_LENGTH}
                                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                aria-label="Join chat"
                                            >
                                                Join
                                            </button>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-400">
                                            <button
                                                onClick={generateRandomUsername}
                                                className="hover:text-white transition"
                                                aria-label="Generate random username"
                                            >
                                                Randomize
                                            </button>
                                            <span>{username.length}/{MAX_USERNAME_LENGTH}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-4 text-center">
                                            {username.trim().length < 3 ? 'Minimum 3 characters required' : 'Press Enter or click Join'}
                                        </p>
                                    </div>
                                )}

                                {/* Modern Dark Chat */}
                                <div className="chat-container">
                                    {/* Header */}
                                    <div className="chat-nav-bar">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <FaUsers className="text-gray-300 w-5 h-5" aria-hidden="true" />
                                                {isConnected ? (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#343541]"></div>
                                                ) : (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#343541] animate-pulse"></div>
                                                )}
                                            </div>
                                            <span className="text-white font-semibold">Live Chat</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-400">
                                                    {isConnected ? `${onlineUsers} online` : 'Connecting...'}
                                                </span>
                                                {connectionError && (
                                                    <span className="text-xs text-yellow-400 ml-2">⚠️</span>
                                                )}
                                            </div>
                                        </div>
                                        {isUsernameSet && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <span
                                                    className="font-medium truncate max-w-[100px]"
                                                    style={{ color: getUserColor(username) }}
                                                >
                                                    {username}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        localStorage.removeItem(`chat-username-${match.gameID}`);
                                                        setIsUsernameSet(false);
                                                        generateRandomUsername();
                                                    }}
                                                    className="text-gray-400 hover:text-white transition"
                                                    title="Change username"
                                                    aria-label="Change username"
                                                >
                                                    <FaUser className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Messages Area */}
                                    <div ref={chatContainerRef} className="chat-messages-area">
                                        {messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center">
                                                <FaRobot className="w-20 h-20 mb-6 opacity-40 text-gray-400" aria-hidden="true" />
                                                <p className="text-lg text-gray-300">No messages yet</p>
                                                <p className="text-sm mt-2 text-gray-400">Be the first to say something!</p>
                                            </div>
                                        ) : (
                                            <>
                                                {messages.map((msg) => (
                                                    <div key={msg.id} className="chat-message">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                                {msg.isAdmin ? (
                                                                    <FaCrown className="text-yellow-500 w-5 h-5" aria-hidden="true" />
                                                                ) : (
                                                                    <FaUser className="text-gray-400 w-4 h-4" aria-hidden="true" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-baseline gap-2">
                                                                    <span
                                                                        className="font-semibold text-sm"
                                                                        style={{ color: typeof msg.color === 'string' && msg.color.startsWith('#') ? msg.color : getUserColor(msg.username) }}
                                                                    >
                                                                        {msg.username}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {typeof msg.timestamp === 'string'
                                                                            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                            : msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                        }
                                                                    </span>
                                                                </div>
                                                                <p
                                                                    className="text-white text-sm break-words mt-1"
                                                                    dangerouslySetInnerHTML={{ __html: msg.message }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {isTyping && (
                                                    <div className="chat-message">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-gray-700 animate-pulse" aria-hidden="true"></div>
                                                            <span className="text-sm italic text-gray-400">Someone is typing...</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={messagesEndRef} aria-hidden="true" />
                                            </>
                                        )}
                                    </div>

                                    {/* Input Area */}
                                    {isUsernameSet && (
                                        <div className="chat-sender-area">
                                            {connectionError && (
                                                <div className="text-xs text-yellow-400 mb-2 px-3 animate-pulse">
                                                    ⚠️ {connectionError}
                                                </div>
                                            )}
                                            <div className="chat-input-place">
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={newMessage}
                                                    onChange={(e) => {
                                                        setNewMessage(e.target.value);
                                                        handleTyping(e.target.value.length > 0);
                                                    }}
                                                    onKeyDown={handleKeyPress}
                                                    onBlur={() => handleTyping(false)}
                                                    placeholder="Send a message..."
                                                    disabled={!isConnected}
                                                    className="chat-send-input text-white placeholder-gray-500"
                                                    maxLength={MAX_MESSAGE_LENGTH}
                                                    aria-label="Type your message"
                                                    aria-describedby="message-length"
                                                />
                                                <button
                                                    onClick={sendMessage}
                                                    disabled={!isConnected || !newMessage.trim()}
                                                    className="chat-send-button"
                                                    aria-label="Send message"
                                                >
                                                    <svg className="send-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill="#6B6C7B" d="M481.508,210.336L68.414,38.926c-17.403-7.222-37.064-4.045-51.309,8.287C2.86,59.547-3.098,78.551,1.558,96.808 L38.327,241h180.026c8.284,0,15.001,6.716,15.001,15.001c0,8.284-6.716,15.001-15.001,15.001H38.327L1.558,415.193 c-4.656,18.258,1.301,37.262,15.547,49.595c14.274,12.357,33.937,15.495,51.31,8.287l413.094-171.409 C500.317,293.862,512,276.364,512,256.001C512,235.638,500.317,218.139,481.508,210.336z"/>
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2 px-3 flex justify-between">
                                                <span className="flex items-center gap-2">
                                                    {isConnected ? (
                                                        <>
                                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                            <span>Connected</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                                            <span>
                                                                {reconnectAttempts > 0
                                                                    ? `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
                                                                    : 'Connecting...'
                                                                }
                                                            </span>
                                                        </>
                                                    )}
                                                </span>
                                                <span id="message-length">{newMessage.length}/{MAX_MESSAGE_LENGTH}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Active Stream Info */}
                            {activeStream && (
                                <div className="neumorphic-card">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Current Stream</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Channel</span>
                                            <span className="font-semibold text-gray-900">{activeStream.channel_name}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Quality</span>
                                            <span className="font-semibold text-green-600">HD</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Viewers</span>
                                            <div className="flex items-center gap-2">
                                                <FaEye className="w-4 h-4 text-gray-500" aria-hidden="true" />
                                                <span className="font-semibold text-gray-900">{formatViewers(activeStream.viewers)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Status</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></div>
                                                <span className="font-semibold text-green-600">Live</span>
                                            </div>
                                        </div>
                                        {/* DNS Ad-Block Status */}
                                        <div className={`flex items-center justify-between p-3 rounded-lg ${
                                            adBlockActive
                                                ? 'bg-green-50 border border-green-200'
                                                : adBlockChecking
                                                    ? 'bg-yellow-50 border border-yellow-200'
                                                    : 'bg-red-50 border border-red-200'
                                        }`}>
                                            <span className="text-sm text-gray-600">DNS Ad-Block</span>
                                            <div className="flex items-center gap-2">
                                                {adBlockActive ? (
                                                    <>
                                                        <FaShieldAlt className="w-4 h-4 text-green-600" aria-hidden="true" />
                                                        <span className="font-semibold text-green-600">Active</span>
                                                    </>
                                                ) : adBlockChecking ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                                        <span className="font-semibold text-yellow-600">Checking</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaBan className="w-4 h-4 text-red-600" aria-hidden="true" />
                                                        <span className="font-semibold text-red-600">Inactive</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* DNS Ad-Block Activation */}
                                    {!adBlockActive && !adBlockChecking && (
                                        <div className="mt-4 pt-4 border-t border-gray-300">
                                            <button
                                                onClick={activateAdBlock}
                                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-3"
                                            >
                                                <FaShieldAlt className="w-5 h-5" />
                                                Activate DNS Ad-Block
                                            </button>
                                            <p className="text-xs text-gray-500 text-center mt-2">
                                                Block ads at the network level
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </aside>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-300 mt-12 py-8">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center">
                        <div className="mb-6">
                            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                BraveStream
                            </span>
                        </div>
                        <p className="text-gray-600">
                            © {new Date().getFullYear()} BraveStream. All rights reserved.
                        </p>
                        <p className="text-sm text-gray-500 mt-4">
                            Watch live sports in crystal clear HD. No blackouts, no restrictions.
                        </p>
                        <div className="mt-6 flex justify-center gap-4">
                            <button className="text-xs text-gray-500 hover:text-gray-700">Terms</button>
                            <button className="text-xs text-gray-500 hover:text-gray-700">Privacy</button>
                            <button className="text-xs text-gray-500 hover:text-gray-700">Contact</button>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Inline Styles */}
            <style jsx global>{`
                /* Neumorphic Styles */
                .neumorphic-card {
                    background: #e0e0e0;
                    border-radius: 20px;
                    padding: 20px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;
                }
                .neumorphic-video-container {
                    background: #e0e0e0;
                    border-radius: 20px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;
                    position: relative;
                    overflow: hidden;
                    height: 60vh;
                    min-height: 400px;
                    max-height: 600px;
                    outline: none;
                }
                .neumorphic-nav-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    color: #4b5563;
                    font-weight: 500;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .neumorphic-nav-item:hover {
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                }
                .neumorphic-button {
                    border-radius: 12px;
                    background: #e0e0e0;
                    border: none;
                    cursor: pointer;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .neumorphic-button:hover:not(:disabled) {
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                }
                .neumorphic-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .neumorphic-server-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }
                .neumorphic-server-item:hover {
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                }
                .neumorphic-server-active {
                    background: linear-gradient(145deg, #cacaca, #f0f0f0);
                    box-shadow: inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff;
                }
                .neumorphic-info-item {
                    text-align: center;
                    padding: 16px 12px;
                    border-radius: 12px;
                    background: #e0e0e0;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                }
                .neumorphic-dropdown {
                    background: #e8e8e8;
                    border-radius: 12px;
                    box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff, 0 10px 30px rgba(0,0,0,0.1);
                }
                .dropdown-item {
                    display: block;
                    padding: 10px 16px;
                    color: #4b5563;
                    width: 100%;
                    text-align: left;
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .dropdown-item:hover {
                    background: rgba(0,0,0,0.05);
                }
                .neumorphic-logo {
                    background: #e0e0e0;
                    border-radius: 12px;
                    box-shadow: 4px 4px 8px #bebebe, -4px -4px 8px #ffffff;
                }
                .neumorphic-badge {
                    padding: 4px 8px;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                /* Modern Dark Chat Styles */
                .chat-container {
                    width: 100%;
                    height: calc(100vh - 200px);
                    background-color: #343541;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                .chat-nav-bar {
                    height: 60px;
                    background-color: #343541;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 20px;
                    border-bottom: 1px solid #444654;
                    flex-shrink: 0;
                }
                .chat-messages-area {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .chat-messages-area::-webkit-scrollbar {
                    width: 8px;
                }
                .chat-messages-area::-webkit-scrollbar-thumb {
                    background: #444654;
                    border-radius: 4px;
                }
                .chat-messages-area::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chat-message p,
                .chat-message span {
                    color: white;
                }
                .chat-message .text-gray-400 {
                    color: #9ca3af;
                }
                .chat-sender-area {
                    padding: 16px;
                    background-color: #343541;
                    flex-shrink: 0;
                    border-top: 1px solid #444654;
                }
                .chat-input-place {
                    display: flex;
                    align-items: center;
                    background-color: #40414F;
                    border-radius: 12px;
                    padding: 0 16px;
                    height: 52px;
                    border: 1px solid #2E2F3A;
                }
                .chat-send-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: white;
                    font-size: 15px;
                }
                .chat-send-input::placeholder {
                    color: #9ca3af;
                }
                .chat-send-input:disabled {
                    opacity: 0.5;
                }
                .chat-send-button {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 50%;
                    transition: background 0.2s;
                    background: transparent;
                    border: none;
                }
                .chat-send-button:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.1);
                }
                .chat-send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .send-icon {
                    width: 20px;
                    height: 20px;
                }

                /* Fullscreen Fallback */
                .fullscreen-fallback {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 9999 !important;
                }

                /* Loading Spinner */
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                /* Responsive */
                @media (max-width: 1024px) {
                    .chat-container {
                        height: 500px;
                    }
                }
                @media (max-width: 768px) {
                    .neumorphic-video-container {
                        height: 50vh;
                        min-height: 300px;
                    }
                    .chat-container {
                        height: 400px;
                    }
                }
                @media (max-width: 640px) {
                    .neumorphic-video-container {
                        height: 40vh;
                        min-height: 250px;
                    }
                    .chat-container {
                        height: 350px;
                    }
                }

                /* DNS Ad-Block Override Styles */
                [data-ad-block="active"] {
                    filter: none !important;
                    -webkit-filter: none !important;
                }
            `}</style>
        </div>
    );
}