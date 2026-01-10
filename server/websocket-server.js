// server/websocket-server.js - ENHANCED VERSION
const WebSocket = require('ws');

const wss = new WebSocket.Server({
    port: 8080,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
    }
});

const matchRooms = new Map();
const userRateLimits = new Map();
const userConnections = new Map(); // Track multiple connections per user

// Configuration
const MESSAGE_LIMIT = 200;
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX = 5; // Max 5 messages per window
const HISTORY_LIMIT = 50;
const MAX_USERNAME_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 200;

// Admin users (can be extended)
const ADMIN_USERS = new Set(['admin', 'moderator', 'system']);

console.log('🎯 WebSocket Chat Server running on port 8080');
console.log('📊 Configuration:');
console.log(`   • Rate limit: ${RATE_LIMIT_MAX} messages per ${RATE_LIMIT_WINDOW/1000}s`);
console.log(`   • History limit: ${HISTORY_LIMIT} messages per room`);
console.log(`   • Message storage: ${MESSAGE_LIMIT} messages per room`);
console.log(`   • Max username length: ${MAX_USERNAME_LENGTH}`);
console.log(`   • Max message length: ${MAX_MESSAGE_LENGTH}`);

// Utility functions
const sanitizeUsername = (username) => {
    if (!username || typeof username !== 'string') return 'Anonymous';

    // Trim and limit length
    const sanitized = username.trim().substring(0, MAX_USERNAME_LENGTH);

    // Remove special characters except basic ones
    return sanitized.replace(/[^\w\s-]/g, '');
};

const sanitizeMessage = (message) => {
    if (!message || typeof message !== 'string') return '';

    // Trim and limit length
    let sanitized = message.trim().substring(0, MAX_MESSAGE_LENGTH);

    // Basic HTML escaping
    sanitized = sanitized
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    return sanitized;
};

const generateMessageId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

const getUserColor = (username) => {
    const colors = [
        '#3B82F6', // blue-500
        '#10B981', // green-500
        '#8B5CF6', // violet-500
        '#EC4899', // pink-500
        '#F59E0B', // yellow-500
        '#EF4444', // red-500
        '#06B6D4', // cyan-500
        '#84CC16', // lime-500
        '#F97316', // orange-500
        '#6366F1', // indigo-500
    ];

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
};

// Room management
class MatchRoom {
    constructor(matchId) {
        this.matchId = matchId;
        this.messages = [];
        this.users = new Map(); // ws -> {username, joinTime, isAdmin}
        this.lastActivity = Date.now();
        this.createdAt = Date.now();
    }

    addUser(ws, username) {
        const sanitizedUsername = sanitizeUsername(username);
        const isAdmin = ADMIN_USERS.has(sanitizedUsername.toLowerCase());

        this.users.set(ws, {
            username: sanitizedUsername,
            joinTime: Date.now(),
            isAdmin,
            color: getUserColor(sanitizedUsername)
        });

        this.lastActivity = Date.now();
        return sanitizedUsername;
    }

    removeUser(ws) {
        const user = this.users.get(ws);
        this.users.delete(ws);
        this.lastActivity = Date.now();
        return user;
    }

    addMessage(messageData) {
        const message = {
            id: generateMessageId(),
            username: messageData.username,
            message: sanitizeMessage(messageData.message),
            timestamp: new Date().toISOString(),
            color: messageData.color || getUserColor(messageData.username),
            isAdmin: ADMIN_USERS.has(messageData.username?.toLowerCase()) || false
        };

        this.messages.push(message);

        // Keep only last MESSAGE_LIMIT messages
        if (this.messages.length > MESSAGE_LIMIT) {
            this.messages = this.messages.slice(-MESSAGE_LIMIT);
        }

        this.lastActivity = Date.now();
        return message;
    }

    getHistory(limit = HISTORY_LIMIT) {
        return this.messages.slice(-limit);
    }

    getUserCount() {
        return this.users.size;
    }

    getUserList() {
        const users = [];
        this.users.forEach((userData, ws) => {
            users.push({
                username: userData.username,
                isAdmin: userData.isAdmin,
                color: userData.color
            });
        });
        return users;
    }

    broadcast(data, excludeWs = null) {
        const jsonData = JSON.stringify(data);
        this.users.forEach((userData, ws) => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(jsonData);
                } catch (error) {
                    console.error('Error sending to client:', error);
                }
            }
        });
    }
}

// Rate limiting
class RateLimiter {
    constructor(windowMs, maxRequests) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.requests = new Map();
    }

    checkLimit(key) {
        const now = Date.now();
        const userRequests = this.requests.get(key) || [];

        // Remove expired requests
        const validRequests = userRequests.filter(time => now - time < this.windowMs);

        if (validRequests.length >= this.maxRequests) {
            return false; // Rate limited
        }

        validRequests.push(now);
        this.requests.set(key, validRequests);
        return true; // Allowed
    }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_WINDOW, RATE_LIMIT_MAX);

// Cleanup
setInterval(() => {
    const now = Date.now();
    let roomsCleaned = 0;

    // Clean old rooms (inactive for 30 minutes)
    for (const [matchId, room] of matchRooms.entries()) {
        if (now - room.lastActivity > 30 * 60 * 1000) {
            console.log(`🧹 Cleaning up inactive room for match ${matchId}`);
            matchRooms.delete(matchId);
            roomsCleaned++;
        }
    }

    // Clean old rate limits (older than 1 hour)
    const rateLimitKeys = Array.from(rateLimiter.requests.keys());
    rateLimitKeys.forEach(key => {
        const requests = rateLimiter.requests.get(key);
        if (requests && requests.length > 0) {
            const oldest = Math.min(...requests);
            if (now - oldest > 60 * 60 * 1000) {
                rateLimiter.requests.delete(key);
            }
        }
    });

    if (roomsCleaned > 0) {
        console.log(`🧹 Cleaned ${roomsCleaned} inactive rooms`);
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// WebSocket server
wss.on('connection', (ws, req) => {
    // Extract parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const matchId = url.searchParams.get('matchId');
    const username = url.searchParams.get('username') || 'Anonymous';
    const clientId = req.headers['sec-websocket-key'] || Math.random().toString(36).substr(2, 9);

    console.log(`🔗 New connection: ${username} to match ${matchId} (${clientId})`);

    // Validate matchId
    if (!matchId || typeof matchId !== 'string' || matchId.length > 100) {
        console.log('❌ Invalid matchId, closing connection');
        ws.close(1008, 'Invalid matchId');
        return;
    }

    // Create or get room
    if (!matchRooms.has(matchId)) {
        console.log(`🏠 Creating new room for match ${matchId}`);
        matchRooms.set(matchId, new MatchRoom(matchId));
    }

    const room = matchRooms.get(matchId);

    // Add user to room
    const finalUsername = room.addUser(ws, username);
    const isAdmin = ADMIN_USERS.has(finalUsername.toLowerCase());

    // Store connection info
    ws.userData = {
        matchId,
        username: finalUsername,
        clientId,
        joinTime: Date.now(),
        isAdmin
    };

    // Send welcome message with history
    const history = room.getHistory();
    ws.send(JSON.stringify({
        type: 'welcome',
        message: `Welcome to the chat, ${finalUsername}!`,
        username: finalUsername,
        color: getUserColor(finalUsername),
        isAdmin,
        timestamp: new Date().toISOString()
    }));

    ws.send(JSON.stringify({
        type: 'history',
        messages: history
    }));

    // Send user list
    ws.send(JSON.stringify({
        type: 'user_list',
        users: room.getUserList()
    }));

    // Broadcast join message to others
    const joinMessage = {
        id: generateMessageId(),
        username: 'System',
        message: `${finalUsername} joined the chat`,
        timestamp: new Date().toISOString(),
        color: '#3B82F6', // blue
        isAdmin: true,
        isSystem: true
    };

    room.messages.push(joinMessage);
    room.broadcast({
        type: 'system',
        message: `${finalUsername} joined the chat`,
        timestamp: new Date().toISOString()
    }, ws);

    // Update user count for all
    room.broadcast({
        type: 'user_count',
        count: room.getUserCount(),
        timestamp: new Date().toISOString()
    });

    // Handle messages
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            // Validate message structure
            if (!message || typeof message !== 'object') {
                console.warn('Invalid message format from', finalUsername);
                return;
            }

            switch (message.type) {
                case 'message':
                    handleChatMessage(ws, room, message);
                    break;

                case 'typing':
                    handleTypingIndicator(ws, room, message);
                    break;

                case 'ping':
                    // Respond to ping
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;

                default:
                    console.warn('Unknown message type:', message.type);
            }

        } catch (error) {
            console.error('❌ Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    // Handle disconnection
    ws.on('close', (code, reason) => {
        console.log(`🔌 Connection closed: ${finalUsername} (code: ${code}, reason: ${reason})`);

        const user = room.removeUser(ws);
        if (user) {
            // Broadcast leave message
            const leaveMessage = {
                id: generateMessageId(),
                username: 'System',
                message: `${user.username} left the chat`,
                timestamp: new Date().toISOString(),
                color: '#EF4444', // red
                isAdmin: true,
                isSystem: true
            };

            room.messages.push(leaveMessage);
            room.broadcast({
                type: 'system',
                message: `${user.username} left the chat`,
                timestamp: new Date().toISOString()
            });

            // Update user count
            room.broadcast({
                type: 'user_count',
                count: room.getUserCount(),
                timestamp: new Date().toISOString()
            });
        }

        // Clean up empty rooms after delay
        if (room.getUserCount() === 0) {
            setTimeout(() => {
                if (room.getUserCount() === 0) {
                    console.log(`🧹 Removing empty room for match ${matchId}`);
                    matchRooms.delete(matchId);
                }
            }, 5 * 60 * 1000); // 5 minutes
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });

    // Heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

// Message handlers
function handleChatMessage(ws, room, message) {
    const userData = ws.userData;
    const rateLimitKey = `${room.matchId}:${userData.username}`;

    // Check rate limit
    if (!rateLimiter.checkLimit(rateLimitKey)) {
        ws.send(JSON.stringify({
            type: 'rate_limit',
            message: 'Rate limit exceeded. Please wait before sending more messages.',
            retryAfter: RATE_LIMIT_WINDOW / 1000
        }));
        return;
    }

    // Validate message content
    if (!message.message || !message.message.message || typeof message.message.message !== 'string') {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message content'
        }));
        return;
    }

    // Add message to room
    const chatMessage = room.addMessage({
        username: userData.username,
        message: message.message.message,
        color: message.message.color
    });

    // Broadcast to all users in room
    room.broadcast({
        type: 'message',
        message: chatMessage,
        timestamp: new Date().toISOString()
    });
}

function handleTypingIndicator(ws, room, message) {
    const userData = ws.userData;

    // Validate typing message
    if (typeof message.isTyping !== 'boolean' || !message.username) {
        return;
    }

    // Broadcast typing indicator to others
    room.broadcast({
        type: 'typing',
        username: userData.username,
        isTyping: message.isTyping,
        timestamp: Date.now()
    }, ws);
}

// Heartbeat interval
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log('💔 Terminating unresponsive client');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(null, false, true);
    });
}, 30000); // 30 seconds

// Cleanup on server shutdown
wss.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('🛑 WebSocket server closed');
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wss.close(() => {
        console.log('✅ WebSocket server closed gracefully');
        process.exit(0);
    });
});

module.exports = wss;