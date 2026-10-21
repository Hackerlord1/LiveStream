import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  // ---- SIGN-IN (Convex Auth: users, sessions, Google accounts) ----
  ...authTables,

  // ---- CHAT (existing) ----
  messages: defineTable({
    matchId: v.string(),
    username: v.string(),
    message: v.string(),
    color: v.string(),
    createdAt: v.number(),
    isAdmin: v.boolean(),
    isSystem: v.optional(v.boolean()),
    // Who sent it, for messages from signed-in users (lets a user be banned later)
    userId: v.optional(v.id("users")),
  })
    .index("by_matchId", ["matchId"])
    .index("by_match_created", ["matchId", "createdAt"])
    .index("by_match_user_created", ["matchId", "username", "createdAt"]),

  // ---- LEGACY: old IPTV token cache, no longer used (IPTV moved to server/). ----
  // Kept so deploys don't fail on existing rows; clear the table in the Convex
  // dashboard, then this can be deleted.
  token: defineTable({
    value: v.string(),
    expiresAt: v.float64(),
  }).index("by_value", ["value"]),
});