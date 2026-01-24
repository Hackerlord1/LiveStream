// public/adblock-evasion.js - Client-side ad-block evasion

(function() {
    'use strict';

    console.log('🛡️ BraveStreams Ad-Block Evasion Loaded');

    // Configuration
    const config = {
        autoSkipAds: true,
        hideAdWarnings: true,
        fakeAdObjects: true,
        blockAdRequests: true,
        debug: false
    };

    // Ad server patterns to watch for
    const adPatterns = [
        'doubleclick.net',
        'googlesyndication.com',
        'adsafeprotected.com',
        'adnxs.com',
        'amazon-adsystem.com',
        '/ad/', '/ads/', '/adserver/',
        'vast.xml', 'vmap.xml', 'vpaid.js',
        'ad.js', 'ads.js', 'advert.js',
        '?ad=', '&ad=', '?ads=', '&ads='
    ];

    // ========== FAKE AD OBJECTS ==========
    if (config.fakeAdObjects) {
        // Fake Google Ads
        window.google_ad_client = "ca-pub-1234567890123456";
        window.google_ad_slot = "1234567890";
        window.google_ad_width = 728;
        window.google_ad_height = 90;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.loaded = true;

        // Fake Google Publisher Tag
        window.googletag = window.googletag || {};
        window.googletag.cmd = window.googletag.cmd || [];
        window.googletag.cmd.push = function(fn) {
            try {
                if (typeof fn === 'function') {
                    setTimeout(fn, 0);
                }
            } catch (e) {
                // Ignore errors
            }
            return 1;
        };

        // Fake other ad networks
        window.fbq = function() {
            console.log('[Fake] fbq called');
        };
        window._fbq = window._fbq || [];

        window.twq = function() {
            console.log('[Fake] twq called');
        };
        window._twq = window._twq || [];

        // Fake prebid.js
        window.pbjs = window.pbjs || {};
        window.pbjs.que = window.pbjs.que || [];

        console.log('[Ad Evasion] Fake ad objects created');
    }

    // ========== BLOCK AD REQUESTS ==========
    if (config.blockAdRequests) {
        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

            // Check if it's an ad URL
            if (isAdUrl(url)) {
                if (config.debug) console.log('[Blocked Fetch]', url);
                return Promise.resolve(new Response('', {
                    status: 404,
                    statusText: 'Not Found',
                    headers: { 'X-Ad-Blocked': 'true' }
                }));
            }

            // Add headers to avoid detection
            if (args[1]) {
                args[1].headers = {
                    ...args[1].headers,
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Ad-Free': 'false',
                    'Accept': '*/*'
                };
            }

            return originalFetch.apply(this, args);
        };

        // Intercept XMLHttpRequest
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = class extends OriginalXHR {
            open(method, url, async = true, user, password) {
                if (url && isAdUrl(url.toString())) {
                    if (config.debug) console.log('[Blocked XHR]', url);
                    this._blocked = true;
                    return;
                }

                // Clean URL
                let cleanUrl = url;
                if (url && typeof url === 'string') {
                    try {
                        const urlObj = new URL(url);
                        // Remove ad parameters
                        ['ad', 'ads', 'advert', 'advertising'].forEach(param => {
                            urlObj.searchParams.delete(param);
                        });
                        cleanUrl = urlObj.toString();
                    } catch (e) {
                        // URL parsing failed
                    }
                }

                super.open(method, cleanUrl, async, user, password);
            }

            send(body) {
                if (this._blocked) {
                    if (config.debug) console.log('[XHR Blocked] Request not sent');
                    return;
                }
                super.send(body);
            }
        };

        console.log('[Ad Evasion] Request interception active');
    }

    // ========== AUTO-SKIP VIDEO ADS ==========
    if (config.autoSkipAds) {
        function skipVideoAds() {
            // Find all video elements
            const videos = document.querySelectorAll('video');

            videos.forEach(video => {
                // Skip short videos (likely ads)
                if (video.duration > 0 && video.duration <= 30) {
                    if (config.debug) console.log('[Auto-skip] Short video detected, likely ad');
                    video.currentTime = video.duration;

                    // Try to play after skipping
                    setTimeout(() => {
                        video.play().catch(() => {});
                    }, 100);
                }

                // Skip muted videos (often ads)
                if (video.muted && video.duration > 0) {
                    if (config.debug) console.log('[Auto-skip] Muted video, likely ad');
                    video.currentTime = video.duration;
                }

                // Click skip buttons
                const skipSelectors = [
                    'button[aria-label*="Skip"]',
                    'button[class*="skip"]',
                    '.skip-button',
                    '.skip-ad',
                    '.ad-skip',
                    'div[role="button"][aria-label*="Skip"]'
                ];

                skipSelectors.forEach(selector => {
                    const buttons = video.parentElement?.querySelectorAll(selector) || [];
                    buttons.forEach(button => {
                        if (button instanceof HTMLElement) {
                            button.click();
                            if (config.debug) console.log('[Auto-skip] Clicked skip button');
                        }
                    });
                });
            });

            // Remove ad overlays
            const overlaySelectors = [
                '.ad-overlay',
                '.ad-modal',
                '.ad-interstitial',
                '.video-ads',
                '.ad-container',
                '[class*="ad-overlay"]',
                '[class*="ad-modal"]',
                'div[style*="background: black"][style*="opacity: 0.8"]'
            ];

            overlaySelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    element.style.display = 'none';
                    element.style.visibility = 'hidden';
                    element.style.opacity = '0';
                    element.style.pointerEvents = 'none';
                });
            });
        }

        // Run immediately and set interval
        skipVideoAds();
        setInterval(skipVideoAds, 1000);

        console.log('[Ad Evasion] Auto-skip active');
    }

    // ========== HIDE AD-BLOCK WARNINGS ==========
    if (config.hideAdWarnings) {
        function hideWarnings() {
            // Select all elements and check for ad-block warnings
            document.querySelectorAll('*').forEach(element => {
                const text = element.textContent || '';
                const html = element.innerHTML || '';

                const isWarning = text.includes('adblock') ||
                    text.includes('AdBlock') ||
                    text.includes('disable ad blocker') ||
                    text.includes('whitelist') ||
                    text.includes('disable your ad blocker') ||
                    text.includes('ad blocker detected') ||
                    html.includes('adblock') ||
                    html.includes('AdBlock');

                if (isWarning) {
                    // Hide the element
                    element.style.cssText = 'display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important;';

                    // Remove from DOM
                    setTimeout(() => {
                        if (element.parentNode) {
                            element.parentNode.removeChild(element);
                        }
                    }, 1000);

                    if (config.debug) console.log('[Warning Hidden]', text.substring(0, 100));
                }
            });
        }

        // Run immediately and periodically
        hideWarnings();
        setInterval(hideWarnings, 2000);

        // MutationObserver for dynamically added warnings
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const element = node;
                        const text = element.textContent || '';

                        if (text.includes('adblock') || text.includes('AdBlock')) {
                            element.style.display = 'none';
                            element.style.visibility = 'hidden';
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        console.log('[Ad Evasion] Warning hiding active');
    }

    // ========== HELPER FUNCTIONS ==========
    function isAdUrl(url) {
        if (!url) return false;

        const urlLower = url.toLowerCase();
        return adPatterns.some(pattern => urlLower.includes(pattern));
    }

    // Global helper functions
    window.BraveStreamsAdBlock = {
        skipAds: skipVideoAds,
        hideWarnings: hideWarnings,
        isEnabled: true,
        version: '1.0.0'
    };

    // Add skip button to page
    function addSkipButton() {
        const skipBtn = document.createElement('button');
        skipBtn.id = 'bravestreams-skip-btn';
        skipBtn.innerHTML = '⏩ Skip Ads';
        skipBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            background: linear-gradient(135deg, #dc2626, #1e40af);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: none;
        `;
        skipBtn.onclick = () => {
            if (window.BraveStreamsAdBlock && window.BraveStreamsAdBlock.skipAds) {
                window.BraveStreamsAdBlock.skipAds();
                skipBtn.style.display = 'none';
            }
        };

        document.body.appendChild(skipBtn);

        // Show button when ads might be playing
        setInterval(() => {
            const videos = document.querySelectorAll('video');
            const hasShortVideo = Array.from(videos).some(v =>
                v.duration > 0 && v.duration <= 30 && v.currentTime < v.duration
            );

            if (hasShortVideo) {
                skipBtn.style.display = 'block';
            }
        }, 1000);
    }

    // Add skip button after page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addSkipButton);
    } else {
        addSkipButton();
    }

    console.log('✅ BraveStreams Ad-Block Evasion fully loaded');
})();