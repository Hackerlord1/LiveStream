import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

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
      .take(RATE_LIMIT_MAX);

    if (recentMessages.length >= RATE_LIMIT_MAX) {
      throw new ConvexError(
        "Rate limit exceeded. Please wait before sending more messages."
      );
    }

    const recentMatchMessages = await ctx.db
      .query("messages")
      .withIndex("by_match_created", (q) =>
        q.eq("matchId", args.matchId).gt("createdAt", windowStart)
      )
      .take(MATCH_RATE_LIMIT_MAX);

    if (recentMatchMessages.length >= MATCH_RATE_LIMIT_MAX) {
      throw new ConvexError("Chat is busy. Please wait a moment.");
    }

    await ctx.db.insert("messages", {
      matchId: args.matchId,
      username,
      message,
      color: COLOR_PATTERN.test(args.color) ? args.color : DEFAULT_COLOR,
      createdAt: now,
      isAdmin: false,
    });
  },
});