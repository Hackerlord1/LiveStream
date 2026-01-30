// src/hooks/usePlayerAdBlock.ts

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface AdBlockStats {
    popupsBlocked: number;
    redirectsBlocked: number;
    overlaysRemoved: number;
    clicksAbsorbed: number;
}

interface UsePlayerAdBlockOptions {
    enabled?: boolean;
    onBlock?: (type: string, url: string) => void;
}

// src/hooks/usePlayerAdBlock.ts (continued)

// Streaming-specific ad domains
const STREAMING_AD_DOMAINS = new Set([
    // Popup/redirect networks common in streaming
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'adsterra.com',
    'trafficjunky.com',
    'exoclick.com',
    'juicyads.com',
    'clickadu.com',
    'hilltopads.net',
    'trafficstars.com',
    'tsyndicate.com',
    'revcontent.com',
    'mgid.com',
    'content.ad',
    'taboola.com',
    'outbrain.com',
    'a-ads.com',
    'adcash.com',
    'admaven.com',
    'bidvertiser.com',
    'clickadilla.com',
    'evadav.com',
    'galaksion.com',
    'mondiad.com',
    'pushground.com',
    'richads.com',
    'rollerads.com',
    'trafficforce.com',
    'zeropark.com',

    // Video ad networks
    'imasdk.googleapis.com',
    'vid.springserve.com',
    'springserve.com',
    'spotxchange.com',
    'spotx.tv',
    'innovid.com',
    'teads.tv',
    'connatix.com',

    // General ad networks
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'amazon-adsystem.com',
    'criteo.com',
    'criteo.net',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'casalemedia.com',
    'adnxs.com',
    'adsrvr.org',
    'bidswitch.net',
    'media.net',
    'advertising.com',
    'adform.net',

    // Tracking
    'moatads.com',
    'doubleverify.com',
    'adsafeprotected.com',
    'scorecardresearch.com',
    'quantserve.com',
]);

// URL patterns that indicate ads
const AD_URL_PATTERNS = [
    /\/ads?\//i,
    /\/pop(up|under)?\//i,
    /\/click\?/i,
    /\/redirect\?/i,
    /\/track(er|ing)?\//i,
    /\/banner/i,
    /\/promo\//i,
    /aff(iliate)?[=_]/i,
    /click[_-]?id=/i,
    /campaign[_-]?id=/i,
    /\?ref=/i,
    /\?source=ad/i,
    /\/out\//i,
    /\/go\//i,
    /\/redir\//i,
    /\/away\//i,
    /\/jump\//i,
];

export function usePlayerAdBlock(options: UsePlayerAdBlockOptions = {}) {
    const { enabled = true, onBlock } = options;

    const [stats, setStats] = useState<AdBlockStats>({
        popupsBlocked: 0,
        redirectsBlocked: 0,
        overlaysRemoved: 0,
        clicksAbsorbed: 0,
    });

    const originalWindowOpen = useRef<typeof window.open | null>(null);
    const isInitialized = useRef(false);

    const incrementStat = useCallback((key: keyof AdBlockStats) => {
        setStats(prev => ({ ...prev, [key]: prev[key] + 1 }));
    }, []);

    const isAdUrl = useCallback((url: string): boolean => {
        if (!url || url === 'about:blank' || url.startsWith('javascript:')) {
            return false;
        }

        try {
            const parsed = new URL(url, window.location.href);
            const hostname = parsed.hostname.toLowerCase();
            const fullUrl = parsed.href.toLowerCase();

            // Check streaming ad domains
            for (const domain of STREAMING_AD_DOMAINS) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return true;
                }
            }

            // Check URL patterns
            for (const pattern of AD_URL_PATTERNS) {
                if (pattern.test(fullUrl)) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }, []);

    const isSafeUrl = useCallback((url: string): boolean => {
        const safeDomains = [
            'twitter.com',
            'x.com',
            'facebook.com',
            'wa.me',
            'whatsapp.com',
            't.me',
            'telegram.org',
            'reddit.com',
            'youtube.com',
            'twitch.tv',
            'discord.com',
        ];

        try {
            const parsed = new URL(url, window.location.href);
            const hostname = parsed.hostname.toLowerCase();
            return safeDomains.some(domain =>
                hostname === domain || hostname.endsWith(`.${domain}`)
            );
        } catch {
            return false;
        }
    }, []);

    // Setup protection
    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || isInitialized.current) {
            return;
        }

        isInitialized.current = true;
        originalWindowOpen.current = window.open;

        // Override window.open
        window.open = function (
            url?: string | URL,
            target?: string,
            features?: string
        ): Window | null {
            const urlString = url?.toString() || '';

            // Block if it's an ad URL
            if (isAdUrl(urlString)) {
                console.log('[PlayerAdBlock] 🛡️ Blocked popup:', urlString);
                incrementStat('popupsBlocked');
                onBlock?.('popup', urlString);
                return null;
            }

            // Allow known safe domains (social sharing, etc.)
            if (isSafeUrl(urlString) && originalWindowOpen.current) {
                return originalWindowOpen.current.call(window, url, target, features);
            }

            // Block all other unknown popups during video playback
            console.log('[PlayerAdBlock] 🛡️ Blocked unknown popup:', urlString);
            incrementStat('popupsBlocked');
            onBlock?.('popup', urlString);
            return null;
        };

        // Block ad link clicks on the document
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // Check if click is on a link
            const anchor = target.closest('a');
            if (anchor) {
                const href = anchor.getAttribute('href') || '';
                if (isAdUrl(href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[PlayerAdBlock] 🛡️ Blocked ad link click:', href);
                    incrementStat('clicksAbsorbed');
                    onBlock?.('click', href);
                    return;
                }
            }

            // Check for invisible element clicks (click-jacking)
            const style = window.getComputedStyle(target);
            if (
                style.opacity === '0' ||
                style.visibility === 'hidden' ||
                (style.position === 'fixed' && parseInt(style.zIndex) > 9000)
            ) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[PlayerAdBlock] 🛡️ Blocked invisible element click');
                incrementStat('clicksAbsorbed');
                onBlock?.('invisible-click', '');
            }
        };

        // Block ad iframe focus stealing
        const handleFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IFRAME') {
                const iframe = target as HTMLIFrameElement;
                try {
                    const src = iframe.src || '';
                    if (isAdUrl(src)) {
                        e.preventDefault();
                        iframe.blur();
                        console.log('[PlayerAdBlock] 🛡️ Blocked ad iframe focus');
                        incrementStat('overlaysRemoved');
                        onBlock?.('focus', src);
                    }
                } catch {
                    // Cross-origin, ignore
                }
            }
        };

        // Remove ad overlays periodically
        const removeOverlays = () => {
            const selectors = [
                'div[style*="z-index: 9999"]',
                'div[style*="z-index:9999"]',
                'div[style*="z-index: 99999"]',
                'iframe[style*="opacity: 0"]',
                'iframe[width="1"][height="1"]',
                'a[target="_blank"][style*="position: fixed"]',
            ];

            let removed = 0;

            selectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        const element = el as HTMLElement;

                        // Don't remove protected elements
                        if (element.closest('[data-protected-player]')) return;
                        if (element.closest('[data-iframe-guard]')) return;

                        // Check if it looks like an ad
                        const isLikelyAd =
                            element.id?.toLowerCase().includes('ad') ||
                            element.className?.toLowerCase().includes('ad') ||
                            element.className?.toLowerCase().includes('pop') ||
                            element.className?.toLowerCase().includes('overlay');

                        if (isLikelyAd) {
                            element.remove();
                            removed++;
                        }
                    });
                } catch {
                    // Ignore selector errors
                }
            });

            if (removed > 0) {
                incrementStat('overlaysRemoved');
            }
        };

        // Add event listeners
        document.addEventListener('click', handleClick, true);
        window.addEventListener('focus', handleFocus, true);

        // Periodic overlay removal
        const overlayInterval = setInterval(removeOverlays, 3000);

        // Initial overlay removal
        removeOverlays();

        // Cleanup
        return () => {
            if (originalWindowOpen.current) {
                window.open = originalWindowOpen.current;
            }
            document.removeEventListener('click', handleClick, true);
            window.removeEventListener('focus', handleFocus, true);
            clearInterval(overlayInterval);
            isInitialized.current = false;
        };
    }, [enabled, isAdUrl, isSafeUrl, incrementStat, onBlock]);

    return {
        stats,
        isAdUrl,
        isSafeUrl,
        resetStats: useCallback(() => {
            setStats({
                popupsBlocked: 0,
                redirectsBlocked: 0,
                overlaysRemoved: 0,
                clicksAbsorbed: 0,
            });
        }, []),
    };
}

export type { AdBlockStats, UsePlayerAdBlockOptions };