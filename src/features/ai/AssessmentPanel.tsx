import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  AI_ERROR_MESSAGES,
  type AiAssessmentPayload,
  type AnalysisKind,
  type MemoryCandidate,
} from "../../types/domain";
import { useInstallationId } from "../../app/installation";
import { usePrefs } from "../../app/prefs";
import { useHasKey } from "../../hooks/useHasKey";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { IconSparkle } from "../../components/Icon";
import { InfoNote } from "../../components/StateViews";
import { navigate } from "../../lib/router";
import {
  buildMemoryContext,
  buildObservationsContext,
  systemAssessmentPrompt,
  userAssessmentPrompt,
  type ObservationDayInput,
  type ObservationRecordInput,
} from "../../services/ai/prompts";
import { runAssessment } from "../../services/ai/service";
import { computePeriodStats, buildDataSummary } from "../../lib/calculations";
import type { MemoryLine } from "../../services/ai/prompts";
import { AssessmentContentView, MemoryCandidateList } from "./AssessmentView";

export interface AssessmentPanelProps {
  kind: AnalysisKind;
  from: string;
  to: string;
  periodLabel: string;
  objectives: Doc<"objectives">[];
  records: Doc<"records">[];
  memories: Doc<"memories">[];
  /** observações livres dos dias do período (dailyNotes) */
  notes?: { dayKey: string; note?: string | null }[];
  onSaved?: () => void;
  compact?: boolean;
}

type Status = "idle" | "loading" | "error" | "done";

export function AssessmentPanel({
  kind,
  from,
  to,
  periodLabel,
  objectives,
  records,
  memories,
  notes,
  onSaved,
  compact,
}: AssessmentPanelProps) {
  const installationId = useInstallationId();
  const { prefs } = usePrefs();
  const { has } = useHasKey();
  const { toast } = useToast();
  const createAnalysis = useMutation(api.analyses.create);
  const saveObserved = useMutation(api.memories.saveObserved);

  const [status, setStatus] = useState<Status>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [payload, setPayload] = useState<AiAssessmentPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const stats = useMemo(
    () => computePeriodStats(objectives, records, from, to),
    [objectives, records, from, to],
  );

  const memoriesContext = useMemo(() => {
    const lines: MemoryLine[] = memories.map((m) => ({
      content: m.content,
      source: m.source,
      confidence: m.confidence,
      state: m.state,
      pinned: m.pinned,
    }));
    return buildMemoryContext(lines);
  }, [memories]);

  // Free text of the period: daily notes merged with record observations.
  const observationsContext = useMemo(() => {
    const recsByDay = new Map<string, ObservationRecordInput[]>();
    for (const r of records) {
      if (!r.observation?.trim()) continue;
      const arr = recsByDay.get(r.dayKey) ?? [];
      arr.push({
        activityName: r.activityName,
        minutes: r.minutes,
        observation: r.observation,
      });
      recsByDay.set(r.dayKey, arr);
    }
    const byDay = new Map<string, ObservationDayInput>();
    for (const [dayKey, recs] of recsByDay) byDay.set(dayKey, { dayKey, records: recs });
    for (const n of notes ?? []) {
      if (!n.note?.trim()) continue;
      const prev = byDay.get(n.dayKey);
      byDay.set(
        n.dayKey,
        prev ? { ...prev, note: n.note } : { dayKey: n.dayKey, note: n.note, records: [] },
      );
    }
    return buildObservationsContext([...byDay.values()]);
  }, [records, notes]);

  const kindLabel =
    kind === "day" ? "Dia" : kind === "week" ? "Semana" : kind === "month" ? "Mês" : "Período";

  async function generate() {
    setStatus("loading");
    setErrorCode(null);
    try {
      const summaryText = JSON.stringify(buildDataSummary(stats));
      const result = await runAssessment({
        model: prefs.model,
        system: systemAssessmentPrompt(),
        user: userAssessmentPrompt({
          kindLabel,
          periodLabel,
          summaryText,
          memoriesContext,
          observationsContext,
        }),
      });
      if (result.ok) {
        setPayload(result.data);
        setStatus("done");
      } else {
        setErrorCode(result.code);
        setStatus("error");
      }
    } catch {
      setErrorCode("unknown");
      setStatus("error");
    }
  }

  async function saveAnalysis() {
    if (!payload) return;
    setSaving(true);
    try {
      const id = await createAnalysis({
        installationId,
        kind,
        periodStart: from,
        periodEnd: to,
        periodLabel,
        resumo: payload.resumo,
        contentJson: JSON.stringify(payload),
        infoUsed: `Período ${from} a ${to} · ${stats.dayCount} dias · ${stats.totalRecords} registros · ${objectives.length} objetivos · ${memories.length} memórias`,
        model: prefs.model,
      });
      setSavedId(id as unknown as string);
      toast("Análise salva.");
      onSaved?.();
    } catch {
      toast("Não foi possível salvar a análise.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMemory(candidate: MemoryCandidate) {
    await saveObserved({
      installationId,
      content: candidate.conteudo,
      category: candidate.categoria,
    });
  }

  if (has === null) {
    return (
      <div className="ai-panel">
        <InfoNote>Verificando a chave de IA…</InfoNote>
      </div>
    );
  }

  return (
    <div className={`ai-panel${compact ? " ai-panel-compact" : ""}`}>
      {status === "idle" && (
        <div className="ai-cta">
          {has === false ? (
            <InfoNote tone="warn">
              Para gerar avaliações é preciso configurar sua chave da Groq.
              <Button
                variant="accent"
                size="sm"
                onClick={() => navigate("/config")}
                style={{ marginTop: 10 }}
              >
                Configurar chave
              </Button>
            </InfoNote>
          ) : (
            <>
              <p className="t-sm t-muted">
                A IA interpreta os dados consolidados deste período — nunca faz
                os cálculos. Resultado fica visível antes de ser salvo.
              </p>
              <Button variant="accent" icon={<IconSparkle size={17} />} onClick={generate}>
                Gerar avaliação do {kind === "custom" ? "período" : kindLabel.toLowerCase()}
              </Button>
            </>
          )}
        </div>
      )}

      {status === "loading" && (
        <div className="ai-loading" role="status">
          <span className="spinner" aria-hidden />
          <p className="t-sm t-muted">Analisando o período… isso pode levar alguns segundos.</p>
        </div>
      )}

      {status === "error" && (
        <div className="ai-error" role="alert">
          <p className="t-sm t-strong">Não foi possível concluir a análise.</p>
          <p className="t-sm t-muted">
            {errorCode ? AI_ERROR_MESSAGES[errorCode as keyof typeof AI_ERROR_MESSAGES] : AI_ERROR_MESSAGES.unknown}
            {errorCode === "invalid-key" && " Vá em Configurações para corrigir a chave."}
          </p>
          {errorCode === "no-key" ? (
            <Button variant="accent" size="sm" onClick={() => navigate("/config")} style={{ marginTop: 8 }}>
              Configurar chave
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={generate} style={{ marginTop: 8 }}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {status === "done" && payload && (
        <div className="ai-result">
          <AssessmentContentView payload={payload} />
          <MemoryCandidateList candidates={payload.possiveisMemorias} onSave={saveMemory} />
          <div className="sheet-actions" style={{ marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={generate}>
              Gerar novamente
            </Button>
            {savedId ? (
              <span className="badge badge-primary">Análise salva</span>
            ) : (
              <Button variant="accent" onClick={saveAnalysis} loading={saving}>
                Salvar análise
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
