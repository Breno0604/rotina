/* ==========================================================================
   Memory evolution logic — PURE module (no Convex imports).

   Two ideas, both deterministic and explainable:
   1. Similarity merging: an AI-proposed memory that is "close enough" to an
      existing memory of the same category counts as new evidence instead of
      creating a duplicate.
   2. Staleness: observed memories that stop being grounded in recent data
      age over time (confidence down) and eventually become
      "possivelmente_desatualizada". User-pinned memories are never auto-aged.
   ========================================================================== */

/** Normalize for comparison: lowercase, strip accents+punctuation, collapse spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token similarity (0..1): average of Jaccard and containment.
 * Pure Jaccard unfairly punishes rephrasings that add filler words
 * ("pela manhã" vs "no período da manhã" share the idea but score 0.5);
 * blending with containment (|inter| / min(|A|,|B|)) keeps those matches
 * while still rejecting genuinely different ideas (0 overlap = 0).
 */
export function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(" ").filter(Boolean));
  const setB = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const jaccard = inter / (setA.size + setB.size - inter);
  const containment = inter / Math.min(setA.size, setB.size);
  return (jaccard + containment) / 2;
}

export const SIMILARITY_THRESHOLD = 0.6;

/** True when two memory texts express the same idea closely enough to merge. */
export function isSimilarMemory(candidate: string, existing: string): boolean {
  const a = normalizeText(candidate);
  const b = normalizeText(existing);
  if (a === b) return true;
  // Fragments with fewer than 3 tokens ("pela manhã") never establish
  // "same idea" on their own — otherwise any short phrase sharing a common
  // token would merge into an unrelated memory.
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);
  if (tokensA.length < 3 || tokensB.length < 3) return false;
  return tokenSimilarity(candidate, existing) >= SIMILARITY_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/* Staleness                                                           */
/* ------------------------------------------------------------------ */

export type MemoryStatusAction = "none" | "refresh" | "downgrade" | "stale";

export interface MemoryStatusInput {
  /** last time the memory was confirmed (ms); 0 = never explicitly confirmed */
  lastConfirmedMs: number;
  /** when the memory was created (ms) */
  createdAtMs: number;
  /** how many times it was confirmed so far */
  evidenceCount: number;
  /** whether any activity referenced by the memory appears in recent records */
  hasRecentData: boolean;
  nowMs: number;
}

const DAY_MS = 86_400_000;

/**
 * Observed memories keep their confidence only while they stay grounded in
 * the user's recent data (or were confirmed recently). Otherwise they age:
 * first the confidence drops one step, then the memory becomes
 * "possivelmente_desatualizada". Memories confirmed more times age slower.
 */
export function decideMemoryStatus(input: MemoryStatusInput): MemoryStatusAction {
  const { lastConfirmedMs, createdAtMs, evidenceCount, hasRecentData, nowMs } = input;

  // Still grounded in recent data: nothing to do (keeps it alive).
  if (hasRecentData) return "refresh";

  const baseline = lastConfirmedMs > 0 ? lastConfirmedMs : createdAtMs;
  const ageMs = nowMs - baseline;

  const staleAfterMs = (evidenceCount >= 2 ? 90 : 45) * DAY_MS;
  const downgradeAfterMs = 30 * DAY_MS;

  if (ageMs > staleAfterMs) return "stale";
  if (ageMs > downgradeAfterMs) return "downgrade";
  return "none";
}

export function downConfidence(c: "baixa" | "media" | "alta"): "baixa" | "media" | "alta" {
  if (c === "alta") return "media";
  if (c === "media") return "baixa";
  return "baixa";
}

export function upConfidence(c: "baixa" | "media" | "alta"): "baixa" | "media" | "alta" {
  if (c === "baixa") return "media";
  if (c === "media") return "alta";
  return "alta";
}