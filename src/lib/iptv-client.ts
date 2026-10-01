// Base URL of the stream/API server (server/server.js), e.g. via Cloudflare Tunnel.
export const IPTV_API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.bravestream.live").replace(/\/+$/, "");

/** A failed request; `serverMessage` is the server's own explanation, when it sent one. */
export class IptvError extends Error {
  constructor(
    public status: number,
    public serverMessage: string | null
  ) {
    super(serverMessage || `IPTV request failed: ${status}`);
  }
}

export async function fetchIptv<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${IPTV_API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let serverMessage: string | null = null;
    try {
      serverMessage = (await res.json())?.error ?? null;
    } catch {
      // not JSON (e.g. a Cloudflare error page)
    }
    throw new IptvError(res.status, serverMessage);
  }
  return (await res.json()) as T;
}
