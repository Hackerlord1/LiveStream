// src/app/match/[id]/MatchPlayer.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// API types
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
    FaShareAlt,
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
const generateMessageId = (): string =>
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

const sanitizeMessage = (text: string): string =>
    text.trim().substring(0, CHAT_CONFIG.MAX_MESSAGE_LENGTH)
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const formatViewers = (viewers: number): string => {
    if (viewers >= 1_000_000) return `${(viewers / 1_000_000).toFixed(1)}M`;
    if (viewers >= 1_000) return `${(viewers / 1_000).toFixed(1)}K`;
    return viewers.toString();
};

const formatDateTime = (dateString: string): string => {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch { return dateString; }
};

const formatMessageTime = (timestamp: Date | string): string => {
    try {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
};

const getSportIcon = (sport: string): React.ReactNode =>
    SPORT_ICONS[sport] || <FaTv className="text-purple-500" />;

const getMatchStatusConfig = (status: string) =>
    MATCH_STATUS_CONFIG[status as keyof typeof MATCH_STATUS_CONFIG] || MATCH_STATUS_CONFIG.ended;

const getScoreDisplay = (match: Match) => {
    const hasScore = match.score && match.score.home !== undefined && match.score.away !== undefined;
    if (hasScore) return { home: match.score!.home.toString(), away: match.score!.away.toString(), showScore: true };
    return { home: '-', away: '-', showScore: false };
};

// ========== SVG ICONS ==========
const ChatIcon = ({ className = "w-5 h-5", style }: { className?: string; style?: React.CSSProperties }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} style={style}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
);

const GearIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
);

const SendIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
);

// ========== CHAT SUB-COMPONENTS (DARK MODE) ==========

const ChatSkeleton = () => (
    <div className="rounded-lg shadow-lg w-full" style={{ backgroundColor: 'var(--surface-primary)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--surface-tertiary)' }}></div>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Live Chat</span>
            </div>
            <div className="w-16 h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--surface-tertiary)' }}></div>
        </div>
        <div className="p-4 h-[400px] flex items-center justify-center">
            <div className="text-center">
                <div className="loading-spinner h-8 w-8 mb-3 mx-auto"></div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading chat...</p>
            </div>
        </div>
        <div className="relative" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <input type="text" placeholder="Loading..." disabled className="h-10 w-full rounded-b-lg pl-3 text-sm" style={{ backgroundColor: 'var(--surface-secondary)' }} />
        </div>
    </div>
);

interface ChatMessageItemProps {
    message: ChatMessage;
    isOwnMessage: boolean;
}

const ChatMessageItem = ({ message, isOwnMessage }: ChatMessageItemProps) => (
    <li className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 mb-0.5 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
            <span className="text-[11px] font-semibold" style={{ color: message.color || getUserColor(message.username) }}>
                {message.isAdmin ? '⭐ ' : ''}{message.username}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {formatMessageTime(message.timestamp)}
            </span>
        </div>
        <div
            className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm break-words ${isOwnMessage ? 'bg-blue-600/70 text-white text-right' : ''}`}
            style={!isOwnMessage ? (message.isAdmin
                ? { backgroundColor: 'var(--warning-bg)', color: 'var(--text-primary)', border: '1px solid var(--warning-text)' }
                : { backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }
            ) : undefined}
            dangerouslySetInnerHTML={{ __html: message.message }}
        />
    </li>
);

const TypingIndicator = () => (
    <li className="flex flex-col items-start">
        <div className="flex w-fit items-center gap-1 rounded-lg px-3 py-2.5 text-sm" style={{ backgroundColor: 'var(--surface-secondary)' }}>
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-light)', animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '300ms' }}></div>
        </div>
    </li>
);

const ChatEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <ChatIcon className="w-16 h-16 mb-4" style={{ color: 'var(--border-primary)' }} />
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>No messages yet</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Be the first to say something!</p>
    </div>
);

// ========== STREAM SUB-COMPONENTS (DARK MODE) ==========

interface StreamErrorStateProps {
    hasChannels: boolean;
    onRetry: () => void;
}

const StreamErrorState = ({ hasChannels, onRetry }: StreamErrorStateProps) => (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--neu-bg)' }}>
        <div className="text-center p-8">
            <div className="text-6xl mb-6" style={{ color: 'var(--text-muted)' }}>📺</div>
            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Stream Unavailable</h3>
            <p className="mb-8 max-w-md" style={{ color: 'var(--text-secondary)' }}>
                {hasChannels ? 'Try selecting another server from the list below.' : 'No streams are currently available for this match.'}
            </p>
            <button onClick={onRetry} className="neumorphic-button px-6 py-3 font-semibold flex items-center gap-3 mx-auto" style={{ color: 'var(--text-secondary)' }}>
                <FaRedoAlt />
                Try Again
            </button>
        </div>
    </div>
);

interface NoStreamStateProps {
    channelCount: number;
}

const NoStreamState = ({ channelCount }: NoStreamStateProps) => (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--neu-bg)' }}>
        <div className="text-center p-8">
            <div className="text-6xl mb-6" style={{ color: 'var(--text-muted)' }}>📺</div>
            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                {channelCount > 0 ? 'Ready to Watch' : 'No Streams Available'}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
                {channelCount > 0 ? `Select from ${channelCount} available servers` : 'Check back later for available streams'}
            </p>
        </div>
    </div>
);

interface ShareDropdownProps {
    isOpen: boolean;
    matchTitle: string;
    onCopy: () => void;
}

const ShareDropdown = ({ isOpen, matchTitle, onCopy }: ShareDropdownProps) => {
    const [shareUrl, setShareUrl] = useState('');
    useEffect(() => { if (typeof window !== 'undefined') setShareUrl(window.location.href); }, []);
    if (!isOpen || !shareUrl) return null;
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(matchTitle);
    return (
        <div className="absolute right-0 top-full mt-2 neumorphic-dropdown w-48 z-50">
            <div className="py-2">
                <button onClick={onCopy} className="dropdown-item">
                    <FaCopy className="w-4 h-4" />
                    <span style={{ color: 'var(--text-secondary)' }}>Copy Link</span>
                </button>
                <a href={`https://twitter.com/intent/tweet?url=${url}&text=${text}`} target="_blank" rel="noopener noreferrer" className="dropdown-item">
                    <FaTwitter className="w-4 h-4 text-blue-400" />
                    <span style={{ color: 'var(--text-secondary)' }}>Share on Twitter</span>
                </a>
                <a href={`https://wa.me/?text=${text}%20${url}`} target="_blank" rel="noopener noreferrer" className="dropdown-item">
                    <FaWhatsapp className="w-4 h-4 text-green-500" />
                    <span style={{ color: 'var(--text-secondary)' }}>Share on WhatsApp</span>
                </a>
            </div>
        </div>
    );
};

interface StreamInfoCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    iconColor?: string;
}

const StreamInfoCard = ({ icon, label, value, iconColor = 'text-gray-500' }: StreamInfoCardProps) => (
    <div className="neumorphic-info-item">
        <div className={`${iconColor} mb-2 flex justify-center`}>{icon}</div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
);

// ========== CUSTOM HOOKS ==========
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const item = localStorage.getItem(key);
            if (item !== null) setStoredValue(JSON.parse(item));
        } catch (error) { console.error(`Error reading localStorage key "${key}":`, error); }
    }, [key]);
    const setValue = useCallback((value: T) => {
        setStoredValue(value);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(key, JSON.stringify(value)); }
            catch (error) { console.error(`Error setting localStorage key "${key}":`, error); }
        }
    }, [key]);
    return [storedValue, setValue];
}

// ========== MAIN COMPONENT ==========
export default function MatchPlayer({ match }: MatchPlayerProps) {
    const [isMounted, setIsMounted] = useState(false);

    // Stream State
    const [activeStream, setActiveStream] = useState<Channel | null>(match.channels?.[0] || null);
    const [streamError, setStreamError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [iframeKey, setIframeKey] = useState<string>('iframe-initial');

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [username, setUsername] = useState('Guest');
    const [isUsernameSet, setIsUsernameSet] = useLocalStorage(`chat-username-set-${match.gameID}`, false);
    const [savedUsername, setSavedUsername] = useLocalStorage(`chat-username-${match.gameID}`, '');
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Refs
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Derived
    const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;
    const statusConfig = getMatchStatusConfig(match.status);
    const scoreDisplay = getScoreDisplay(match);

    useEffect(() => { setIsMounted(true); setUsername(generateRandomUsername()); setIframeKey(`iframe-${Date.now()}`); }, []);
    useEffect(() => { if (savedUsername && isMounted) setUsername(savedUsername); }, [savedUsername, isMounted]);

    const addMessage = useCallback((message: ChatMessage) => {
        setMessages(prev => {
            const newMessages = [...prev, { ...message, id: message.id || generateMessageId(), timestamp: typeof message.timestamp === 'string' ? new Date(message.timestamp) : message.timestamp }];
            return newMessages.slice(-CHAT_CONFIG.MAX_MESSAGES);
        });
    }, []);

    // WebSocket Connection (unchanged logic)
    useEffect(() => {
        if (!isMounted || !isUsernameSet || !match?.gameID) return;
        let ws: WebSocket | null = null;
        let connectionAttempts = 0;

        const connectWebSocket = () => {
            if (ws) { ws.close(); ws = null; }
            if (!WS_URL) { setConnectionError('Chat server not configured'); return; }
            try {
                const url = new URL(WS_URL);
                url.searchParams.append('matchId', match.gameID);
                url.searchParams.append('username', username);
                ws = new WebSocket(url.toString());
                ws.onopen = () => {
                    setIsConnected(true); setConnectionError(null); setReconnectAttempts(0); connectionAttempts = 0;
                    heartbeatIntervalRef.current = setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, CHAT_CONFIG.HEARTBEAT_INTERVAL);
                };
                ws.onmessage = (event) => { try { handleWebSocketMessage(JSON.parse(event.data)); } catch (error) { console.error('Error parsing WebSocket message:', error); } };
                ws.onclose = (event) => {
                    setIsConnected(false); setIsTyping(false);
                    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                    if (event.code !== 1000 && connectionAttempts < CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS) {
                        connectionAttempts++; setReconnectAttempts(connectionAttempts);
                        const delay = Math.min(CHAT_CONFIG.BASE_RECONNECT_DELAY * Math.pow(2, connectionAttempts - 1), 30000) + Math.random() * 1000;
                        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
                    } else if (connectionAttempts >= CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS) { setConnectionError('Failed to connect. Please refresh the page.'); }
                };
                ws.onerror = () => { setConnectionError('Connection error. Trying to reconnect...'); };
                setWsConnection(ws);
            } catch { setConnectionError('Failed to connect to chat server'); }
        };

        const handleWebSocketMessage = (data: WebSocketMessage) => {
            switch (data.type) {
                case 'welcome': case 'system':
                    addMessage({ id: generateMessageId(), username: 'System', message: typeof data.message === 'string' ? data.message : '', timestamp: new Date(), color: '#3B82F6', isAdmin: true }); break;
                case 'message':
                    if (data.message && typeof data.message === 'object') addMessage({ id: data.message.id || generateMessageId(), username: data.message.username, message: data.message.message, timestamp: new Date(data.message.timestamp as string), color: data.message.color || getUserColor(data.message.username), isAdmin: data.message.isAdmin }); break;
                case 'user_count': setOnlineUsers(data.count || 0); break;
                case 'history':
                    if (data.messages) setMessages(data.messages.map(msg => ({ ...msg, id: msg.id || generateMessageId(), timestamp: new Date(msg.timestamp as string), color: msg.color || getUserColor(msg.username) }))); break;
                case 'rate_limit':
                    addMessage({ id: generateMessageId(), username: 'System', message: typeof data.message === 'string' ? data.message : 'Rate limit exceeded.', timestamp: new Date(), color: '#F59E0B', isAdmin: true }); break;
                case 'error':
                    addMessage({ id: generateMessageId(), username: 'System', message: typeof data.message === 'string' ? data.message : 'Server error occurred', timestamp: new Date(), color: '#EF4444', isAdmin: true }); break;
                case 'typing':
                    if (data.username && data.username !== username) setIsTyping(data.isTyping || false); break;
            }
        };
        connectWebSocket();
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close(1000, 'Component unmounting');
        };
    }, [isMounted, isUsernameSet, match.gameID, username, addMessage]);

    useEffect(() => {
        if (messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.username !== username) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, username]);

    const handleTyping = useCallback((typing: boolean) => {
        if (!wsConnection || !isConnected) return;
        if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
        wsConnection.send(JSON.stringify({ type: 'typing', username, isTyping: typing }));
        if (typing) { typingTimeoutRef.current = setTimeout(() => { if (wsConnection && isConnected) wsConnection.send(JSON.stringify({ type: 'typing', username, isTyping: false })); }, CHAT_CONFIG.TYPING_TIMEOUT); }
    }, [wsConnection, isConnected, username]);

    const sendMessage = useCallback(() => {
        if (!newMessage.trim() || !wsConnection || !isConnected) return;
        const messageData = { id: generateMessageId(), username, message: sanitizeMessage(newMessage), timestamp: new Date().toISOString(), color: getUserColor(username) };
        try {
            wsConnection.send(JSON.stringify({ type: 'message', message: messageData }));
            setNewMessage(''); inputRef.current?.focus();
            if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); handleTyping(false); }
        } catch { addMessage({ id: generateMessageId(), username: 'System', message: 'Failed to send message.', timestamp: new Date(), color: '#EF4444', isAdmin: true }); }
    }, [newMessage, wsConnection, isConnected, username, handleTyping, addMessage]);

    const saveUsername = useCallback(() => {
        const trimmed = username.trim();
        if (trimmed.length >= 3 && trimmed.length <= CHAT_CONFIG.MAX_USERNAME_LENGTH) { setSavedUsername(trimmed); setIsUsernameSet(true); }
    }, [username, setSavedUsername, setIsUsernameSet]);

    const handleStreamChange = useCallback((channel: Channel) => { setActiveStream(channel); setStreamError(false); setIsLoading(true); setIframeKey(`iframe-${Date.now()}`); }, []);
    const handleStreamError = useCallback(() => { setStreamError(true); setIsLoading(false); }, []);
    const handleRetry = useCallback(() => { setStreamError(false); setIsLoading(true); setIframeKey(`iframe-${Date.now()}`); }, []);
    const handleStreamLoad = useCallback(() => { setIsLoading(false); }, []);

    const handleFullScreen = useCallback(async () => {
        const container = videoContainerRef.current;
        if (!container) return;
        try { if (!document.fullscreenElement) { await container.requestFullscreen(); setIsFullScreen(true); } else { await document.exitFullscreen(); setIsFullScreen(false); } }
        catch { container.classList.toggle('fullscreen-fallback'); setIsFullScreen(!isFullScreen); }
    }, [isFullScreen]);

    const handleShare = useCallback(async () => {
        if (typeof window === 'undefined') return;
        if (navigator.share) { try { await navigator.share({ title: matchTitle, text: `Watch ${matchTitle} live`, url: window.location.href }); return; } catch { /* cancelled */ } }
        setShowShareOptions(!showShareOptions);
    }, [matchTitle, showShareOptions]);

    const copyToClipboard = useCallback(() => { if (typeof window === 'undefined') return; window.prompt('Copy this match link:', window.location.href); setShowShareOptions(false); }, []);

    useEffect(() => {
        const handler = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler); document.addEventListener('webkitfullscreenchange', handler);
        return () => { document.removeEventListener('fullscreenchange', handler); document.removeEventListener('webkitfullscreenchange', handler); };
    }, []);

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => { const target = e.target as HTMLImageElement; target.src = '/team-placeholder.svg'; target.onerror = null; };

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
                        <Link href="/" className="neumorphic-nav-item group">
                            <FaArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            <span className="hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>Back to Matches</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <button onClick={handleShare} className="neumorphic-button p-2" aria-label="Share match">
                                    <FaShareAlt className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                </button>
                                <ShareDropdown isOpen={showShareOptions} matchTitle={matchTitle} onCopy={copyToClipboard} />
                            </div>
                            <div
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                style={{
                                    backgroundColor: 'var(--surface-primary)',
                                    border: '1px solid var(--border-primary)',
                                }}
                            >
                                <div className={`w-2 h-2 rounded-full ${match.status === 'live' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{statusConfig.text}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative">
                <div className="max-w-7xl mx-auto px-4 py-6">

                    {/* ===== MATCH HEADER CARD ===== */}
                    <div
                        className="rounded-2xl p-5 mb-6 overflow-hidden transition-colors duration-300"
                        style={{
                            backgroundColor: 'var(--neu-bg)',
                            boxShadow: '6px 6px 12px var(--neu-shadow-dark), -6px -6px 12px var(--neu-shadow-light)',
                        }}
                    >
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center justify-center gap-4 md:gap-8 flex-1">
                                {/* Home Team */}
                                <div className="text-center min-w-0">
                                    <div className="relative w-16 h-16 mx-auto mb-3">
                                        <div className="absolute inset-0 neumorphic-logo rounded-full"></div>
                                        <Image src={match.homeTeamIMG} alt={match.homeTeam} fill className="object-contain p-2" onError={handleImageError} sizes="64px" />
                                    </div>
                                    <div className="font-bold text-sm md:text-base truncate max-w-[120px] mx-auto" style={{ color: 'var(--text-primary)' }}>{match.homeTeam}</div>
                                    {scoreDisplay.showScore ? (
                                        <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{scoreDisplay.home}</div>
                                    ) : match.status === 'live' ? (
                                        <div className="text-2xl md:text-3xl font-bold text-red-600 mt-1 animate-pulse">-</div>
                                    ) : (
                                        <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color: 'var(--text-muted)' }}>-</div>
                                    )}
                                </div>

                                {/* VS */}
                                <div className="text-center flex-shrink-0">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold mb-2 ${statusConfig.color}`}>{statusConfig.text}</div>
                                    {scoreDisplay.showScore ? (
                                        <div className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>VS</div>
                                    ) : match.status === 'live' ? (
                                        <div className="text-lg font-bold text-red-600 mb-1 animate-pulse">LIVE</div>
                                    ) : (
                                        <div className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>VS</div>
                                    )}
                                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{isMounted ? formatDateTime(match.start) : '--'}</div>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        {getSportIcon(match.sport)}
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{match.sport}</span>
                                    </div>
                                </div>

                                {/* Away Team */}
                                <div className="text-center min-w-0">
                                    <div className="relative w-16 h-16 mx-auto mb-3">
                                        <div className="absolute inset-0 neumorphic-logo rounded-full"></div>
                                        <Image src={match.awayTeamIMG} alt={match.awayTeam} fill className="object-contain p-2" onError={handleImageError} sizes="64px" />
                                    </div>
                                    <div className="font-bold text-sm md:text-base truncate max-w-[120px] mx-auto" style={{ color: 'var(--text-primary)' }}>{match.awayTeam}</div>
                                    {scoreDisplay.showScore ? (
                                        <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{scoreDisplay.away}</div>
                                    ) : match.status === 'live' ? (
                                        <div className="text-2xl md:text-3xl font-bold text-red-600 mt-1 animate-pulse">-</div>
                                    ) : (
                                        <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color: 'var(--text-muted)' }}>-</div>
                                    )}
                                </div>
                            </div>

                            {/* Tournament Info */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {match.countryIMG && (
                                    <div className="relative w-8 h-6 flex-shrink-0">
                                        <Image src={match.countryIMG} alt={match.country || ''} fill className="object-cover rounded" sizes="32px" onError={handleImageError} />
                                    </div>
                                )}
                                <div className="text-center">
                                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{match.tournament}</div>
                                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{match.country}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* ===== MAIN VIDEO PLAYER ===== */}
                        <div className="lg:col-span-2 space-y-6">
                            <div ref={videoContainerRef} className="neumorphic-video-container relative">
                                {activeStream && !streamError ? (
                                    <div className="absolute inset-0 w-full h-full">
                                        {isLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 rounded-xl">
                                                <div className="text-center">
                                                    <div className="loading-spinner h-12 w-12 mb-4 mx-auto"></div>
                                                    <p className="text-gray-400 text-sm">Loading stream...</p>
                                                </div>
                                            </div>
                                        )}
                                        <iframe
                                            key={iframeKey}
                                            src={activeStream.url}
                                            title={`${matchTitle} - ${activeStream.channel_name}`}
                                            className="w-full h-full rounded-xl"
                                            allowFullScreen
                                            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                            onLoad={handleStreamLoad}
                                            onError={handleStreamError}
                                            style={{ border: 'none' }}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 z-30">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 text-white text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                        <span>LIVE</span>
                                                    </div>
                                                    <div className="flex items-center gap-2"><FaSignal className="w-4 h-4" /><span>HD</span></div>
                                                    {activeStream.viewers > 0 && (
                                                        <div className="flex items-center gap-2"><FaEye className="w-4 h-4" /><span>{formatViewers(activeStream.viewers)}</span></div>
                                                    )}
                                                </div>
                                                <button onClick={handleFullScreen} className="p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition">
                                                    {isFullScreen ? <FaCompress className="w-5 h-5 text-white" /> : <FaExpand className="w-5 h-5 text-white" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : streamError ? (
                                    <StreamErrorState hasChannels={match.channels.length > 0} onRetry={handleRetry} />
                                ) : (
                                    <NoStreamState channelCount={match.channels.length} />
                                )}
                            </div>

                            {/* ===== STREAM SERVERS ===== */}
                            {match.channels.length > 0 && (
                                <div className="neumorphic-card">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 neumorphic-button"><FaBroadcastTower className="text-red-500" /></div>
                                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Available Streams</h2>
                                        <span className="neumorphic-badge" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)' }}>{match.channels.length} SERVERS</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {match.channels.map((channel, index) => (
                                            <button
                                                key={`${channel.channel_code}-${index}`}
                                                onClick={() => handleStreamChange(channel)}
                                                className={`neumorphic-server-item ${activeStream?.channel_code === channel.channel_code ? 'neumorphic-server-active' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${activeStream?.channel_code === channel.channel_code ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                                    <div className="text-left flex-1 min-w-0">
                                                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Server {index + 1}</div>
                                                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{channel.channel_name}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {channel.viewers > 0 && (
                                                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                            <FaEye className="w-3 h-3" />{formatViewers(channel.viewers)}
                                                        </div>
                                                    )}
                                                    <div
                                                        className="text-xs px-2 py-1 rounded"
                                                        style={{
                                                            backgroundColor: activeStream?.channel_code === channel.channel_code ? 'var(--success-bg)' : 'var(--surface-secondary)',
                                                            color: activeStream?.channel_code === channel.channel_code ? 'var(--success-text)' : 'var(--text-secondary)',
                                                        }}
                                                    >
                                                        {index === 0 ? 'HD' : 'SD'}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ===== STREAM QUALITY ===== */}
                            <div className="neumorphic-card">
                                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Stream Quality</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <StreamInfoCard icon={<FaSignal className="w-5 h-5" />} label="Quality" value="1080p HD" iconColor="text-blue-500" />
                                    <StreamInfoCard icon={<FaWifi className="w-5 h-5" />} label="Bitrate" value="Adaptive" iconColor="text-green-500" />
                                    <StreamInfoCard icon={<FaDesktop className="w-5 h-5" />} label="Platform" value="Web" iconColor="text-purple-500" />
                                </div>
                            </div>
                        </div>

                        {/* ========== SIDEBAR - CHAT ========== */}
                        <aside className="lg:col-span-1 space-y-6">
                            <div className="relative">
                                {!isMounted ? (
                                    <ChatSkeleton />
                                ) : !isUsernameSet ? (
                                    /* ===== USERNAME ENTRY ===== */
                                    <div className="rounded-lg shadow-lg w-full overflow-hidden" style={{ backgroundColor: 'var(--surface-primary)' }}>
                                        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                            <div className="flex items-center gap-2">
                                                <ChatIcon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Live Chat</span>
                                            </div>
                                        </div>
                                        <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-20 h-20 mb-6" style={{ color: 'var(--border-primary)' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                            </svg>
                                            <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>Join Live Chat</h3>
                                            <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-muted)' }}>Pick a username to start chatting</p>
                                            <div className="w-full max-w-xs">
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="text"
                                                        value={username}
                                                        onChange={(e) => setUsername(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' && username.trim().length >= 3) saveUsername(); }}
                                                        placeholder="Choose a username"
                                                        maxLength={CHAT_CONFIG.MAX_USERNAME_LENGTH}
                                                        className="flex-1 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                        style={{
                                                            backgroundColor: 'var(--input-bg)',
                                                            border: '1px solid var(--input-border)',
                                                            color: 'var(--input-text)',
                                                        }}
                                                    />
                                                    <button onClick={saveUsername} disabled={username.trim().length < 3} className="px-4 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                                        Join
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    <button onClick={() => setUsername(generateRandomUsername())} className="hover:opacity-80 transition-colors">🎲 Random name</button>
                                                    <span>{username.length}/{CHAT_CONFIG.MAX_USERNAME_LENGTH}</span>
                                                </div>
                                                {username.trim().length > 0 && username.trim().length < 3 && (
                                                    <p className="text-xs text-red-400 mt-2 text-center">Minimum 3 characters</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* ===== ACTIVE CHAT ===== */
                                    <div className="rounded-lg shadow-lg w-full overflow-hidden" style={{ backgroundColor: 'var(--surface-primary)' }}>
                                        {/* Chat Header */}
                                        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                            <div className="flex items-center gap-2">
                                                <ChatIcon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Live Chat</span>
                                                <div className="flex items-center gap-1.5 ml-2">
                                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isConnected ? `${onlineUsers} online` : 'Connecting...'}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setSavedUsername(''); setIsUsernameSet(false); setUsername(generateRandomUsername()); }}
                                                className="group cursor-pointer rounded-full p-2 transition-colors"
                                                style={{ color: 'var(--text-muted)' }}
                                                title="Change username"
                                            >
                                                <GearIcon className="w-4 h-4 transition-transform group-hover:rotate-90" />
                                            </button>
                                        </div>

                                        {/* Username Bar */}
                                        <div className="px-4 py-1.5 flex items-center justify-between" style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-secondary)' }}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getUserColor(username) }}></div>
                                                <span className="text-xs font-medium" style={{ color: getUserColor(username) }}>{username}</span>
                                            </div>
                                            {connectionError && (
                                                <span className="text-[10px]" style={{ color: 'var(--warning-text)' }}>⚠️ {connectionError}</span>
                                            )}
                                        </div>

                                        {/* Messages */}
                                        <div className="h-[400px] overflow-y-auto chat-messages-scroll">
                                            {messages.length === 0 ? (
                                                <ChatEmptyState />
                                            ) : (
                                                <ul className="p-3 pb-6 space-y-3">
                                                    {messages.map((msg) => (
                                                        <ChatMessageItem key={msg.id} message={msg} isOwnMessage={msg.username === username} />
                                                    ))}
                                                    {isTyping && <TypingIndicator />}
                                                    <div ref={messagesEndRef} />
                                                </ul>
                                            )}
                                        </div>

                                        {/* Input */}
                                        <div className="relative" style={{ borderTop: '1px solid var(--border-primary)' }}>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={newMessage}
                                                onChange={(e) => { setNewMessage(e.target.value); handleTyping(e.target.value.length > 0); }}
                                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                                onBlur={() => handleTyping(false)}
                                                placeholder="Reply..."
                                                disabled={!isConnected}
                                                maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH}
                                                className="h-10 w-full pl-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                                                style={{
                                                    backgroundColor: 'var(--surface-secondary)',
                                                    color: 'var(--text-primary)',
                                                }}
                                            />
                                            <button
                                                onClick={sendMessage}
                                                disabled={!isConnected || !newMessage.trim()}
                                                className="absolute top-0 right-1 bottom-0 my-auto h-fit cursor-pointer rounded-full p-2 text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <SendIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Footer */}
                                        <div
                                            className="px-3 py-1.5 rounded-b-lg flex justify-between items-center text-[10px]"
                                            style={{
                                                backgroundColor: 'var(--surface-secondary)',
                                                color: 'var(--text-muted)',
                                                borderTop: '1px solid var(--border-secondary)',
                                            }}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                                                {isConnected ? 'Connected' : reconnectAttempts > 0 ? `Reconnecting (${reconnectAttempts}/${CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS})` : 'Connecting...'}
                                            </span>
                                            <span>{newMessage.length}/{CHAT_CONFIG.MAX_MESSAGE_LENGTH}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ===== ACTIVE STREAM INFO ===== */}
                            {activeStream && (
                                <div className="neumorphic-card">
                                    <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Current Stream</h3>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Channel', value: activeStream.channel_name },
                                            { label: 'Quality', value: 'HD', valueColor: 'var(--success-text)' },
                                        ].map((item) => (
                                            <div
                                                key={item.label}
                                                className="flex items-center justify-between p-3 rounded-lg"
                                                style={{ backgroundColor: 'var(--surface-secondary)' }}
                                            >
                                                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                                <span className="font-semibold" style={{ color: item.valueColor || 'var(--text-primary)' }}>{item.value}</span>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Viewers</span>
                                            <div className="flex items-center gap-2">
                                                <FaEye className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                                                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatViewers(activeStream.viewers)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Status</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="font-semibold" style={{ color: 'var(--success-text)' }}>Live</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
}