import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const MAX_MESSAGE_LENGTH = 200;
const MAX_USERNAME_LENGTH = 20;
const RATE_LIMIT_WINDOW = 10_000;
const RATE_LIMIT_MAX = 5;

const ADMIN_USERS = new Set(["admin", "moderator", "system"]);

function sanitizeUsername(username: string) {
  const cleaned = username.trim().slice(0, MAX_USERNAME_LENGTH);
  return cleaned.replace(/[^\w\s-]/g, "") || "Anonymous";
}

function sanitizeMessage(message: string) {
  return message
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const getMessages = query({
  args: {
    matchId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_match_created", (q) => q.eq("matchId", args.matchId))
      .order("desc")
      .take(50);

    return messages.reverse();
  },
});

export const sendMessage = mutation({
  args: {
    matchId: v.string(),
    username: v.string(),
    message: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const username = sanitizeUsername(args.username);
    const message = sanitizeMessage(args.message);

    if (!message) {
      throw new ConvexError("Message cannot be empty.");
    }

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_match_user_created", (q) =>
        q
          .eq("matchId", args.matchId)
          .eq("username", username)
          .gt("createdAt", windowStart)
      )
      .collect();

    if (recentMessages.length >= RATE_LIMIT_MAX) {
      throw new ConvexError(
        "Rate limit exceeded. Please wait before sending more messages."
      );
    }

    const isAdmin = ADMIN_USERS.has(username.toLowerCase());

    await ctx.db.insert("messages", {
      matchId: args.matchId,
      username,
      message,
      color: args.color,
      createdAt: now,
      isAdmin,
    });
  },
});