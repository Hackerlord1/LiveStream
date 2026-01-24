'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast'; // Optional: for nice notifications

export default function ServiceWorkerProvider() {
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
    const messageQueueRef = useRef<any[]>([]); // For queuing messages before SW is ready

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            console.warn('Service Workers not supported in this browser.');
            return;
        }

        let registration: ServiceWorkerRegistration;

        const registerSW = async () => {
            try {
                registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none', // Ensures fresh SW on update
                });

                registrationRef.current = registration;

                console.log('✅ BraveStreams Service Worker registered:', registration.scope);

                // Force update check on load (useful after deploy)
                registration.update();

                // Periodic update check (every 30 minutes is better than hourly)
                const updateInterval = setInterval(() => {
                    registration.update();
                    console.log('🔄 Checking for Service Worker update...');
                }, 30 * 60 * 1000);

                // Handle update found
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    console.log('🔔 New Service Worker update found! Installing...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New SW installed, but waiting to activate
                            toast.success('New ad-blocker update ready! Refresh to apply.', {
                                duration: 8000,
                                id: 'sw-update',
                            });

                            // Optional: Add global function to force refresh
                            (window as any).applySWUpdate = () => {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            };
                        }
                    });
                });

                // Drain any queued messages
                if (messageQueueRef.current.length > 0) {
                    messageQueueRef.current.forEach(msg =>
                        navigator.serviceWorker.controller?.postMessage(msg)
                    );
                    messageQueueRef.current = [];
                }
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
                toast.error('Ad-blocker failed to load. Some ads may appear.');
            }
        };

        // Listen for controller change (SW becomes active)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker controller changed');
            // Optionally reload page on new SW activation
            // window.location.reload();
        });

        // Central message handler
        const handleMessage = (event: MessageEvent) => {
            const { type, url, segmentsRemoved, timestamp } = event.data;

            switch (type) {
                case 'AD_BLOCKED':
                    console.log('🚫 Ad blocked:', url);
                    toast.success('Ad blocked', { duration: 2000, id: `ad-${timestamp}` });
                    break;

                case 'ADS_REMOVED_FROM_PLAYLIST':
                case 'STREAM_MODIFIED':
                    console.log(`🧹 ${segmentsRemoved} ad segments removed from stream`);
                    toast.success(`${segmentsRemoved} ad segment(s) removed!`, {
                        duration: 4000,
                        icon: '✂️',
                    });
                    break;

                case 'STATS':
                    console.log('📊 Ad-blocker stats:', event.data);
                    break;

                default:
                    console.log('📩 SW Message:', event.data);
            }

            // Forward to any app-level listeners (e.g., React context)
            window.dispatchEvent(
                new CustomEvent('bravestreams:sw-message', { detail: event.data })
            );
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Global utility functions
        (window as any).braveStreams = {
            skipAd: () => {
                const msg = { type: 'FORCE_AD_SKIP', timestamp: Date.now() };
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage(msg);
                } else {
                    messageQueueRef.current.push(msg); // Queue if SW not ready yet
                }
            },

            reloadStream: () => {
                navigator.serviceWorker.controller?.postMessage({
                    type: 'RELOAD_STREAM',
                });
            },

            getStats: () => {
                navigator.serviceWorker.controller?.postMessage({ type: 'GET_STATS' });
            },

            forceUpdate: () => registrationRef.current?.update(),
        };

        registerSW();

        // Cleanup
        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            // clearInterval(updateInterval); // Handled by browser
        };
    }, []);

    return null;
}