import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ---- CHAT (existing) ----
  messages: defineTable({
    matchId: v.string(),
    username: v.string(),
    message: v.string(),
    color: v.string(),
    createdAt: v.number(),
    isAdmin: v.boolean(),
    isSystem: v.optional(v.boolean()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_match_created", ["matchId", "createdAt"])
    .index("by_match_user_created", ["matchId", "username", "createdAt"]),

  // ---- IPTV TOKEN CACHE ----
  token: defineTable({
    value: v.string(),
    expiresAt: v.float64(),
  }).index("by_value", ["value"]),
});