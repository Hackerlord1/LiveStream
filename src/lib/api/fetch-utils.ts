// src/lib/api/fetch-utils.ts - SIMPLIFIED VERSION

import { TIMEOUT_CONFIG, RETRY_CONFIG, HTTP_STATUS } from './config';

// ========== ERROR UTILITIES ==========

export function isAbortError(error: unknown): boolean {
    if (error instanceof Error) {
        return error.name === 'AbortError' || error.message.includes('aborted');
    }
    return false;
}

export function isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
        return error.message.includes('Failed to fetch') || error.message.includes('Network');
    }
    return false;
}

// ========== FETCH WITH RETRY ==========

interface FetchOptions {
    retries?: number;
    timeout?: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    const {
        retries = RETRY_CONFIG.MAX_RETRIES,
        timeout = TIMEOUT_CONFIG.DEFAULT,
    } = options;

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            console.log(`[Fetch] Attempt ${attempt}/${retries}: ${url}`);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
                cache: 'no-store',
            });

            clearTimeout(timeoutId);
            console.log(`[Fetch] Status: ${response.status}`);

            if (response.status === HTTP_STATUS.RATE_LIMITED && attempt < retries) {
                await sleep(RETRY_CONFIG.RATE_LIMIT_DELAY * attempt);
                continue;
            }

            if (response.status >= 500 && attempt < retries) {
                await sleep(RETRY_CONFIG.BASE_DELAY * attempt);
                continue;
            }

            return response;

        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`[Fetch] Attempt ${attempt} failed:`, lastError.message);

            if (attempt < retries) {
                await sleep(RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1));
            }
        }
    }

    throw lastError;
}

// ========== UTILITY FUNCTIONS ==========

export async function safeParseJSON<T>(response: Response): Promise<T | null> {
    try {
        return await response.json() as T;
    } catch {
        return null;
    }
}

export function buildUrl(base: string, params: Record<string, string>): string {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return url.toString();
}