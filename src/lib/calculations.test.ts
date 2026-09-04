import { describe, expect, it } from "vitest";
import {
  consolidate,
  goalProgressForDay,
  isObjectiveActiveOnDay,
  computePeriodStats,
  comparePeriods,
  consistencyRanking,
  buildDataSummary,
  type ObjectiveLike,
  type RecordLike,
} from "./calculations";
import { addDays, eachDay, endOfMonth, startOfWeek, toDayKey } from "./dates";
import { formatMinutes, parseDurationInput, percentOf } from "./format";

let nextId = 0;
function objective(
  name: string,
  targetMinutes: number,
  opts: Partial<ObjectiveLike> = {},
): ObjectiveLike {
  nextId += 1;
  return {
    _id: `obj-${nextId}`,
    name,
    targetMinutes,
    active: true,
    createdDayKey: "2026-01-01",
    deactivatedDayKey: null,
    ...opts,
  };
}

function record(
  dayKey: string,
  minutes: number,
  objectiveId: string | null,
  name: string,
  targetMinutes: number | null = null,
): RecordLike {
  nextId += 1;
  return {
    _id: `rec-${nextId}`,
    dayKey,
    objectiveId,
    activityName: name,
    targetMinutes,
    minutes,
  };
}

describe("dates", () => {
  it("converts local dates to day keys", () => {
    expect(toDayKey(new Date(2026, 1, 15))).toBe("2026-02-15");
  });

  it("adds days across month/year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28"); // 2026 not a leap year
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("iterates inclusive ranges", () => {
    expect(eachDay("2026-01-30", "2026-02-01")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
    ]);
  });

  it("computes week start (Monday)", () => {
    // 2026-09-01 is a Tuesday, so the week starts 2026-08-31.
    expect(startOfWeek("2026-09-01")).toBe("2026-08-31");
  });

  it("computes month end", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2026-01-10")).toBe("2026-01-31");
  });
});

describe("format minutes", () => {
  it("parses durations", () => {
    expect(parseDurationInput("45")).toBe(45);
    expect(parseDurationInput(" 1h30 ")).toBe(90);
    expect(parseDurationInput("1:30")).toBe(90);
    expect(parseDurationInput("1h")).toBe(60);
    expect(parseDurationInput("30m")).toBe(30);
    expect(parseDurationInput("1h30m")).toBe(90);
  });

  it("rejects invalid durations", () => {
    expect(parseDurationInput("0")).toBeNull();
    expect(parseDurationInput("abc")).toBeNull();
    expect(parseDurationInput("1h75")).toBeNull();
    expect(parseDurationInput("2000")).toBeNull();
    expect(parseDurationInput("")).toBeNull();
  });

  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(70)).toBe("1h10");
  });

  it("computes integer percentages", () => {
    expect(percentOf(45, 60)).toBe(75);
    expect(percentOf(70, 60)).toBe(117);
    expect(percentOf(0, 60)).toBe(0);
    expect(percentOf(30, 0)).toBeNull();
  });
});

describe("consolidation", () => {
  it("merges multiple records of the same objective", () => {
    const objs = [objective("Inglês", 60)];
    const rows = goalProgressForDay(
      objs,
      [record("2026-09-02", 20, objs[0]._id, "Inglês"), record("2026-09-02", 25, objs[0]._id, "Inglês")],
      "2026-09-02",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actualMinutes).toBe(45);
    expect(rows[0].pct).toBe(75);
    expect(rows[0].recordCount).toBe(2);
  });

  it("groups off-goal records by activity (case-insensitive)", () => {
    const totals = consolidate([
      record("2026-09-02", 15, null, "Caminhada"),
      record("2026-09-02", 15, null, "caminhada"),
    ]);
    expect(totals).toHaveLength(1);
    expect(totals[0].minutes).toBe(30);
  });

  it("shows a zero row for an objective with no records", () => {
    const objs = [objective("Exercícios", 30)];
    const rows = goalProgressForDay(objs, [], "2026-09-02");
    expect(rows[0].actualMinutes).toBe(0);
    expect(rows[0].pct).toBe(0);
  });

  it("respects activation boundaries", () => {
    const o = objective("X", 30, { createdDayKey: "2026-09-02", deactivatedDayKey: "2026-09-05" });
    expect(isObjectiveActiveOnDay(o, "2026-09-01")).toBe(false);
    expect(isObjectiveActiveOnDay(o, "2026-09-02")).toBe(true);
    expect(isObjectiveActiveOnDay(o, "2026-09-04")).toBe(true);
    expect(isObjectiveActiveOnDay(o, "2026-09-05")).toBe(false);
  });

  it("keeps backdated records even when the objective was not active that day", () => {
    const objs = [objective("Inglês", 60, { createdDayKey: "2026-09-10" })];
    const rows = goalProgressForDay(
      objs,
      [record("2026-09-05", 45, objs[0]._id, "Inglês", 60)],
      "2026-09-05",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actualMinutes).toBe(45);
    expect(rows[0].targetMinutes).toBe(60);
  });
});

describe("period statistics", () => {
  const a = objective("Inglês", 60);
  const b = objective("Exercícios", 30);

  const records = [
    record("2026-09-01", 45, a._id, "Inglês", 60),
    record("2026-09-01", 30, b._id, "Exercícios", 30),
    record("2026-09-01", 20, null, "Caminhada"),
    record("2026-09-02", 60, a._id, "Inglês", 60),
  ];

  const stats = computePeriodStats([a, b], records, "2026-09-01", "2026-09-03");

  it("sums targets across active days per objective", () => {
    expect(stats.dayCount).toBe(3);
    expect(stats.targetMinutes).toBe(3 * 90);
  });

  it("computes overall percent and per-objective stats", () => {
    // Off-goal minutes do NOT count toward goal realization.
    expect(stats.actualMinutes).toBe(135); // 45+30+60
    expect(stats.pct).toBe(50); // 135/270
    const inglês = stats.perObjective.find((s) => s.name === "Inglês")!;
    expect(inglês.actualMinutes).toBe(105);
    expect(inglês.targetMinutes).toBe(180);
    expect(inglês.pct).toBe(58);
    expect(inglês.daysWithRecord).toBe(2);
    expect(inglês.consistency).toBe(33); // only day 2 reached the target
  });

  it("separates off-goal activities", () => {
    expect(stats.offGoal).toHaveLength(1);
    expect(stats.offGoal[0].activityName).toBe("Caminhada");
    expect(stats.offGoal[0].minutes).toBe(20);
  });

  it("builds daily series (goals only)", () => {
    expect(stats.series).toHaveLength(3);
    expect(stats.series[0].actualMinutes).toBe(75);
    expect(stats.series[0].pct).toBe(83);
    expect(stats.series[2].actualMinutes).toBe(0);
    expect(stats.series[2].pct).toBe(0);
  });

  it("compares with the previous period", () => {
    const prev = computePeriodStats([a, b], records, "2026-08-29", "2026-08-31");
    const diffs = comparePeriods(prev, stats);
    expect(diffs.length).toBeGreaterThan(0);
    const inglês = diffs.find((d) => d.name === "Inglês")!;
    expect(inglês.prevPct).toBe(0); // objectives active, no records yet
    expect(inglês.currPct).toBe(58);
    expect(inglês.diffPoints).toBe(58);
  });

  it("ranks by consistency", () => {
    const ranking = consistencyRanking(stats);
    expect(ranking.map((r) => r.name)).toEqual(
      expect.arrayContaining(["Inglês", "Exercícios"]),
    );
    for (const row of ranking) {
      expect(row.consistency).toBe(33);
    }
  });

  it("produces a data summary for the AI", () => {
    const summary = buildDataSummary(stats);
    expect(summary.percentualGeral).toBe(50);
    expect(summary.porObjetivo).toHaveLength(2);
    expect(summary.foraDosObjetivos).toHaveLength(1);
  });
});
