/* Domain constants and shared types (pure, no Convex imports). */

export const APP_NAME = "Freebuff";

/* ------------------------------------------------------------------ */
/* Memory / personal context                                           */
/* ------------------------------------------------------------------ */

export const MEMORY_CATEGORIES = [
  { id: "produtividade", label: "Produtividade" },
  { id: "rotina", label: "Rotina" },
  { id: "objetivos", label: "Objetivos" },
  { id: "estrategias", label: "Estratégias" },
  { id: "dificuldades", label: "Dificuldades" },
  { id: "motivacao", label: "Motivação" },
  { id: "preferencias", label: "Preferências" },
  { id: "outros", label: "Outros" },
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]["id"];

export const MEMORY_CATEGORY_IDS: readonly MemoryCategory[] =
  MEMORY_CATEGORIES.map((c) => c.id);

export function memoryCategoryLabel(id: MemoryCategory): string {
  return MEMORY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const MEMORY_SOURCES = [
  { id: "declared", label: "Declarada" },
  { id: "observed", label: "Observada" },
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number]["id"];

export const CONFIDENCES = ["baixa", "media", "alta"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const MEMORY_STATES = [
  { id: "ativa", label: "Ativa" },
  { id: "possivelmente_desatualizada", label: "Possivelmente desatualizada" },
  { id: "arquivada", label: "Arquivada" },
] as const;
export type MemoryState = (typeof MEMORY_STATES)[number]["id"];

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export function confidenceLabel(c: Confidence): string {
  return CONFIDENCE_LABELS[c];
}

/* ------------------------------------------------------------------ */
/* AI analyses                                                         */
/* ------------------------------------------------------------------ */

export const ANALYSIS_KINDS = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "custom", label: "Personalizado" },
] as const;
export type AnalysisKind = (typeof ANALYSIS_KINDS)[number]["id"];

export function analysisKindLabel(kind: AnalysisKind): string {
  return ANALYSIS_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** Structured result of an AI assessment (validated before saving). */
export interface AiAssessmentPayload {
  resumo: string;
  pontosPositivos: string[];
  pontosAtencao: string[];
  padroes: string[];
  possiveisExplicacoes: string[];
  sugestoes: string[];
  possiveisMemorias: MemoryCandidate[];
}

export interface MemoryCandidate {
  conteudo: string;
  categoria: MemoryCategory;
}

/** Structured chat turn (AI replies in JSON so we can offer memory capture). */
export interface AiChatResult {
  resposta: string;
  memoriaSugerida: MemoryCandidate | null;
}

/* ------------------------------------------------------------------ */
/* Groq                                                                */
/* ------------------------------------------------------------------ */

export const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

/** Curated selectable models (Groq changes models over time; custom allowed). */
export const GROQ_MODELS: { id: string; label: string; hint: string }[] = [
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    hint: "Rápido e econômico — recomendado",
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    hint: "Análises mais profundas, mais lento",
  },
];

export type AiErrorCode =
  | "no-key"
  | "invalid-key"
  | "rate-limited"
  | "timeout"
  | "network"
  | "invalid-response"
  | "unknown";

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  "no-key": "Nenhuma chave de API configurada. Adicione sua chave Groq em Configurações.",
  "invalid-key": "A chave da API parece inválida. Verifique em Configurações e tente novamente.",
  "rate-limited":
    "O serviço de IA está ocupado no momento (limite de requisições). Tente novamente em alguns instantes.",
  timeout: "A IA demorou demais para responder. Tente novamente.",
  network: "Falha de conexão com o serviço de IA. Verifique sua internet.",
  "invalid-response": "A IA respondeu em um formato inesperado. Tente novamente.",
  unknown: "Algo deu errado ao chamar a IA. Tente novamente.",
};

/* ------------------------------------------------------------------ */
/* Theme palettes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Color palettes for the theme. The `id` is applied as `data-palette` on
 * <html>; tokens.css is the single source of truth for the rendered colors
 * (src/styles/tokens.css). `swatch` holds the fill for each theme so the
 * settings picker can preview every palette simultaneously.
 */
export const PALETTES = [
  { id: "laranja", label: "Laranja", swatch: { light: "#92400e", dark: "#b45309" } },
  { id: "azul", label: "Azul", swatch: { light: "#1d4ed8", dark: "#2563eb" } },
  { id: "roxo", label: "Roxo", swatch: { light: "#6d28d9", dark: "#7c3aed" } },
  { id: "verde", label: "Verde", swatch: { light: "#15803d", dark: "#166534" } },
  { id: "vermelho", label: "Vermelho", swatch: { light: "#b91c1c", dark: "#b91c1c" } },
  { id: "cinza", label: "Cinza", swatch: { light: "#44403c", dark: "#57534e" } },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export const DEFAULT_PALETTE: PaletteId = "laranja";

export function isPaletteId(v: unknown): v is PaletteId {
  return PALETTES.some((p) => p.id === v);
}

export function paletteLabel(id: PaletteId): string {
  return PALETTES.find((p) => p.id === id)?.label ?? id;
}

/* ------------------------------------------------------------------ */
/* Local storage keys                                                  */
/* ------------------------------------------------------------------ */

/**
 * Single shared space: every device uses this fixed scope id, so all
 * installations see and edit the SAME data with no linking or codes.
 * (The app has no login — anyone with the URL shares this space.)
 */
export const SHARED_SPACE_ID = "freebuff-shared-space-v1";
export const PREFS_KEY = "fb.prefs.v1";
export const CHAT_KEY = "fb.chat.v1";
export const THEME_KEY = "fb.theme";
