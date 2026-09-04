import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertConfidence,
  assertInstallationId,
  assertMemoryCategory,
  assertMemoryState,
  cleanText,
  MEMORY_MAX,
  notFound,
} from "./utils";
import {
  decideMemoryStatus,
  downConfidence,
  isSimilarMemory,
  upConfidence,
  type MemoryStatusAction,
} from "./memoryLogic";
import { toDayKey } from "../src/lib/dates";
import { addDays } from "../src/lib/dates";

export const list = query({
  args: { installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    assertInstallationId(installationId);
    return ctx.db
      .query("memories")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();
  },
});

/** User declares a memory themselves (or edits). */
export const createDeclared = mutation({
  args: {
    installationId: v.string(),
    content: v.string(),
    category: v.string(),
  },
  handler: async (ctx, { installationId, content, category }) => {
    assertInstallationId(installationId);
    assertMemoryCategory(category);
    const now = Date.now();
    return ctx.db.insert("memories", {
      installationId,
      content: cleanText(content, MEMORY_MAX, "content"),
      category: category as never,
      source: "declared",
      confidence: "media",
      state: "ativa",
      pinned: false,
      evidenceCount: 0,
      lastConfirmedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Save an AI-proposed (observed) memory. If an existing memory of the same
 * category is similar enough (same idea, possibly rephrased), we treat it as
 * NEW EVIDENCE instead of creating a duplicate: the memory is re-activated,
 * confidence rises and evidenceCount grows.
 */
export const saveObserved = mutation({
  args: {
    installationId: v.string(),
    content: v.string(),
    category: v.string(),
  },
  handler: async (ctx, { installationId, content, category }) => {
    assertInstallationId(installationId);
    assertMemoryCategory(category);
    const clean = cleanText(content, MEMORY_MAX, "content");
    const now = Date.now();

    const all = await ctx.db
      .query("memories")
      .withIndex("by_installation", (q) => q.eq("installationId", installationId))
      .collect();

    const match = all.find(
      (m) => m.category === category && isSimilarMemory(clean, m.content),
    );

    if (match) {
      await ctx.db.patch(match._id, {
        state: "ativa",
        confidence: upConfidence(match.confidence),
        evidenceCount: match.evidenceCount + 1,
        lastConfirmedAt: now,
        updatedAt: now,
      });
      return match._id;
    }

    return ctx.db.insert("memories", {
      installationId,
      content: clean,
      category: category as never,
      source: "observed",
      confidence: "baixa",
      state: "ativa",
      pinned: false,
      evidenceCount: 1,
      lastConfirmedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** User edits content/category/pinned/state/confidence of their memory. */
export const update = mutation({
  args: {
    installationId: v.string(),
    id: v.id("memories"),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    state: v.optional(v.string()),
    confidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInstallationId(args.installationId);
    const memory = await ctx.db.get(args.id);
    if (!memory || memory.installationId !== args.installationId) {
      throw notFound();
    }
    const patch: {
      content?: string;
      category?: string;
      pinned?: boolean;
      state?: string;
      confidence?: string;
      updatedAt?: number;
    } = { updatedAt: Date.now() };
    if (args.content !== undefined) {
      patch.content = cleanText(args.content, MEMORY_MAX, "content");
    }
    if (args.category !== undefined) {
      assertMemoryCategory(args.category);
      patch.category = args.category;
    }
    if (args.pinned !== undefined) patch.pinned = args.pinned;
    if (args.state !== undefined) {
      assertMemoryState(args.state);
      patch.state = args.state;
    }
    if (args.confidence !== undefined) {
      assertConfidence(args.confidence);
      patch.confidence = args.confidence;
    }
    await ctx.db.patch(args.id, patch as never);
  },
});

export const remove = mutation({
  args: { installationId: v.string(), id: v.id("memories") },
  handler: async (ctx, { installationId, id }) => {
    assertInstallationId(installationId);
    const memory = await ctx.db.get(id);
    if (!memory || memory.installationId !== installationId) {
      throw notFound();
    }
    await ctx.db.delete(id);
  },
});

/* ------------------------------------------------------------------ */
/* Periodic maintenance (cron)                                          */
/* ------------------------------------------------------------------ */

const STALE_WINDOW_DAYS = 45;

/**
 * Weekly maintenance: age observed memories that are no longer grounded in
 * recent data (see memoryLogic.decideMemoryStatus). Pinned memories are
 * never touched — the user explicitly flagged them as important.
 *
 * A memory is "grounded" when any activity name mentioned in it appears in
 * records from the last STALE_WINDOW_DAYS days. Records carry the objective
 * name (or free name) at record time, so this works even for renamed goals.
 */
export const runStalenessCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const memories = await ctx.db.query("memories").collect();

    // Only observed, active, unpinned memories are candidates.
    const byInstallation = new Map<string, typeof memories>();
    for (const m of memories) {
      if (m.source !== "observed" || m.state !== "ativa" || m.pinned) continue;
      const list = byInstallation.get(m.installationId) ?? [];
      list.push(m);
      byInstallation.set(m.installationId, list);
    }
    if (byInstallation.size === 0) return;

    // Day-key window (UTC — a few hours of drift vs. user-local days is fine
    // for a month-scale staleness check).
    const utcToday = toDayKey(new Date());
    const from = addDays(utcToday, -STALE_WINDOW_DAYS);

    for (const [installationId, list] of byInstallation) {
      const recent = await ctx.db
        .query("records")
        .withIndex("by_installation_day", (q) =>
          q.eq("installationId", installationId).gte("dayKey", from),
        )
        .collect();

      const recentNames = new Set(
        recent.map((r) => r.activityName.toLowerCase()),
      );

      for (const m of list) {
        const norm = m.content.toLowerCase();
        const hasRecentData = [...recentNames].some(
          (name) =>
            (name.length >= 3 && norm.includes(name)) ||
            (norm.length >= 3 && name.includes(norm)),
        );

        const action: MemoryStatusAction = decideMemoryStatus({
          lastConfirmedMs: m.lastConfirmedAt ?? 0,
          createdAtMs: m.createdAt,
          evidenceCount: m.evidenceCount,
          hasRecentData,
          nowMs: now,
        });

        if (action === "refresh") {
          await ctx.db.patch(m._id, { lastConfirmedAt: now });
        } else if (action === "downgrade") {
          await ctx.db.patch(m._id, {
            confidence: downConfidence(m.confidence),
            updatedAt: now,
          });
        } else if (action === "stale") {
          await ctx.db.patch(m._id, {
            state: "possivelmente_desatualizada",
            confidence: downConfidence(m.confidence),
            updatedAt: now,
          });
        }
      }
    }
  },
});

/** User confirms a possibly-outdated memory is still true (sets it active again). */
export const confirmStillValid = mutation({
  args: { installationId: v.string(), id: v.id("memories") },
  handler: async (ctx, { installationId, id }) => {
    assertInstallationId(installationId);
    const memory = await ctx.db.get(id);
    if (!memory || memory.installationId !== installationId) {
      throw notFound();
    }
    const now = Date.now();
    await ctx.db.patch(id, {
      state: "ativa",
      confidence: upConfidence(memory.confidence),
      evidenceCount: memory.evidenceCount + 1,
      lastConfirmedAt: now,
      updatedAt: now,
    });
  },
});
