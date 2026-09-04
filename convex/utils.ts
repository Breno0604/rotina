import { ConvexError } from "convex/values";
import { DAY_KEY_RE } from "../src/lib/dates";
import { MEMORY_CATEGORY_IDS } from "../src/types/domain";

export const INSTALLATION_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
export const NAME_MAX = 60;
export const NOTE_MAX = 4000;
export const MEMORY_MAX = 600;

export type ConvexErrorData = { code: string; field?: string };

function invalid(code: string): ConvexError<ConvexErrorData> {
  return new ConvexError<ConvexErrorData>({ code: "invalid", field: code });
}

export function assertInstallationId(value: string): void {
  if (typeof value !== "string" || !INSTALLATION_ID_RE.test(value)) {
    throw invalid("installationId");
  }
}

export function assertDayKey(value: string): void {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) {
    throw invalid("dayKey");
  }
}

export function cleanName(value: unknown): string {
  if (typeof value !== "string") throw invalid("name");
  const name = value.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  if (name.length < 1) throw invalid("name");
  return name;
}

export function cleanFreeName(value: unknown): string {
  if (typeof value !== "string") throw invalid("activityName");
  const name = value.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  if (name.length < 1) throw invalid("activityName");
  return name;
}

export function cleanMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw invalid("minutes");
  }
  if (value < 1 || value > 1440) throw invalid("minutes");
  return value;
}

export function cleanText(value: unknown, max: number, code: string): string {
  if (typeof value !== "string") throw invalid(code);
  const text = value.trim().slice(0, max);
  if (text.length < 1) throw invalid(code);
  return text;
}

export function cleanOptionalText(
  value: unknown,
  max: number,
  code: string,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw invalid(code);
  const text = value.trim().slice(0, max);
  return text.length === 0 ? null : text;
}

export function assertMemoryCategory(value: unknown): void {
  if (typeof value !== "string" || !(MEMORY_CATEGORY_IDS as readonly string[]).includes(value)) {
    throw invalid("category");
  }
}

export function assertConfidence(value: unknown): void {
  if (typeof value !== "string" || !["baixa", "media", "alta"].includes(value)) {
    throw invalid("confidence");
  }
}

export function assertMemoryState(value: unknown): void {
  if (
    typeof value !== "string" ||
    !["ativa", "possivelmente_desatualizada", "arquivada"].includes(value)
  ) {
    throw invalid("state");
  }
}

export function notFound(): ConvexError<ConvexErrorData> {
  return new ConvexError<ConvexErrorData>({ code: "not_found" });
}
