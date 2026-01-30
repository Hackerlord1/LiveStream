// public/sw.js

const CACHE_NAME = 'bravestream-shield-v1';

// Ad domains blocklist
const AD_DOMAINS = new Set([
    'pagead2.googlesyndication.com',
    'googleadservices.com',
    'googlesyndication.com',
    'doubleclick.net',
    'google-analytics.com',
    'googletagmanager.com',
    'pixel.facebook.com',
    'connect.facebook.net',
    'amazon-adsystem.com',
    'adnxs.com',
    'adsrvr.org',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'criteo.com',
    'criteo.net',
    'outbrain.com',
    'taboola.com',
    'moatads.com',
    'scorecardresearch.com',
    'quantserve.com',
    'hotjar.com',
    'mixpanel.com',
    'segment.io',
    'amplitude.com',
    'imasdk.googleapis.com',
    'popads.net',
    'propellerads.com',
]);

const TRACKING_PATTERNS = [
    /^ad[s]?\d*\./i,
    /^adserver/i,
    /^analytics\./i,
    /^track(er|ing)?\./i,
    /^pixel\./i,
    /^beacon\./i,
    /\/ad[s]?[\/\?]/i,
    /\/track/i,
    /\/pixel/i,
    /\/beacon/i,
    /\/collect/i,
];

const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', '_ga', '_gl',
];

let blockedCount = 0;

function shouldBlock(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        
        if (AD_DOMAINS.has(hostname)) {
            return { blocked: true, reason: 'domain' };
        }
        
        for (const domain of AD_DOMAINS) {
            if (hostname.endsWith('.' + domain)) {
                return { blocked: true, reason: 'subdomain' };
            }
        }
        
        for (const pattern of TRACKING_PATTERNS) {
            if (pattern.test(hostname) || pattern.test(parsed.pathname)) {
                return { blocked: true, reason: 'pattern' };
            }
        }
        
        return { blocked: false };
    } catch {
        return { blocked: false };
    }
}

function stripTracking(url) {
    try {
        const parsed = new URL(url);
        TRACKING_PARAMS.forEach(param => parsed.searchParams.delete(param));
        return parsed.toString();
    } catch {
        return url;
    }
}

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    const result = shouldBlock(url);
    
    if (result.blocked) {
        blockedCount++;
        console.log(`[BraveStream Shield] 🛡️ Blocked (${result.reason}): ${url}`);
        
        event.respondWith(
            new Response(null, {
                status: 200,
                headers: { 'X-Blocked': 'true' },
            })
        );
        return;
    }
    
    const cleanUrl = stripTracking(url);
    if (cleanUrl !== url) {
        console.log(`[BraveStream Shield] 🧹 Cleaned: ${url}`);
        event.respondWith(fetch(cleanUrl, event.request));
        return;
    }
    
    event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'GET_STATS') {
        event.ports[0].postMessage({ blockedCount });
    }
});

self.addEventListener('install', () => {
    self.skipWaiting();
    console.log('[BraveStream Shield] 🛡️ Installed');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('[BraveStream Shield] 🛡️ Activated');
});