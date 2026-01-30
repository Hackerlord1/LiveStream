// src/lib/adblock/brave-blocker.ts

import { FilterEngine } from './filter-engine';
import { CosmeticFilter } from './cosmetic-filter';
import { NetworkFilter } from './network-filter';

/**
 * Brave-style ad blocking engine
 * Uses same logic as Brave Shields
 */

// Popular filter lists (same ones Brave uses)
const FILTER_LISTS = {
  easylist: 'https://easylist.to/easylist/easylist.txt',
  easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
  ublock: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
  brave: 'https://raw.githubusercontent.com/nickkelly1/nickkelly.dev/main/public/brave/lists/default.txt',
};

// Comprehensive ad domain blocklist (from Brave + Pi-hole + AdGuard)
const AD_DOMAINS: Set<string> = new Set([
  // Google Ads
  'pagead2.googlesyndication.com',
  'googleadservices.com',
  'googlesyndication.com',
  'doubleclick.net',
  'googleads.g.doubleclick.net',
  'ad.doubleclick.net',
  'adservice.google.com',
  'www.googletagservices.com',
  'adwords.google.com',
  
  // Google Analytics & Tracking
  'google-analytics.com',
  'ssl.google-analytics.com',
  'www.google-analytics.com',
  'analytics.google.com',
  'www.googletagmanager.com',
  
  // Facebook
  'pixel.facebook.com',
  'an.facebook.com',
  'ads.facebook.com',
  'www.facebook.com/tr',
  'connect.facebook.net',
  
  // Amazon
  'amazon-adsystem.com',
  'aax.amazon.com',
  'fls-na.amazon.com',
  
  // Twitter
  'ads.twitter.com',
  'static.ads-twitter.com',
  'analytics.twitter.com',
  
  // Microsoft
  'ads.msn.com',
  'adnxs.com',
  'adnexus.net',
  
  // Ad Networks
  'adsrvr.org',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'criteo.com',
  'criteo.net',
  'outbrain.com',
  'outbrainimg.com',
  'taboola.com',
  'cdn.taboola.com',
  'moatads.com',
  'z-na.moatads.com',
  
  // Trackers
  'scorecardresearch.com',
  'sb.scorecardresearch.com',
  'quantserve.com',
  'pixel.quantserve.com',
  'bluekai.com',
  'exelator.com',
  'turn.com',
  'mathtag.com',
  'rlcdn.com',
  'demdex.net',
  'krxd.net',
  'agkn.com',
  'adsymptotic.com',
  'adform.net',
  'serving-sys.com',
  'eyeota.net',
  'rfihub.com',
  'liveramp.com',
  'dotomi.com',
  'nexac.com',
  'adadvisor.net',
  'adgrx.com',
  
  // Video Ads
  'imasdk.googleapis.com',
  'www.youtube.com/api/stats/ads',
  'vid.springserve.com',
  'ads.us.e.appnexus.net',
  
  // Popups & Malware
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'adsterra.com',
  'trafficjunky.com',
  'exoclick.com',
  'juicyads.com',
  
  // Analytics
  'hotjar.com',
  'mixpanel.com',
  'segment.com',
  'segment.io',
  'amplitude.com',
  'heapanalytics.com',
  'fullstory.com',
  'crazyegg.com',
  'mouseflow.com',
  'luckyorange.com',
]);

// Tracking URL patterns (regex)
const TRACKING_PATTERNS: RegExp[] = [
  // URL patterns
  /[?&]utm_/i,
  /[?&]fbclid=/i,
  /[?&]gclid=/i,
  /[?&]msclkid=/i,
  /[?&]mc_eid=/i,
  /[?&]oly_/i,
  /[?&]_ga=/i,
  /[?&]__hs/i,
  
  // Path patterns
  /\/ad[s]?[\/\?]/i,
  /\/ad[s]?\./i,
  /\/advert/i,
  /\/banner[s]?[\/\?]/i,
  /\/pixel[\/\?]/i,
  /\/track(er|ing)?[\/\?]/i,
  /\/beacon[\/\?]/i,
  /\/telemetry[\/\?]/i,
  /\/collect[\/\?]/i,
  /\/analytics[\/\?]/i,
  /\/stat[s]?[\/\?]/i,
  /\/log[\/\?]/i,
  /\/click[\/\?]/i,
  /\/impression[\/\?]/i,
  /\/pxl[\/\?]/i,
  /\/conversion[\/\?]/i,
];

// Subdomain patterns
const SUBDOMAIN_PATTERNS: RegExp[] = [
  /^ad[s]?\d*\./i,
  /^adserver/i,
  /^adtrack/i,
  /^advert/i,
  /^affiliate/i,
  /^analytics\./i,
  /^banner[s]?\./i,
  /^beacon\./i,
  /^click\./i,
  /^counter\./i,
  /^pixel\./i,
  /^stat[s]?\./i,
  /^tag\./i,
  /^telemetry\./i,
  /^track(er|ing)?\./i,
];

export type BlockReason = 
  | 'domain'
  | 'subdomain'
  | 'tracking-pattern'
  | 'filter-list'
  | 'custom-rule';

export interface BlockResult {
  blocked: boolean;
  reason?: BlockReason;
  matchedRule?: string;
}

export interface BraveBlockerStats {
  totalBlocked: number;
  blockedByDomain: number;
  blockedByPattern: number;
  blockedByFilter: number;
  domainsInList: number;
  patternsInList: number;
}

export class BraveStyleBlocker {
  private domainBlocklist: Set<string>;
  private trackingPatterns: RegExp[];
  private subdomainPatterns: RegExp[];
  private customRules: Set<string>;
  private whitelist: Set<string>;
  
  // Cache for performance (like Brave's bloom filter)
  private cache: Map<string, BlockResult>;
  private cacheMaxSize: number = 10000;
  
  // Stats
  private stats: BraveBlockerStats;

  constructor() {
    this.domainBlocklist = new Set(AD_DOMAINS);
    this.trackingPatterns = [...TRACKING_PATTERNS];
    this.subdomainPatterns = [...SUBDOMAIN_PATTERNS];
    this.customRules = new Set();
    this.whitelist = new Set();
    this.cache = new Map();
    
    this.stats = {
      totalBlocked: 0,
      blockedByDomain: 0,
      blockedByPattern: 0,
      blockedByFilter: 0,
      domainsInList: this.domainBlocklist.size,
      patternsInList: this.trackingPatterns.length + this.subdomainPatterns.length,
    };
  }

  /**
   * Main blocking check - mimics Brave's shouldBlock logic
   */
  shouldBlock(url: string): BlockResult {
    try {
      // Check cache first (Brave uses bloom filter for speed)
      const cacheKey = this.getCacheKey(url);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      const fullUrl = parsedUrl.href.toLowerCase();

      // Check whitelist
      if (this.isWhitelisted(hostname)) {
        return this.cacheResult(cacheKey, { blocked: false });
      }

      // 1. Check exact domain match
      if (this.domainBlocklist.has(hostname)) {
        this.stats.blockedByDomain++;
        this.stats.totalBlocked++;
        return this.cacheResult(cacheKey, {
          blocked: true,
          reason: 'domain',
          matchedRule: hostname,
        });
      }

      // 2. Check if hostname is subdomain of blocked domain
      for (const blockedDomain of this.domainBlocklist) {
        if (hostname.endsWith(`.${blockedDomain}`)) {
          this.stats.blockedByDomain++;
          this.stats.totalBlocked++;
          return this.cacheResult(cacheKey, {
            blocked: true,
            reason: 'domain',
            matchedRule: blockedDomain,
          });
        }
      }

      // 3. Check subdomain patterns
      for (const pattern of this.subdomainPatterns) {
        if (pattern.test(hostname)) {
          this.stats.blockedByPattern++;
          this.stats.totalBlocked++;
          return this.cacheResult(cacheKey, {
            blocked: true,
            reason: 'subdomain',
            matchedRule: pattern.source,
          });
        }
      }

      // 4. Check tracking patterns in URL
      for (const pattern of this.trackingPatterns) {
        if (pattern.test(fullUrl)) {
          this.stats.blockedByPattern++;
          this.stats.totalBlocked++;
          return this.cacheResult(cacheKey, {
            blocked: true,
            reason: 'tracking-pattern',
            matchedRule: pattern.source,
          });
        }
      }

      // 5. Check custom rules
      for (const rule of this.customRules) {
        if (fullUrl.includes(rule) || hostname.includes(rule)) {
          this.stats.blockedByFilter++;
          this.stats.totalBlocked++;
          return this.cacheResult(cacheKey, {
            blocked: true,
            reason: 'custom-rule',
            matchedRule: rule,
          });
        }
      }

      return this.cacheResult(cacheKey, { blocked: false });
    } catch (error) {
      return { blocked: false };
    }
  }

  /**
   * Strip tracking parameters from URL (like Brave does)
   */
  stripTrackingParams(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'mc_eid', 'oly_anon_id', 'oly_enc_id',
        '_ga', '_gl', '__hssc', '__hstc', '__hsfp', 'hsCtaTracking',
        'ref', 'ref_', 'referrer', 'source', 'src',
        'click_id', 'campaign_id', 'ad_id',
      ];

      trackingParams.forEach(param => {
        parsedUrl.searchParams.delete(param);
      });

      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  /**
   * Add domain to blocklist
   */
  addDomain(domain: string): void {
    this.domainBlocklist.add(domain.toLowerCase());
    this.stats.domainsInList = this.domainBlocklist.size;
    this.clearCache();
  }

  /**
   * Add multiple domains
   */
  addDomains(domains: string[]): void {
    domains.forEach(d => this.domainBlocklist.add(d.toLowerCase()));
    this.stats.domainsInList = this.domainBlocklist.size;
    this.clearCache();
  }

  /**
   * Add custom blocking rule
   */
  addCustomRule(rule: string): void {
    this.customRules.add(rule.toLowerCase());
    this.clearCache();
  }

  /**
   * Add domain to whitelist
   */
  addToWhitelist(domain: string): void {
    this.whitelist.add(domain.toLowerCase());
    this.clearCache();
  }

  /**
   * Remove domain from whitelist
   */
  removeFromWhitelist(domain: string): void {
    this.whitelist.delete(domain.toLowerCase());
    this.clearCache();
  }

  /**
   * Check if domain is whitelisted
   */
  private isWhitelisted(hostname: string): boolean {
    if (this.whitelist.has(hostname)) return true;
    
    for (const whitelisted of this.whitelist) {
      if (hostname.endsWith(`.${whitelisted}`)) return true;
    }
    
    return false;
  }

  /**
   * Get cache key
   */
  private getCacheKey(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Cache result with LRU eviction
   */
  private cacheResult(key: string, result: BlockResult): BlockResult {
    if (this.cache.size >= this.cacheMaxSize) {
      // Simple LRU: delete first entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
    return result;
  }

  /**
   * Clear cache
   */
  private clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get blocking statistics
   */
  getStats(): BraveBlockerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalBlocked: 0,
      blockedByDomain: 0,
      blockedByPattern: 0,
      blockedByFilter: 0,
      domainsInList: this.domainBlocklist.size,
      patternsInList: this.trackingPatterns.length + this.subdomainPatterns.length,
    };
  }

  /**
   * Export blocklist for debugging
   */
  exportBlocklist(): string[] {
    return Array.from(this.domainBlocklist);
  }
}

// Singleton instance
export const braveBlocker = new BraveStyleBlocker();