// src/app/providers/AdBlockProvider.tsx

'use client';

import { 
    createContext, 
    useContext, 
    useEffect, 
    useState, 
    useCallback,
    ReactNode 
} from 'react';

// ============================================
// Types
// ============================================

export type BlockReason = 
    | 'domain'
    | 'subdomain'
    | 'tracking-pattern'
    | 'custom-rule';

export interface BlockResult {
    blocked: boolean;
    reason?: BlockReason;
    matchedRule?: string;
}

export interface BlockerStats {
    totalBlocked: number;
    blockedByDomain: number;
    blockedByPattern: number;
    domainsInList: number;
    patternsInList: number;
}

interface AdBlockContextType {
    isEnabled: boolean;
    stats: BlockerStats;
    enable: () => void;
    disable: () => void;
    toggle: () => void;
    addToWhitelist: (domain: string) => void;
    removeFromWhitelist: (domain: string) => void;
    testUrl: (url: string) => BlockResult;
    stripTrackingParams: (url: string) => string;
}

// ============================================
// Blocklists (Brave-style)
// ============================================

const AD_DOMAINS: Set<string> = new Set([
    // Google Ads
    'pagead2.googlesyndication.com',
    'googleadservices.com',
    'googlesyndication.com',
    'doubleclick.net',
    'googleads.g.doubleclick.net',
    'ad.doubleclick.net',
    'adservice.google.com',
    'www.googletagservices.com',
    'adwords.google.com',
    'partner.googleadservices.com',
    
    // Google Analytics & Tracking
    'google-analytics.com',
    'ssl.google-analytics.com',
    'www.google-analytics.com',
    'analytics.google.com',
    'www.googletagmanager.com',
    
    // Facebook
    'pixel.facebook.com',
    'an.facebook.com',
    'ads.facebook.com',
    'connect.facebook.net',
    'www.facebook.com/tr',
    
    // Amazon
    'amazon-adsystem.com',
    'aax.amazon.com',
    'fls-na.amazon.com',
    'assoc-amazon.com',
    
    // Twitter/X
    'ads.twitter.com',
    'static.ads-twitter.com',
    'analytics.twitter.com',
    'ads.x.com',
    
    // Microsoft
    'ads.msn.com',
    'adnxs.com',
    'adnexus.net',
    'bat.bing.com',
    
    // Major Ad Networks
    'adsrvr.org',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'casalemedia.com',
    'criteo.com',
    'criteo.net',
    'outbrain.com',
    'outbrainimg.com',
    'taboola.com',
    'cdn.taboola.com',
    'moatads.com',
    'z-na.moatads.com',
    'advertising.com',
    'adroll.com',
    'bidswitch.net',
    'contextweb.com',
    'lijit.com',
    'media.net',
    'mediamath.com',
    'sharethrough.com',
    'simpli.fi',
    'spotxchange.com',
    'tapad.com',
    'tribalfusion.com',
    'yieldmo.com',
    'zedo.com',
    
    // Trackers
    'scorecardresearch.com',
    'sb.scorecardresearch.com',
    'quantserve.com',
    'pixel.quantserve.com',
    'bluekai.com',
    'exelator.com',
    'turn.com',
    'mathtag.com',
    'rlcdn.com',
    'demdex.net',
    'krxd.net',
    'agkn.com',
    'adsymptotic.com',
    'adform.net',
    'serving-sys.com',
    'eyeota.net',
    'rfihub.com',
    'liveramp.com',
    'dotomi.com',
    'nexac.com',
    'adadvisor.net',
    'adgrx.com',
    'acuityplatform.com',
    'addthis.com',
    'bounceexchange.com',
    'brealtime.com',
    
    // Video Ads
    'imasdk.googleapis.com',
    'vid.springserve.com',
    'ads.us.e.appnexus.net',
    'innovid.com',
    'springserve.com',
    
    // Pop-ups & Aggressive Ads
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'adsterra.com',
    'trafficjunky.com',
    'exoclick.com',
    'juicyads.com',
    'clickadu.com',
    'hilltopads.net',
    'revcontent.com',
    'mgid.com',
    
    // Analytics (Optional - can whitelist if needed)
    'hotjar.com',
    'mixpanel.com',
    'segment.com',
    'segment.io',
    'amplitude.com',
    'heapanalytics.com',
    'fullstory.com',
    'crazyegg.com',
    'mouseflow.com',
    'luckyorange.com',
    'clarity.ms',
    'newrelic.com',
    'nr-data.net',
]);

const TRACKING_PATTERNS: RegExp[] = [
    // URL parameter patterns
    /[?&]utm_/i,
    /[?&]fbclid=/i,
    /[?&]gclid=/i,
    /[?&]msclkid=/i,
    /[?&]mc_eid=/i,
    /[?&]oly_/i,
    /[?&]_ga=/i,
    /[?&]__hs/i,
    /[?&]wickedid=/i,
    /[?&]dclid=/i,
    
    // Path patterns
    /\/ad[s]?[\/\?]/i,
    /\/advert/i,
    /\/banner[s]?[\/\?]/i,
    /\/pixel[\/\?\.]/i,
    /\/track(er|ing)?[\/\?]/i,
    /\/beacon[\/\?]/i,
    /\/telemetry[\/\?]/i,
    /\/collect[\/\?]/i,
    /\/log[\/\?\.]/i,
    /\/click[\/\?]/i,
    /\/impression/i,
    /\/pxl[\/\?]/i,
    /\/conversion/i,
    /\/stat[s]?[\/\?\.]/i,
    /\/analytics[\/\?]/i,
];

const SUBDOMAIN_PATTERNS: RegExp[] = [
    /^ad[s]?\d*\./i,
    /^adserver/i,
    /^adtrack/i,
    /^advert/i,
    /^affiliate/i,
    /^analytics\./i,
    /^banner[s]?\./i,
    /^beacon\./i,
    /^click[s]?\./i,
    /^counter\./i,
    /^metric[s]?\./i,
    /^pixel[s]?\./i,
    /^stat[s]?\./i,
    /^tag[s]?\./i,
    /^telemetry\./i,
    /^track(er|ing)?\./i,
];

const TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'gclsrc', 'msclkid', 'dclid',
    'mc_eid', 'mc_cid',
    'oly_anon_id', 'oly_enc_id',
    '_ga', '_gl', '_gid',
    '__hssc', '__hstc', '__hsfp', 'hsCtaTracking',
    'ref', 'ref_', 'referrer', 'source', 'src',
    'click_id', 'campaign_id', 'ad_id', 'adset_id',
    'wickedid', 'twclid', 'igshid',
    'ml_subscriber', 'ml_subscriber_hash',
    'rb_clickid', 'vero_id',
];

// ============================================
// Blocker Class
// ============================================

class BraveStyleBlocker {
    private domainBlocklist: Set<string>;
    private whitelist: Set<string>;
    private cache: Map<string, BlockResult>;
    private stats: BlockerStats;

    constructor() {
        this.domainBlocklist = new Set(AD_DOMAINS);
        this.whitelist = new Set();
        this.cache = new Map();
        this.stats = {
            totalBlocked: 0,
            blockedByDomain: 0,
            blockedByPattern: 0,
            domainsInList: this.domainBlocklist.size,
            patternsInList: TRACKING_PATTERNS.length + SUBDOMAIN_PATTERNS.length,
        };
    }

    shouldBlock(url: string): BlockResult {
        try {
            const cacheKey = this.getCacheKey(url);
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey)!;
            }

            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            const fullUrl = parsedUrl.href.toLowerCase();

            // Check whitelist
            if (this.isWhitelisted(hostname)) {
                return this.cacheResult(cacheKey, { blocked: false });
            }

            // 1. Exact domain match
            if (this.domainBlocklist.has(hostname)) {
                this.stats.blockedByDomain++;
                this.stats.totalBlocked++;
                return this.cacheResult(cacheKey, {
                    blocked: true,
                    reason: 'domain',
                    matchedRule: hostname,
                });
            }

            // 2. Subdomain of blocked domain
            for (const blockedDomain of this.domainBlocklist) {
                if (hostname.endsWith(`.${blockedDomain}`)) {
                    this.stats.blockedByDomain++;
                    this.stats.totalBlocked++;
                    return this.cacheResult(cacheKey, {
                        blocked: true,
                        reason: 'subdomain',
                        matchedRule: blockedDomain,
                    });
                }
            }

            // 3. Subdomain patterns
            for (const pattern of SUBDOMAIN_PATTERNS) {
                if (pattern.test(hostname)) {
                    this.stats.blockedByPattern++;
                    this.stats.totalBlocked++;
                    return this.cacheResult(cacheKey, {
                        blocked: true,
                        reason: 'subdomain',
                        matchedRule: pattern.source,
                    });
                }
            }

            // 4. Tracking patterns in URL
            for (const pattern of TRACKING_PATTERNS) {
                if (pattern.test(fullUrl)) {
                    this.stats.blockedByPattern++;
                    this.stats.totalBlocked++;
                    return this.cacheResult(cacheKey, {
                        blocked: true,
                        reason: 'tracking-pattern',
                        matchedRule: pattern.source,
                    });
                }
            }

            return this.cacheResult(cacheKey, { blocked: false });
        } catch {
            return { blocked: false };
        }
    }

    stripTrackingParams(url: string): string {
        try {
            const parsedUrl = new URL(url);
            TRACKING_PARAMS.forEach(param => parsedUrl.searchParams.delete(param));
            return parsedUrl.toString();
        } catch {
            return url;
        }
    }

    addToWhitelist(domain: string): void {
        this.whitelist.add(domain.toLowerCase());
        this.cache.clear();
    }

    removeFromWhitelist(domain: string): void {
        this.whitelist.delete(domain.toLowerCase());
        this.cache.clear();
    }

    private isWhitelisted(hostname: string): boolean {
        if (this.whitelist.has(hostname)) return true;
        for (const whitelisted of this.whitelist) {
            if (hostname.endsWith(`.${whitelisted}`)) return true;
        }
        return false;
    }

    private getCacheKey(url: string): string {
        try {
            const parsed = new URL(url);
            return `${parsed.hostname}${parsed.pathname}`;
        } catch {
            return url;
        }
    }

    private cacheResult(key: string, result: BlockResult): BlockResult {
        if (this.cache.size >= 10000) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, result);
        return result;
    }

    getStats(): BlockerStats {
        return { ...this.stats };
    }
}

// Singleton
const blocker = new BraveStyleBlocker();

// ============================================
// Context
// ============================================

const AdBlockContext = createContext<AdBlockContextType | null>(null);

export function useAdBlock() {
    const context = useContext(AdBlockContext);
    if (!context) {
        throw new Error('useAdBlock must be used within AdBlockProvider');
    }
    return context;
}

// ============================================
// Provider Component
// ============================================

interface AdBlockProviderProps {
    children: ReactNode;
    enabled?: boolean;
}

export function AdBlockProvider({ children, enabled = true }: AdBlockProviderProps) {
    const [isEnabled, setIsEnabled] = useState(enabled);
    const [stats, setStats] = useState<BlockerStats>(blocker.getStats());

    // Setup fetch interceptor
    useEffect(() => {
        if (!isEnabled || typeof window === 'undefined') return;

        const originalFetch = window.fetch;

        window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string' 
                ? input 
                : input instanceof URL 
                    ? input.href 
                    : input.url;

            const result = blocker.shouldBlock(url);

            if (result.blocked) {
                console.log(`[BraveStream Shield] 🛡️ Blocked: ${url}`);
                console.log(`  Reason: ${result.reason} | Rule: ${result.matchedRule}`);
                
                return new Response(null, {
                    status: 200,
                    statusText: 'Blocked by BraveStream Shield',
                });
            }

            // Strip tracking params
            const cleanUrl = blocker.stripTrackingParams(url);
            const modifiedInput = typeof input === 'string' ? cleanUrl : input;
            
            return originalFetch.call(window, modifiedInput, init);
        };

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(() => console.log('[BraveStream Shield] Service worker registered'))
                .catch((err) => console.warn('[BraveStream Shield] SW registration failed:', err));
        }

        // Update stats periodically
        const statsInterval = setInterval(() => {
            setStats(blocker.getStats());
        }, 2000);

        return () => {
            window.fetch = originalFetch;
            clearInterval(statsInterval);
        };
    }, [isEnabled]);

    const enable = useCallback(() => setIsEnabled(true), []);
    const disable = useCallback(() => setIsEnabled(false), []);
    const toggle = useCallback(() => setIsEnabled(prev => !prev), []);
    
    const addToWhitelist = useCallback((domain: string) => {
        blocker.addToWhitelist(domain);
    }, []);
    
    const removeFromWhitelist = useCallback((domain: string) => {
        blocker.removeFromWhitelist(domain);
    }, []);
    
    const testUrl = useCallback((url: string): BlockResult => {
        return blocker.shouldBlock(url);
    }, []);
    
    const stripTrackingParams = useCallback((url: string): string => {
        return blocker.stripTrackingParams(url);
    }, []);

    return (
        <AdBlockContext.Provider
            value={{
                isEnabled,
                stats,
                enable,
                disable,
                toggle,
                addToWhitelist,
                removeFromWhitelist,
                testUrl,
                stripTrackingParams,
            }}
        >
            {children}
        </AdBlockContext.Provider>
    );
}