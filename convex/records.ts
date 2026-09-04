import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  assertDayKey,
  assertInstallationId,
  cleanFreeName,
  cleanMinutes,
  cleanOptionalText,
  notFound,
} from "./utils";

export const listByRange = query({
  args: {
    installationId: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, { installationId, from, to }) => {
    assertInstallationId(installationId);
    if (from) assertDayKey(from);
    if (to) assertDayKey(to);
    if (from && to) {
      return ctx.db
        .query("records")
        .withIndex("by_installation_day", (q) =>
          q.eq("installationId", installationId).gte("dayKey", from).lte("dayKey", to),
        )
        .collect();
    }
    return ctx.db
      .query("records")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
  },
});

export const add = mutation({
  args: {
    installationId: v.string(),
    dayKey: v.string(),
    minutes: v.number(),
    /** when given, the record belongs to this objective */
    objectiveId: v.optional(v.id("objectives")),
    /** free activity name when NOT linked to an objective */
    activityName: v.optional(v.string()),
    observation: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertInstallationId(args.installationId);
    assertDayKey(args.dayKey);
    const minutes = cleanMinutes(args.minutes);
    const observation = cleanOptionalText(args.observation ?? null, 600, "observation");

    let objectiveId: Id<"objectives"> | null = null;
    let activityName: string;
    let targetMinutes: number | null;

    if (args.objectiveId) {
      const objective = await ctx.db.get(args.objectiveId);
      if (!objective || objective.installationId !== args.installationId) {
        throw notFound();
      }
      objectiveId = objective._id;
      // Server-side snapshot: name and target at record time.
      activityName = objective.name;
      targetMinutes = objective.targetMinutes;
    } else {
      activityName = cleanFreeName(args.activityName ?? "");
      targetMinutes = null;
    }

    return ctx.db.insert("records", {
      installationId: args.installationId,
      dayKey: args.dayKey,
      objectiveId: objectiveId as never,
      activityName,
      targetMinutes,
      minutes,
      observation,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    installationId: v.string(),
    id: v.id("records"),
    minutes: v.optional(v.number()),
    dayKey: v.optional(v.string()),
    observation: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { installationId, id, minutes, dayKey, observation }) => {
    assertInstallationId(installationId);
    const record = await ctx.db.get(id);
    if (!record || record.installationId !== installationId) {
      throw notFound();
    }
    const patch: {
      minutes?: number;
      dayKey?: string;
      observation?: string | null;
    } = {};
    if (minutes !== undefined) patch.minutes = cleanMinutes(minutes);
    if (dayKey !== undefined) {
      assertDayKey(dayKey);
      patch.dayKey = dayKey;
    }
    if (observation !== undefined) {
      patch.observation = cleanOptionalText(observation, 600, "observation");
    }
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { installationId: v.string(), id: v.id("records") },
  handler: async (ctx, { installationId, id }) => {
    assertInstallationId(installationId);
    const record = await ctx.db.get(id);
    if (!record || record.installationId !== installationId) {
      throw notFound();
    }
    await ctx.db.delete(id);
  },
});
