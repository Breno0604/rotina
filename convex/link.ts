import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertInstallationId } from "./utils";

/**
 * Merge-on-connect: moves EVERY row of the `from` installation into the `to`
 * installation (used when a device pastes another device's code — its own
 * data joins the shared space instead of staying orphaned under the old id).
 *
 * Nothing is deleted: rows are re-keyed by installationId. Objective ids are
 * preserved, so records keep pointing at their objectives. If both spaces had
 * similar objectives, duplicates can appear — the user can delete one.
 */
export const merge = mutation({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    assertInstallationId(from);
    assertInstallationId(to);
    if (from === to) return { moved: 0 };

    let moved = 0;

    const wipeObj = await ctx.db
      .query("objectives")
      .withIndex("by_installation", (q) => q.eq("installationId", from))
      .collect();
    for (const r of wipeObj) {
      await ctx.db.patch(r._id, { installationId: to });
      moved += 1;
    }

    const wipeRec = await ctx.db
      .query("records")
      .withIndex("by_installation", (q) => q.eq("installationId", from))
      .collect();
    for (const r of wipeRec) {
      await ctx.db.patch(r._id, { installationId: to });
      moved += 1;
    }

    const wipeNotes = await ctx.db
      .query("dailyNotes")
      .withIndex("by_installation_day", (q) => q.eq("installationId", from))
      .collect();
    for (const r of wipeNotes) {
      await ctx.db.patch(r._id, { installationId: to });
      moved += 1;
    }

    const wipeMem = await ctx.db
      .query("memories")
      .withIndex("by_installation", (q) => q.eq("installationId", from))
      .collect();
    for (const r of wipeMem) {
      await ctx.db.patch(r._id, { installationId: to });
      moved += 1;
    }

    const wipeAna = await ctx.db
      .query("analyses")
      .withIndex("by_installation", (q) => q.eq("installationId", from))
      .collect();
    for (const r of wipeAna) {
      await ctx.db.patch(r._id, { installationId: to });
      moved += 1;
    }

    // Fold the device row itself into the target (keep a single row per space).
    const wipeInst = await ctx.db
      .query("installations")
      .withIndex("by_installation", (q) => q.eq("installationId", from))
      .collect();
    for (const r of wipeInst) {
      const target = await ctx.db
        .query("installations")
        .withIndex("by_installation", (q) => q.eq("installationId", to))
        .first();
      if (target) {
        await ctx.db.delete(r._id);
      } else {
        await ctx.db.patch(r._id, { installationId: to });
        moved += 1;
      }
    }

    return { moved };
  },
});
