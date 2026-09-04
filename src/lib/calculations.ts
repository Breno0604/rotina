/* ==========================================================================
   Calculations — pure functions. NO React, NO Convex imports.
   Everything the UI/AI needs is derived here and unit-tested.
   ========================================================================== */

import { eachDay } from "./dates";
import { percentOf } from "./format";

/* Structural types: Convex Doc types satisfy these because extra fields are
   allowed; tests pass plain objects. */

export interface ObjectiveLike {
  _id: string;
  name: string;
  targetMinutes: number;
  active: boolean;
  createdDayKey: string;
  deactivatedDayKey: string | null;
}

export interface RecordLike {
  _id: string;
  dayKey: string;
  objectiveId: string | null;
  activityName: string;
  targetMinutes: number | null;
  minutes: number;
  observation?: string | null;
}

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export function sumMinutes(records: RecordLike[]): number {
  return records.reduce((acc, r) => acc + r.minutes, 0);
}

/** An objective is in effect on a day when created before/on it and not
    deactivated on or before it. */
export function isObjectiveActiveOnDay(
  objective: Pick<ObjectiveLike, "createdDayKey" | "deactivatedDayKey">,
  dayKey: string,
): boolean {
  return (
    objective.createdDayKey <= dayKey &&
    (objective.deactivatedDayKey === null ||
      objective.deactivatedDayKey === undefined ||
      dayKey < objective.deactivatedDayKey)
  );
}

export function activeObjectivesOnDay(
  objectives: ObjectiveLike[],
  dayKey: string,
): ObjectiveLike[] {
  return objectives.filter((o) => isObjectiveActiveOnDay(o, dayKey));
}

/* ------------------------------------------------------------------ */
/* Consolidation                                                       */
/* ------------------------------------------------------------------ */

export interface ActivityTotal {
  key: string; // objectiveId or "free:<activityName>"
  objectiveId: string | null;
  activityName: string;
  minutes: number;
  count: number;
  targetMinutes: number | null;
}

/** Merge (possibly multiple) records into per-activity totals. Records of the
    same objective merge; off-goal records merge by activity name. */
export function consolidate(records: RecordLike[]): ActivityTotal[] {
  const map = new Map<string, ActivityTotal>();
  for (const r of records) {
    const key = r.objectiveId ?? `free:${r.activityName.toLowerCase()}`;
    const prev = map.get(key);
    if (prev) {
      prev.minutes += r.minutes;
      prev.count += 1;
    } else {
      map.set(key, {
        key,
        objectiveId: r.objectiveId,
        activityName: r.activityName,
        minutes: r.minutes,
        count: 1,
        targetMinutes: r.targetMinutes ?? null,
      });
    }
  }
  return [...map.values()];
}

/* ------------------------------------------------------------------ */
/* Day comparison: objective × realized                                */
/* ------------------------------------------------------------------ */

export interface GoalDayRow {
  objectiveId: string;
  name: string;
  targetMinutes: number;
  actualMinutes: number;
  /** integer percent, null when target is 0 */
  pct: number | null;
  recordCount: number;
}

/**
 * Row for every objective active on `dayKey`, plus objectives referenced by
 * that day's records but not active (backdated notes) using the snapshot
 * target. A row exists even with no record (shows 0% honestly).
 */
export function goalProgressForDay(
  objectives: ObjectiveLike[],
  dayRecords: RecordLike[],
  dayKey: string,
): GoalDayRow[] {
  const actualById = new Map(
    consolidate(dayRecords)
      .filter((a) => a.objectiveId !== null)
      .map((a) => [a.objectiveId as string, a]),
  );

  const rows: GoalDayRow[] = [];
  const seen = new Set<string>();

  for (const o of activeObjectivesOnDay(objectives, dayKey)) {
    const a = actualById.get(o._id);
    rows.push({
      objectiveId: o._id,
      name: o.name,
      targetMinutes: o.targetMinutes,
      actualMinutes: a?.minutes ?? 0,
      pct: percentOf(a?.minutes ?? 0, o.targetMinutes),
      recordCount: a?.count ?? 0,
    });
    seen.add(o._id);
  }

  for (const [id, a] of actualById) {
    if (seen.has(id)) continue;
    const o = objectives.find((x) => x._id === id);
    const target = a.targetMinutes ?? o?.targetMinutes ?? 0;
    rows.push({
      objectiveId: id,
      name: o?.name ?? a.activityName,
      targetMinutes: target,
      actualMinutes: a.minutes,
      pct: percentOf(a.minutes, target),
      recordCount: a.count,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Period statistics                                                   */
/* ------------------------------------------------------------------ */

export interface ObjectivePeriodStat {
  objectiveId: string;
  name: string;
  targetMinutes: number;
  actualMinutes: number;
  pct: number | null;
  activeDays: number;
  daysWithRecord: number;
  /** % of active days where actual >= target (0..100), null if no active days */
  consistency: number | null;
}

export interface OffGoalPeriodStat {
  key: string;
  activityName: string;
  minutes: number;
  count: number;
}

export interface DaySeriesPoint {
  day: string;
  actualMinutes: number;
  targetMinutes: number;
  pct: number | null;
}

export interface PeriodStats {
  from: string;
  to: string;
  dayCount: number;
  daysWithAnyRecord: number;
  targetMinutes: number;
  actualMinutes: number;
  pct: number | null;
  perObjective: ObjectivePeriodStat[];
  offGoal: OffGoalPeriodStat[];
  series: DaySeriesPoint[];
  totalRecords: number;
}

export function computePeriodStats(
  objectives: ObjectiveLike[],
  records: RecordLike[],
  from: string,
  to: string,
): PeriodStats {
  const days = eachDay(from, to);
  const daySet = new Set(days);

  // Per-day: which objectives are active and their targets.
  interface DayInfo {
    active: { id: string; target: number }[];
    targetSum: number;
  }
  const dayInfo = new Map<string, DayInfo>();
  for (const day of days) {
    const active = activeObjectivesOnDay(objectives, day).map((o) => ({
      id: o._id,
      target: o.targetMinutes,
    }));
    dayInfo.set(day, {
      active,
      targetSum: active.reduce((a, o) => a + o.target, 0),
    });
  }

  // Accumulate targets per objective across active days.
  const statById = new Map<string, ObjectivePeriodStat>();
  for (const info of dayInfo.values()) {
    for (const o of info.active) {
      const s = statById.get(o.id);
      if (s) {
        s.activeDays += 1;
        s.targetMinutes += o.target;
      } else {
        statById.set(o.id, {
          objectiveId: o.id,
          name: "",
          targetMinutes: o.target,
          actualMinutes: 0,
          pct: null,
          activeDays: 1,
          daysWithRecord: 0,
          consistency: null,
        });
      }
    }
  }
  // Fill names from the objective list.
  const byId = new Map(objectives.map((o) => [o._id, o]));
  for (const s of statById.values()) {
    s.name = byId.get(s.objectiveId)?.name ?? "Objetivo";
  }

  const series: DaySeriesPoint[] = days.map((day) => ({
    day,
    actualMinutes: 0,
    targetMinutes: dayInfo.get(day)!.targetSum,
    pct: null,
  }));
  const seriesByDay = new Map(series.map((s) => [s.day, s]));

  const offMap = new Map<string, OffGoalPeriodStat>();
  const recordDays = new Set<string>();
  const dayActualById = new Map<string, Map<string, number>>(); // day -> objectiveId -> minutes

  let totalRecords = 0;
  for (const r of records) {
    if (!daySet.has(r.dayKey)) continue;
    totalRecords += 1;
    recordDays.add(r.dayKey);

    if (r.objectiveId) {
      seriesByDay.get(r.dayKey)!.actualMinutes += r.minutes;
      const s = statById.get(r.objectiveId);
      if (!s) {
        // Objective never active inside the period but referenced (rare).
        statById.set(r.objectiveId, {
          objectiveId: r.objectiveId,
          name: byId.get(r.objectiveId)?.name ?? r.activityName,
          targetMinutes: 0,
          actualMinutes: 0,
          pct: null,
          activeDays: 0,
          daysWithRecord: 0,
          consistency: null,
        });
      }
      const stat = statById.get(r.objectiveId)!;
      stat.actualMinutes += r.minutes;
      let perDay = dayActualById.get(r.dayKey);
      if (!perDay) {
        perDay = new Map();
        dayActualById.set(r.dayKey, perDay);
      }
      perDay.set(r.objectiveId, (perDay.get(r.objectiveId) ?? 0) + r.minutes);
    } else {
      const key = `free:${r.activityName.toLowerCase()}`;
      const prev = offMap.get(key);
      if (prev) {
        prev.minutes += r.minutes;
        prev.count += 1;
      } else {
        offMap.set(key, {
          key,
          activityName: r.activityName,
          minutes: r.minutes,
          count: 1,
        });
      }
    }
  }

  // daysWithRecord + consistency (per objective, over its active days).
  for (const [day, info] of dayInfo) {
    const actualById = dayActualById.get(day);
    for (const o of info.active) {
      const s = statById.get(o.id);
      if (!s) continue;
      const actual = actualById?.get(o.id) ?? 0;
      if (actual > 0) s.daysWithRecord += 1;
      if (actual >= o.target) {
        s.consistency = ((s.consistency ?? 0) + 100) / s.activeDays;
      }
    }
  }
  for (const s of statById.values()) {
    s.consistency =
      s.activeDays > 0 ? Math.round(s.consistency ?? 0) : null;
    s.pct = percentOf(s.actualMinutes, s.targetMinutes);
  }

  const perObjective = [...statById.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  const offGoal = [...offMap.values()].sort((a, b) => b.minutes - a.minutes);

  let actualTotal = 0;
  let targetTotal = 0;
  for (const s of perObjective) {
    actualTotal += s.actualMinutes;
    targetTotal += s.targetMinutes;
  }

  for (const s of series) {
    s.pct = percentOf(s.actualMinutes, s.targetMinutes);
  }

  return {
    from,
    to,
    dayCount: days.length,
    daysWithAnyRecord: recordDays.size,
    targetMinutes: targetTotal,
    actualMinutes: actualTotal,
    pct: percentOf(actualTotal, targetTotal),
    perObjective,
    offGoal,
    series,
    totalRecords,
  };
}

/* ------------------------------------------------------------------ */
/* Period comparison                                                   */
/* ------------------------------------------------------------------ */

export interface PeriodDiff {
  objectiveId: string;
  name: string;
  prevPct: number | null;
  currPct: number | null;
  diffPoints: number | null;
}

/** Compare per-objective percentages: current period minus previous one. */
export function comparePeriods(
  prev: PeriodStats,
  curr: PeriodStats,
): PeriodDiff[] {
  const byId = new Map(prev.perObjective.map((s) => [s.objectiveId, s]));
  return curr.perObjective.map((s) => {
    const p = byId.get(s.objectiveId) ?? null;
    const prevPct = p?.pct ?? null;
    return {
      objectiveId: s.objectiveId,
      name: s.name,
      prevPct,
      currPct: s.pct,
      diffPoints: prevPct !== null && s.pct !== null ? s.pct - prevPct : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Rankings                                                            */
/* ------------------------------------------------------------------ */

export interface ConsistencyRow {
  objectiveId: string;
  name: string;
  consistency: number | null;
  pct: number | null;
  daysWithRecord: number;
  activeDays: number;
}

export function consistencyRanking(stats: PeriodStats): ConsistencyRow[] {
  return stats.perObjective
    .map((s) => ({
      objectiveId: s.objectiveId,
      name: s.name,
      consistency: s.consistency,
      pct: s.pct,
      daysWithRecord: s.daysWithRecord,
      activeDays: s.activeDays,
    }))
    .sort((a, b) => (b.consistency ?? -1) - (a.consistency ?? -1));
}

/* ------------------------------------------------------------------ */
/* Data summary for the AI (interpretation only — never raw math)      */
/* ------------------------------------------------------------------ */

export function buildDataSummary(stats: PeriodStats): Record<string, unknown> {
  return {
    periodo: { de: stats.from, ate: stats.to },
    diasNoPeriodo: stats.dayCount,
    diasComRegistros: stats.daysWithAnyRecord,
    totalRegistros: stats.totalRecords,
    tempoObjetivoTotalMin: stats.targetMinutes,
    tempoRealizadoTotalMin: stats.actualMinutes,
    percentualGeral: stats.pct,
    porObjetivo: stats.perObjective.map((o) => ({
      objetivo: o.name,
      tempoObjetivoMin: o.targetMinutes,
      tempoRealizadoMin: o.actualMinutes,
      percentual: o.pct,
      diasAtivos: o.activeDays,
      diasComRegistro: o.daysWithRecord,
      consistencia: o.consistency,
    })),
    foraDosObjetivos: stats.offGoal.map((o) => ({
      atividade: o.activityName,
      minutos: o.minutes,
      registros: o.count,
    })),
    serieDiaria: stats.series.map((s) => ({
      dia: s.day,
      realizadoMin: s.actualMinutes,
      percentual: s.pct,
    })),
  };
}
