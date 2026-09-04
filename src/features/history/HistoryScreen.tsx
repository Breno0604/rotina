import { useMemo, useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useObjectives, useRecordsRange, useNotesRange } from "../../hooks/useQueries";
import { navigate } from "../../lib/router";
import {
  addDays,
  eachDay,
  endOfMonth,
  formatDayShort,
  formatMonthLabel,
  startOfMonth,
  todayKey,
} from "../../lib/dates";
import { formatMinutes, percentOf } from "../../lib/format";
import { goalProgressForDay, sumMinutes } from "../../lib/calculations";
import { Button } from "../../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "../../components/Icon";

export function HistoryScreen() {
  const [anchor, setAnchor] = useState<string>(todayKey());
  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);

  const objectives = useObjectives();
  const records = useRecordsRange(from, to);
  const notes = useNotesRange(from, to);

  const days = useMemo(() => {
    if (!records || !notes) return null;
    const notesByDay = new Map(notes.map((n) => [n.dayKey, n]));
    const out: {
      dayKey: string;
      records: Doc<"records">[];
      note: string;
      pct: number | null;
      actual: number;
      target: number;
    }[] = [];
    for (const day of eachDay(from, to)) {
      const dayRecs = records.filter((r) => r.dayKey === day);
      const note = notesByDay.get(day)?.note ?? "";
      if (dayRecs.length === 0 && !note) continue;
      const rows = objectives ? goalProgressForDay(objectives, dayRecs, day) : [];
      // Minutes shown = everything logged that day (incl. off-goal). The % badge
      // measures goal conformance only — off-goal time never inflates it.
      const actual = sumMinutes(dayRecs);
      const goalActual = rows.reduce((a, r) => a + r.actualMinutes, 0);
      const target = rows.reduce((a, r) => a + (r.targetMinutes > 0 ? r.targetMinutes : 0), 0);
      out.push({
        dayKey: day,
        records: dayRecs,
        note,
        actual,
        target,
        pct: percentOf(goalActual, target),
      });
    }
    return out.reverse(); // newest first
  }, [records, notes, objectives, from, to]);

  if (objectives === undefined || records === undefined || notes === undefined) {
    return <LoadingState label="Carregando histórico…" />;
  }
  if (objectives === null || records === null) {
    return <ErrorState message="Não foi possível carregar o histórico." />;
  }

  const isCurrentMonth = anchor.slice(0, 7) === todayKey().slice(0, 7);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Histórico</h1>
          <p className="page-sub">Dias com registros ou observações.</p>
        </div>
      </div>

      <div className="month-nav" role="group" aria-label="Navegar entre meses">
        <Button
          variant="ghost"
          className="btn-icon"
          aria-label="Mês anterior"
          onClick={() => setAnchor((a) => addDays(startOfMonth(a), -1))}
        >
          <IconChevronLeft size={18} />
        </Button>
        <span className="t-h2 t-num" aria-live="polite">
          {formatMonthLabel(anchor)}
        </span>
        <Button
          variant="ghost"
          className="btn-icon"
          aria-label="Próximo mês"
          onClick={() => setAnchor((a) => addDays(endOfMonth(a), 1))}
        >
          <IconChevronRight size={18} />
        </Button>
        {!isCurrentMonth && (
          <Button variant="secondary" size="sm" onClick={() => setAnchor(todayKey())}>
            Hoje
          </Button>
        )}
      </div>

      {days === null || days.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={24} />}
          title="Nenhum dia com registros"
          body={`Sem registros ou observações em ${formatMonthLabel(anchor).toLowerCase()}.`}
        />
      ) : (
        <div className="list history-list">
          {days.map((d) => (
            <button
              key={d.dayKey}
              type="button"
              className="row day-row"
              onClick={() => navigate(`/dia/${d.dayKey}`)}
            >
              <div className="day-row-main">
                <span className="t-strong">{formatDayShort(d.dayKey)}</span>
                {d.note && <span className="day-note-preview t-sm t-muted">{d.note}</span>}
              </div>
              <div className="day-row-meta">
                <span className="t-num t-sm t-muted">
                  {d.records.length > 0 ? `${formatMinutes(d.actual)}` : "—"}
                </span>
                {d.pct !== null && d.target > 0 && (
                  <span className={`badge${d.pct >= 100 ? " badge-primary" : ""}`}>
                    {d.pct}%
                  </span>
                )}
                <IconChevronRight size={16} className="row-chevron" />
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
