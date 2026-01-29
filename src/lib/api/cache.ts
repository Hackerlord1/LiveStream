// src/lib/api/cache.ts

import { CACHE_CONFIG } from './config';
import { logger } from './logger';
import type { CacheEntry } from './types';

class ApiCache {
    private memoryCache = new Map<string, CacheEntry<unknown>>();
    private maxAge: number;

    constructor(maxAge: number = CACHE_CONFIG.DURATION) {
        this.maxAge = maxAge;
    }

    /**
     * Get cached data if valid
     */
    get<T>(key: string): T | null {
        // Try memory cache first (faster, SSR-safe)
        const memCached = this.memoryCache.get(key);
        if (memCached && this.isValid(memCached.timestamp)) {
            logger.debug(`Cache hit (memory): ${key}`);
            return memCached.data as T;
        }

        // Fall back to localStorage (client-side only)
        if (typeof window === 'undefined') return null;

        try {
            const item = localStorage.getItem(key);
            if (!item) return null;

            const entry: CacheEntry<T> = JSON.parse(item);
            
            if (!this.isValid(entry.timestamp)) {
                logger.debug(`Cache expired: ${key}`);
                this.delete(key);
                return null;
            }

            // Populate memory cache for faster subsequent access
            this.memoryCache.set(key, entry);
            logger.debug(`Cache hit (localStorage): ${key}`);
            return entry.data;
        } catch (error) {
            logger.warn(`Cache read error for ${key}:`, error);
            this.delete(key);
            return null;
        }
    }

    /**
     * Set cache data
     */
    set<T>(key: string, data: T): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
        };

        // Always set in memory cache
        this.memoryCache.set(key, entry);

        // Try to persist to localStorage
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(key, JSON.stringify(entry));
                logger.debug(`Cache set: ${key}`);
            } catch (error) {
                // localStorage might be full
                logger.warn(`Cache write error for ${key}:`, error);
                this.clearOldEntries();
                
                // Try again after clearing
                try {
                    localStorage.setItem(key, JSON.stringify(entry));
                } catch {
                    logger.error(`Failed to cache ${key} even after clearing old entries`);
                }
            }
        }
    }

    /**
     * Delete specific cache entry
     */
    delete(key: string): void {
        this.memoryCache.delete(key);
        
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(key);
                logger.debug(`Cache deleted: ${key}`);
            } catch (error) {
                logger.warn(`Cache delete error for ${key}:`, error);
            }
        }
    }

    /**
     * Clear all API-related cache
     */
    clear(): void {
        // Clear memory cache
        this.memoryCache.clear();

        // Clear localStorage cache
        if (typeof window !== 'undefined') {
            try {
                Object.values(CACHE_CONFIG.KEYS).forEach(key => {
                    localStorage.removeItem(key);
                });
                logger.info('Cache cleared');
            } catch (error) {
                logger.warn('Cache clear error:', error);
            }
        }
    }

    /**
     * Check if timestamp is within valid range
     */
    private isValid(timestamp: number): boolean {
        return Date.now() - timestamp < this.maxAge;
    }

    /**
     * Clear old cache entries when storage is full
     */
    private clearOldEntries(): void {
        if (typeof window === 'undefined') return;

        try {
            const keysToRemove: string[] = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                try {
                    const item = localStorage.getItem(key);
                    if (!item) continue;

                    const entry = JSON.parse(item);
                    if (entry.timestamp && !this.isValid(entry.timestamp)) {
                        keysToRemove.push(key);
                    }
                } catch {
                    // Not a valid cache entry, skip
                }
            }

            keysToRemove.forEach(key => localStorage.removeItem(key));
            logger.debug(`Cleared ${keysToRemove.length} old cache entries`);
        } catch (error) {
            logger.warn('Error clearing old cache entries:', error);
        }
    }

    /**
     * Get cache stats (for debugging)
     */
    getStats(): { memorySize: number; keys: string[] } {
        return {
            memorySize: this.memoryCache.size,
            keys: Array.from(this.memoryCache.keys()),
        };
    }
}

// Export singleton instance
export const apiCache = new ApiCache();

// Export class for custom instances
export { ApiCache };

// Convenience function to clear cache (exported for use in components)
export function clearApiCache(): void {
    apiCache.clear();
}