import { describe, expect, it } from "vitest";
import {
  parseJson,
  validateAssessmentPayload,
  validateChatResult,
  InvalidResponseError,
} from "./validators";

describe("AI response validation", () => {
  it("strips markdown fences before parsing", () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts JSON wrapped in stray prose", () => {
    expect(parseJson('Aqui está a análise:\n{"a":1}\nEspero que ajude.')).toEqual({
      a: 1,
    });
    expect(parseJson('{"a":1} trailing')).toEqual({ a: 1 });
    expect(parseJson('prefix { "a": { "b": 2 } }')).toEqual({ a: { b: 2 } });
  });

  it("still rejects truncated or absent JSON", () => {
    expect(() => parseJson('{ "a": 1')).toThrow(InvalidResponseError);
    expect(() => parseJson('texto sem json')).toThrow(InvalidResponseError);
    expect(() => parseJson('{ "a": 1 } junk }')).toThrow(InvalidResponseError);
  });

  it("accepts a well-formed assessment payload", () => {
    const payload = validateAssessmentPayload({
      resumo: "Boa semana.",
      pontosPositivos: ["Manteve a rotina"],
      pontosAtencao: [],
      padroes: ["Mais consistência pela manhã"],
      possiveisExplicacoes: [],
      sugestoes: ["Testar horários diferentes"],
      possiveisMemorias: [
        { conteudo: "Rende mais pela manhã", categoria: "produtividade" },
      ],
    });
    expect(payload.resumo).toBe("Boa semana.");
    expect(payload.pontosPositivos).toEqual(["Manteve a rotina"]);
    expect(payload.possiveisMemorias[0].categoria).toBe("produtividade");
  });

  it("rejects missing resumo", () => {
    expect(() =>
      validateAssessmentPayload({
        resumo: "",
        pontosPositivos: [],
        pontosAtencao: [],
        padroes: [],
        possiveisExplicacoes: [],
        sugestoes: [],
        possiveisMemorias: [],
      }),
    ).toThrow(InvalidResponseError);
  });

  it("truncates oversized fields and keeps array limits", () => {
    const payload = validateAssessmentPayload({
      resumo: "x".repeat(500),
      pontosPositivos: Array.from({ length: 30 }, (_, i) => `item ${i}`),
      pontosAtencao: [],
      padroes: [],
      possiveisExplicacoes: [],
      sugestoes: [],
      possiveisMemorias: [],
    });
    expect(payload.resumo.length).toBeLessThanOrEqual(400);
    expect(payload.pontosPositivos.length).toBeLessThanOrEqual(6);
  });

  it("maps unknown memory categories to 'outros'", () => {
    const result = validateChatResult({
      resposta: "ok",
      memoriaSugerida: { conteudo: "Prefiro começar cedo", categoria: "horario" },
    });
    expect(result.memoriaSugerida?.categoria).toBe("outros");
  });

  it("rejects chat without a resposta", () => {
    expect(() => validateChatResult({ resposta: "   " })).toThrow(InvalidResponseError);
  });
});
