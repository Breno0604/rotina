/* Date helpers — everything is computed in the user's LOCAL timezone.
   A "dayKey" is a local date string "YYYY-MM-DD"; comparing dayKeys as
   strings is safe because of the fixed zero-padded format. */

export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

/** Returns a Date at local midnight for the dayKey, or null if invalid. */
export function dayKeyToDate(dayKey: string): Date | null {
  if (!DAY_KEY_RE.test(dayKey)) return null;
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDayKey(value: string): boolean {
  return dayKeyToDate(value) !== null;
}

export function addDays(dayKey: string, delta: number): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}

/** Monday as the first day of the week. */
export function startOfWeek(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  const dow = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - dow);
  return toDayKey(date);
}

export function endOfWeek(dayKey: string): string {
  return addDays(startOfWeek(dayKey), 6);
}

export function startOfMonth(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`;
}

export function endOfMonth(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toDayKey(last);
}

/** All dayKeys from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 4000) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return days;
}

export function compareDayKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Formatting (pt-BR)                                                  */
/* ------------------------------------------------------------------ */

const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "seg, 1 set" style label (no year for current year). */
export function formatDayShort(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const withYear = date.getFullYear() !== new Date().getFullYear();
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${
    months[date.getMonth()]
  }${withYear ? ` ${date.getFullYear()}` : ""}`;
}

export function formatDayHeader(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  const long = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  const withYear = date.getFullYear() !== new Date().getFullYear();
  return withYear
    ? `${long} de ${date.getFullYear()}`
    : long.replace(/\bde\b/, "de");
}

/** "seg, 1 de setembro de 2026" */
export function formatDayLong(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "25 ago – 31 ago" */
export function formatRangeShort(from: string, to: string): string {
  const a = dayKeyToDate(from);
  const b = dayKeyToDate(to);
  if (!a || !b) return `${from} – ${to}`;
  const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const year = a.getFullYear() !== new Date().getFullYear();
  const fa = `${a.getDate()} ${months[a.getMonth()]}`;
  const fb = `${b.getDate()} ${months[b.getMonth()]}${year ? ` ${b.getFullYear()}` : ""}`;
  return sameMonth ? `${a.getDate()} – ${b.getDate()} ${months[b.getMonth()]}${year ? ` ${b.getFullYear()}` : ""}` : `${fa} – ${fb}`;
}

export function formatMonthLabel(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  if (!date) return dayKey;
  const year = date.getFullYear();
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  return `${month[0].toUpperCase()}${month.slice(1)}${year !== new Date().getFullYear() ? ` de ${year}` : ""}`;
}

export function isToday(dayKey: string): boolean {
  return dayKey === todayKey();
}

export function isYesterday(dayKey: string): boolean {
  return dayKey === addDays(todayKey(), -1);
}

/** Human relative label for history list: "Hoje", "Ontem" or short date. */
export function formatRelativeDay(dayKey: string): string {
  if (isToday(dayKey)) return "Hoje";
  if (isYesterday(dayKey)) return "Ontem";
  return formatDayShort(dayKey);
}
