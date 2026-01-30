// src/app/match/[id]/ChatMessageItem.tsx
'use client';

import { FaUser } from 'react-icons/fa';

interface ChatMessage {
    id: string;
    username: string;
    message: string;
    timestamp: number;
    color: string;
}

interface ChatMessageItemProps {
    message: ChatMessage;
}

export default function ChatMessageItem({ message }: ChatMessageItemProps) {
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-message">
            <div className="flex items-start gap-3 p-3 hover:bg-gray-800/50 rounded-lg transition-colors">
                {/* User Avatar */}
                <div className="flex-shrink-0">
                    <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: message.color }}
                    >
                        <FaUser className="w-4 h-4" />
                    </div>
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                        <span 
                            className="font-semibold truncate"
                            style={{ color: message.color }}
                        >
                            {message.username}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatTime(message.timestamp)}
                        </span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed break-words">
                        {message.message}
                    </p>
                </div>
            </div>
        </div>
    );
}