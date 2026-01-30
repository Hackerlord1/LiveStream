// src/components/player/IframeGuard.tsx

'use client';

import React, { useEffect, useRef, useCallback, useState, forwardRef } from 'react';

// ========== TYPES ==========
interface IframeGuardProps {
    src: string;
    title: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
}

interface BlockedRequest {
    url: string;
    type: 'popup' | 'redirect' | 'navigation' | 'overlay';
    timestamp: number;
}

// ========== BLOCKED DOMAINS ==========
const BLOCKED_DOMAINS = new Set([
    // Google Ads
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'adservice.google.com',
    'pagead2.googlesyndication.com',
    'pubads.g.doubleclick.net',
    'securepubads.g.doubleclick.net',
    'tpc.googlesyndication.com',
    'www.googletagservices.com',
    
    // Popup/Redirect Networks
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
    
    // Content/Native Ad Networks
    'taboola.com',
    'cdn.taboola.com',
    'outbrain.com',
    'widgets.outbrain.com',
    'revcontent.com',
    'mgid.com',
    'content.ad',
    'nativo.com',
    'sharethrough.com',
    
    // Video Ad Networks
    'imasdk.googleapis.com',
    'vid.springserve.com',
    'springserve.com',
    'spotxchange.com',
    'spotx.tv',
    'innovid.com',
    'teads.tv',
    'connatix.com',
    
    // General Ad Networks
    'criteo.com',
    'criteo.net',
    'static.criteo.net',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'casalemedia.com',
    'adnxs.com',
    'adsrvr.org',
    'bidswitch.net',
    'amazon-adsystem.com',
    'media.net',
    'contextweb.com',
    'advertising.com',
    'adform.net',
    'smartadserver.com',
    'lijit.com',
    'sovrn.com',
    'yieldmo.com',
    'triplelift.com',
    'indexww.com',
    '33across.com',
    'gumgum.com',
    'undertone.com',
    'kargo.com',
    
    // Tracking/Analytics
    'moatads.com',
    'doubleverify.com',
    'adsafeprotected.com',
    'scorecardresearch.com',
    'quantserve.com',
    'bluekai.com',
    'krxd.net',
    'demdex.net',
    'exelator.com',
    'eyeota.net',
    'rlcdn.com',
    'rfihub.com',
    'liveramp.com',
    'tapad.com',
    'agkn.com',
    'serving-sys.com',
    
    // Short URL / Redirect services often used for ads
    'bit.ly',
    'tinyurl.com',
    'adf.ly',
    'bc.vc',
    'shorte.st',
    'linkbucks.com',
]);

// ========== AD URL PATTERNS ==========
const AD_URL_PATTERNS = [
    /\/ads?\//i,
    /\/advert/i,
    /\/pop(up|under)?\//i,
    /\/click\?/i,
    /\/redirect\?/i,
    /\/track(er|ing)?\//i,
    /\/banner/i,
    /\/promo\//i,
    /\/sponsor/i,
    /aff(iliate)?[=_]/i,
    /click[_-]?id=/i,
    /campaign[_-]?id=/i,
    /\?ref=/i,
    /\?source=ad/i,
    /\/out\//i,
    /\/go\//i,
    /\/redir\//i,
    /\/jump\//i,
    /\/away\//i,
    /\/link\//i,
    /\/visit\//i,
    /\/partner\//i,
    /[?&]aff=/i,
    /[?&]pid=/i,
    /[?&]offer/i,
    /[?&]clickid/i,
    /[?&]subid/i,
];

// ========== HELPER FUNCTIONS ==========

/**
 * Check if a URL is an ad/redirect URL
 */
function isAdUrl(url: string): boolean {
    if (!url || url === 'about:blank' || url.startsWith('javascript:') || url.startsWith('data:')) {
        return false;
    }

    try {
        const parsed = new URL(url, window.location.href);
        const hostname = parsed.hostname.toLowerCase();
        const fullUrl = parsed.href.toLowerCase();

        // Check blocked domains
        for (const domain of BLOCKED_DOMAINS) {
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

        // Check for suspicious query parameters
        const suspiciousParams = ['clickid', 'affid', 'pid', 'subid', 'offer', 'campaign'];
        for (const param of suspiciousParams) {
            if (parsed.searchParams.has(param)) {
                return true;
            }
        }

        return false;
    } catch {
        // Invalid URL, could be suspicious
        return true;
    }
}

/**
 * Check if URL is a safe/allowed domain
 */
function isSafeUrl(url: string): boolean {
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
        'youtu.be',
        'twitch.tv',
        'discord.com',
        'discord.gg',
    ];

    try {
        const parsed = new URL(url, window.location.href);
        const hostname = parsed.hostname.toLowerCase();

        // Allow same origin
        if (hostname === window.location.hostname) {
            return true;
        }

        return safeDomains.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch {
        return false;
    }
}

// ========== IFRAME GUARD COMPONENT ==========

const IframeGuard = forwardRef<HTMLIFrameElement, IframeGuardProps>(({
    src,
    title,
    className = '',
    onLoad,
    onError,
}, ref) => {
    const internalRef = useRef<HTMLIFrameElement>(null);
    const iframeRef = (ref as React.RefObject<HTMLIFrameElement>) || internalRef;

    const [blockedCount, setBlockedCount] = useState(0);
    const [showBlockedNotice, setShowBlockedNotice] = useState(false);

    const originalWindowOpenRef = useRef<typeof window.open | null>(null);

    // Log blocked request
    const logBlockedRequest = useCallback((url: string, type: BlockedRequest['type']) => {
        console.log(`[IframeGuard] 🛡️ Blocked ${type}:`, url);

        setBlockedCount(prev => prev + 1);

        // Show notice briefly
        setShowBlockedNotice(true);
        setTimeout(() => setShowBlockedNotice(false), 2000);
    }, []);

    // Setup protection - Only override window.open (safe to override)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Store original window.open
        originalWindowOpenRef.current = window.open;

        // Override window.open - this is safe and commonly done
        window.open = function (
            url?: string | URL,
            target?: string,
            features?: string
        ): Window | null {
            const urlString = url?.toString() || '';

            // Block if it's an ad URL
            if (isAdUrl(urlString)) {
                logBlockedRequest(urlString, 'popup');
                return null;
            }

            // Allow safe URLs (social sharing, etc.)
            if (isSafeUrl(urlString) && originalWindowOpenRef.current) {
                return originalWindowOpenRef.current.call(window, url, target, features);
            }

            // Block all other unknown popups during video playback
            if (urlString) {
                logBlockedRequest(urlString, 'popup');
            }
            return null;
        };

        // Cleanup
        return () => {
            if (originalWindowOpenRef.current) {
                window.open = originalWindowOpenRef.current;
            }
        };
    }, [logBlockedRequest]);

    // Block click events that try to navigate to ad URLs
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // Check for anchor tags
            const anchor = target.closest('a');
            if (anchor) {
                const href = anchor.getAttribute('href');
                if (href && isAdUrl(href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    logBlockedRequest(href, 'navigation');
                    return;
                }

                // Block target="_blank" links to unknown domains
                if (anchor.target === '_blank' && href && !isSafeUrl(href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    logBlockedRequest(href || 'unknown', 'popup');
                    return;
                }
            }

            // Check for elements with suspicious onclick handlers
            const onclick = target.getAttribute('onclick');
            if (onclick) {
                const lowerOnclick = onclick.toLowerCase();
                if (lowerOnclick.includes('window.open') ||
                    lowerOnclick.includes('location.href') ||
                    lowerOnclick.includes('location.assign') ||
                    lowerOnclick.includes('location.replace')) {
                    // Let our overridden window.open handle popups
                    // But block direct location changes by preventing the click
                    // if the onclick seems to redirect to an ad
                    for (const domain of BLOCKED_DOMAINS) {
                        if (lowerOnclick.includes(domain)) {
                            e.preventDefault();
                            e.stopPropagation();
                            logBlockedRequest(domain, 'redirect');
                            return;
                        }
                    }
                }
            }
        };

        // Block focus stealing by ad iframes
        const handleFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IFRAME' && target !== iframeRef.current) {
                try {
                    const iframe = target as HTMLIFrameElement;
                    if (iframe.src && isAdUrl(iframe.src)) {
                        e.preventDefault();
                        iframe.blur();
                        iframeRef.current?.focus();
                        logBlockedRequest(iframe.src, 'popup');
                    }
                } catch {
                    // Cross-origin, ignore
                }
            }
        };

        // Add event listeners with capture to intercept before the event reaches the target
        document.addEventListener('click', handleClick, true);
        window.addEventListener('focus', handleFocus, true);

        // Cleanup
        return () => {
            document.removeEventListener('click', handleClick, true);
            window.removeEventListener('focus', handleFocus, true);
        };
    }, [logBlockedRequest, iframeRef]);

    // Remove ad overlays periodically
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const removeAdOverlays = () => {
            // Find and remove suspicious overlays
            const suspiciousSelectors = [
                'div[style*="z-index: 9999"]',
                'div[style*="z-index:9999"]',
                'div[style*="z-index: 99999"]',
                'div[style*="z-index:99999"]',
                'div[style*="z-index: 999999"]',
                'div[style*="position: fixed"][style*="top: 0"][style*="left: 0"]',
                'a[target="_blank"][style*="position: absolute"][style*="width: 100%"]',
                'a[target="_blank"][style*="position: fixed"]',
                'iframe[style*="opacity: 0"]',
                'iframe[style*="visibility: hidden"]',
                'iframe[width="1"][height="1"]',
                'iframe[style*="width: 1px"]',
                'iframe[style*="height: 1px"]',
                'iframe[style*="width:1px"]',
                'iframe[style*="height:1px"]',
            ];

            let removed = 0;

            suspiciousSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        const element = el as HTMLElement;

                        // Don't remove our own elements
                        if (element.closest('[data-iframe-guard]')) return;
                        if (element.closest('[data-protected-player]')) return;
                        if (element === iframeRef.current) return;

                        // Check if it's likely an ad
                        const id = element.id?.toLowerCase() || '';
                        const className = element.className?.toString().toLowerCase() || '';
                        const src = (element as HTMLIFrameElement).src?.toLowerCase() || '';

                        const isAdElement =
                            id.includes('ad') ||
                            id.includes('pop') ||
                            id.includes('banner') ||
                            className.includes('ad-') ||
                            className.includes('ad_') ||
                            className.includes('ads-') ||
                            className.includes('ads_') ||
                            className.includes('popup') ||
                            className.includes('overlay') ||
                            src.includes('/ad') ||
                            src.includes('/pop') ||
                            src.includes('/track');

                        const computedStyle = window.getComputedStyle(element);
                        const isInvisible =
                            computedStyle.opacity === '0' ||
                            computedStyle.visibility === 'hidden';
                        const hasHighZIndex = parseInt(computedStyle.zIndex) > 9000;
                        const isFullScreen =
                            element.offsetWidth >= window.innerWidth * 0.8 &&
                            element.offsetHeight >= window.innerHeight * 0.8;

                        // Remove if it matches ad criteria
                        if (isAdElement ||
                            (isInvisible && element.tagName === 'IFRAME') ||
                            (hasHighZIndex && isFullScreen)) {
                            console.log('[IframeGuard] 🗑️ Removing ad element:', element.tagName, element.id || element.className);
                            element.remove();
                            removed++;
                        }
                    });
                } catch {
                    // Selector might be invalid
                }
            });

            if (removed > 0) {
                setBlockedCount(prev => prev + removed);
            }
        };

        // Run immediately
        removeAdOverlays();

        // Run periodically
        const interval = setInterval(removeAdOverlays, 3000);

        // Also observe DOM changes
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as HTMLElement;
                            if (element.tagName === 'IFRAME' ||
                                element.tagName === 'DIV' ||
                                element.tagName === 'A' ||
                                element.tagName === 'SCRIPT') {
                                shouldCheck = true;
                                break;
                            }
                        }
                    }
                }
                if (shouldCheck) break;
            }

            if (shouldCheck) {
                setTimeout(removeAdOverlays, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => {
            clearInterval(interval);
            observer.disconnect();
        };
    }, [iframeRef]);

    // Handle iframe load
    const handleLoad = useCallback(() => {
        console.log('[IframeGuard] ✅ Iframe loaded');
        onLoad?.();
    }, [onLoad]);

    // Handle iframe error
    const handleError = useCallback(() => {
        console.log('[IframeGuard] ❌ Iframe error');
        onError?.();
    }, [onError]);

    // Sandbox permissions - carefully chosen to block ads while allowing playback
    // NOT including allow-popups, allow-popups-to-escape-sandbox, or allow-top-navigation
    const sandboxPermissions = [
        'allow-scripts',           // Required for video player
        'allow-same-origin',       // Required for some players
        'allow-forms',             // Some players need this
        'allow-presentation',      // For fullscreen
    ].join(' ');

    return (
        <div className="relative w-full h-full" data-iframe-guard="true">
            <iframe
                ref={iframeRef}
                src={src}
                title={title}
                className={`w-full h-full border-0 ${className}`}
                sandbox={sandboxPermissions}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                onLoad={handleLoad}
                onError={handleError}
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
                data-protected="true"
            />

            {/* Blocked notification */}
            {showBlockedNotice && (
                <div className="absolute top-4 right-4 z-50 animate-slide-up">
                    <div className="bg-green-600/90 text-white px-4 py-2 rounded-lg 
                        flex items-center gap-2 text-sm font-medium backdrop-blur-sm
                        shadow-lg border border-green-500/30">
                        <span>🛡️</span>
                        <span>Ad blocked</span>
                    </div>
                </div>
            )}

            {/* Debug counter (development only) */}
            {process.env.NODE_ENV === 'development' && blockedCount > 0 && (
                <div className="absolute top-4 left-4 z-50">
                    <div className="bg-red-600/80 text-white px-3 py-1.5 rounded-lg 
                        text-xs font-medium backdrop-blur-sm">
                        🛡️ {blockedCount} blocked
                    </div>
                </div>
            )}
        </div>
    );
});

IframeGuard.displayName = 'IframeGuard';

export { IframeGuard };
export type { IframeGuardProps };