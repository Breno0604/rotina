import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertDayKey, assertInstallationId } from "./utils";

const NOTE_MAX = 4000;

/** Save the day's free observation (upsert per installation+day). */
export const set = mutation({
  args: {
    installationId: v.string(),
    dayKey: v.string(),
    note: v.string(),
  },
  handler: async (ctx, { installationId, dayKey, note }) => {
    assertInstallationId(installationId);
    assertDayKey(dayKey);
    const cleaned = note.trim().slice(0, NOTE_MAX);
    const existing = await ctx.db
      .query("dailyNotes")
      .withIndex("by_installation_day", (q) =>
        q.eq("installationId", installationId).eq("dayKey", dayKey),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        note: cleaned,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("dailyNotes", {
      installationId,
      dayKey,
      note: cleaned,
      updatedAt: Date.now(),
    });
  },
});

export const get = query({
  args: { installationId: v.string(), dayKey: v.string() },
  handler: async (ctx, { installationId, dayKey }) => {
    assertInstallationId(installationId);
    assertDayKey(dayKey);
    return ctx.db
      .query("dailyNotes")
      .withIndex("by_installation_day", (q) =>
        q.eq("installationId", installationId).eq("dayKey", dayKey),
      )
      .first();
  },
});

/** Used by export: all notes of the installation. */
export const list = query({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    return ctx.db
      .query("dailyNotes")
      .withIndex("by_installation_day", (q) => q.eq("installationId", installationId))
      .collect();
  },
});

/** Notes within a day range (used by History month list). */
export const listRange = query({
  args: { installationId: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { installationId, from, to }) => {
    assertInstallationId(installationId);
    assertDayKey(from);
    assertDayKey(to);
    return ctx.db
      .query("dailyNotes")
      .withIndex("by_installation_day", (q) =>
        q.eq("installationId", installationId).gte("dayKey", from).lte("dayKey", to),
      )
      .collect();
  },
});
