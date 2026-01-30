// src/lib/adblock/network-interceptor.ts

import { braveBlocker, BlockResult } from './brave-blocker';

interface InterceptorOptions {
  blockMode: 'block' | 'log-only' | 'redirect';
  stripTracking: boolean;
  logging: boolean;
  onBlock?: (url: string, result: BlockResult) => void;
}

const defaultOptions: InterceptorOptions = {
  blockMode: 'block',
  stripTracking: true,
  logging: process.env.NODE_ENV === 'development',
  onBlock: undefined,
};

/**
 * Brave-style network request interceptor
 */
export class NetworkInterceptor {
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;
  private options: InterceptorOptions;
  private isActive: boolean = false;

  constructor(options: Partial<InterceptorOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.originalFetch = globalThis.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
  }

  /**
   * Activate the interceptor
   */
  activate(): void {
    if (this.isActive) return;
    
    this.interceptFetch();
    this.interceptXHR();
    this.isActive = true;
    
    if (this.options.logging) {
      console.log('[Brave Blocker] Network interceptor activated');
    }
  }

  /**
   * Deactivate the interceptor
   */
  deactivate(): void {
    if (!this.isActive) return;
    
    globalThis.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    this.isActive = false;
    
    if (this.options.logging) {
      console.log('[Brave Blocker] Network interceptor deactivated');
    }
  }

  /**
   * Intercept fetch requests
   */
  private interceptFetch(): void {
    const self = this;
    
    globalThis.fetch = async function(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      let url = self.getUrl(input);
      
      // Strip tracking parameters
      if (self.options.stripTracking) {
        url = braveBlocker.stripTrackingParams(url);
      }
      
      // Check if should block
      const result = braveBlocker.shouldBlock(url);
      
      if (result.blocked) {
        if (self.options.logging) {
          console.log(`[Brave Blocker] 🛡️ Blocked: ${url}`);
          console.log(`  Reason: ${result.reason}`);
          console.log(`  Rule: ${result.matchedRule}`);
        }
        
        self.options.onBlock?.(url, result);
        
        if (self.options.blockMode === 'block') {
          // Return empty response (like Brave)
          return new Response(null, {
            status: 200,
            statusText: 'Blocked',
            headers: new Headers({
              'X-Blocked-By': 'Brave-Style-Blocker',
              'X-Block-Reason': result.reason || 'unknown',
            }),
          });
        }
      }
      
      // Proceed with request
      const modifiedInput = typeof input === 'string' ? url : input;
      return self.originalFetch.call(globalThis, modifiedInput, init);
    };
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXHR(): void {
    const self = this;
    
    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null
    ): void {
      let urlString = url.toString();
      
      // Strip tracking parameters
      if (self.options.stripTracking) {
        urlString = braveBlocker.stripTrackingParams(urlString);
      }
      
      // Check if should block
      const result = braveBlocker.shouldBlock(urlString);
      
      if (result.blocked) {
        if (self.options.logging) {
          console.log(`[Brave Blocker] 🛡️ XHR Blocked: ${urlString}`);
        }
        
        self.options.onBlock?.(urlString, result);
        
        if (self.options.blockMode === 'block') {
          // Redirect to empty response
          urlString = 'data:application/json,{}';
        }
      }
      
      return self.originalXHROpen.call(
        this, method, urlString, async, username, password
      );
    };
  }

  /**
   * Get URL from fetch input
   */
  private getUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
  }
}

// Create and export singleton
export const networkInterceptor = new NetworkInterceptor();