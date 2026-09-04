import { useState, type ReactNode } from "react";
import type { AiAssessmentPayload, MemoryCandidate } from "../../types/domain";
import { memoryCategoryLabel } from "../../types/domain";
import { Button } from "../../components/Button";
import {
  IconAlert,
  IconCheck,
  IconHistory,
  IconInfo,
  IconSparkle,
} from "../../components/Icon";
import { useToast } from "../../components/Toast";

interface Section {
  icon: ReactNode;
  title: string;
  items: string[];
  tone: "ok" | "warn" | "neutral";
}

export function AssessmentContentView({ payload }: { payload: AiAssessmentPayload }) {
  const all: Section[] = [
    { icon: <IconCheck size={16} />, title: "O que foi bem", items: payload.pontosPositivos, tone: "ok" },
    { icon: <IconAlert size={16} />, title: "Pontos de atenção", items: payload.pontosAtencao, tone: "warn" },
    { icon: <IconHistory size={16} />, title: "Padrões observados", items: payload.padroes, tone: "neutral" },
    { icon: <IconInfo size={16} />, title: "Possíveis explicações", items: payload.possiveisExplicacoes, tone: "neutral" },
    { icon: <IconSparkle size={16} />, title: "Sugestões", items: payload.sugestoes, tone: "neutral" },
  ];
  const sections = all.filter((s) => s.items.length > 0);

  return (
    <div className="ai-content">
      <p className="ai-resumo">{payload.resumo}</p>
      {sections.map((s) => (
        <div className="ai-section" key={s.title}>
          <h3 className="ai-section-title">
            <span className="ai-section-icon" aria-hidden>
              {s.icon}
            </span>
            {s.title}
          </h3>
          <ul className="ai-list" data-tone={s.tone}>
            {s.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** AI-proposed memories — saved only when the user taps Guardar. */
export function MemoryCandidateList({
  candidates,
  onSave,
}: {
  candidates: MemoryCandidate[];
  onSave: (candidate: MemoryCandidate) => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  async function save(candidate: MemoryCandidate, index: number) {
    setSaving(index);
    try {
      await onSave(candidate);
      setSaved((prev) => new Set(prev).add(index));
      toast("Memória salva no seu contexto pessoal.");
    } catch {
      toast("Não foi possível salvar a memória.", "error");
    } finally {
      setSaving(null);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <div className="ai-memory-candidates">
      <h3 className="ai-section-title">
        <span className="ai-section-icon" aria-hidden>
          <IconSparkle size={16} />
        </span>
        Possíveis memórias para o contexto pessoal
      </h3>
      <p className="t-sm t-muted" style={{ marginBottom: 8 }}>
        A IA identificou padrões que talvez valham guardar. Você decide — nada é
        salvo sem a sua confirmação.
      </p>
      {candidates.map((c, i) => (
        <div className="memory-candidate" key={i}>
          <div>
            <p className="t-sm t-strong">{c.conteudo}</p>
            <span className="badge">{memoryCategoryLabel(c.categoria)}</span>
          </div>
          {saved.has(i) ? (
            <span className="badge badge-primary">Guardada</span>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={saving === i}
              onClick={() => save(c, i)}
            >
              Guardar
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
