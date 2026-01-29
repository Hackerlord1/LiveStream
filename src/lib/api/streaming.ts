// src/lib/api/streaming.ts

import { API_CONFIG, TIMEOUT_CONFIG } from './config';
import { logger } from './logger';
import type { ApiChannel } from './types';

// ========== EMBED URL FUNCTIONS ==========

/**
 * Get embed URL for a channel
 */
export function getEmbedUrl(channel: ApiChannel): string {
    const url = channel.url;
    logger.debug('Original channel URL:', url);

    // Check if this is already a player URL with required parameters
    if (url.includes('/api/v1/channels/player/')) {
        return addEmbedParameters(url);
    }

    // Construct proper player URL
    return constructPlayerUrl(channel);
}

/**
 * Add embed parameters to existing URL
 */
function addEmbedParameters(url: string): string {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;

        // Ensure required parameters
        if (!params.has('user')) params.set('user', API_CONFIG.USER);
        if (!params.has('plan')) params.set('plan', API_CONFIG.PLAN);

        // Add embed parameters
        params.set('embed', 'true');
        params.set('autoplay', '1');
        params.set('mute', '0');

        const embedUrl = urlObj.toString();
        logger.debug('Final embed URL:', embedUrl);
        return embedUrl;
    } catch (error) {
        logger.error('Error adding embed parameters:', error);
        return url;
    }
}

/**
 * Construct player URL from channel data
 */
function constructPlayerUrl(channel: ApiChannel): string {
    const params = new URLSearchParams({
        name: channel.name,
        code: channel.code,
        user: API_CONFIG.USER,
        plan: API_CONFIG.PLAN,
        embed: 'true',
        autoplay: '1',
        mute: '0',
        controls: '1',
    });

    const embedUrl = `${API_CONFIG.ENDPOINTS.PLAYER}?${params.toString()}`;
    logger.debug('Constructed embed URL:', embedUrl);
    return embedUrl;
}

/**
 * Get iframe embed URL (alternative method)
 */
export function getIframeEmbedUrl(channel: ApiChannel): string {
    const params = new URLSearchParams({
        name: channel.name,
        code: channel.code,
        user: API_CONFIG.USER,
        plan: API_CONFIG.PLAN,
        autoplay: '1',
    });

    return `${API_CONFIG.ENDPOINTS.EMBED}?${params.toString()}`;
}

/**
 * Check if URL has required parameters
 */
export function isProperlyFormatted(url: string): boolean {
    return url.includes('user=') && url.includes('plan=');
}

/**
 * Get safe embed URL for iframe
 */
export function getSafeEmbedUrl(channel: ApiChannel): string {
    const url = channel.url;

    // If URL is from cdn-live.tv and has required params, enhance it
    if (url.includes('cdn-live.tv') && isProperlyFormatted(url)) {
        return addEmbedParameters(url);
    }

    // Fallback to constructing URL
    return getEmbedUrl(channel);
}

/**
 * Test if stream URL is accessible
 */
export async function testStreamUrl(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            TIMEOUT_CONFIG.STREAM_TEST
        );

        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        logger.debug('URL test result:', {
            url,
            status: response.status,
            contentType: response.headers.get('content-type'),
            ok: response.ok,
        });

        return response.ok;
    } catch (error) {
        logger.error('URL test failed:', error);
        return false;
    }
}

/**
 * Get best available stream URL for a channel
 */
export async function getBestStreamUrl(channel: ApiChannel): Promise<string> {
    const urls = [
        getEmbedUrl(channel),
        getSafeEmbedUrl(channel),
        getIframeEmbedUrl(channel),
    ];

    // Remove duplicates
    const uniqueUrls = [...new Set(urls)];

    // Test each URL and return first working one
    for (const url of uniqueUrls) {
        const isWorking = await testStreamUrl(url);
        if (isWorking) {
            logger.debug('Found working stream URL:', url);
            return url;
        }
    }

    // Return primary URL as fallback
    logger.warn('No working stream URL found, using default');
    return uniqueUrls[0];
}