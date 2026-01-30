// src/components/player/ClickShield.tsx

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ClickShieldProps {
    children: React.ReactNode;
    onFirstClick?: () => void;
    enabled?: boolean;
    showMessage?: boolean;
}

/**
 * ClickShield - Absorbs malicious first-click attempts
 * 
 * Many ad-injected video players hijack the first click to open ads.
 * This component absorbs those clicks and only passes through legitimate ones.
 */
function ClickShield({ 
    children, 
    onFirstClick, 
    enabled = true,
    showMessage = true 
}: ClickShieldProps) {
    const [clickCount, setClickCount] = useState(0);
    const [isArmed, setIsArmed] = useState(true);
    const [showNotice, setShowNotice] = useState(false);
    const [showClickPrompt, setShowClickPrompt] = useState(false);
    
    const lastClickTime = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const armResetTimeout = useRef<NodeJS.Timeout | null>(null);

    // Reset armed state after period of inactivity
    useEffect(() => {
        const resetArmed = () => {
            if (clickCount > 0 && Date.now() - lastClickTime.current > 60000) {
                setIsArmed(true);
                setClickCount(0);
                setShowClickPrompt(false);
            }
        };

        const interval = setInterval(resetArmed, 15000);
        return () => clearInterval(interval);
    }, [clickCount]);

    // Show click prompt after initial render
    useEffect(() => {
        if (enabled && isArmed) {
            const timer = setTimeout(() => {
                setShowClickPrompt(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [enabled, isArmed]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!enabled) return;

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime.current;
        lastClickTime.current = now;

        // First click protection - absorb it
        if (isArmed && clickCount === 0) {
            e.preventDefault();
            e.stopPropagation();

            setClickCount(1);
            setIsArmed(false);
            setShowClickPrompt(false);
            
            if (showMessage) {
                setShowNotice(true);
                setTimeout(() => setShowNotice(false), 2500);
            }

            onFirstClick?.();

            console.log('[ClickShield] 🛡️ First click absorbed - ad redirect prevented');
            return;
        }

        // Rapid double-click detection (likely ad trying multiple redirects)
        if (timeSinceLastClick < 150) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ClickShield] 🛡️ Rapid click blocked');
            return;
        }

        // Triple click within short time - might be ad script
        if (clickCount >= 3 && timeSinceLastClick < 500) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ClickShield] 🛡️ Suspicious click pattern blocked');
            return;
        }

        // Allow subsequent legitimate clicks
        setClickCount(prev => prev + 1);
    }, [enabled, isArmed, clickCount, onFirstClick, showMessage]);

    // Handle touch events for mobile
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled || !isArmed || clickCount > 0) return;

        // On mobile, treat first touch as the first click
        e.preventDefault();
        e.stopPropagation();

        setClickCount(1);
        setIsArmed(false);
        setShowClickPrompt(false);

        if (showMessage) {
            setShowNotice(true);
            setTimeout(() => setShowNotice(false), 2500);
        }

        onFirstClick?.();
        lastClickTime.current = Date.now();

        console.log('[ClickShield] 🛡️ First touch absorbed - ad redirect prevented');
    }, [enabled, isArmed, clickCount, onFirstClick, showMessage]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full"
            onClick={handleClick}
            onTouchStart={handleTouchStart}
        >
            {children}

            {/* First click prompt */}
            {showClickPrompt && isArmed && enabled && (
                <div className="absolute inset-0 z-40 flex items-center justify-center 
                    bg-black/40 backdrop-blur-[2px] cursor-pointer transition-opacity">
                    <div className="player-click-message animate-slide-up">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <span className="text-3xl">▶️</span>
                        </div>
                        <h3 className="text-white text-lg font-semibold mb-2">
                            Click to Play
                        </h3>
                        <p className="text-gray-300 text-sm">
                            Protected by BraveStream Shield
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-3 text-green-400 text-xs">
                            <span>🛡️</span>
                            <span>Ad-free viewing enabled</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Click absorbed notice */}
            {showNotice && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 
                    pointer-events-none animate-fade-in-out">
                    <div className="bg-green-600/95 text-white px-5 py-3 rounded-xl 
                        flex items-center gap-3 shadow-2xl backdrop-blur-sm
                        border border-green-400/30">
                        <span className="text-xl">✓</span>
                        <div>
                            <div className="font-semibold">Ad Blocked!</div>
                            <div className="text-xs text-green-100">Click again to play video</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export { ClickShield };
export type { ClickShieldProps };