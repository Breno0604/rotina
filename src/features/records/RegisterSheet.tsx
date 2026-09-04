/* Quick registration — the product's primary daily action. Designed for a
   few taps: pick activity, duration (with quick chips), optional note.
   Supports logging several entries in a row. */

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useInstallationId } from "../../app/installation";
import { useToast } from "../../components/Toast";
import { Sheet } from "../../components/Sheet";
import { Button } from "../../components/Button";
import { TextArea, TextInput } from "../../components/Field";
import { formatMinutes, parseDurationInput } from "../../lib/format";
import { useObjectives } from "../../hooks/useQueries";
import type { Doc } from "../../../convex/_generated/dataModel";

interface RegisterSheetProps {
  open: boolean;
  onClose: () => void;
  dayKey: string;
  preselectObjectiveId?: string | null;
  title?: string;
}

const QUICK = [15, 30, 45, 60];

export function RegisterSheet({
  open,
  onClose,
  dayKey,
  preselectObjectiveId,
  title = "Registrar atividade",
}: RegisterSheetProps) {
  const installationId = useInstallationId();
  const objectives = useObjectives();
  const addRecord = useMutation(api.records.add);
  const { toast } = useToast();

  const active = useMemo(
    () => (objectives ?? []).filter((o) => o.active),
    [objectives],
  );

  const [mode, setMode] = useState<"objective" | "free">("objective");
  const [objectiveId, setObjectiveId] = useState("");
  const [freeName, setFreeName] = useState("");
  const [durationRaw, setDurationRaw] = useState("");
  const [observation, setObservation] = useState("");
  const [keepOpen, setKeepOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ duration?: string; name?: string }>({});

  // Reset when the sheet opens (or a preselected objective changes). With no
  // active goals, start directly in the free-activity mode to save a tap.
  useEffect(() => {
    if (open) {
      setMode(preselectObjectiveId ? "objective" : active.length === 0 ? "free" : "objective");
      setObjectiveId(preselectObjectiveId ?? "");
      setFreeName("");
      setDurationRaw("");
      setObservation("");
      setErrors({});
      setSaving(false);
    }
  }, [open, preselectObjectiveId, active.length]);

  const selected = active.find((o) => o._id === objectiveId);
  const quickChips = useMemo(() => {
    const chips = new Set(QUICK);
    if (selected && selected.targetMinutes <= 240) chips.add(selected.targetMinutes);
    return [...chips].sort((a, b) => a - b);
  }, [selected]);

  function pickChip(min: number) {
    setDurationRaw(String(min));
    setErrors((e) => ({ ...e, duration: undefined }));
  }

  async function submit() {
    const minutes = parseDurationInput(durationRaw);
    const errs: typeof errors = {};
    if (minutes === null) errs.duration = "Informe um tempo válido (ex.: 45 ou 1h30).";
    if (mode === "free" && freeName.trim().length === 0) {
      errs.name = "Dê um nome à atividade.";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0 || minutes === null) return;

    setSaving(true);
    try {
      await addRecord({
        installationId,
        dayKey,
        minutes,
        objectiveId: mode === "objective" && objectiveId ? (objectiveId as never) : undefined,
        activityName: mode === "free" ? freeName.trim() : undefined,
        observation: observation.trim() || null,
      });
      const label = mode === "objective" ? selected?.name ?? freeName : freeName.trim();
      toast(`Registrado: ${label} · ${formatMinutes(minutes)}`);
      if (keepOpen) {
        setDurationRaw("");
        setObservation("");
        setErrors({});
      } else {
        onClose();
      }
    } catch {
      toast("Não foi possível salvar o registro. Tente novamente.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="field">
        <label className="field-label" htmlFor="reg-mode">
          Tipo de atividade
        </label>
        <div className="segmented" role="group" aria-label="Tipo de atividade">
          <button
            type="button"
            id="reg-mode"
            className="seg-btn"
            aria-pressed={mode === "objective"}
            onClick={() => {
              setMode("objective");
              setErrors((e) => ({ ...e, name: undefined }));
            }}
          >
            Objetivo
          </button>
          <button
            type="button"
            className="seg-btn"
            aria-pressed={mode === "free"}
            onClick={() => {
              setMode("free");
              setObjectiveId("");
            }}
          >
            Outra atividade
          </button>
        </div>
      </div>

      {mode === "objective" ? (
        <div className="field">
          <label className="field-label" htmlFor="reg-objective">
            Atividade <span className="req" aria-hidden>*</span>
          </label>
          <select
            id="reg-objective"
            className="field-control"
            value={objectiveId}
            onChange={(e) => setObjectiveId(e.target.value)}
            aria-label="Objetivo"
            data-autofocus
          >
            <option value="">Escolha um objetivo…</option>
            {active.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name} · {formatMinutes(o.targetMinutes)}/dia
              </option>
            ))}
          </select>
          {active.length === 0 && (
            <span className="field-hint">
              Nenhum objetivo ativo. Você pode registrar uma atividade livre.
            </span>
          )}
        </div>
      ) : (
        <TextInput
          label="Nome da atividade"
          required
          placeholder="Ex.: Caminhada, Leitura…"
          value={freeName}
          maxLength={60}
          onChange={(e) => setFreeName(e.target.value)}
          error={errors.name}
          data-autofocus
        />
      )}

      <div className="field">
        <TextInput
          label="Tempo realizado"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ex.: 45 ou 1h30"
          value={durationRaw}
          onChange={(e) => {
            setDurationRaw(e.target.value);
            setErrors((prev) => ({ ...prev, duration: undefined }));
          }}
          error={errors.duration}
          data-autofocus
        />
        <div className="chips" role="group" aria-label="Tempos rápidos">
          {quickChips.map((min) => (
            <button
              key={min}
              type="button"
              className="chip"
              aria-pressed={parseDurationInput(durationRaw) === min}
              onClick={() => pickChip(min)}
            >
              {min === selected?.targetMinutes ? `meta ${min}` : formatMinutes(min)}
            </button>
          ))}
        </div>
      </div>

      <TextArea
        label="Observação (opcional)"
        placeholder="Como foi? Algo relevante?"
        value={observation}
        maxLength={600}
        rows={2}
        onChange={(e) => setObservation(e.target.value)}
      />

      <label className="check-row">
        <input
          type="checkbox"
          checked={keepOpen}
          onChange={(e) => setKeepOpen(e.target.checked)}
        />
        <span>Continuar registrando (vários registros no dia)</span>
      </label>

      <div className="sheet-actions">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={submit} loading={saving} block>
          Registrar
        </Button>
      </div>
    </Sheet>
  );
}

export interface EditRecordSheetProps {
  record: Doc<"records"> | null;
  onClose: () => void;
}

/** Edit duration / observation of an existing record (same day). */
export function EditRecordSheet({ record, onClose }: EditRecordSheetProps) {
  const installationId = useInstallationId();
  const update = useMutation(api.records.update);
  const remove = useMutation(api.records.remove);
  const { toast } = useToast();

  const [minutesRaw, setMinutesRaw] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (record) {
      setMinutesRaw(record.minutes < 60 ? String(record.minutes) : formatMinutes(record.minutes));
      setObservation(record.observation ?? "");
      setError(undefined);
    }
  }, [record]);

  if (!record) return null;
  const rec: Doc<"records"> = record;

  async function save() {
    const minutes = parseDurationInput(minutesRaw);
    if (minutes === null) {
      setError("Informe um tempo válido (ex.: 45 ou 1h30).");
      return;
    }
    setSaving(true);
    try {
      await update({
        installationId,
        id: rec._id,
        minutes,
        observation: observation.trim() || null,
      });
      toast("Registro atualizado.");
      onClose();
    } catch {
      toast("Não foi possível atualizar.", "error");
      setSaving(false);
    }
  }

  async function doDelete() {
    setSaving(true);
    try {
      await remove({ installationId, id: rec._id });
      toast("Registro removido.");
      onClose();
    } catch {
      toast("Não foi possível remover.", "error");
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={`Editar: ${rec.activityName}`}>
      <div className="field">
        <TextInput
          label="Tempo realizado"
          required
          inputMode="numeric"
          value={minutesRaw}
          onChange={(e) => {
            setMinutesRaw(e.target.value);
            setError(undefined);
          }}
          error={error}
          data-autofocus
        />
      </div>
      <TextArea
        label="Observação (opcional)"
        value={observation}
        maxLength={600}
        rows={3}
        onChange={(e) => setObservation(e.target.value)}
      />
      <div className="sheet-actions">
        {confirmDelete ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={saving}>
              Manter
            </Button>
            <Button variant="danger" onClick={doDelete} loading={saving}>
              Confirmar exclusão
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
              Excluir
            </Button>
            <span className="sheet-actions-right">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={save} loading={saving}>
                Salvar
              </Button>
            </span>
          </>
        )}
      </div>
    </Sheet>
  );
}
