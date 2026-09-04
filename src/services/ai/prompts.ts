/* ==========================================================================
   Prompt builders. All AI prompts are pt-BR, neutral in tone, and ask for
   structured JSON that validators.ts then verifies.
   ========================================================================== */

import { formatDayShort } from "../../lib/dates";
import { formatMinutes } from "../../lib/format";

export interface MemoryLine {
  content: string;
  source: "declared" | "observed";
  confidence: "baixa" | "media" | "alta";
  state: "ativa" | "possivelmente_desatualizada" | "arquivada";
  pinned: boolean;
}

/**
 * Context text separating declared from observed memory (never mixed):
 * declared memories first (pinned first), then observed patterns clearly
 * labeled with their confidence.
 */
export function buildMemoryContext(memories: MemoryLine[]): string {
  const active = memories.filter((m) => m.state === "ativa");
  const declared = active
    .filter((m) => m.source === "declared")
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const observed = active.filter((m) => m.source === "observed");

  const lines: string[] = [];
  lines.push("## Contexto pessoal do usuário");
  if (declared.length === 0 && observed.length === 0) {
    lines.push("(Nenhuma memória registrada ainda.)");
  } else {
    if (declared.length > 0) {
      lines.push("### Informado pelo usuário");
      for (const m of declared) {
        lines.push(`- ${m.pinned ? "[FIXADA] " : ""}${m.content}`);
      }
    }
    if (observed.length > 0) {
      lines.push("### Padrões observados (identificados pela IA, confiança baixa/média)");
      for (const m of observed) {
        lines.push(`- ${m.content} (confiança ${m.confidence})`);
      }
    }
  }
  return lines.join("\n");
}

const TONE_RULES = `- Língua: português (Brasil). Tom: neutro, acolhedor, sem julgamentos.
- NUNCA use linguagem de cobrança ou fracasso ("você falhou", "você não cumpriu"). Use fatos: "45 de 60 minutos".
- Quando a evidência não for conclusiva, use linguagem ponderada: "os dados sugerem", "parece existir um padrão", "há indícios de".
- Sugestões são sempre sugestões — nunca ordens. Prefira "talvez valha a pena testar", "pode ser interessante".
- Não invente números: os dados fornecidos são os únicos números disponíveis.
- Textos concisos. Cada item de lista com no máximo 280 caracteres.`;

const ASSESSMENT_JSON = `Responda APENAS com um JSON válido, sem texto fora dele, neste formato exato:
{
  "resumo": "parágrafo curto (até 400 caracteres) interpretando o período",
  "pontosPositivos": ["..."],
  "pontosAtencao": ["..."],
  "padroes": ["padrões observados nos dados..."],
  "possiveisExplicacoes": ["explicações prováveis, ligando dados e contexto..."],
  "sugestoes": ["sugestões práticas e opcionais..."],
  "possiveisMemorias": [{"conteudo": "afirmação geral e durável sobre o usuário", "categoria": "produtividade|rotina|objetivos|estrategias|dificuldades|motivacao|preferencias|outros"}]
}`;

export function systemAssessmentPrompt(): string {
  return `Você é um assistente pessoal de reflexão. O usuário define objetivos diários e registra o que realmente fez; você interpreta os dados consolidados e o contexto pessoal para ajudá-lo a se entender melhor ao longo do tempo.

Você NÃO faz cálculos: recebe números já consolidados e apenas os interpreta.
- Combine dados objetivos (tempo realizado × meta), o contexto pessoal do usuário (memórias) e o histórico recente.
- Considere também as observações livres do usuário (se houver) como relatos pessoais: ajudam a explicar padrões, mas não alteram os números consolidados.
- Ao citar uma percepção do usuário que os dados confirmam ou contradizem, diga isso de forma explícita e ponderada.
- possiveisMemorias: apenas padrões claros e repetidos (não eventos pontuais), redigidos como afirmações gerais sobre como o usuário funciona. Máximo 3. Se nada for claro, use lista vazia.
- As memórias declaradas são informação dada pelo usuário; padrões observados são apenas hipóteses da IA.

${TONE_RULES}

${ASSESSMENT_JSON}`;
}

export interface ObservationRecordInput {
  activityName: string;
  minutes: number;
  observation?: string | null;
}

export interface ObservationDayInput {
  dayKey: string;
  /** observação livre do dia (dailyNotes) */
  note?: string | null;
  records?: ObservationRecordInput[];
}

const OBS_DEFAULTS: {
  maxDays: number;
  maxRecordsPerDay: number;
  noteChars: number;
  recordChars: number;
} = {
  /** max days with free text included (most recent kept) */
  maxDays: 12,
  /** max record observations per day */
  maxRecordsPerDay: 5,
  noteChars: 500,
  recordChars: 300,
};

type ObsOpts = Partial<typeof OBS_DEFAULTS>;

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

/**
 * Free-text user context for the AI: daily notes + per-record observations,
 * bounded (recent days first, per-item char caps) so prompts stay small.
 * Returns "" when there is nothing to send.
 */
export function buildObservationsContext(
  days: ObservationDayInput[],
  opts?: ObsOpts,
): string {
  const { maxDays, maxRecordsPerDay, noteChars, recordChars } = {
    ...OBS_DEFAULTS,
    ...opts,
  };

  const usable = (days ?? [])
    .map((d) => ({ dayKey: d.dayKey, note: d.note ?? "", records: d.records ?? [] }))
    .filter(
      (d) =>
        d.note.trim() !== "" ||
        d.records.some((r) => (r.observation?.trim() ?? "") !== ""),
    )
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0));

  if (usable.length === 0) return "";

  const kept = usable.slice(0, maxDays).reverse(); // chronological order
  const lines: string[] = [];
  for (const day of kept) {
    const label = formatDayShort(day.dayKey);
    if (day.note.trim() !== "") {
      lines.push(`- ${label} — observação do dia: “${clip(day.note, noteChars)}”`);
    }
    const withObs = day.records
      .filter((r) => (r.observation?.trim() ?? "") !== "")
      .slice(0, maxRecordsPerDay);
    for (const r of withObs) {
      lines.push(
        `- ${label} — ${r.activityName} (${formatMinutes(r.minutes)}): “${clip(
          r.observation as string,
          recordChars,
        )}”`,
      );
    }
  }

  const omitted = usable.length - kept.length;
  const omittedNote =
    omitted > 0
      ? `\n(Outras ${omitted} ${
          omitted === 1 ? "observação" : "observações"
        } do período foram omitidas para caber no contexto.)`
      : "";

  return `## Observações do usuário\nTextos livres do próprio usuário (notas do dia e anotações dos registros). São relatos e percepções — use como pistas de explicação, nunca como números.\n${lines.join(
    "\n",
  )}${omittedNote}`;
}

export interface AssessmentUserInput {
  kindLabel: string;
  periodLabel: string;
  /** JSON string of the consolidated numbers (buildDataSummary) */
  summaryText: string;
  memoriesContext: string;
  /** free-text section from buildObservationsContext (may be "") */
  observationsContext?: string;
}

export function userAssessmentPrompt(input: AssessmentUserInput): string {
  const observations = input.observationsContext
    ? `${input.observationsContext}\n\n`
    : "";
  return `Período analisado: ${input.kindLabel} (${input.periodLabel}).\n\n${input.memoriesContext}\n\n${observations}## Dados consolidados do período (não recalcule — apenas interprete)\n${input.summaryText}`;
}

export function systemChatPrompt(memoriesContext: string): string {
  return `Você é o assistente pessoal de acompanhamento de objetivos do usuário. O usuário pode conversar livremente sobre o dia, objetivos, dificuldades e descobertas.

Comporte-se assim:
- Responda com naturalidade, em português do Brasil, de forma breve (até 200 palavras, salvo se o usuário pedir mais).
- Considere o contexto pessoal abaixo e os dados que o usuário mencionar — mas não invente números sobre registros que não foram informados.
- Quando o usuário compartilhar algo que pareça um fato durável e relevante sobre como ele funciona (rotina, preferência, dificuldade, estratégia, motivação), devolva esse fato em "memoriaSugerida", redigido como afirmação geral, com a categoria mais adequada. Eventos pontuais ("hoje estou cansado") NÃO geram memória.
- Sugestões são sempre sugestões; nunca ordens.

${TONE_RULES}

${memoriesContext}

Responda APENAS com um JSON válido neste formato exato:
{"resposta": "texto da resposta", "memoriaSugerida": null ou {"conteudo": "...", "categoria": "uma das categorias listadas"}}`;
}

export function chatContextHeader(summaryText: string): string {
  return `## Dados de hoje (consolidados)\n${summaryText}`;
}
