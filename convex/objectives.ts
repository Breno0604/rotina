import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertInstallationId,
  assertDayKey,
  cleanMinutes,
  cleanName,
  notFound,
} from "./utils";

export const list = query({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    return ctx.db
      .query("objectives")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
  },
});

export const create = mutation({
  args: {
    installationId: v.string(),
    name: v.string(),
    targetMinutes: v.number(),
    createdDayKey: v.string(),
  },
  handler: async (ctx, args) => {
    assertInstallationId(args.installationId);
    assertDayKey(args.createdDayKey);
    const name = cleanName(args.name);
    const targetMinutes = cleanMinutes(args.targetMinutes);
    const now = Date.now();
    return ctx.db.insert("objectives", {
      installationId: args.installationId,
      name,
      targetMinutes,
      active: true,
      createdDayKey: args.createdDayKey,
      deactivatedDayKey: null,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const edit = mutation({
  args: {
    installationId: v.string(),
    id: v.id("objectives"),
    name: v.string(),
    targetMinutes: v.number(),
  },
  handler: async (ctx, { installationId, id, name, targetMinutes }) => {
    assertInstallationId(installationId);
    const objective = await ctx.db.get(id);
    if (!objective || objective.installationId !== installationId) {
      throw notFound();
    }
    await ctx.db.patch(id, {
      name: cleanName(name),
      targetMinutes: cleanMinutes(targetMinutes),
      updatedAt: Date.now(),
    });
  },
});

/** Activate or deactivate (soft). Deactivating never destroys history. */
export const setActive = mutation({
  args: {
    installationId: v.string(),
    id: v.id("objectives"),
    active: v.boolean(),
    dayKey: v.string(),
  },
  handler: async (ctx, { installationId, id, active, dayKey }) => {
    assertInstallationId(installationId);
    assertDayKey(dayKey);
    const objective = await ctx.db.get(id);
    if (!objective || objective.installationId !== installationId) {
      throw notFound();
    }
    await ctx.db.patch(id, {
      active,
      deactivatedDayKey: active ? null : dayKey,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { installationId: v.string(), id: v.id("objectives") },
  handler: async (ctx, { installationId, id }) => {
    assertInstallationId(installationId);
    const objective = await ctx.db.get(id);
    if (!objective || objective.installationId !== installationId) {
      throw notFound();
    }
    // Records keep objectiveId: history survives; records become orphaned but
    // still render by their snapshot name. Deactivate first to be safe.
    if (objective.active) {
      await ctx.db.patch(id, {
        active: false,
        deactivatedDayKey: objective.deactivatedDayKey ?? objective.createdDayKey,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.delete(id);
  },
});
