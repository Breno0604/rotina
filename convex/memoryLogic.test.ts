import { describe, expect, it } from "vitest";
import {
  decideMemoryStatus,
  downConfidence,
  isSimilarMemory,
  normalizeText,
  tokenSimilarity,
  upConfidence,
  type MemoryStatusAction,
} from "./memoryLogic";

const DAY = 86_400_000;

describe("normalizeText / tokenSimilarity", () => {
  it("normalizes case, accents and punctuation", () => {
    expect(normalizeText("Tenho mais concentração pela manhã!")).toBe(
      "tenho mais concentracao pela manha",
    );
  });

  it("computes Jaccard similarity", () => {
    expect(tokenSimilarity("tenho mais concentração pela manhã", "tenho mais concentração no período da manhã")).toBeGreaterThan(0.6);
    expect(tokenSimilarity("prefiro começar cedo", "acordo bem tarde")).toBeLessThan(0.3);
  });
});

describe("isSimilarMemory", () => {
  it("matches identical and rephrased ideas", () => {
    expect(isSimilarMemory("Tenho mais concentração pela manhã", "tenho mais concentração pela manhã")).toBe(true);
    expect(isSimilarMemory("Tenho mais concentração pela manhã", "tenho mais concentração no período da manhã")).toBe(true);
    expect(isSimilarMemory("Inglês é minha prioridade", "Inglês é minha principal prioridade agora")).toBe(true);
  });

  it("rejects unrelated ideas", () => {
    expect(isSimilarMemory("Tenho mais concentração pela manhã", "Prefiro dormir cedo")).toBe(false);
    expect(isSimilarMemory("Tenho dificuldade com atividades noturnas", "Gosto de estudar após o almoço")).toBe(false);
  });
});

describe("decideMemoryStatus", () => {
  const now = 1_800_000_000_000;
  const base = { createdAtMs: now - 10 * DAY, evidenceCount: 1, nowMs: now };

  it("keeps memories grounded in recent data alive", () => {
    const action = decideMemoryStatus({ ...base, lastConfirmedMs: now - 60 * DAY, hasRecentData: true });
    expect(action).toBe("refresh");
  });

  it("downgrades confidence after 30 days without confirmation/data", () => {
    const action = decideMemoryStatus({ ...base, lastConfirmedMs: now - 35 * DAY, hasRecentData: false });
    expect(action).toBe("downgrade");
  });

  it("marks stale after 45 days (low evidence)", () => {
    const action = decideMemoryStatus({ ...base, lastConfirmedMs: now - 50 * DAY, hasRecentData: false });
    expect(action).toBe("stale");
  });

  it("ages slower when evidence is strong (90 days)", () => {
    const staleEarly = decideMemoryStatus({ ...base, evidenceCount: 3, lastConfirmedMs: now - 60 * DAY, hasRecentData: false });
    expect(staleEarly).not.toBe("stale");
    const staleLate = decideMemoryStatus({ ...base, evidenceCount: 3, lastConfirmedMs: now - 95 * DAY, hasRecentData: false });
    expect(staleLate).toBe("stale");
  });

  it("stays put when fresh", () => {
    const action = decideMemoryStatus({ ...base, lastConfirmedMs: now - 5 * DAY, hasRecentData: false });
    expect(action).toBe("none");
  });

  it("uses createdAt when never explicitly confirmed", () => {
    const action: MemoryStatusAction = decideMemoryStatus({ ...base, lastConfirmedMs: 0, hasRecentData: false });
    expect(["none", "downgrade"]).toContain(action);
  });
});

describe("confidence steps", () => {
  it("moves up and down one step, clamped at the edges", () => {
    expect(upConfidence("baixa")).toBe("media");
    expect(upConfidence("media")).toBe("alta");
    expect(upConfidence("alta")).toBe("alta");
    expect(downConfidence("alta")).toBe("media");
    expect(downConfidence("media")).toBe("baixa");
    expect(downConfidence("baixa")).toBe("baixa");
  });
});