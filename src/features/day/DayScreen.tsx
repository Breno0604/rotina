/* One component powers both "Hoje" and the /dia/YYYY-MM-DD route:
   goals × realized, records, daily note, saved AI analysis + generation. */

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useInstallationId } from "../../app/installation";
import {
  useObjectives,
  useRecordsRange,
  useAnalyses,
  useMemories,
  useDayNote,
} from "../../hooks/useQueries";
import { navigate } from "../../lib/router";
import { formatDayLong, formatDayShort, formatRangeShort } from "../../lib/dates";
import { formatMinutes, percentOf } from "../../lib/format";
import { goalProgressForDay } from "../../lib/calculations";
import { GoalRow } from "../../components/GoalRow";
import { Button } from "../../components/Button";
import { EmptyState, ErrorState, InfoNote, LoadingState } from "../../components/StateViews";
import { ConfirmSheet } from "../../components/Sheet";
import { IconArrowLeft, IconTarget } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { RegisterSheet, EditRecordSheet } from "../records/RegisterSheet";
import { RecordList } from "../records/RecordList";
import { DayNoteEditor } from "./DayNoteEditor";
import { AiZone } from "../ai/AiZone";

interface DayScreenProps {
  dayKey: string;
  isToday: boolean;
}

export function DayScreen({ dayKey, isToday }: DayScreenProps) {
  const installationId = useInstallationId();
  const objectives = useObjectives();
  const dayRecords = useRecordsRange(dayKey, dayKey);
  const dayNote = useDayNote(dayKey);
  const analyses = useAnalyses();
  const memories = useMemories();
  const removeRecord = useMutation(api.records.remove);
  const { toast } = useToast();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"records"> | null>(null);
  const [deleting, setDeleting] = useState<Doc<"records"> | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const records = useMemo(() => dayRecords ?? [], [dayRecords]);
  const activeGoals = useMemo(
    () => (objectives ?? []).filter((o) => o.active),
    [objectives],
  );

  const rows = useMemo(
    () => (objectives ? goalProgressForDay(objectives, records, dayKey) : []),
    [objectives, records, dayKey],
  );

  const { totalActual, totalTarget, pct } = useMemo(() => {
    const actual = rows.reduce((a, r) => a + r.actualMinutes, 0);
    const target = rows.reduce((a, r) => a + (r.targetMinutes > 0 ? r.targetMinutes : 0), 0);
    return { totalActual: actual, totalTarget: target, pct: percentOf(actual, target) };
  }, [rows]);

  // "Registros do dia" counts every record logged that day, including off-goal ones.
  const totalLoggedMinutes = records.reduce((a, r) => a + r.minutes, 0);

  const offGoal = useMemo(
    () => records.filter((r) => r.objectiveId === null),
    [records],
  );

  const dayAnalyses = useMemo(
    () =>
      (analyses ?? []).filter(
        (a) => a.kind === "day" && a.periodStart === dayKey && a.periodEnd === dayKey,
      ),
    [analyses, dayKey],
  );

  const loading =
    objectives === undefined ||
    dayRecords === undefined ||
    dayNote === undefined ||
    analyses === undefined ||
    memories === undefined;

  if (loading) return <LoadingState label="Carregando o dia…" />;
  // `dayNote` is null when the day simply has no note — that's a valid
  // state (empty note), not a loading failure.
  if (objectives === null || dayRecords === null) {
    return <ErrorState message="Não foi possível carregar os dados deste dia." />;
  }

  // Only the day's free note reaches the AI context (records carry their own).
  const dayNotes = dayNote && dayNote.note.trim().length > 0 ? [dayNote] : [];

  async function confirmDeleteRecord() {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await removeRecord({ installationId, id: deleting._id });
      toast("Registro removido.");
      setDeleting(null);
    } catch {
      toast("Não foi possível remover o registro.", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  const pageTitle = isToday ? "Hoje" : formatDayShort(dayKey);
  const subtitle = isToday ? formatDayLong(dayKey) : formatRangeShort(dayKey, dayKey);

  return (
    <>
      {!isToday && (
        <div className="back-row">
          <Button
            variant="ghost"
            size="sm"
            icon={<IconArrowLeft size={16} />}
            onClick={() => navigate("/historico")}
          >
            Histórico
          </Button>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-sub">
            {subtitle}
            {activeGoals.length > 0 && totalTarget > 0 && (
              <span className="day-summary-sentence">
                {" "}
                · {formatMinutes(totalActual)} de {formatMinutes(totalTarget)} (
                {pct === null ? "—" : `${pct}%`})
              </span>
            )}
          </p>
        </div>
      </div>

      {!isToday && <DayNoteEditor dayKey={dayKey} />}

      <section className="section" aria-labelledby="day-goals-title">
        <div className="section-head">
          <h2 className="section-title" id="day-goals-title">
            Objetivos × realizado
          </h2>
        </div>
        {activeGoals.length === 0 && (objectives ?? []).length === 0 ? (
          <EmptyState
            icon={<IconTarget size={24} />}
            title="Comece definindo um objetivo"
            body="Um objetivo é algo como “Inglês — 60 min/dia”. Você também pode registrar atividades livres."
            action={
              <Button variant="primary" onClick={() => navigate("/objetivos")}>
                Criar objetivo
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <p className="t-sm t-muted">Nenhum objetivo ativo para este dia.</p>
        ) : (
          <div className="list">
            {rows.map((r) => (
              <div className="card goal-card" key={r.objectiveId}>
                <GoalRow
                  name={r.name}
                  actualMinutes={r.actualMinutes}
                  targetMinutes={r.targetMinutes}
                  pct={r.pct}
                  extra={
                    r.recordCount > 0 && r.actualMinutes > 0 ? (
                      <span className="badge">{r.recordCount} registro{r.recordCount > 1 ? "s" : ""}</span>
                    ) : r.actualMinutes === 0 ? (
                      <span className="badge">sem registro</span>
                    ) : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {isToday && <DayNoteEditor dayKey={dayKey} />}

      <section className="section" aria-labelledby="day-records-title">
        <div className="section-head">
          <h2 className="section-title" id="day-records-title">
            Registros do dia
          </h2>
          <span className="t-sm t-muted t-num">
            {records.length === 0 ? "" : `${formatMinutes(totalLoggedMinutes)} total`}
          </span>
        </div>
        {offGoal.length > 0 && records.length === offGoal.length && (
          <InfoNote tone="accent">
            Estes registros estão fora dos objetivos — aparecem separados nos relatórios.
          </InfoNote>
        )}
        <RecordList
          records={records}
          onEdit={(r) => setEditing(r)}
          onDelete={(r) => setDeleting(r)}
          emptyHint={
            isToday
              ? "Nada registrado ainda. Toque em “Registrar” para contar o que você fez."
              : "Nenhum registro neste dia."
          }
        />
      </section>

      <AiZone
        kind="day"
        from={dayKey}
        to={dayKey}
        periodLabel={isToday ? "Hoje" : formatDayShort(dayKey)}
        objectives={objectives ?? []}
        records={records}
        memories={memories ?? []}
        notes={dayNotes}
        savedAnalyses={dayAnalyses}
        triggerLabel="Gerar análise do dia"
      />

      <RegisterSheet
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        dayKey={dayKey}
      />
      {editing && <EditRecordSheet record={editing} onClose={() => setEditing(null)} />}
      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDeleteRecord}
        title="Excluir registro"
        confirmLabel="Excluir"
        danger
        loading={busyDelete}
        message={
          <>
            Excluir o registro de <strong>{deleting?.activityName}</strong> ({deleting ? formatMinutes(deleting.minutes) : ""})?
          </>
        }
      />
    </>
  );
}
