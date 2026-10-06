// Remembers each viewer's preferred video quality (per device, in localStorage).

const LIVE_KEY = "iptv-live-quality"; // "best" (default), "auto" or a height like "480"
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

/** Live default: the best quality the channel offers, unless the viewer chose otherwise. */
export const readLiveQuality = () => read(LIVE_KEY) || "best";
export const writeLiveQuality = (value: string) => write(LIVE_KEY, value);

/** Movies/series default: the original file, unless the viewer chose a lower quality. */
export const readVodQuality = () => read(VOD_KEY) || "original";
export const writeVodQuality = (value: string) => write(VOD_KEY, value);
