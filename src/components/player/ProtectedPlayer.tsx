// src/components/player/ProtectedPlayer.tsx

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ClickShield } from './ClickShield';
import { IframeGuard } from './IframeGuard';

interface ProtectedPlayerProps {
    src: string;
    title: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
    isLoading?: boolean;
    showLoadingOverlay?: boolean;
}

/**
 * ProtectedPlayer - Complete ad protection wrapper for video embeds
 * Combines ClickShield + IframeGuard + Overlay Protection
 */
function ProtectedPlayer({
    src,
    title,
    className = '',
    onLoad,
    onError,
    isLoading = false,
    showLoadingOverlay = true,
}: ProtectedPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [adsBlocked, setAdsBlocked] = useState(0);

    // Handle iframe load
    const handleLoad = useCallback(() => {
        setIsReady(true);
        onLoad?.();
    }, [onLoad]);

    // Handle first click absorbed
    const handleFirstClick = useCallback(() => {
        setAdsBlocked(prev => prev + 1);
        console.log('[ProtectedPlayer] First click absorbed, ad redirect prevented');
    }, []);

    // Remove any injected ad elements
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        const removeAds = () => {
            // Remove any scripts that might have been injected
            const scripts = container.querySelectorAll('script');
            scripts.forEach(script => {
                if (!script.src.includes(window.location.hostname)) {
                    script.remove();
                }
            });

            // Remove suspicious iframes (not our main one)
            const iframes = container.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                if (!iframe.hasAttribute('data-protected')) {
                    const src = iframe.src || '';
                    if (src.includes('ad') || src.includes('pop') || 
                        src.includes('track') || iframe.style.display === 'none' ||
                        iframe.style.visibility === 'hidden' ||
                        iframe.style.opacity === '0') {
                        iframe.remove();
                        setAdsBlocked(prev => prev + 1);
                    }
                }
            });

            // Remove click-jacking elements
            const overlays = container.querySelectorAll('a, div');
            overlays.forEach(el => {
                const element = el as HTMLElement;
                const style = window.getComputedStyle(element);
                
                if (style.position === 'absolute' || style.position === 'fixed') {
                    const zIndex = parseInt(style.zIndex) || 0;
                    if (zIndex > 100 && element.tagName === 'A') {
                        element.remove();
                        setAdsBlocked(prev => prev + 1);
                    }
                }
            });
        };

        // Initial cleanup
        removeAds();

        // Periodic cleanup
        const interval = setInterval(removeAds, 5000);

        // Mutation observer for dynamically injected ads
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    setTimeout(removeAds, 50);
                    break;
                }
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
        });

        return () => {
            clearInterval(interval);
            observer.disconnect();
        };
    }, [src]);

    return (
        <div 
            ref={containerRef} 
            className={`relative w-full h-full overflow-hidden ${className}`}
            data-protected-player="true"
        >
            <ClickShield 
                onFirstClick={handleFirstClick} 
                enabled={true}
                showMessage={true}
            >
                <IframeGuard
                    src={src}
                    title={title}
                    onLoad={handleLoad}
                    onError={onError}
                    className="rounded-xl"
                />
            </ClickShield>

            {/* Loading overlay */}
            {showLoadingOverlay && (isLoading || !isReady) && (
                <div className="absolute inset-0 flex items-center justify-center 
                    bg-gray-900/70 z-10 rounded-xl backdrop-blur-sm">
                    <div className="text-center">
                        <div className="loading-spinner h-12 w-12 mx-auto"></div>
                        <span className="mt-4 block text-white font-medium">
                            Loading stream...
                        </span>
                        <span className="mt-2 block text-gray-400 text-sm">
                            🛡️ Protection active
                        </span>
                    </div>
                </div>
            )}

            {/* Protection indicator (bottom left) */}
            <div className="absolute bottom-3 left-3 z-20">
                <div className="protection-badge-minimal opacity-60 hover:opacity-100 
                    transition-opacity cursor-default">
                    <span>🛡️</span>
                    <span>Protected</span>
                    {adsBlocked > 0 && (
                        <span className="ml-1 bg-green-600/30 px-1.5 rounded">
                            {adsBlocked}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export { ProtectedPlayer };
export type { ProtectedPlayerProps };