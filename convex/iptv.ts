import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================================
// CONFIGURATION
// ============================================================
const PORTAL_URL = "http://seatv.xyz";
const API_BASE = `${PORTAL_URL}/portalott.php`;
const MAC = "00:1A:79:55:16:06";
const PREHASH = "2614ddf9829ba9d284f389d88e8c669d81f6a5c2";
const STREAM_KEY = "B2X4MX4S65WNTPY/bc65CNzbec";
const SN = "062014N013786";
const STB_TYPE = "MAG424";

const HEADERS: Record<string, string> = {
  Cookie: `mac=${MAC.replace(/:/g, "%3A")}; stb_lang=en; timezone=Africa%2FNairobi`,
  "User-Agent":
    "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
  "X-User-Agent": `Model: ${STB_TYPE}; Link: WiFi`,
  Accept: "*/*",
  "Cache-Control": "no-cache",
  Host: "seatv.xyz",
};

// ============================================================
// SAFE FETCH HELPER
// ============================================================
async function safeFetch(url: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();

    if (!text || text.trim() === "") {
      console.error(`Empty response from: ${url}`);
      return { js: {} };
    }

    try {
      return JSON.parse(text);
    } catch {
      console.error(`Failed to parse JSON from: ${url}`);
      console.error(`Response starts with: ${text.substring(0, 200)}`);
      return { js: {} };
    }
  } catch (error) {
    console.error(`Fetch failed from: ${url}`, error);
    return { js: {} };
  }
}

// ============================================================
// BASE64 HELPER
// ============================================================
function base64Encode(str: string): string {
  const BufferGlobal = (globalThis as any).Buffer;

  if (BufferGlobal?.from) {
    return BufferGlobal.from(str, "utf8").toString("base64");
  }

  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(str)));
  }

  const bytes = new TextEncoder().encode(str);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const chunk =
      (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);

    result += chars[(chunk >> 18) & 0x3f];
    result += chars[(chunk >> 12) & 0x3f];
    result +=
      typeof bytes[i + 1] === "undefined"
        ? "="
        : chars[(chunk >> 6) & 0x3f];
    result +=
      typeof bytes[i + 2] === "undefined" ? "=" : chars[chunk & 0x3f];
  }

  return result;
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

  const data = (await safeFetch(`${API_BASE}?${params}`)) as {
    js?: { token?: string };
  };

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

      return await safeFetch(`${API_BASE}?${params}`);
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
    try {
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
    } catch (err) {
      console.error("getOrderedList error:", err);
      return { js: { data: [], total_items: 0 } };
    }
  },
});

export const getChannelById = action({
  args: {
    channelId: v.number(),
  },
  handler: async (ctx: ActionCtx, args) => {
    try {
      const targetId = Number(args.channelId);
      const token = await getOrRefreshToken(ctx);

      const allParams = new URLSearchParams({
        type: "itv",
        action: "get_all_channels",
        force_ch_link_check: "",
        JsHttpRequest: "1-xml",
        token,
      });

      const allChannelsResult = await safeFetch(`${API_BASE}?${allParams}`);
      const allChannels =
        allChannelsResult?.js?.data || allChannelsResult?.js || [];

      if (Array.isArray(allChannels)) {
        const found = allChannels.find((channel: any) => {
          return Number(channel.id) === targetId;
        });

        if (found) {
          return {
            js: {
              data: found,
            },
          };
        }
      }

      async function fetchOrderedPage(page: number) {
        const params = new URLSearchParams({
          type: "itv",
          action: "get_ordered_list",
          genre: "*",
          force_ch_link_check: "",
          fav: "0",
          sortby: "number",
          hd: "0",
          p: String(page),
          JsHttpRequest: "1-xml",
          from_ch_id: "0",
          token,
        });

        return await safeFetch(`${API_BASE}?${params}`);
      }

      const firstPage = await fetchOrderedPage(0);
      const firstChannels = firstPage?.js?.data || [];

      const firstMatch = firstChannels.find((channel: any) => {
        return Number(channel.id) === targetId;
      });

      if (firstMatch) {
        return {
          js: {
            data: firstMatch,
          },
        };
      }

      const totalItems = Number(firstPage?.js?.total_items || 0);
      const pageSize = firstChannels.length || 14;
      const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 300;

      for (let page = 1; page < totalPages; page++) {
        const pageResult = await fetchOrderedPage(page);
        const channels = pageResult?.js?.data || [];

        const match = channels.find((channel: any) => {
          return Number(channel.id) === targetId;
        });

        if (match) {
          return {
            js: {
              data: match,
            },
          };
        }

        if (!channels.length && page > 10) {
          break;
        }
      }

      return {
        js: {
          data: null,
        },
      };
    } catch (err) {
      console.error("getChannelById error:", err);

      return {
        js: {
          data: null,
        },
      };
    }
  },
});

export const getChannelsByIds = action({
  args: {
    channelIds: v.array(v.number()),
  },
  handler: async (ctx: ActionCtx, args) => {
    try {
      const wantedIds = Array.from(
        new Set(
          args.channelIds
            .map((id) => Number(id))
            .filter((id) => !Number.isNaN(id))
        )
      );

      if (wantedIds.length === 0) {
        return {
          js: {
            data: [],
          },
        };
      }

      const wantedSet = new Set(wantedIds);
      const foundMap = new Map<number, any>();
      const token = await getOrRefreshToken(ctx);

      const allParams = new URLSearchParams({
        type: "itv",
        action: "get_all_channels",
        force_ch_link_check: "",
        JsHttpRequest: "1-xml",
        token,
      });

      const allChannelsResult = await safeFetch(`${API_BASE}?${allParams}`);
      const allChannels =
        allChannelsResult?.js?.data || allChannelsResult?.js || [];

      if (Array.isArray(allChannels)) {
        for (const channel of allChannels) {
          const id = Number(channel.id);

          if (wantedSet.has(id)) {
            foundMap.set(id, channel);
          }
        }

        if (foundMap.size === wantedSet.size) {
          return {
            js: {
              data: Array.from(foundMap.values()),
            },
          };
        }
      }

      async function fetchOrderedPage(page: number) {
        const params = new URLSearchParams({
          type: "itv",
          action: "get_ordered_list",
          genre: "*",
          force_ch_link_check: "",
          fav: "0",
          sortby: "number",
          hd: "0",
          p: String(page),
          JsHttpRequest: "1-xml",
          from_ch_id: "0",
          token,
        });

        return await safeFetch(`${API_BASE}?${params}`);
      }

      const firstPage = await fetchOrderedPage(0);
      const firstChannels = firstPage?.js?.data || [];

      for (const channel of firstChannels) {
        const id = Number(channel.id);

        if (wantedSet.has(id)) {
          foundMap.set(id, channel);
        }
      }

      if (foundMap.size === wantedSet.size) {
        return {
          js: {
            data: Array.from(foundMap.values()),
          },
        };
      }

      const totalItems = Number(firstPage?.js?.total_items || 0);
      const pageSize = firstChannels.length || 14;
      const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 300;

      for (let page = 1; page < totalPages; page++) {
        const pageResult = await fetchOrderedPage(page);
        const channels = pageResult?.js?.data || [];

        for (const channel of channels) {
          const id = Number(channel.id);

          if (wantedSet.has(id)) {
            foundMap.set(id, channel);
          }
        }

        if (foundMap.size === wantedSet.size) {
          break;
        }

        if (!channels.length && page > 10) {
          break;
        }
      }

      return {
        js: {
          data: Array.from(foundMap.values()),
        },
      };
    } catch (err) {
      console.error("getChannelsByIds error:", err);

      return {
        js: {
          data: [],
        },
      };
    }
  },
});

export const getGenres = action({
  handler: async (ctx: ActionCtx) => {
    try {
      const token = await getOrRefreshToken(ctx);

      const params = new URLSearchParams({
        type: "itv",
        action: "get_genres",
        JsHttpRequest: "1-xml",
        token,
      });

      return await safeFetch(`${API_BASE}?${params}`);
    } catch (err) {
      console.error("getGenres error:", err);
      return { js: { data: [] } };
    }
  },
});

// ============================================================
// EPG
// ============================================================
export const getEpgInfo = action({
  args: {
    period: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args) => {
    try {
      const token = await getOrRefreshToken(ctx);

      const params = new URLSearchParams({
        type: "itv",
        action: "get_epg_info",
        period: String(args.period || 5),
        JsHttpRequest: "1-xml",
        token,
      });

      return await safeFetch(`${API_BASE}?${params}`);
    } catch (err) {
      console.error("getEpgInfo error:", err);
      return { js: { data: {} } };
    }
  },
});

export const getShortEpg = action({
  args: {
    channelId: v.number(),
    size: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args) => {
    try {
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
    } catch (err) {
      console.error("getShortEpg error:", err);
      return { js: { data: [] } };
    }
  },
});

// ============================================================
// LIVE GAMES / SPORTS
// ============================================================
export const getLiveGames = action({
  args: {
    period: v.optional(v.number()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);

    const headers = {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
    };

    const period = args.period || 1;
    const page = args.page || 0;
    const pageSize = args.pageSize || 20;

    try {
      console.log("Priming session for live games...");

      await fetch(
        `${API_BASE}?type=stb&action=get_localization&JsHttpRequest=1-xml`,
        { headers }
      );

      await fetch(
        `${API_BASE}?type=itv&action=get_fav_ids&force_ch_link_check=&JsHttpRequest=1-xml`,
        { headers }
      );

      console.log("Fetching EPG for live games...");

      const epgUrl = `${API_BASE}?type=itv&action=get_epg_info&period=${period}&JsHttpRequest=1-xml`;
      const res = await fetch(epgUrl, { headers });
      const text = await res.text();

      console.log("Live games EPG response length:", text.length);

      if (!text || text.trim() === "") {
        return {
          status: "empty",
          games: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        };
      }

      let data: any;

      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Live games EPG parse error:", parseError);
        console.error("Response starts with:", text.substring(0, 300));

        return {
          status: "parse_error",
          games: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        };
      }

      const channels = data?.js?.data || {};

      const sportsKeywords = [
        " vs ",
        " VS ",
        "premier league",
        "la liga",
        "serie a",
        "bundesliga",
        "champions league",
        "europa league",
        "fa cup",
        "carabao cup",
        "nba",
        "nfl",
        "mlb",
        "nhl",
        "ufc",
        "boxing",
        "formula 1",
        "f1 ",
        "tennis",
        "grand slam",
        "sport momenten",
        "kick 't met",
        "live:",
        "matchday",
        "finale",
      ];

      const excludeKeywords = [
        "rondje",
        "nieuws",
        "journaal",
        "met het oog",
        "weer",
        "verkeer",
        "documentaire",
      ];

      const allGames: Array<{
        title: string;
        description: string;
        startTime: string;
        endTime: string;
        channelId: string;
        channelName: string;
        duration: number;
      }> = [];

      for (const [chId, programs] of Object.entries(channels)) {
        if (!Array.isArray(programs)) continue;

        for (const program of programs as any[]) {
          const title = program.name || "";
          const descr = program.descr || "";
          const combined = `${title} ${descr}`.toLowerCase();

          const isMatch = sportsKeywords.some((keyword) =>
            combined.includes(keyword.toLowerCase())
          );

          const isExcluded = excludeKeywords.some((keyword) =>
            combined.includes(keyword.toLowerCase())
          );

          if (isMatch && !isExcluded) {
            allGames.push({
              title,
              description: descr,
              startTime: program.time || program.start_timestamp || "",
              endTime: program.time_to || program.stop_timestamp || "",
              channelId: String(chId),
              channelName: program.ch_name || "",
              duration: Number(program.duration || 0),
            });
          }
        }
      }

      allGames.sort((a, b) => {
        const timeA = Number(a.startTime) || 0;
        const timeB = Number(b.startTime) || 0;
        return timeA - timeB;
      });

      const start = page * pageSize;
      const end = start + pageSize;
      const paginatedGames = allGames.slice(start, end);

      console.log(
        `Found ${allGames.length} live games, returning ${paginatedGames.length}`
      );

      return {
        status: "success",
        total: allGames.length,
        page,
        pageSize,
        totalPages: Math.ceil(allGames.length / pageSize),
        games: paginatedGames,
      };
    } catch (error) {
      console.error("getLiveGames error:", error);

      return {
        status: "error",
        games: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      };
    }
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
// VOD
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
  args: {
    page: v.optional(v.number()),
    category: v.optional(v.string()),
  },
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
  args: {
    movieId: v.number(),
  },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);

    const cmd = base64Encode(
      JSON.stringify({
        type: "movie",
        stream_id: args.movieId,
        stream_source: null,
        target_container: "mp4",
      })
    );

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
  args: {
    page: v.optional(v.number()),
    seriesId: v.optional(v.number()),
  },
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
  args: {
    seriesId: v.number(),
    seasonNum: v.number(),
  },
  handler: async (ctx: ActionCtx, args) => {
    const token = await getOrRefreshToken(ctx);

    const cmd = base64Encode(
      JSON.stringify({
        type: "series",
        series_id: args.seriesId,
        season_num: args.seasonNum,
      })
    );

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
  args: {
    page: v.optional(v.number()),
  },
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

    const ver = encodeURIComponent(
      "ImageDescription: 2.20.02-pub-424; ImageDate: Fri May 8 15:39:55 UTC 2020; PORTAL version: 5.3.1; API Version: JS API version: 343; STB API version: 146; Player Engine version: 0x588"
    );

    const metrics = encodeURIComponent(
      JSON.stringify({
        mac: MAC,
        sn: SN,
        model: STB_TYPE,
        type: "STB",
        uid: "",
        random: "",
      })
    );

    const params = new URLSearchParams({
      type: "stb",
      action: "get_profile",
      hd: "1",
      ver,
      num_banks: "2",
      sn: SN,
      stb_type: STB_TYPE,
      client_type: "STB",
      image_version: "220",
      video_out: "hdmi",
      device_id: "",
      device_id2: "",
      signature: "",
      auth_second_step: "1",
      hw_version: "1.7-BD-00",
      not_valid_token: "0",
      metrics,
      hw_version_2: "3f31829b3ba2d6eeac202d4e6758192802a1c018",
      timestamp: String(Math.floor(Date.now() / 1000)),
      api_signature: "262",
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
  args: {
    channelId: v.number(),
  },
  handler: async (_ctx: ActionCtx, args) => {
    return `${PORTAL_URL}/${STREAM_KEY}/${args.channelId}`;
  },
});

export const getMovieStreamUrl = action({
  args: {
    movieId: v.number(),
    playToken: v.string(),
  },
  handler: async (_ctx: ActionCtx, args) => {
    return `${PORTAL_URL}/movie/${STREAM_KEY}/${args.movieId}.mp4?play_token=${args.playToken}`;
  },
});

export const getSeriesStreamUrl = action({
  args: {
    episodeId: v.number(),
    playToken: v.string(),
  },
  handler: async (_ctx: ActionCtx, args) => {
    return `${PORTAL_URL}/series/${STREAM_KEY}/${args.episodeId}.mkv?play_token=${args.playToken}`;
  },
});

// ============================================================
// CRON
// ============================================================
export const refreshTokenCron = internalAction({
  handler: async (ctx: ActionCtx) => {
    await getOrRefreshToken(ctx);
  },
});