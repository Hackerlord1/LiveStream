// src/hooks/useAdBlock.ts
import { useState, useEffect, useCallback } from 'react';

export interface AdBlockStats {
    blockedAds: number;
    adSegmentsRemoved: number;
}

export function useAdBlock() {
    const [isActive, setIsActive] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [stats, setStats] = useState<AdBlockStats>({
        blockedAds: 0,
        adSegmentsRemoved: 0,
    });

    // Check if SW is active
    useEffect(() => {
        const checkStatus = async () => {
            if (!('serviceWorker' in navigator)) {
                setIsChecking(false);
                return;
            }

            try {
                const reg = await navigator.serviceWorker.getRegistration('/');
                setIsActive(!!reg?.active);
            } catch (err) {
                console.warn('SW status check failed:', err);
            } finally {
                setIsChecking(false);
            }
        };

        checkStatus();
    }, []);

    // Listen to messages from Service Worker
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handler = (event: MessageEvent) => {
            const { type, count } = event.data || {};

            if (type === 'AD_BLOCKED') {
                setStats(prev => ({ ...prev, blockedAds: prev.blockedAds + 1 }));
            }

            if (type === 'ADS_REMOVED_FROM_PLAYLIST' || type === 'STREAM_MODIFIED') {
                setStats(prev => ({
                    ...prev,
                    adSegmentsRemoved: count || prev.adSegmentsRemoved + 1,
                }));
            }
        };

        navigator.serviceWorker.addEventListener('message', handler);
        return () => navigator.serviceWorker.removeEventListener('message', handler);
    }, []);

    // Activate the ad-blocker
    const activate = useCallback(async () => {
        if (!('serviceWorker' in navigator)) return false;

        try {
            await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            });
            setIsActive(true);
            return true;
        } catch (err) {
            console.error('Failed to activate ad-blocker:', err);
            return false;
        }
    }, []);

    // Force skip ads (useful for stubborn embeds)
    const forceSkip = useCallback(() => {
        navigator.serviceWorker.controller?.postMessage({
            type: 'FORCE_AD_SKIP',
            timestamp: Date.now(),
        });
    }, []);

    // Notify about new stream
    const notifyStreamChange = useCallback((url: string) => {
        navigator.serviceWorker.controller?.postMessage({
            type: 'STREAM_CHANGE',
            url,
        });
    }, []);

    return {
        isActive,
        isChecking,
        stats,
        activate,
        forceSkip,
        notifyStreamChange,
    };
}