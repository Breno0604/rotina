/* Duration parsing and formatting (minutes based). */

const MIN_MINUTES = 1;
export const MAX_MINUTES = 1440; // 24h per day

/** Parse user input like "45", "90", "1h30", "1:30", "1h". Null when invalid. */
export function parseDurationInput(raw: string): number | null {
  const input = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!input) return null;

  let minutes: number | null = null;

  const hms = input.match(/^(\d{1,2})h(?:(\d{1,2})m?)?$/);
  if (hms) {
    const h = Number(hms[1]);
    const m = hms[2] ? Number(hms[2]) : 0;
    if (hms[2] !== undefined && m >= 60) return null;
    minutes = h * 60 + m;
  }

  const minutesSuffix = input.match(/^(\d{1,3})m$/);
  if (minutesSuffix) minutes = Number(minutesSuffix[1]);

  const colon = input.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (m >= 60) return null;
    minutes = h * 60 + m;
  }

  const plain = input.match(/^(\d{1,3})$/);
  if (plain) minutes = Number(plain[1]);

  if (minutes === null || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return null;
  }
  return minutes;
}

export function isValidDuration(raw: string): boolean {
  return parseDurationInput(raw) !== null;
}

/** "45 min" / "1h10" — friendly label. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Compact "45m" / "1h10". */
export function formatMinutesCompact(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

/** Minutes formatted for input fields, e.g. "1h10" or "45". */
export function formatMinutesInput(minutes: number): string {
  if (minutes < 60) return String(minutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

/** "1 hora" / "2 horas" / "45 minutos" — for sentences. */
export function formatMinutesLong(minutes: number): string {
  if (minutes < 60) {
    return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hPart = h === 1 ? "1 hora" : `${h} horas`;
  if (m === 0) return hPart;
  return m === 1 ? `${hPart} e 1 minuto` : `${hPart} e ${m} minutos`;
}

/** Round percent to whole number. */
export function percentOf(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) {
    return null;
  }
  return Math.round((actual / target) * 100);
}
