import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    matchId: v.string(),
    username: v.string(),
    message: v.string(),
    color: v.string(),
    createdAt: v.number(),
    isAdmin: v.optional(v.boolean()),
    isSystem: v.optional(v.boolean()),
  })
    .index("by_match_created", ["matchId", "createdAt"])
    .index("by_match_user_created", ["matchId", "username", "createdAt"]),
});