// Remembers each viewer's preferred video quality (per device, in localStorage).

const LIVE_KEY = "iptv-live-quality"; // "auto" or a height like "480"
const VOD_KEY = "iptv-vod-quality";   // "original" or a height like "480"

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode): the choice just won't be remembered
  }
}

export const readLiveQuality = () => read(LIVE_KEY) || "auto";
export const writeLiveQuality = (value: string) => write(LIVE_KEY, value);

/**
 * Movies/series default: the saved choice, else 480p on a connection the browser reports
 * as slow (Chrome/Android expose this), else the original file.
 */
export function readVodQuality(): string {
  const saved = read(VOD_KEY);
  if (saved) return saved;
  const connection = (navigator as Navigator & { connection?: { downlink?: number; saveData?: boolean } }).connection;
  if (connection?.saveData || (connection?.downlink && connection.downlink < 4)) return "480";
  return "original";
}
export const writeVodQuality = (value: string) => write(VOD_KEY, value);
