import { describe, expect, it } from "vitest";
import { buildObservationsContext } from "./prompts";

const NOTE_DAY = { dayKey: "2026-09-02", note: "Trabalhei até tarde e fiquei cansado." };
const REC_DAY = {
  dayKey: "2026-09-02",
  records: [
    { activityName: "Inglês", minutes: 45, observation: "Fui melhor do que ontem." },
    { activityName: "Caminhada", minutes: 30, observation: "  " },
    { activityName: "Leitura", minutes: 20, observation: null },
  ],
};

describe("buildObservationsContext", () => {
  it("returns empty string when there is nothing to send", () => {
    expect(buildObservationsContext([])).toBe("");
    expect(
      buildObservationsContext([{ dayKey: "2026-09-02", note: "   ", records: [] }]),
    ).toBe("");
    expect(
      buildObservationsContext([
        {
          dayKey: "2026-09-02",
          records: [{ activityName: "X", minutes: 10, observation: undefined }],
        },
      ]),
    ).toBe("");
  });

  it("includes the daily note with its section header", () => {
    const out = buildObservationsContext([NOTE_DAY]);
    expect(out).toContain("## Observações do usuário");
    expect(out).toContain("observação do dia");
    expect(out).toContain(NOTE_DAY.note);
  });

  it("includes record observations even without a daily note", () => {
    const out = buildObservationsContext([REC_DAY]);
    expect(out).toContain("Inglês");
    expect(out).toContain("45 min");
    expect(out).toContain("Fui melhor do que ontem.");
  });

  it("ignores blank record observations", () => {
    const out = buildObservationsContext([REC_DAY]);
    expect(out).not.toContain("Caminhada");
  });

  it("merges note and record observation of the same day", () => {
    const out = buildObservationsContext([{ ...NOTE_DAY, ...REC_DAY }]);
    expect(out).toContain(NOTE_DAY.note as string);
    expect(out).toContain("Fui melhor do que ontem.");
  });

  it("keeps only the most recent maxDays and says others were omitted", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map(
      (dayKey) => ({ dayKey, note: `nota de ${dayKey}` }),
    );
    const out = buildObservationsContext(days, { maxDays: 2 });
    expect(out).toContain("nota de 2026-09-05");
    expect(out).toContain("nota de 2026-09-04");
    expect(out).not.toContain("nota de 2026-09-03");
    expect(out).toContain("Outras 3 observações do período foram omitidas");
  });

  it("orders kept days chronologically (oldest first)", () => {
    const days = [
      { dayKey: "2026-09-03", note: "dia 3" },
      { dayKey: "2026-09-01", note: "dia 1" },
      { dayKey: "2026-09-02", note: "dia 2" },
    ];
    const out = buildObservationsContext(days, { maxDays: 3 });
    expect(out.indexOf("dia 1")).toBeGreaterThan(-1);
    expect(out.indexOf("dia 1")).toBeLessThan(out.indexOf("dia 2"));
    expect(out.indexOf("dia 2")).toBeLessThan(out.indexOf("dia 3"));
  });

  it("clips long daily notes with an ellipsis", () => {
    const long = "x".repeat(600);
    const out = buildObservationsContext([{ dayKey: "2026-09-02", note: long }], {
      noteChars: 120,
    });
    expect(out).toContain(`${"x".repeat(120)}…`);
    expect(out.length).toBeLessThan(400);
  });

  it("caps record observations per day", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      activityName: `Atividade ${i}`,
      minutes: 10,
      observation: `obs ${i}`,
    }));
    const out = buildObservationsContext(
      [{ dayKey: "2026-09-02", records: many }],
      { maxRecordsPerDay: 2 },
    );
    expect(out).toContain("obs 0");
    expect(out).toContain("obs 1");
    expect(out).not.toContain("obs 2");
  });
});
