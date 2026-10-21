import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Rooms where only signed-in (Google) users may post: the live TV chat
const SIGNED_IN_ROOMS = new Set(["iptv-global"]);

// Admins are recognised by the email on their Google account, listed in the deployment's
// ADMIN_EMAILS setting (comma-separated), so the address isn't in the code
async function isAdmin(ctx: QueryCtx, userId: Id<"users"> | null) {
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  const email = user?.email?.trim().toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && admins.includes(email!);
}

/** The user's block or time freeze that is still in force, if any. */
async function activeBan(ctx: QueryCtx, userId: Id<"users">) {
  const ban = await ctx.db.query("chatBans").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  return ban && (ban.until === undefined || ban.until > Date.now()) ? ban : null;
}

// Time freeze lengths an admin can pick, in minutes
const FREEZE_MINUTES = new Set([10, 60, 24 * 60]);

/** The signed-in user, who must be an admin; throws otherwise. */
async function requireAdmin(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId || !(await isAdmin(ctx, userId))) throw new ConvexError("Only admins can do that.");
  return userId;
}

const MAX_MESSAGE_LENGTH = 200;
const MAX_USERNAME_LENGTH = 20;
const RATE_LIMIT_WINDOW = 10_000;
const RATE_LIMIT_MAX = 5;
// Per-match cap across all users, so switching usernames can't bypass the per-user limit
const MATCH_RATE_LIMIT_MAX = 30;

// Names that could be mistaken for staff. Admin status is never granted from a username.
const RESERVED_USERNAMES = new Set(["admin", "moderator", "system", "bravestream"]);
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#3B82F6";

// WELCOME MESSAGE - Edit this to customize
const WELCOME_MESSAGE = "👋 Welcome to BraveStream Chat! This is a free community space to share your thoughts, react to the game, and connect with fellow sports fans. Be respectful and enjoy the match! ⚽🔥";

function sanitizeUsername(username: string) {
  const cleaned = username.trim().slice(0, MAX_USERNAME_LENGTH).replace(/[^\w\s-]/g, "").trim();
  if (!cleaned || RESERVED_USERNAMES.has(cleaned.toLowerCase())) {
    return "Anonymous";
  }
  return cleaned;
}

// Messages are stored as plain text; the client renders them as text, never as HTML.
function sanitizeMessage(message: string) {
  return message.trim().slice(0, MAX_MESSAGE_LENGTH);
}

export const getMessages = query({
  args: {
    matchId: v.string(),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_match_created", (q) => q.eq("matchId", args.matchId))
      .order("desc")
      .take(50);

    const reversedMessages = messages.reverse();

    // Only check for welcome message if username is provided
    if (args.username) {
      const userMessages = await ctx.db
        .query("messages")
        .withIndex("by_match_user_created", (q) =>
          q.eq("matchId", args.matchId).eq("username", args.username!)
        )
        .first();

      // If user has no messages, prepend welcome message
      if (!userMessages) {
        const welcomeMsg = {
          _id: "welcome-" + args.matchId,
          _creationTime: Date.now(),
          matchId: args.matchId,
          username: "BraveStream",
          message: WELCOME_MESSAGE,
          color: "#10B981",
          createdAt: Date.now(),
          isAdmin: true,
          isSystem: true,
        };
        return [welcomeMsg, ...reversedMessages];
      }
    }

    return reversedMessages;
  },
});

/** Rate-limits, then stores a message. `username` must already be sanitised. */
async function insertMessage(
  ctx: MutationCtx,
  { matchId, username, message, color, userId, admin = false }: {
    matchId: string; username: string; message: string; color: string; userId?: Id<"users">; admin?: boolean;
  }
) {
  const text = sanitizeMessage(message);
  if (!text) {
    throw new ConvexError("Message cannot be empty.");
  }

  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  const recentMessages = await ctx.db
    .query("messages")
    .withIndex("by_match_user_created", (q) =>
      q
        .eq("matchId", matchId)
        .eq("username", username)
        .gt("createdAt", windowStart)
    )
    .take(RATE_LIMIT_MAX);

  if (recentMessages.length >= RATE_LIMIT_MAX) {
    throw new ConvexError(
      "Rate limit exceeded. Please wait before sending more messages."
    );
  }

  const recentMatchMessages = await ctx.db
    .query("messages")
    .withIndex("by_match_created", (q) =>
      q.eq("matchId", matchId).gt("createdAt", windowStart)
    )
    .take(MATCH_RATE_LIMIT_MAX);

  if (recentMatchMessages.length >= MATCH_RATE_LIMIT_MAX) {
    throw new ConvexError("Chat is busy. Please wait a moment.");
  }

  await ctx.db.insert("messages", {
    matchId,
    username,
    message: text,
    color: COLOR_PATTERN.test(color) ? color : DEFAULT_COLOR,
    createdAt: now,
    isAdmin: admin,
    ...(userId && { userId }),
  });
}

/** The name a signed-in user chats under: Google first name plus last initial, e.g. "Felix G". */
function chatNameFor(fullName: string | undefined) {
  const [first = "", last = ""] = (fullName || "").trim().split(/\s+/);
  return sanitizeUsername(last ? `${first} ${last[0]}` : first);
}

/** Anonymous posting (match chats). Rooms in SIGNED_IN_ROOMS need sendSignedIn instead. */
export const sendMessage = mutation({
  args: {
    matchId: v.string(),
    username: v.string(),
    message: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    if (SIGNED_IN_ROOMS.has(args.matchId)) {
      throw new ConvexError("Please sign in with Google to chat.");
    }
    await insertMessage(ctx, { ...args, username: sanitizeUsername(args.username) });
  },
});

/** Posting as the signed-in Google user; the name comes from their account. */
export const sendSignedIn = mutation({
  args: {
    matchId: v.string(),
    message: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Please sign in with Google to chat.");
    }
    const ban = await activeBan(ctx, userId);
    if (ban) {
      throw new ConvexError(ban.until ? "You're frozen in the chat for a while. Try again later." : "You've been blocked from the chat.");
    }
    const user = await ctx.db.get(userId);
    await insertMessage(ctx, { ...args, username: chatNameFor(user?.name), userId, admin: await isAdmin(ctx, userId) });
  },
});

/** The signed-in user's chat name and admin status, or null when signed out. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const ban = await activeBan(ctx, userId);
    return {
      name: chatNameFor(user?.name),
      isAdmin: await isAdmin(ctx, userId),
      isBlocked: Boolean(ban),
      // Set for a time freeze: when they may post again
      blockedUntil: ban?.until ?? null,
    };
  },
});

// =============================
// ADMIN: delete messages, block and unblock users
// =============================

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    await requireAdmin(ctx);
    if (await ctx.db.get(messageId)) await ctx.db.delete(messageId);
  },
});

/**
 * Stops the signed-in user who wrote `messageId` from posting. With `minutes` it's a time
 * freeze (their messages stay); without, a permanent block that also deletes their messages.
 */
export const blockAuthor = mutation({
  args: { messageId: v.id("messages"), minutes: v.optional(v.number()) },
  handler: async (ctx, { messageId, minutes }) => {
    const adminId = await requireAdmin(ctx);
    if (minutes !== undefined && !FREEZE_MINUTES.has(minutes)) throw new ConvexError("Unknown freeze length.");
    const message = await ctx.db.get(messageId);
    if (!message) return;
    if (!message.userId) {
      // Anonymous (older or match chat) messages have no account to block
      await ctx.db.delete(messageId);
      return;
    }
    const userId = message.userId;
    if (userId === adminId) throw new ConvexError("You can't block yourself.");

    const now = Date.now();
    const ban = { username: message.username, bannedBy: adminId, createdAt: now, until: minutes ? now + minutes * 60_000 : undefined };
    const existing = await ctx.db.query("chatBans").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    if (existing) await ctx.db.replace(existing._id, { userId, ...ban });
    else await ctx.db.insert("chatBans", { userId, ...ban });

    if (!minutes) {
      // Blocked for good: their messages disappear from every chat (capped so one call stays small)
      const theirs = await ctx.db.query("messages").withIndex("by_user", (q) => q.eq("userId", userId)).take(500);
      for (const m of theirs) await ctx.db.delete(m._id);
    }
  },
});

export const unblockUser = mutation({
  args: { banId: v.id("chatBans") },
  handler: async (ctx, { banId }) => {
    await requireAdmin(ctx);
    if (await ctx.db.get(banId)) await ctx.db.delete(banId);
  },
});

/** Blocked and frozen users, newest first (admins only; others get an empty list). Ended freezes are left out. */
export const blockedUsers = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx, await getAuthUserId(ctx)))) return [];
    const now = Date.now();
    const bans = await ctx.db.query("chatBans").order("desc").take(200);
    return bans
      .filter((b) => b.until === undefined || b.until > now)
      .map((b) => ({ id: b._id, username: b.username, createdAt: b.createdAt, until: b.until ?? null }));
  },
});