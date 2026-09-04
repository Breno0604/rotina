import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  assertDayKey,
  assertInstallationId,
  cleanFreeName,
  cleanMinutes,
  cleanName,
  cleanText,
  cleanOptionalText,
  MEMORY_MAX,
} from "./utils";

const CATEGORIES = [
  "produtividade",
  "rotina",
  "objetivos",
  "estrategias",
  "dificuldades",
  "motivacao",
  "preferencias",
  "outros",
] as const;
const KINDS = ["day", "week", "month", "custom"] as const;
const CONFIDENCES = ["baixa", "media", "alta"] as const;
const SOURCES = ["declared", "observed"] as const;
const STATES = ["ativa", "possivelmente_desatualizada", "arquivada"] as const;

function safeCategory(v: string): string {
  return (CATEGORIES as readonly string[]).includes(v) ? v : "outros";
}

function safeKind(v: string): string {
  return (KINDS as readonly string[]).includes(v) ? v : "custom";
}

function safeConfidence(v: string): string {
  return (CONFIDENCES as readonly string[]).includes(v) ? v : "media";
}

function safeSource(v: string): string {
  return (SOURCES as readonly string[]).includes(v) ? v : "declared";
}

function safeState(v: string): string {
  return (STATES as readonly string[]).includes(v) ? v : "ativa";
}

function safeDay(v: string): string {
  try {
    assertDayKey(v);
    return v;
  } catch {
    return "1970-01-01";
  }
}

/** Deletes every row belonging to the installation (used by "apagar tudo"). */
export const clearAllData = mutation({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    // No bulk-delete API in this Convex version: collect (indexed by
    // installation) then delete each row. Fine at personal-data scale.
    const wipeObj = await ctx.db
      .query("objectives")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
    for (const r of wipeObj) await ctx.db.delete(r._id);
    const wipeRec = await ctx.db
      .query("records")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
    for (const r of wipeRec) await ctx.db.delete(r._id);
    const wipeNotes = await ctx.db
      .query("dailyNotes")
      .withIndex("by_installation_day", (q) => q.eq("installationId", installationId))
      .collect();
    for (const r of wipeNotes) await ctx.db.delete(r._id);
    const wipeMem = await ctx.db
      .query("memories")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
    for (const r of wipeMem) await ctx.db.delete(r._id);
    const wipeAna = await ctx.db
      .query("analyses")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
    for (const r of wipeAna) await ctx.db.delete(r._id);
    const wipeInst = await ctx.db
      .query("installations")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
    for (const r of wipeInst) await ctx.db.delete(r._id);
  },
});

const objectiveArg = v.object({
  exportId: v.string(),
  name: v.string(),
  targetMinutes: v.number(),
  active: v.boolean(),
  createdDayKey: v.string(),
  deactivatedDayKey: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const recordArg = v.object({
  exportId: v.string(),
  dayKey: v.string(),
  objectiveId: v.union(v.string(), v.null()),
  activityName: v.string(),
  targetMinutes: v.union(v.number(), v.null()),
  minutes: v.number(),
  observation: v.union(v.string(), v.null()),
  createdAt: v.number(),
});

/**
 * Restores an exported backup into the CURRENT installation (records that
 * reference objectives are remapped onto the newly inserted objectives).
 */
export const importData = mutation({
  args: {
    installationId: v.string(),
    objectives: v.array(objectiveArg),
    records: v.array(recordArg),
    dailyNotes: v.array(
      v.object({ dayKey: v.string(), note: v.string(), updatedAt: v.number() }),
    ),
    memories: v.array(
      v.object({
        content: v.string(),
        category: v.string(),
        source: v.string(),
        confidence: v.string(),
        state: v.string(),
        pinned: v.boolean(),
        evidenceCount: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
    analyses: v.array(
      v.object({
        kind: v.string(),
        periodStart: v.string(),
        periodEnd: v.string(),
        periodLabel: v.string(),
        resumo: v.string(),
        contentJson: v.string(),
        infoUsed: v.string(),
        model: v.string(),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertInstallationId(args.installationId);
    if (args.objectives.length > 2000 || args.records.length > 20000) {
      throw new ConvexError({ code: "invalid", field: "volume" });
    }
    const now = Date.now();

    const idMap = new Map<string, Id<"objectives">>();
    for (const o of args.objectives) {
      const id = await ctx.db.insert("objectives", {
        installationId: args.installationId,
        name: cleanName(o.name),
        targetMinutes: cleanMinutes(o.targetMinutes),
        active: Boolean(o.active),
        createdDayKey: safeDay(o.createdDayKey),
        deactivatedDayKey:
          typeof o.deactivatedDayKey === "string" ? safeDay(o.deactivatedDayKey) : null,
        createdAt: Number.isFinite(o.createdAt) ? o.createdAt : now,
        updatedAt: Number.isFinite(o.updatedAt) ? o.updatedAt : now,
      });
      idMap.set(o.exportId, id);
    }

    for (const r of args.records) {
      const minutes = cleanMinutes(r.minutes);
      const objectiveId = r.objectiveId ? (idMap.get(r.objectiveId) ?? null) : null;
      await ctx.db.insert("records", {
        installationId: args.installationId,
        dayKey: safeDay(r.dayKey),
        objectiveId: objectiveId as never,
        activityName:
          objectiveId === null
            ? cleanFreeName(r.activityName)
            : cleanName(r.activityName || "Atividade"),
        targetMinutes:
          typeof r.targetMinutes === "number" && Number.isFinite(r.targetMinutes)
            ? Math.min(1440, Math.max(1, Math.round(r.targetMinutes)))
            : null,
        minutes,
        observation: cleanOptionalText(r.observation, 600, "observation"),
        createdAt: Number.isFinite(r.createdAt) ? r.createdAt : now,
      });
    }

    for (const n of args.dailyNotes) {
      const dayKey = safeDay(n.dayKey);
      const note = cleanText(n.note, 4000, "note");
      const existing = await ctx.db
        .query("dailyNotes")
        .withIndex("by_installation_day", (q) =>
          q.eq("installationId", args.installationId).eq("dayKey", dayKey),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { note, updatedAt: now });
      } else {
        await ctx.db.insert("dailyNotes", {
          installationId: args.installationId,
          dayKey,
          note,
          updatedAt: now,
        });
      }
    }

    for (const m of args.memories) {
      await ctx.db.insert("memories", {
        installationId: args.installationId,
        content: cleanText(m.content, MEMORY_MAX, "content"),
        category: safeCategory(m.category) as never,
        source: safeSource(m.source) as never,
        confidence: safeConfidence(m.confidence) as never,
        state: safeState(m.state) as never,
        pinned: Boolean(m.pinned),
        evidenceCount: Number.isFinite(m.evidenceCount) ? Math.max(0, m.evidenceCount) : 0,
        createdAt: Number.isFinite(m.createdAt) ? m.createdAt : now,
        updatedAt: Number.isFinite(m.updatedAt) ? m.updatedAt : now,
      });
    }

    for (const a of args.analyses) {
      await ctx.db.insert("analyses", {
        installationId: args.installationId,
        kind: safeKind(a.kind) as never,
        periodStart: safeDay(a.periodStart),
        periodEnd: safeDay(a.periodEnd),
        periodLabel: cleanText(a.periodLabel, 120, "periodLabel"),
        resumo: cleanText(a.resumo, 600, "resumo"),
        contentJson: a.contentJson.slice(0, 40000),
        infoUsed: cleanText(a.infoUsed, 2000, "infoUsed"),
        model: cleanText(a.model, 100, "model"),
        createdAt: Number.isFinite(a.createdAt) ? a.createdAt : now,
      });
    }
  },
});
