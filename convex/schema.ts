import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const category = v.union(
  v.literal("produtividade"),
  v.literal("rotina"),
  v.literal("objetivos"),
  v.literal("estrategias"),
  v.literal("dificuldades"),
  v.literal("motivacao"),
  v.literal("preferencias"),
  v.literal("outros"),
);

export default defineSchema({
  /** One row per browser "installation" — separates data without login. */
  installations: defineTable({
    installationId: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_installation", ["installationId"]),

  /** Goals the user set (soft deactivation only — history is preserved). */
  objectives: defineTable({
    installationId: v.string(),
    name: v.string(),
    targetMinutes: v.number(),
    active: v.boolean(),
    createdDayKey: v.string(),
    deactivatedDayKey: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_installation", ["installationId"]),

  /** Manual daily entries: activity + minutes (+ optional note). */
  records: defineTable({
    installationId: v.string(),
    dayKey: v.string(),
    objectiveId: v.union(v.id("objectives"), v.null()),
    /** snapshot of the objective name at record time (or free text) */
    activityName: v.string(),
    /** snapshot of the objective target at record time */
    targetMinutes: v.union(v.number(), v.null()),
    minutes: v.number(),
    observation: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_installation", ["installationId"])
    .index("by_installation_day", ["installationId", "dayKey"]),

  /** Free observation about the day (§7). */
  dailyNotes: defineTable({
    installationId: v.string(),
    dayKey: v.string(),
    note: v.string(),
    updatedAt: v.number(),
  }).index("by_installation_day", ["installationId", "dayKey"]),

  /** Personal context / memory entries. */
  memories: defineTable({
    installationId: v.string(),
    content: v.string(),
    category: category,
    source: v.union(v.literal("declared"), v.literal("observed")),
    confidence: v.union(v.literal("baixa"), v.literal("media"), v.literal("alta")),
    state: v.union(
      v.literal("ativa"),
      v.literal("possivelmente_desatualizada"),
      v.literal("arquivada"),
    ),
    pinned: v.boolean(),
    evidenceCount: v.number(),
    /** last time the memory was confirmed (AI proposal or explicit user action) */
    lastConfirmedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_installation", ["installationId"]),

  /** Saved AI assessments (never auto-deleted). */
  analyses: defineTable({
    installationId: v.string(),
    kind: v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("custom"),
    ),
    periodStart: v.string(),
    periodEnd: v.string(),
    periodLabel: v.string(),
    resumo: v.string(),
    /** validated, JSON-serialized AiAssessmentPayload */
    contentJson: v.string(),
    infoUsed: v.string(),
    model: v.string(),
    createdAt: v.number(),
  }).index("by_installation", ["installationId"]),
});
