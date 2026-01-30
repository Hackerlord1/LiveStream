// src/app/match/[id]/MatchPlayer.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// API - separate type imports
import type { Match, Channel } from '@/lib/api';

// Icons
import {
    FaExpand,
    FaCompress,
    FaRedoAlt,
    FaTv,
    FaArrowLeft,
    FaBroadcastTower,
    FaFutbol,
    FaBasketballBall,
    FaFootballBall,
    FaHockeyPuck,
    FaEye,
    FaSignal,
    FaWifi,
    FaDesktop,
    FaMobileAlt,
    FaShareAlt,
    FaUser,
    FaUsers,
    FaRobot,
    FaCrown,
    FaCopy,
    FaTwitter,
    FaWhatsapp,
} from 'react-icons/fa';

// ========== TYPES ==========
interface MatchPlayerProps {
    match: Match;
}

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
    message?: ChatMessage | string;
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

// ========== CONSTANTS ==========
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://serverstream.onrender.com';

const CHAT_CONFIG = {
    MAX_MESSAGE_LENGTH: 200,
    MAX_USERNAME_LENGTH: 20,
    MAX_RECONNECT_ATTEMPTS: 5,
    BASE_RECONNECT_DELAY: 1000,
    HEARTBEAT_INTERVAL: 25000,
    TYPING_TIMEOUT: 3000,
    MAX_MESSAGES: 200,
} as const;

const USER_COLORS = [
    '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
] as const;

const RANDOM_NAMES = {
    adjectives: ['Swift', 'Clever', 'Brave', 'Fast', 'Smart', 'Cool', 'Epic', 'Mighty', 'Golden', 'Silver'],
    animals: ['Lion', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Panther', 'Falcon', 'Shark', 'Dragon'],
} as const;

const SPORT_ICONS: Record<string, React.ReactNode> = {
    SOCCER: <FaFutbol className="text-emerald-500" />,
    NBA: <FaBasketballBall className="text-orange-500" />,
    NFL: <FaFootballBall className="text-red-500" />,
    NHL: <FaHockeyPuck className="text-blue-500" />,
};

const MATCH_STATUS_CONFIG = {
    live: { color: 'bg-red-500 text-white', text: 'LIVE' },
    upcoming: { color: 'bg-blue-500 text-white', text: 'UPCOMING' },
    ended: { color: 'bg-gray-500 text-white', text: 'ENDED' },
} as const;

// ========== HELPER FUNCTIONS ==========
const generateMessageId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getUserColor = (username: string): string => {
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return USER_COLORS[hash % USER_COLORS.length];
};

const generateRandomUsername = (): string => {
    const adj = RANDOM_NAMES.adjectives[Math.floor(Math.random() * RANDOM_NAMES.adjectives.length)];
    const animal = RANDOM_NAMES.animals[Math.floor(Math.random() * RANDOM_NAMES.animals.length)];
    const num = Math.floor(Math.random() * 999) + 1;
    return `${adj}${animal}${num}`;
};

const sanitizeMessage = (text: string): string => {
    return text
        .trim()
        .substring(0, CHAT_CONFIG.MAX_MESSAGE_LENGTH)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const formatViewers = (viewers: number): string => {
    if (viewers >= 1_000_000) return `${(viewers / 1_000_000).toFixed(1)}M`;
    if (viewers >= 1_000) return `${(viewers / 1_000).toFixed(1)}K`;
    return viewers.toString();
};

const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatMessageTime = (timestamp: Date | string): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getSportIcon = (sport: string): React.ReactNode => {
    return SPORT_ICONS[sport] || <FaTv className="text-purple-500" />;
};

const getMatchStatusConfig = (status: string) => {
    return MATCH_STATUS_CONFIG[status as keyof typeof MATCH_STATUS_CONFIG] || MATCH_STATUS_CONFIG.ended;
};

// ========== SUB-COMPONENTS ==========

// Loading Overlay
const LoadingOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
        <div className="text-center">
            <div className="loading-spinner h-12 w-12 mx-auto"></div>
            <span className="mt-4 block text-white">Loading stream...</span>
        </div>
    </div>
);

// Stream Error State
interface StreamErrorStateProps {
    hasChannels: boolean;
    onRetry: () => void;
}

const StreamErrorState = ({ hasChannels, onRetry }: StreamErrorStateProps) => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#e0e0e0] rounded-xl">
        <div className="text-center p-8">
            <div className="text-6xl mb-6 text-gray-400">📺</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Stream Unavailable</h3>
            <p className="text-gray-600 mb-8 max-w-md">
                {hasChannels
                    ? 'Try selecting another server from the list below.'
                    : 'No streams are currently available for this match.'}
            </p>
            <button
                onClick={onRetry}
                className="neumorphic-button px-6 py-3 text-gray-700 font-semibold flex items-center gap-3 mx-auto"
            >
                <FaRedoAlt />
                Try Again
            </button>
        </div>
    </div>
);

// No Stream State
interface NoStreamStateProps {
    channelCount: number;
}

const NoStreamState = ({ channelCount }: NoStreamStateProps) => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#e0e0e0] rounded-xl">
        <div className="text-center p-8">
            <div className="text-6xl mb-6 text-gray-400">📺</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
                {channelCount > 0 ? 'Ready to Watch' : 'No Streams Available'}
            </h3>
            <p className="text-gray-600">
                {channelCount > 0
                    ? `Select from ${channelCount} available servers`
                    : 'Check back later for available streams'}
            </p>
        </div>
    </div>
);

// Share Dropdown
interface ShareDropdownProps {
    isOpen: boolean;
    matchTitle: string;
    onCopy: () => void;
}

const ShareDropdown = ({ isOpen, matchTitle, onCopy }: ShareDropdownProps) => {
    if (!isOpen || typeof window === 'undefined') return null;

    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(matchTitle);

    return (
        <div className="absolute right-0 top-full mt-2 neumorphic-dropdown w-48 z-50">
            <div className="py-2">
                <button onClick={onCopy} className="dropdown-item">
                    <FaCopy className="w-4 h-4" />
                    Copy Link
                </button>
                <a
                    href={`https://twitter.com/intent/tweet?url=${url}&text=${text}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dropdown-item"
                >
                    <FaTwitter className="w-4 h-4 text-blue-400" />
                    Share on Twitter
                </a>
                <a
                    href={`https://wa.me/?text=${text}%20${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dropdown-item"
                >
                    <FaWhatsapp className="w-4 h-4 text-green-500" />
                    Share on WhatsApp
                </a>
            </div>
        </div>
    );
};

// Username Setup Overlay
interface UsernameSetupProps {
    username: string;
    onUsernameChange: (value: string) => void;
    onSave: () => void;
    onRandomize: () => void;
}

const UsernameSetup = ({ username, onUsernameChange, onSave, onRandomize }: UsernameSetupProps) => {
    const isValid = username.trim().length >= 3 && username.trim().length <= CHAT_CONFIG.MAX_USERNAME_LENGTH;

    return (
        <div className="absolute inset-0 z-10 bg-[#343541] rounded-xl flex flex-col p-6 shadow-2xl">
            <h3 className="text-white text-lg font-semibold mb-6">Join Live Chat</h3>
            <div className="flex gap-3 mb-4">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isValid && onSave()}
                    placeholder="Choose a username"
                    maxLength={CHAT_CONFIG.MAX_USERNAME_LENGTH}
                    className="flex-1 bg-[#40414F] text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={onSave}
                    disabled={!isValid}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    Join
                </button>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
                <button onClick={onRandomize} className="hover:text-white transition">
                    Randomize
                </button>
                <span>{username.length}/{CHAT_CONFIG.MAX_USERNAME_LENGTH}</span>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
                {!isValid ? 'Minimum 3 characters required' : 'Press Enter or click Join'}
            </p>
        </div>
    );
};

// Chat Message Component
interface ChatMessageItemProps {
    message: ChatMessage;
}

const ChatMessageItem = ({ message }: ChatMessageItemProps) => (
    <div className="chat-message">
        <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                {message.isAdmin ? (
                    <FaCrown className="text-yellow-500 w-5 h-5" />
                ) : (
                    <FaUser className="text-gray-400 w-4 h-4" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span
                        className="font-semibold text-sm"
                        style={{ color: message.color || getUserColor(message.username) }}
                    >
                        {message.username}
                    </span>
                    <span className="text-xs text-gray-400">
                        {formatMessageTime(message.timestamp)}
                    </span>
                </div>
                <p
                    className="text-white text-sm break-words mt-1"
                    dangerouslySetInnerHTML={{ __html: message.message }}
                />
            </div>
        </div>
    </div>
);

// Stream Info Card
interface StreamInfoCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    iconColor?: string;
}

const StreamInfoCard = ({ icon, label, value, iconColor = 'text-gray-500' }: StreamInfoCardProps) => (
    <div className="neumorphic-info-item">
        <div className={`${iconColor} mb-2 flex justify-center`}>{icon}</div>
        <div className="text-sm text-gray-600">{label}</div>
        <div className="font-semibold text-gray-900">{value}</div>
    </div>
);

// ========== CUSTOM HOOKS ==========

// useLocalStorage hook
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback((value: T) => {
        setStoredValue(value);
        if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }, [key]);

    return [storedValue, setValue];
}

// ========== MAIN COMPONENT ==========
export default function MatchPlayer({ match }: MatchPlayerProps) {
    // Stream State
    const [activeStream, setActiveStream] = useState<Channel | null>(match.channels?.[0] || null);
    const [streamError, setStreamError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [iframeKey, setIframeKey] = useState<string>(`iframe-${Date.now()}`);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [username, setUsername] = useState(() => generateRandomUsername());
    const [isUsernameSet, setIsUsernameSet] = useLocalStorage(`chat-username-set-${match.gameID}`, false);
    const [savedUsername, setSavedUsername] = useLocalStorage(`chat-username-${match.gameID}`, '');
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Refs
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Derived values
    const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
    const statusConfig = getMatchStatusConfig(match.status);

    // Load saved username
    useEffect(() => {
        if (savedUsername) {
            setUsername(savedUsername);
        }
    }, [savedUsername]);

    // Add message handler
    const addMessage = useCallback((message: ChatMessage) => {
        setMessages(prev => {
            const newMessages = [...prev, {
                ...message,
                id: message.id || generateMessageId(),
                timestamp: typeof message.timestamp === 'string' ? new Date(message.timestamp) : message.timestamp,
            }];
            return newMessages.slice(-CHAT_CONFIG.MAX_MESSAGES);
        });
    }, []);

    // WebSocket Connection
    useEffect(() => {
        if (!isUsernameSet || !match?.gameID) return;

        let ws: WebSocket | null = null;
        let connectionAttempts = 0;

        const connectWebSocket = () => {
            if (ws) {
                ws.close();
                ws = null;
            }

            if (!WS_URL) {
                setConnectionError('Chat server not configured');
                return;
            }

            try {
                const url = new URL(WS_URL);
                url.searchParams.append('matchId', match.gameID);
                url.searchParams.append('username', username);

                console.log('🔗 Connecting to WebSocket:', url.toString());
                ws = new WebSocket(url.toString());

                ws.onopen = () => {
                    console.log('✅ WebSocket connected');
                    setIsConnected(true);
                    setConnectionError(null);
                    setReconnectAttempts(0);
                    connectionAttempts = 0;

                    heartbeatIntervalRef.current = setInterval(() => {
                        if (ws?.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                        }
                    }, CHAT_CONFIG.HEARTBEAT_INTERVAL);
                };

                ws.onmessage = (event) => {
                    try {
                        const data: WebSocketMessage = JSON.parse(event.data);
                        handleWebSocketMessage(data);
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                    }
                };

                ws.onclose = (event) => {
                    console.log('🔌 WebSocket disconnected:', event.code);
                    setIsConnected(false);
                    setIsTyping(false);

                    if (heartbeatIntervalRef.current) {
                        clearInterval(heartbeatIntervalRef.current);
                    }

                    if (event.code !== 1000 && connectionAttempts < CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS) {
                        connectionAttempts++;
                        setReconnectAttempts(connectionAttempts);

                        const delay = Math.min(
                            CHAT_CONFIG.BASE_RECONNECT_DELAY * Math.pow(2, connectionAttempts - 1),
                            30000
                        ) + Math.random() * 1000;

                        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
                    } else if (connectionAttempts >= CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS) {
                        setConnectionError('Failed to connect. Please refresh the page.');
                    }
                };

                ws.onerror = () => {
                    setConnectionError('Connection error. Trying to reconnect...');
                };

                setWsConnection(ws);
            } catch (error) {
                console.error('❌ Error creating WebSocket:', error);
                setConnectionError('Failed to connect to chat server');
            }
        };

        const handleWebSocketMessage = (data: WebSocketMessage) => {
            switch (data.type) {
                case 'welcome':
                case 'system':
                    addMessage({
                        id: generateMessageId(),
                        username: 'System',
                        message: typeof data.message === 'string' ? data.message : '',
                        timestamp: new Date(),
                        color: '#3B82F6',
                        isAdmin: true,
                    });
                    break;

                case 'message':
                    if (data.message && typeof data.message === 'object') {
                        addMessage({
                            id: data.message.id || generateMessageId(),
                            username: data.message.username,
                            message: data.message.message,
                            timestamp: new Date(data.message.timestamp as string),
                            color: data.message.color || getUserColor(data.message.username),
                            isAdmin: data.message.isAdmin,
                        });
                    }
                    break;

                case 'user_count':
                    setOnlineUsers(data.count || 0);
                    break;

                case 'history':
                    if (data.messages) {
                        const historyMessages = data.messages.map(msg => ({
                            ...msg,
                            id: msg.id || generateMessageId(),
                            timestamp: new Date(msg.timestamp as string),
                            color: msg.color || getUserColor(msg.username),
                        }));
                        setMessages(historyMessages);
                    }
                    break;

                case 'rate_limit':
                    addMessage({
                        id: generateMessageId(),
                        username: 'System',
                        message: typeof data.message === 'string' ? data.message : 'Rate limit exceeded.',
                        timestamp: new Date(),
                        color: '#F59E0B',
                        isAdmin: true,
                    });

                    if (data.retryAfter && inputRef.current) {
                        inputRef.current.disabled = true;
                        setTimeout(() => {
                            if (inputRef.current) {
                                inputRef.current.disabled = false;
                                inputRef.current.focus();
                            }
                        }, data.retryAfter * 1000);
                    }
                    break;

                case 'error':
                    addMessage({
                        id: generateMessageId(),
                        username: 'System',
                        message: typeof data.message === 'string' ? data.message : 'Server error occurred',
                        timestamp: new Date(),
                        color: '#EF4444',
                        isAdmin: true,
                    });
                    break;

                case 'typing':
                    if (data.username && data.username !== username) {
                        setIsTyping(data.isTyping || false);
                    }
                    break;
            }
        };

        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                ws.close(1000, 'Component unmounting');
            }
        };
    }, [isUsernameSet, match.gameID, username, addMessage]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.username !== username) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, username]);

    // Handle typing indicator
    const handleTyping = useCallback((typing: boolean) => {
        if (!wsConnection || !isConnected) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        wsConnection.send(JSON.stringify({
            type: 'typing',
            username,
            isTyping: typing,
        }));

        if (typing) {
            typingTimeoutRef.current = setTimeout(() => {
                if (wsConnection && isConnected) {
                    wsConnection.send(JSON.stringify({
                        type: 'typing',
                        username,
                        isTyping: false,
                    }));
                }
            }, CHAT_CONFIG.TYPING_TIMEOUT);
        }
    }, [wsConnection, isConnected, username]);

    // Send message
    const sendMessage = useCallback(() => {
        if (!newMessage.trim() || !wsConnection || !isConnected) return;

        const messageData = {
            id: generateMessageId(),
            username,
            message: sanitizeMessage(newMessage),
            timestamp: new Date().toISOString(),
            color: getUserColor(username),
        };

        try {
            wsConnection.send(JSON.stringify({ type: 'message', message: messageData }));
            setNewMessage('');
            inputRef.current?.focus();

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
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
                isAdmin: true,
            });
        }
    }, [newMessage, wsConnection, isConnected, username, handleTyping, addMessage]);

    // Save username
    const saveUsername = useCallback(() => {
        const trimmed = username.trim();
        if (trimmed.length >= 3 && trimmed.length <= CHAT_CONFIG.MAX_USERNAME_LENGTH) {
            setSavedUsername(trimmed);
            setIsUsernameSet(true);
        }
    }, [username, setSavedUsername, setIsUsernameSet]);

    // Stream handlers
    const handleStreamChange = useCallback((channel: Channel) => {
        setActiveStream(channel);
        setStreamError(false);
        setIsLoading(true);
        setIframeKey(`iframe-${Date.now()}`);
    }, []);

    const handleStreamError = useCallback(() => {
        setStreamError(true);
        setIsLoading(false);
    }, []);

    const handleRetry = useCallback(() => {
        setStreamError(false);
        setIsLoading(true);
        setIframeKey(`iframe-${Date.now()}`);
    }, []);

    // Fullscreen
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
        } catch {
            container.classList.toggle('fullscreen-fallback');
            setIsFullScreen(!isFullScreen);
        }
    }, [isFullScreen]);

    // Share
    const handleShare = useCallback(async () => {
        if (typeof window === 'undefined') return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: matchTitle,
                    text: `Watch ${matchTitle} live on BraveStream`,
                    url: window.location.href,
                });
                return;
            } catch {
                /* User cancelled */
            }
        }
        setShowShareOptions(!showShareOptions);
    }, [matchTitle, showShareOptions]);

    const copyToClipboard = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // Simple prompt for manual copy
    window.prompt('Copy this match link:', window.location.href);
    setShowShareOptions(false);
}, []);

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

    // Resize observer
    useEffect(() => {
        if (!activeStream || streamError) return;

        setTimeout(fixIframeSize, 100);

        const handleResize = () => requestAnimationFrame(fixIframeSize);
        window.addEventListener('resize', handleResize);

        const observer = new ResizeObserver(handleResize);
        if (videoContainerRef.current) {
            observer.observe(videoContainerRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [activeStream, streamError, fixIframeSize]);

    // Fullscreen change listener
    useEffect(() => {
        const handler = () => setIsFullScreen(!!document.fullscreenElement);

        document.addEventListener('fullscreenchange', handler);
        document.addEventListener('webkitfullscreenchange', handler);

        return () => {
            document.removeEventListener('fullscreenchange', handler);
            document.removeEventListener('webkitfullscreenchange', handler);
        };
    }, []);

    // Image error handler
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        target.src = '/team-placeholder.svg';
        target.onerror = null;
    };

    return (
        <div className="min-h-screen bg-[#e8e8e8] text-gray-900">
            {/* Header */}
            <header className="bg-[#e8e8e8] border-b border-gray-300 py-3 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="neumorphic-nav-item group">
                            <FaArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to Matches</span>
                        </Link>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <button
                                    onClick={handleShare}
                                    className="neumorphic-button p-2"
                                    aria-label="Share match"
                                >
                                    <FaShareAlt className="w-5 h-5 text-gray-700" />
                                </button>
                                <ShareDropdown
                                    isOpen={showShareOptions}
                                    matchTitle={matchTitle}
                                    onCopy={copyToClipboard}
                                />
                            </div>

                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300">
                                <div className={`w-2 h-2 rounded-full ${match.status === 'live' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                <span className="text-sm text-gray-700">{statusConfig.text}</span>
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
                                {/* Home Team */}
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
                                    <div className="font-bold text-gray-900 text-sm md:text-base">{match.homeTeam}</div>
                                    <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                                        {match.score?.home ?? '0'}
                                    </div>
                                </div>

                                {/* VS */}
                                <div className="text-center">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold mb-2 ${statusConfig.color}`}>
                                        {statusConfig.text}
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 mb-1">VS</div>
                                    <div className="text-sm text-gray-600">{formatDateTime(match.start)}</div>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        {getSportIcon(match.sport)}
                                        <span className="text-xs text-gray-600">{match.sport}</span>
                                    </div>
                                </div>

                                {/* Away Team */}
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
                                    <div className="font-bold text-gray-900 text-sm md:text-base">{match.awayTeam}</div>
                                    <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                                        {match.score?.away ?? '0'}
                                    </div>
                                </div>
                            </div>

                            {/* Tournament Info */}
                            <div className="flex items-center gap-3">
                                {match.countryIMG && (
                                    <div className="relative w-8 h-6">
                                        <Image
                                            src={match.countryIMG}
                                            alt={match.country || ''}
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
                        {/* Main Video Player */}
                        <div className="lg:col-span-2 space-y-6">
                            <div ref={videoContainerRef} className="neumorphic-video-container relative">
                                {activeStream && !streamError ? (
                                    <div className="absolute inset-0 w-full h-full">
                                        {isLoading && <LoadingOverlay />}

                                        <iframe
                                            ref={iframeRef}
                                            key={iframeKey}
                                            src={activeStream.url}
                                            className="absolute inset-0 w-full h-full border-0 rounded-xl"
                                            allowFullScreen
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            onError={handleStreamError}
                                            onLoad={() => {
                                                fixIframeSize();
                                                setIsLoading(false);
                                            }}
                                            title={`${matchTitle} - ${activeStream.channel_name}`}
                                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                            loading="eager"
                                        />

                                        {/* Bottom Controls */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 text-white text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                        <span>LIVE</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <FaSignal className="w-4 h-4" />
                                                        <span>HD</span>
                                                    </div>
                                                    {activeStream.viewers > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <FaEye className="w-4 h-4" />
                                                            <span>{formatViewers(activeStream.viewers)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handleFullScreen}
                                                    className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition"
                                                >
                                                    {isFullScreen ? (
                                                        <FaCompress className="w-5 h-5 text-white" />
                                                    ) : (
                                                        <FaExpand className="w-5 h-5 text-white" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : streamError ? (
                                    <StreamErrorState
                                        hasChannels={match.channels.length > 0}
                                        onRetry={handleRetry}
                                    />
                                ) : (
                                    <NoStreamState channelCount={match.channels.length} />
                                )}
                            </div>

                            {/* Stream Servers */}
                            {match.channels.length > 0 && (
                                <div className="neumorphic-card">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 neumorphic-button">
                                            <FaBroadcastTower className="text-red-500" />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">Available Streams</h2>
                                        <span className="neumorphic-badge bg-red-100 text-red-700">
                                            {match.channels.length} SERVERS
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {match.channels.map((channel, index) => (
                                            <button
                                                key={`${channel.channel_code}-${index}`}
                                                onClick={() => handleStreamChange(channel)}
                                                className={`neumorphic-server-item ${
                                                    activeStream?.channel_code === channel.channel_code
                                                        ? 'neumorphic-server-active'
                                                        : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${
                                                        activeStream?.channel_code === channel.channel_code
                                                            ? 'bg-green-500'
                                                            : 'bg-gray-400'
                                                    }`}></div>
                                                    <div className="text-left flex-1">
                                                        <div className="font-medium text-gray-900">Server {index + 1}</div>
                                                        <div className="text-xs text-gray-600 truncate">{channel.channel_name}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {channel.viewers > 0 && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-600">
                                                            <FaEye className="w-3 h-3" />
                                                            {formatViewers(channel.viewers)}
                                                        </div>
                                                    )}
                                                    <div className={`text-xs px-2 py-1 rounded ${
                                                        activeStream?.channel_code === channel.channel_code
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {index === 0 ? 'HD' : 'SD'}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stream Quality Info */}
                            <div className="neumorphic-card">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Stream Quality</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <StreamInfoCard icon={<FaSignal className="w-5 h-5" />} label="Quality" value="1080p HD" iconColor="text-blue-500" />
                                    <StreamInfoCard icon={<FaWifi className="w-5 h-5" />} label="Bitrate" value="Adaptive" iconColor="text-green-500" />
                                    <StreamInfoCard icon={<FaDesktop className="w-5 h-5" />} label="Platform" value="Web" iconColor="text-purple-500" />
                                    <StreamInfoCard icon={<FaMobileAlt className="w-5 h-5" />} label="Device" value="All Devices" iconColor="text-orange-500" />
                                </div>
                            </div>
                        </div>

                        {/* Sidebar - Chat */}
                        <aside className="lg:col-span-1 space-y-6">
                            <div className="relative">
                                {/* Username Setup */}
                                {!isUsernameSet && (
                                    <UsernameSetup
                                        username={username}
                                        onUsernameChange={setUsername}
                                        onSave={saveUsername}
                                        onRandomize={() => setUsername(generateRandomUsername())}
                                    />
                                )}

                                {/* Chat Container */}
                                <div className="chat-container">
                                    {/* Chat Header */}
                                    <div className="chat-nav-bar">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <FaUsers className="text-gray-300 w-5 h-5" />
                                                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#343541] ${
                                                    isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
                                                }`}></div>
                                            </div>
                                            <span className="text-white font-semibold">Live Chat</span>
                                            <span className="text-sm text-gray-400">
                                                {isConnected ? `${onlineUsers} online` : 'Connecting...'}
                                            </span>
                                        </div>
                                        {isUsernameSet && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="font-medium truncate max-w-[100px]" style={{ color: getUserColor(username) }}>
                                                    {username}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setSavedUsername('');
                                                        setIsUsernameSet(false);
                                                        setUsername(generateRandomUsername());
                                                    }}
                                                    className="text-gray-400 hover:text-white transition"
                                                    title="Change username"
                                                >
                                                    <FaUser className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Messages */}
                                    <div ref={chatContainerRef} className="chat-messages-area">
                                        {messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center">
                                                <FaRobot className="w-20 h-20 mb-6 opacity-40 text-gray-400" />
                                                <p className="text-lg text-gray-300">No messages yet</p>
                                                <p className="text-sm mt-2 text-gray-400">Be the first to say something!</p>
                                            </div>
                                        ) : (
                                            <>
                                                {messages.map((msg) => (
                                                    <ChatMessageItem key={msg.id} message={msg} />
                                                ))}
                                                {isTyping && (
                                                    <div className="chat-message">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-gray-700 animate-pulse"></div>
                                                            <span className="text-sm italic text-gray-400">Someone is typing...</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={messagesEndRef} />
                                            </>
                                        )}
                                    </div>

                                    {/* Input */}
                                    {isUsernameSet && (
                                        <div className="chat-sender-area">
                                            {connectionError && (
                                                <div className="text-xs text-yellow-400 mb-2 px-3">⚠️ {connectionError}</div>
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
                                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                                    onBlur={() => handleTyping(false)}
                                                    placeholder="Send a message..."
                                                    disabled={!isConnected}
                                                    maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH}
                                                    className="chat-send-input"
                                                />
                                                <button
                                                    onClick={sendMessage}
                                                    disabled={!isConnected || !newMessage.trim()}
                                                    className="chat-send-button"
                                                >
                                                    <svg className="send-icon" viewBox="0 0 512 512">
                                                        <path fill="#6B6C7B" d="M481.508,210.336L68.414,38.926c-17.403-7.222-37.064-4.045-51.309,8.287C2.86,59.547-3.098,78.551,1.558,96.808L38.327,241h180.026c8.284,0,15.001,6.716,15.001,15.001c0,8.284-6.716,15.001-15.001,15.001H38.327L1.558,415.193c-4.656,18.258,1.301,37.262,15.547,49.595c14.274,12.357,33.937,15.495,51.31,8.287l413.094-171.409C500.317,293.862,512,276.364,512,256.001C512,235.638,500.317,218.139,481.508,210.336z"/>
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2 px-3 flex justify-between">
                                                <span className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                                                    {isConnected
                                                        ? 'Connected'
                                                        : reconnectAttempts > 0
                                                            ? `Reconnecting... (${reconnectAttempts}/${CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS})`
                                                            : 'Connecting...'}
                                                </span>
                                                <span>{newMessage.length}/{CHAT_CONFIG.MAX_MESSAGE_LENGTH}</span>
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
                                                <FaEye className="w-4 h-4 text-gray-500" />
                                                <span className="font-semibold text-gray-900">{formatViewers(activeStream.viewers)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Status</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="font-semibold text-green-600">Live</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                </div>

                {/* Footer */}
                <footer className="bg-white border-t border-gray-300 mt-12 py-8">
                    <div className="max-w-7xl mx-auto px-4 text-center">
                        <div className="mb-6">
                            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                                BraveStream
                            </span>
                        </div>
                        <p className="text-gray-600">© {new Date().getFullYear()} BraveStream. All rights reserved.</p>
                        <p className="text-sm text-gray-500 mt-4">Watch live sports in crystal clear HD. No blackouts, no restrictions.</p>
                    </div>
                </footer>
            </main>
        </div>
    );
}