import { action, internalAction, internalMutation, internalQuery, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================================
// PORTAL CONFIGURATION — expat-tv.xyz
// ============================================================
const PORTAL_URL = "http://expat-tv.xyz";
const API_BASE = `${PORTAL_URL}/portalott.php`;
const MAC = "00:1A:79:9C:5F:D5";
const PREHASH = "9c42ac937c6bc42ba21b45b853bfc020b013f8f6";
const STREAM_KEY = "MAGL2ELNMB/MAG42M41CA";
const SN = "";
const STB_TYPE = "MAG250";
const IMAGE_VERSION = "218";
const API_SIGNATURE = "263";
const HW_VERSION_2 = "194afd292f2f70ca31fb618bfd1f2eecb12557b8";

const HEADERS = {
  "Cookie": `mac=${MAC.replace(/:/g, "%3A")}; stb_lang=en; timezone=Africa%2FNairobi`,
  "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
  "X-User-Agent": `Model: ${STB_TYPE}; Link: WiFi`,
  "Accept": "*/*",
  "Cache-Control": "no-cache",
  "Host": "expat-tv.xyz",
};

// ============================================================
// SAFE FETCH HELPER
// ============================================================
async function safeFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS });
  const text = await res.text();

  if (!text || text.trim() === "") {
    console.error(`Empty response from: ${url}`);
    return { js: {} };
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`Failed to parse JSON from: ${url}`);
    console.error(`Response starts with: ${text.substring(0, 200)}`);
    return { js: {} };
  }
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================
export const getCachedToken = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("token").order("desc").first();
  },
});

export const storeToken = internalMutation({
  args: {
    value: v.string(),
    expiresAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("token", args);
  },
});

async function getOrRefreshToken(ctx: ActionCtx): Promise<string> {
  const existing = await ctx.runQuery(internal.iptv.getCachedToken, {});

  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const params = new URLSearchParams({
    type: "stb",
    action: "handshake",
    token: "",
    prehash: PREHASH,
    JsHttpRequest: "1-xml",
  });

  const data = await safeFetch(`${API_BASE}?${params}`) as { js?: { token?: string } };
  const token = data?.js?.token;

  if (!token) {
    console.error("Handshake failed — no token returned");
    throw new Error("Failed to authenticate with IPTV server");
  }

  await ctx.runMutation(internal.iptv.storeToken, {
    value: token,
    expiresAt: Date.now() + 3600000,
  });

  return token;
}

// ============================================================
// AUTHENTICATION
// ============================================================
export const handshake = action({
  handler: async (ctx: ActionCtx) => {
    return await getOrRefreshToken(ctx);
  },
});

// ============================================================
// LIVE TV
// ============================================================
export const getAllChannels = action({
  handler: async (ctx: ActionCtx) => {
    try {
      const token = await getOrRefreshToken(ctx);
      const params = new URLSearchParams({
        type: "itv",
        action: "get_all_channels",
        force_ch_link_check: "",
        JsHttpRequest: "1-xml",
        token,
      });
      const data = await safeFetch(`${API_BASE}?${params}`);
      return data;
    } catch (err) {
      console.error("getAllChannels error:", err);
      return { js: { data: [] } };
    }
  },
});

export const getOrderedList = action({
  args: {
    genre: v.optional(v.string()),
    page: v.optional(v.number()),
    sortby: v.optional(v.string()),
    hd: v.optional(v.number()),
    fav: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "itv",
      action: "get_ordered_list",
      genre: args.genre || "*",
      force_ch_link_check: "",
      fav: String(args.fav || 0),
      sortby: args.sortby || "number",
      hd: String(args.hd || 0),
      p: String(args.page || 0),
      JsHttpRequest: "1-xml",
      from_ch_id: "0",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getChannelById = action({
  args: { channelId: v.number() },
  handler: async (ctx: ActionCtx, args) => {
    try {
      const token = await getOrRefreshToken(ctx);
      const params = new URLSearchParams({
        type: "itv",
        action: "get_all_channels",
        force_ch_link_check: "",
        JsHttpRequest: "1-xml",
        token,
      });
      const data = (await safeFetch(`${API_BASE}?${params}`)) as any;
      const channels = data?.js?.data || [];
      const channel = channels.find((item: any) => Number(item.id) === args.channelId);
      return { js: { data: channel || null } };
    } catch (err) {
      console.error("getChannelById error:", err);
      return { js: { data: null } };
    }
  },
});

export const getGenres = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "itv",
      action: "get_genres",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// EPG
// ============================================================
export const getEpgInfo = action({
  args: { period: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "itv",
      action: "get_epg_info",
      period: String(args.period || 5),
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getShortEpg = action({
  args: { channelId: v.number(), size: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "itv",
      action: "get_short_epg",
      ch_id: String(args.channelId),
      size: String(args.size || 10),
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// FAVORITES
// ============================================================
export const getFavChannels = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "itv",
      action: "get_all_fav_channels",
      fav: "1",
      force_ch_link_check: "",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getFavIds = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "itv",
      action: "get_fav_ids",
      force_ch_link_check: "",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// VOD (MOVIES)
// ============================================================
export const getVodCategories = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "vod",
      action: "get_categories",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getVodList = action({
  args: { page: v.optional(v.number()), category: v.optional(v.string()) },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "vod",
      action: "get_ordered_list",
      movie_id: "0",
      season_id: "0",
      episode_id: "0",
      category: args.category || "*",
      fav: "0",
      sortby: "added",
      hd: "0",
      not_ended: "0",
      p: String(args.page || 1),
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const createVodLink = action({
  args: { movieId: v.number() },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const cmd = btoa(JSON.stringify({
      type: "movie",
      stream_id: args.movieId,
      stream_source: null,
      target_container: "mp4",
    }));
    const params = new URLSearchParams({
      type: "vod",
      action: "create_link",
      cmd,
      series: "",
      forced_storage: "",
      disable_ad: "0",
      download: "0",
      force_ch_link_check: "0",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// SERIES
// ============================================================
export const getSeriesCategories = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "series",
      action: "get_categories",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getSeriesList = action({
  args: { page: v.optional(v.number()), seriesId: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "series",
      action: "get_ordered_list",
      movie_id: String(args.seriesId || 0),
      season_id: "0",
      episode_id: "0",
      category: "*",
      fav: "0",
      sortby: "added",
      hd: "0",
      not_ended: "0",
      p: String(args.page || 1),
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const createSeriesLink = action({
  args: { seriesId: v.number(), seasonNum: v.number() },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const cmd = btoa(JSON.stringify({
      type: "series",
      series_id: args.seriesId,
      season_num: args.seasonNum,
    }));
    const params = new URLSearchParams({
      type: "vod",
      action: "create_link",
      cmd,
      series: "1",
      forced_storage: "",
      disable_ad: "0",
      download: "0",
      force_ch_link_check: "0",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// RADIO
// ============================================================
export const getRadioList = action({
  args: { page: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "radio",
      action: "get_ordered_list",
      all: "0",
      p: String(args.page || 1),
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getFavRadio = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "radio",
      action: "get_all_fav_radio",
      fav: "1",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// ACCOUNT
// ============================================================
export const getAccountInfo = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "account_info",
      action: "get_main_info",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

export const getPaymentInfo = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const params = new URLSearchParams({
      type: "account_info",
      action: "get_payment_info",
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// PROFILE
// ============================================================
export const getProfile = action({
  handler: async (ctx: ActionCtx) => {
    const token = await getOrRefreshToken(ctx);
    const ver = encodeURIComponent("ImageDescription: 0.2.18-r14-pub-250; ImageDate: Fri Jan 15 15:20:44 EET 2016; PORTAL version: 5.3.1; API Version: JS API version: 328; STB API version: 134; Player Engine version: 0x588");
    const metrics = encodeURIComponent(JSON.stringify({
      mac: MAC,
      sn: SN,
      model: STB_TYPE,
      type: "STB",
      uid: "",
      random: "",
    }));
    const params = new URLSearchParams({
      type: "stb",
      action: "get_profile",
      hd: "1",
      ver,
      num_banks: "2",
      sn: SN,
      stb_type: STB_TYPE,
      client_type: "STB",
      image_version: IMAGE_VERSION,
      video_out: "hdmi",
      device_id: "",
      device_id2: "",
      signature: "",
      auth_second_step: "1",
      hw_version: "1.7-BD-00",
      not_valid_token: "0",
      metrics,
      hw_version_2: HW_VERSION_2,
      timestamp: String(Math.floor(Date.now() / 1000)),
      api_signature: API_SIGNATURE,
      prehash: PREHASH,
      JsHttpRequest: "1-xml",
      token,
    });
    return await safeFetch(`${API_BASE}?${params}`);
  },
});

// ============================================================
// STREAM URL HELPERS
// ============================================================
export const getLiveStreamUrl = action({
  args: { channelId: v.number() },
  handler: async (_ctx: ActionCtx, args) => {
    return `${PORTAL_URL}/${STREAM_KEY}/${args.channelId}`;
  },
});

export const getMovieStreamUrl = action({
  args: { movieId: v.number(), playToken: v.string() },
  handler: async (_ctx: ActionCtx, args) => {
    return `${PORTAL_URL}/movie/${STREAM_KEY}/${args.movieId}.mp4?play_token=${args.playToken}`;
  },
});

export const getSeriesStreamUrl = action({
  args: { episodeId: v.number(), playToken: v.string() },
  handler: async (_ctx: ActionCtx, args) => {
    return `${PORTAL_URL}/series/${STREAM_KEY}/${args.episodeId}.mkv?play_token=${args.playToken}`;
  },
});

// ============================================================
// CRON: Refresh Token Every 30 Minutes
// ============================================================
export const refreshTokenCron = internalAction({
  handler: async (ctx: ActionCtx) => {
    await getOrRefreshToken(ctx);
  },
});