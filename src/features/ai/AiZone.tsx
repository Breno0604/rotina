import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { AnalysisKind, AiAssessmentPayload } from "../../types/domain";
import { useInstallationId } from "../../app/installation";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { ConfirmSheet } from "../../components/Sheet";
import { IconSparkle, IconTrash, IconChevronDown } from "../../components/Icon";
import { validateAssessmentPayload } from "../../services/ai/validators";
import { AssessmentPanel } from "./AssessmentPanel";
import { AssessmentContentView } from "./AssessmentView";

interface AiZoneProps {
  kind: AnalysisKind;
  from: string;
  to: string;
  periodLabel: string;
  objectives: Doc<"objectives">[];
  records: Doc<"records">[];
  memories: Doc<"memories">[];
  /** observações livres dos dias do período (dailyNotes) */
  notes?: { dayKey: string; note?: string | null }[];
  savedAnalyses: Doc<"analyses">[];
  triggerLabel: string;
}

/** Saved analyses can be expanded; generation is always user-initiated. */
export function AiZone({
  kind,
  from,
  to,
  periodLabel,
  objectives,
  records,
  memories,
  notes,
  savedAnalyses,
  triggerLabel,
}: AiZoneProps) {
  const installationId = useInstallationId();
  const remove = useMutation(api.analyses.remove);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Doc<"analyses"> | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...savedAnalyses].sort((a, b) => b.createdAt - a.createdAt),
    [savedAnalyses],
  );

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await remove({ installationId, id: toDelete._id });
      toast("Análise removida.");
      setToDelete(null);
    } catch {
      toast("Não foi possível remover a análise.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section ai-zone" aria-labelledby="ai-zone-title">
      <div className="section-head">
        <h2 className="section-title" id="ai-zone-title">
          Avaliação da IA
        </h2>
      </div>

      {sorted.length > 0 && (
        <div className="list saved-analyses">
          {sorted.map((a) => {
            const isOpen = expandedId === a._id;
            return (
              <div className="card saved-analysis" key={a._id}>
                <button
                  type="button"
                  className="saved-analysis-head"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedId(isOpen ? null : a._id)}
                >
                  <span>
                    <span className="t-sm t-strong">{a.periodLabel}</span>
                    <span className="t-xs t-muted" style={{ display: "block" }}>
                      {new Date(a.createdAt).toLocaleString("pt-BR")} · {a.model}
                    </span>
                  </span>
                  <IconChevronDown size={16} className={isOpen ? "rot" : undefined} />
                </button>
                {isOpen && (
                  <div className="saved-analysis-body">
                    <AssessmentContentView payload={parsePayload(a.contentJson)} />
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<IconTrash size={14} />}
                      onClick={() => setToDelete(a)}
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <AssessmentPanel
          kind={kind}
          from={from}
          to={to}
          periodLabel={periodLabel}
          objectives={objectives}
          records={records}
          memories={memories}
          notes={notes}
          onSaved={() => setOpen(false)}
        />
      ) : (
        <Button
          variant="secondary"
          icon={<IconSparkle size={17} />}
          onClick={() => setOpen(true)}
          block
        >
          {sorted.length > 0 ? `Gerar nova análise (${triggerLabel})` : triggerLabel}
        </Button>
      )}

      <ConfirmSheet
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Remover análise"
        confirmLabel="Remover"
        danger
        loading={busy}
        message="A análise salva será removida. O histórico de registros não é afetado."
      />
    </section>
  );
}

function parsePayload(json: string): AiAssessmentPayload {
  try {
    return validateAssessmentPayload(JSON.parse(json));
  } catch {
    return {
      resumo: "Conteúdo da análise indisponível.",
      pontosPositivos: [],
      pontosAtencao: [],
      padroes: [],
      possiveisExplicacoes: [],
      sugestoes: [],
      possiveisMemorias: [],
    };
  }
}
