// public/sw.js - BraveStreams Ad-Blocker Service Worker (Updated January 2026)

const VERSION = '1.2.0';
const CACHE_NAME = `bravestreams-adblock-${VERSION}`;

// Updated comprehensive ad server blocklist (2026)
const AD_SERVERS = [
    // Google Ads
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    'gstatic.com',
    'google.com/pagead/',
    'google.com/ads/',
    'googleads.g.doubleclick.net',
    'securepubads.g.doubleclick.net',
    'tpc.googlesyndication.com',
    'pagead2.googlesyndication.com',
    'imasdk.googleapis.com',
    'video-ad-stats.googlesyndication.com',
    's0.2mdn.net',
    'pubads.g.doubleclick.net',

    // Major Ad Networks
    'adsafeprotected.com',
    'adnxs.com',
    'amazon-adsystem.com',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'criteo.com',
    'outbrain.com',
    'taboola.com',
    'adsystem.com',
    'adzerk.net',
    'serving-sys.com',
    'zedo.com',
    'adtech.de',
    'adform.net',
    'brightroll.com',
    'contextweb.com',
    'lijit.com',
    'revcontent.com',
    'sharethrough.com',
    'yieldmo.com',
    'indexexchange.com',
    'sonobi.com',

    // Newer/2025-2026 aggressive networks
    'adsrvr.org',
    'demdex.net',
    'everesttech.net',
    '3lift.com',
    'bidswitch.net',
    'casalemedia.com',
    'smartadserver.com',
    'teads.tv',
    'spotxchange.com',
    'freewheel.tv',
    'aniview.com',
    'vidazoo.com',
    'primis.tech',
    'lockerdome.com',
    'mgid.com',

    // Sports & Video-specific
    'streamads.com',
    'sportsads.net',
    'liveads.pro',
    'streamad.net',
    'vidads.tv',
    'sportad.net',
    'matchad.com',
    'gamead.io',
    'eventad.net',

    // Analytics & Tracking
    'facebook.net',
    'facebook.com/tr',
    'twitter.com/i/ads',
    'linkedin.com/ads',
    'snapchat.com/ads',
    'tiktok.com/ads',
    'statcounter.com',
    'hotjar.com',
    'mouseflow.com',
    'crazyegg.com',
    'scorecardresearch.com',
    'quantcast.com',
    'krxd.net',
    'bluekai.com',

    // CDN-based ads
    'cloudfront.net/ads',
    'akamai.net/ads',
    'fastly.net/ads',
];

// Ad URL patterns (paths & query params)
const AD_PATTERNS = [
    '/ad/', '/ads/', '/adserver/', '/advert/', '/adv/', '/advertising/',
    '/banner/', '/promo/', '/sponsor/', '/commercial/', '/preroll/',
    '/midroll/', '/postroll/', '/ad_break/', '/ad_segment/', '/ad_cue/',
    'ad.js', 'ads.js', 'advert.js', 'advertisement.js',
    'ad.json', 'ads.json', 'ad.xml', 'ads.xml',
    'vast.xml', 'vmap.xml', 'vpaid.js', 'vpaid.swf',
    '?ad=', '&ad=', '?ads=', '&ads=', '?advert=', '&advert=',
    '?banner=', '&banner=', '?promo=', '&promo=', '?sponsor=', '&sponsor=',
    'ad=true', 'ads=true', 'advert=true',
];

// Your streaming API domains (whitelist)
const STREAMING_DOMAINS = [
    'your-sports-api.com',
    'serverstream.onrender.com',
    'livestream-api.com',
    'sports-stream-api.com'
];

// Helper: Broadcast message to all clients
function broadcastToClients(message) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage(message));
    });
}

// Improved ad URL detection (avoids false positives)
function isAdUrl(urlString) {
    try {
        const url = new URL(urlString);
        const hostname = url.hostname.toLowerCase();
        const pathname = url.pathname.toLowerCase();
        const search = url.search.toLowerCase();

        // Block known ad domains/subdomains
        if (AD_SERVERS.some(server => {
            const cleanServer = server.toLowerCase();
            if (cleanServer.startsWith('.')) {
                return hostname.endsWith(cleanServer.slice(1));
            }
            return hostname === cleanServer || hostname.endsWith('.' + cleanServer);
        })) {
            return true;
        }

        // Only apply path/query patterns on non-whitelisted domains
        const isWhitelisted = STREAMING_DOMAINS.some(d => hostname.includes(d.toLowerCase()));
        if (!isWhitelisted && AD_PATTERNS.some(p => pathname.includes(p) || search.includes(p))) {
            return true;
        }

        // Block obvious ad segments in streaming contexts
        if (pathname.endsWith('.ts') || pathname.endsWith('.m4s') || pathname.endsWith('.mp4')) {
            const adSegs = ['/ad.ts', '/ads.ts', '/preroll.ts', '/midroll.ts', '/postroll.ts', '/commercial.ts', '/advert.ts'];
            if (adSegs.some(seg => pathname.includes(seg))) {
                return true;
            }
        }

        return false;
    } catch {
        return false;
    }
}

// Is this a streaming media request?
function isStreamingRequest(urlString) {
    try {
        const url = new URL(urlString);
        const pathname = url.pathname.toLowerCase();
        const hostname = url.hostname.toLowerCase();

        return STREAMING_DOMAINS.some(d => hostname.includes(d)) ||
            pathname.endsWith('.m3u8') ||
            pathname.endsWith('.mpd') ||
            pathname.endsWith('.ts') ||
            pathname.endsWith('.m4s') ||
            pathname.endsWith('.mp4');
    } catch {
        return false;
    }
}

// Enhanced HLS playlist cleaning
function cleanHLSPlaylist(playlistText, requestUrl) {
    const lines = playlistText.split('\n');
    const cleanedLines = [];
    let skipUntilCueIn = false;
    let adSegmentsRemoved = 0;

    for (let line of lines) {
        line = line.trim();

        // Ad start markers
        if (line.startsWith('#EXT-X-CUE-OUT') || line.includes('CUE-OUT')) {
            skipUntilCueIn = true;
            adSegmentsRemoved++;
            continue;
        }

        // Ad end markers
        if (line.startsWith('#EXT-X-CUE-IN') || line.startsWith('#EXT-X-CUE-OUT-CONT')) {
            skipUntilCueIn = false;
            continue;
        }

        // Optional: treat discontinuity as potential ad boundary
        if (line.startsWith('#EXT-X-DISCONTINUITY')) {
            continue;
        }

        // Very short segments are usually ads
        if (line.startsWith('#EXTINF:')) {
            const durationStr = line.split(':')[1]?.split(',')[0];
            const duration = parseFloat(durationStr);
            if (duration > 0 && duration <= 15) {
                skipUntilCueIn = true;
                adSegmentsRemoved++;
                continue;
            }
        }

        // Skip actual segment URLs during ad break
        if (skipUntilCueIn && (
            line.endsWith('.ts') ||
            line.endsWith('.m4s') ||
            line.endsWith('.aac') ||
            line.endsWith('.mp4') ||
            /^[\w-]+\.(ts|m4s|aac|mp4)$/i.test(line)
        )) {
            adSegmentsRemoved++;
            continue;
        }

        // Keep everything else (headers, non-ad segments)
        if (!skipUntilCueIn || line.startsWith('#')) {
            cleanedLines.push(line);
        }
    }

    // Ensure valid playlist termination
    let result = cleanedLines.join('\n').trim();
    if (!result.endsWith('\n')) result += '\n';
    if (!result.includes('#EXT-X-ENDLIST')) {
        result += '#EXT-X-ENDLIST\n';
    }

    if (adSegmentsRemoved > 0) {
        broadcastToClients({
            type: 'ADS_REMOVED_FROM_PLAYLIST',
            count: adSegmentsRemoved,
            url: requestUrl
        });
    }

    return result;
}

// Improved DASH manifest cleaning
function cleanDashManifest(manifestText) {
    return manifestText
        .replace(/<Period[^>]*id=["'][^"']*ad[^"']*["'][^>]*>[\s\S]*?<\/Period>/gi, '')
        .replace(/<Period[^>]*contentType=["']?ad["']?[^>]*>[\s\S]*?<\/Period>/gi, '')
        .replace(/<EventStream[\s\S]*?schemeIdUri=["']urn:scte:scte35[^'"]*["'][^>]*>[\s\S]*?<\/EventStream>/gi, '')
        .replace(/<Event[\s\S]*?<MessageData>[^<]*?(AD|ad|break)[^<]*<\/MessageData>[\s\S]*?<\/Event>/gi, '');
}

// Service Worker Lifecycle
self.addEventListener('install', event => {
    console.log('🔧 BraveStreams Ad-Blocker installing (v' + VERSION + ')');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '/',
                '/adblock-evasion.js' // if you have one
            ]);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    console.log('✅ BraveStreams Ad-Blocker activated (v' + VERSION + ')');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('🗑️ Deleting old cache:', key);
                    return caches.delete(key);
                }
            })
        )).then(() => self.clients.claim())
    );
});

// Handle messages from client (including SKIP_WAITING for instant updates)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }

    if (event.data && event.data.type === 'FORCE_AD_SKIP') {
        console.log('Client requested force ad skip');
        // Future: implement advanced skipping logic
    }

    if (event.data && event.data.type === 'RELOAD_STREAM') {
        console.log('Client requested stream reload');
        // Could broadcast to trigger reload in player
    }

    if (event.data && event.data.type === 'GET_STATS') {
        event.ports[0]?.postMessage({
            type: 'STATS',
            version: VERSION,
            message: 'Ad-blocker active'
        });
    }
});

// Main fetch interceptor
self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (!url.startsWith('http')) return;

    // Block obvious ads
    if (isAdUrl(url)) {
        console.log(`🚫 Blocked ad: ${url}`);
        broadcastToClients({
            type: 'AD_BLOCKED',
            url,
            timestamp: Date.now()
        });

        event.respondWith(new Response('', {
            status: 404,
            headers: {
                'Content-Type': 'text/plain',
                'X-Ad-Blocked': 'true',
                'X-Blocked-By': 'BraveStreams-Ad-Blocker'
            }
        }));
        return;
    }

    // Special handling for streaming assets
    if (isStreamingRequest(url)) {
        event.respondWith(
            fetch(event.request).then(response => {
                if (!response.ok) return response;

                const contentType = response.headers.get('content-type') || '';
                const urlLower = url.toLowerCase();

                // HLS playlist (.m3u8)
                if (contentType.includes('application/vnd.apple.mpegurl') ||
                    contentType.includes('application/x-mpegurl') ||
                    urlLower.endsWith('.m3u8')) {

                    return response.text().then(text => {
                        const cleaned = cleanHLSPlaylist(text, url);
                        return new Response(cleaned, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    });
                }

                // DASH manifest (.mpd)
                if (contentType.includes('application/dash+xml') || urlLower.endsWith('.mpd')) {
                    return response.text().then(text => {
                        const cleaned = cleanDashManifest(text);
                        return new Response(cleaned, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    });
                }

                return response;
            }).catch(err => {
                console.error('Stream fetch error:', err);
                return new Response('Stream processing error', { status: 500 });
            })
        );
        return;
    }

    // Cache-first for other assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                if (event.request.method === 'GET' && response.type !== 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});