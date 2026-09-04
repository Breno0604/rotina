/* ==========================================================================
   AI response validation — model output is untrusted data. Every response
   passes through here before touching the UI or the database.
   ========================================================================== */

import {
  MEMORY_CATEGORY_IDS,
  type AiAssessmentPayload,
  type AiChatResult,
  type MemoryCandidate,
  type MemoryCategory,
} from "../../types/domain";

const CATEGORIES = MEMORY_CATEGORY_IDS as readonly string[];

export class InvalidResponseError extends Error {
  constructor() {
    super("invalid-response");
    this.name = "InvalidResponseError";
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse model output as JSON. Tolerant to markdown fences and stray prose
 * around the object: we first try a direct parse, then extract the first
 * `{...}` span (models sometimes wrap or prefix the JSON). Throws
 * InvalidResponseError when there is no recoverable JSON.
 */
export function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fallback: extract the outermost { ... } block and try again
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new InvalidResponseError();
  }
}

function stringList(
  v: unknown,
  maxItems: number,
  maxLen: number,
  required: boolean,
): string[] {
  if (!Array.isArray(v)) {
    if (required) throw new InvalidResponseError();
    return [];
  }
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s.length > 0) out.push(s.slice(0, maxLen));
    }
    if (out.length >= maxItems) break;
  }
  if (required && out.length === 0) throw new InvalidResponseError();
  return out;
}

function memoryCandidate(v: unknown): MemoryCandidate | null {
  if (!isObject(v)) return null;
  const conteudo = typeof v.conteudo === "string" ? v.conteudo.trim().slice(0, 300) : "";
  if (conteudo.length < 2) return null;
  const categoriaRaw = typeof v.categoria === "string" ? v.categoria : "";
  const categoria: MemoryCategory = CATEGORIES.includes(categoriaRaw)
    ? (categoriaRaw as MemoryCategory)
    : "outros";
  return { conteudo, categoria };
}

export function validateAssessmentPayload(raw: unknown): AiAssessmentPayload {
  if (!isObject(raw)) throw new InvalidResponseError();

  if (typeof raw.resumo !== "string" || raw.resumo.trim().length === 0) {
    throw new InvalidResponseError();
  }
  const resumo = raw.resumo.trim().slice(0, 400);

  const possiveisMemorias: MemoryCandidate[] = [];
  if (Array.isArray(raw.possiveisMemorias)) {
    for (const item of raw.possiveisMemorias) {
      const c = memoryCandidate(item);
      if (c) possiveisMemorias.push(c);
      if (possiveisMemorias.length >= 3) break;
    }
  }

  return {
    resumo,
    pontosPositivos: stringList(raw.pontosPositivos, 6, 280, false),
    pontosAtencao: stringList(raw.pontosAtencao, 6, 280, false),
    padroes: stringList(raw.padroes, 6, 280, false),
    possiveisExplicacoes: stringList(raw.possiveisExplicacoes, 5, 280, false),
    sugestoes: stringList(raw.sugestoes, 6, 320, false),
    possiveisMemorias,
  };
}

export function validateChatResult(raw: unknown): AiChatResult {
  if (!isObject(raw)) throw new InvalidResponseError();
  const resposta =
    typeof raw.resposta === "string" && raw.resposta.trim().length > 0
      ? raw.resposta.trim().slice(0, 4000)
      : (() => {
          throw new InvalidResponseError();
        })();

  let memoriaSugerida: MemoryCandidate | null = null;
  if (isObject(raw.memoriaSugerida)) {
    memoriaSugerida = memoryCandidate(raw.memoriaSugerida);
  }
  return { resposta, memoriaSugerida };
}
