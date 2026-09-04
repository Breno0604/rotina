import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useInstallationId } from "../../app/installation";
import { useObjectives } from "../../hooks/useQueries";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { IconArchive, IconPencil, IconPlus, IconRefresh, IconTarget, IconTrash } from "../../components/Icon";
import { EmptyState, LoadingState, ErrorState, InfoNote } from "../../components/StateViews";
import { Sheet, ConfirmSheet } from "../../components/Sheet";
import { TextInput } from "../../components/Field";
import { formatMinutes, parseDurationInput } from "../../lib/format";
import { todayKey } from "../../lib/dates";

export function ObjectivesScreen() {
  const installationId = useInstallationId();
  const objectives = useObjectives();
  const setActive = useMutation(api.objectives.setActive);
  const remove = useMutation(api.objectives.remove);
  const { toast } = useToast();

  const [editor, setEditor] = useState<{ open: boolean; objective: Doc<"objectives"> | null }>({
    open: false,
    objective: null,
  });
  const [toDelete, setToDelete] = useState<Doc<"objectives"> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = useMemo(() => (objectives ?? []).filter((o) => o.active), [objectives]);
  const inactive = useMemo(() => (objectives ?? []).filter((o) => !o.active), [objectives]);

  if (objectives === undefined) return <LoadingState label="Carregando objetivos…" />;
  if (objectives === null) return <ErrorState message="Falha ao carregar os objetivos." />;

  async function toggle(o: Doc<"objectives">) {
    setBusyId(o._id);
    try {
      await setActive({ installationId, id: o._id, active: !o.active, dayKey: todayKey() });
      toast(o.active ? `${o.name} desativado (histórico preservado).` : `${o.name} ativado.`);
    } catch {
      toast("Não foi possível alterar o objetivo.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!toDelete) return;
    try {
      await remove({ installationId, id: toDelete._id });
      toast("Objetivo excluído.");
      setToDelete(null);
    } catch {
      toast("Não foi possível excluir.", "error");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Objetivos</h1>
          <p className="page-sub">O que você quer fazer, em minutos por dia.</p>
        </div>
        <Button
          variant="primary"
          className="btn-icon"
          aria-label="Novo objetivo"
          title="Novo objetivo"
          icon={<IconTarget size={18} />}
          onClick={() => setEditor({ open: true, objective: null })}
        />
      </div>

      <InfoNote>
        Desativar um objetivo não apaga o histórico: os dias passados continuam
        mostrando o que foi feito. A meta é usada para comparar objetivo × realizado.
      </InfoNote>

      <section className="section" aria-labelledby="obj-active-title">
        <h2 className="section-title" id="obj-active-title">
          Ativos
        </h2>
        {active.length === 0 ? (
          <EmptyState
            icon={<IconTarget size={24} />}
            title="Nenhum objetivo ativo"
            body="Crie o primeiro para começar a comparar o planejado com o realizado."
            action={
              <Button
                variant="primary"
                icon={<IconPlus size={18} />}
                onClick={() => setEditor({ open: true, objective: null })}
              >
                Novo objetivo
              </Button>
            }
          />
        ) : (
          <div className="list">
            {active.map((o) => (
              <div className="card goal-card" key={o._id}>
                <div className="goal-top">
                  <span className="goal-name t-strong">{o.name}</span>
                  <span className="goal-right t-num t-sm t-muted">
                    {formatMinutes(o.targetMinutes)}/dia
                  </span>
                </div>
                <div className="obj-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconPencil size={15} />}
                    onClick={() => setEditor({ open: true, objective: o })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconArchive size={15} />}
                    loading={busyId === o._id}
                    onClick={() => toggle(o)}
                  >
                    Desativar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="section" aria-labelledby="obj-inactive-title">
          <h2 className="section-title" id="obj-inactive-title">
            Desativados
          </h2>
          <div className="list">
            {inactive.map((o) => (
              <div className="card goal-card" key={o._id}>
                <div className="goal-top">
                  <span className="goal-name t-muted">{o.name}</span>
                  <span className="goal-right t-num t-sm t-muted">
                    {formatMinutes(o.targetMinutes)}/dia
                  </span>
                </div>
                <div className="obj-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconPencil size={15} />}
                    onClick={() => setEditor({ open: true, objective: o })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconRefresh size={15} />}
                    loading={busyId === o._id}
                    onClick={() => toggle(o)}
                  >
                    Reativar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<IconTrash size={15} />}
                    onClick={() => setToDelete(o)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {editor.open && (
        <ObjectiveSheet
          objective={editor.objective}
          onClose={() => setEditor({ open: false, objective: null })}
        />
      )}
      <ConfirmSheet
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmRemove}
        title="Excluir objetivo"
        confirmLabel="Excluir"
        danger
        message={
          <>
            Excluir <strong>{toDelete?.name}</strong>? Os registros antigos permanecem,
            mas os dias passados sem registro deixarão de contar essa meta.
          </>
        }
      />
    </>
  );
}

const TARGET_CHIPS = [15, 30, 45, 60, 90, 120];

function ObjectiveSheet({
  objective,
  onClose,
}: {
  objective: Doc<"objectives"> | null;
  onClose: () => void;
}) {
  const installationId = useInstallationId();
  const create = useMutation(api.objectives.create);
  const edit = useMutation(api.objectives.edit);
  const { toast } = useToast();

  const [name, setName] = useState(objective?.name ?? "");
  const [targetRaw, setTargetRaw] = useState(
    objective ? formatMinutes(objective.targetMinutes) : "60",
  );
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const target = parseDurationInput(targetRaw);
    const errs: typeof errors = {};
    if (name.trim().length === 0) errs.name = "Dê um nome ao objetivo.";
    if (target === null) errs.target = "Informe a meta em minutos (ex.: 60 ou 1h30).";
    setErrors(errs);
    if (Object.keys(errs).length > 0 || target === null) return;

    setSaving(true);
    try {
      if (objective) {
        await edit({ installationId, id: objective._id, name: name.trim(), targetMinutes: target });
        toast("Objetivo atualizado.");
      } else {
        await create({
          installationId,
          name: name.trim(),
          targetMinutes: target,
          createdDayKey: todayKey(),
        });
        toast("Objetivo criado.");
      }
      onClose();
    } catch {
      toast("Não foi possível salvar o objetivo.", "error");
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={objective ? "Editar objetivo" : "Novo objetivo"}
    >
      <TextInput
        label="Nome"
        required
        placeholder="Ex.: Inglês, Programação, Exercícios…"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        data-autofocus
      />
      <div className="field">
        <TextInput
          label="Meta diária"
          required
          hint="Minutos por dia — ex.: 60 ou 1h30."
          inputMode="numeric"
          value={targetRaw}
          onChange={(e) => {
            setTargetRaw(e.target.value);
            setErrors((prev) => ({ ...prev, target: undefined }));
          }}
          error={errors.target}
        />
        <div className="chips" role="group" aria-label="Metas rápidas">
          {TARGET_CHIPS.map((min) => (
            <button
              key={min}
              type="button"
              className="chip"
              aria-pressed={parseDurationInput(targetRaw) === min}
              onClick={() => setTargetRaw(String(min))}
            >
              {formatMinutes(min)}
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-actions">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save} loading={saving} block>
          {objective ? "Salvar alterações" : "Criar objetivo"}
        </Button>
      </div>
    </Sheet>
  );
}
