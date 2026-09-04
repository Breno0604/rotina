import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertInstallationId } from "./utils";

/** Create (or refresh) the row describing this installation. */
export const touch = mutation({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    const now = Date.now();
    const existing = await ctx.db
      .query("installations")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("installations", {
        installationId,
        createdAt: now,
        lastSeenAt: now,
      });
    }
  },
});

export const get = query({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    return ctx.db
      .query("installations")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .first();
  },
});
