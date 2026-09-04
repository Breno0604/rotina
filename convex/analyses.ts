import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  assertDayKey,
  assertInstallationId,
  cleanText,
  notFound,
} from "./utils";

const KINDS = ["day", "week", "month", "custom"] as const;

export const create = mutation({
  args: {
    installationId: v.string(),
    kind: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    periodLabel: v.string(),
    resumo: v.string(),
    contentJson: v.string(),
    infoUsed: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    assertInstallationId(args.installationId);
    if (!(KINDS as readonly string[]).includes(args.kind)) {
      throw new ConvexError({ code: "invalid", field: "kind" });
    }
    assertDayKey(args.periodStart);
    assertDayKey(args.periodEnd);
    const now = Date.now();
    return ctx.db.insert("analyses", {
      installationId: args.installationId,
      kind: args.kind as never,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      periodLabel: cleanText(args.periodLabel, 120, "periodLabel"),
      resumo: cleanText(args.resumo, 600, "resumo"),
      contentJson: args.contentJson.slice(0, 40000),
      infoUsed: cleanText(args.infoUsed, 2000, "infoUsed"),
      model: cleanText(args.model, 100, "model"),
      createdAt: now,
    });
  },
});

export const list = query({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    return ctx.db
      .query("analyses")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
  },
});

export const remove = mutation({
  args: { installationId: v.string(), id: v.id("analyses") },
  handler: async (ctx, { installationId, id }) => {
    assertInstallationId(installationId);
    const analysis = await ctx.db.get(id);
    if (!analysis || analysis.installationId !== installationId) {
      throw notFound();
    }
    await ctx.db.delete(id);
  },
});
