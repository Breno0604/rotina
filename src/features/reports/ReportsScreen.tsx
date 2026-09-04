import { useMemo, useState } from "react";
import {
  useObjectives,
  useRecordsRange,
  useNotesRange,
  useAnalyses,
  useMemories,
} from "../../hooks/useQueries";
import {
  addDays,
  eachDay,
  endOfMonth,
  endOfWeek,
  formatDayShort,
  formatMonthLabel,
  formatRangeShort,
  startOfMonth,
  startOfWeek,
  todayKey,
} from "../../lib/dates";
import { formatMinutes } from "../../lib/format";
import {
  computePeriodStats,
  comparePeriods,
  consistencyRanking,
  type PeriodStats,
} from "../../lib/calculations";
import { Button } from "../../components/Button";
import { ErrorState, LoadingState, InfoNote } from "../../components/StateViews";
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight } from "../../components/Icon";
import type { AnalysisKind } from "../../types/domain";
import { AiZone } from "../ai/AiZone";

type Filter = "today" | "week" | "month" | "custom";

interface DayRange {
  from: string;
  to: string;
}

function lengthOf(r: DayRange): number {
  return eachDay(r.from, r.to).length;
}

function previousOf(r: DayRange): DayRange {
  const len = lengthOf(r);
  const to = addDays(r.from, -1);
  return { from: addDays(to, -(len - 1)), to };
}

export function ReportsScreen() {
  const [filter, setFilter] = useState<Filter>("today");
  const [anchor, setAnchor] = useState<string>(todayKey());
  const [customFrom, setCustomFrom] = useState<string>(addDays(todayKey(), -6));
  const [customTo, setCustomTo] = useState<string>(todayKey());

  const objectives = useObjectives();
  const analyses = useAnalyses();
  const memories = useMemories();

  const current: DayRange = useMemo(() => {
    if (filter === "today") return { from: todayKey(), to: todayKey() };
    if (filter === "week") return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
    if (filter === "month") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    const [a, b] = [customFrom, customTo].sort();
    return { from: a, to: b };
  }, [filter, anchor, customFrom, customTo]);

  const previous = useMemo(() => previousOf(current), [current]);
  const fetchFrom = previous.from;
  const fetchTo = current.to;

  const records = useRecordsRange(fetchFrom, fetchTo);
  const notes = useNotesRange(current.from, current.to);

  const { currStats, prevStats } = useMemo(() => {
    const emptyPrev: PeriodStats = {
      from: previous.from, to: previous.to, dayCount: lengthOf(previous),
      daysWithAnyRecord: 0, targetMinutes: 0, actualMinutes: 0, pct: null,
      perObjective: [], offGoal: [], series: [], totalRecords: 0,
    };
    if (!records) return { currStats: null, prevStats: emptyPrev };
    const cur = computePeriodStats(objectives ?? [], records, current.from, current.to);
    const prev = computePeriodStats(objectives ?? [], records, previous.from, previous.to);
    return { currStats: cur, prevStats: prev };
  }, [records, objectives, current, previous]);

  const diffs = useMemo(
    () => (currStats ? comparePeriods(prevStats, currStats) : []),
    [currStats, prevStats],
  );

  const ranking = useMemo(() => {
    if (!currStats) return null;
    return consistencyRanking(currStats).filter((r) => r.activeDays >= 3);
  }, [currStats]);

  const zoneKind: AnalysisKind =
    filter === "today" ? "day" : filter === "custom" ? "custom" : filter;
  const zoneLabel =
    filter === "today"
      ? `Hoje · ${formatDayShort(current.from)}`
      : filter === "week"
        ? `Semana ${formatRangeShort(current.from, current.to)}`
        : filter === "month"
          ? formatMonthLabel(current.from)
          : formatRangeShort(current.from, current.to);

  const savedForRange = useMemo(
    () =>
      (analyses ?? []).filter(
        (a) =>
          a.kind === zoneKind && a.periodStart === current.from && a.periodEnd === current.to,
      ),
    [analyses, zoneKind, current],
  );

  if (
    objectives === undefined ||
    records === undefined ||
    notes === undefined ||
    analyses === undefined ||
    memories === undefined
  ) {
    return <LoadingState label="Calculando relatórios…" />;
  }
  if (objectives === null || records === null || notes === null) {
    return <ErrorState message="Não foi possível carregar os dados." />;
  }
  if (!currStats) return null;

  const canShift = filter === "week" || filter === "month";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-sub">Objetivo × realizado, evolução e consistência.</p>
        </div>
      </div>

      <div className="segmented" role="group" aria-label="Período do relatório">
        {(
          [
            ["today", "Hoje"],
            ["week", "Semana"],
            ["month", "Mês"],
            ["custom", "Período"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="seg-btn"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="range-bar">
        {filter === "custom" ? (
          <div className="range-custom">
            <label className="t-xs t-muted" htmlFor="rep-from">
              De
            </label>
            <input
              id="rep-from"
              type="date"
              className="field-control"
              value={customFrom}
              max={customTo}
              onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
            />
            <label className="t-xs t-muted" htmlFor="rep-to">
              Até
            </label>
            <input
              id="rep-to"
              type="date"
              className="field-control"
              value={customTo}
              min={customFrom}
              max={todayKey()}
              onChange={(e) => e.target.value && setCustomTo(e.target.value)}
            />
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              className="btn-icon"
              aria-label="Período anterior"
              disabled={!canShift}
              onClick={() => setAnchor((a) => (filter === "week" ? addDays(startOfWeek(a), -7) : addDays(startOfMonth(a), -1)))}
            >
              <IconChevronLeft size={18} />
            </Button>
            <span className="t-strong">{zoneLabel}</span>
            <Button
              variant="ghost"
              className="btn-icon"
              aria-label="Próximo período"
              disabled={!canShift}
              onClick={() => setAnchor((a) => (filter === "week" ? addDays(endOfWeek(a), 1) : addDays(endOfMonth(a), 1)))}
            >
              <IconChevronRight size={18} />
            </Button>
            {filter !== "today" && (filter === "week" ? !(todayKey() >= current.from && todayKey() <= current.to) : anchor.slice(0, 7) !== todayKey().slice(0, 7)) && (
              <Button variant="secondary" size="sm" onClick={() => { setAnchor(todayKey()); setFilter("today"); }}>
                Hoje
              </Button>
            )}
          </>
        )}
      </div>

      <StatGrid currStats={currStats} />

      {currStats.perObjective.length > 0 ? (
        <section className="section" aria-labelledby="rep-goals-title">
          <h2 className="section-title" id="rep-goals-title">
            Por objetivo
          </h2>
          <div className="list">
            {currStats.perObjective.map((s) => {
              const diff = diffs.find((d) => d.objectiveId === s.objectiveId);
              return (
                <div className="card goal-card" key={s.objectiveId}>
                  <div className="goal-top">
                    <span className="goal-name t-strong">{s.name}</span>
                    <span className="goal-right t-num t-strong">{s.pct === null ? "—" : `${s.pct}%`}</span>
                  </div>
                  <p className="t-sm t-muted t-num">
                    {formatMinutes(s.actualMinutes)} de {formatMinutes(s.targetMinutes)} no período
                  </p>
                  {diff && (diff.diffPoints !== null || diff.prevPct !== null) && (
                    <span className="rep-diff t-sm t-num">
                      {diff.prevPct === null ? (
                        "novo neste período"
                      ) : diff.diffPoints === null ? (
                        `período anterior: ${diff.prevPct}%`
                      ) : diff.diffPoints === 0 ? (
                        `igual ao período anterior (${diff.prevPct}%)`
                      ) : (
                        <>
                          {diff.diffPoints > 0 ? (
                            <IconArrowUp size={13} aria-hidden />
                          ) : (
                            <IconArrowDown size={13} aria-hidden />
                          )}
                          {diff.diffPoints > 0 ? "+" : ""}
                          {diff.diffPoints} pp vs {diff.prevPct}% do período anterior
                        </>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <InfoNote>
          Sem objetivos ativos neste período — registros fora dos objetivos aparecem abaixo.
        </InfoNote>
      )}

      {ranking && ranking.length >= 2 && (
        <section className="section" aria-labelledby="rep-consistency-title">
          <h2 className="section-title" id="rep-consistency-title">
            Consistência
          </h2>
          <ConsistencyPanel ranking={ranking} />
        </section>
      )}

      {currStats.offGoal.length > 0 && (
        <section className="section" aria-labelledby="rep-offgoal-title">
          <div className="section-head">
            <h2 className="section-title" id="rep-offgoal-title">
              Fora dos objetivos
            </h2>
            <span className="t-sm t-muted t-num">
              {formatMinutes(currStats.offGoal.reduce((a, o) => a + o.minutes, 0))} total
            </span>
          </div>
          <div className="list">
            {currStats.offGoal.map((o) => (
              <div className="row offgoal-row" key={o.key}>
                <span className="record-name">{o.activityName}</span>
                <span className="t-num t-sm t-muted">
                  {formatMinutes(o.minutes)} · {o.count} registro{o.count > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <TrendSection stats={currStats} />

      <AiZone
        kind={zoneKind}
        from={current.from}
        to={current.to}
        periodLabel={zoneLabel}
        objectives={objectives}
        records={records.filter((r) => r.dayKey >= current.from && r.dayKey <= current.to)}
        memories={memories ?? []}
        notes={notes}
        savedAnalyses={savedForRange}
        triggerLabel={filter === "today" ? "Gerar avaliação do dia" : "Gerar avaliação do período"}
      />
    </>
  );
}

function StatGrid({ currStats }: { currStats: PeriodStats }) {
  const stats = [
    { label: "Objetivo", value: formatMinutes(currStats.targetMinutes) },
    { label: "Realizado", value: formatMinutes(currStats.actualMinutes) },
    { label: "Realização", value: currStats.pct === null ? "—" : `${currStats.pct}%`, big: true },
    { label: "Dias com registro", value: `${currStats.daysWithAnyRecord}/${currStats.dayCount}` },
  ];
  return (
    <div className="stat-grid" role="group" aria-label="Resumo do período">
      {stats.map((s) => (
        <div className="stat-box card" key={s.label}>
          <span className="stat-label t-xs">{s.label}</span>
          <span className={`stat-value t-num${s.big ? " stat-big" : ""}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function ConsistencyPanel({ ranking }: { ranking: ReturnType<typeof consistencyRanking> }) {
  const top = ranking.slice(0, 3);
  const bottom = [...ranking].reverse().slice(0, 3);
  return (
    <div className="consistency-cols">
      <div>
        <h3 className="t-sm t-strong" style={{ marginBottom: 6 }}>
          Mais consistentes
        </h3>
        {top.map((r) => (
          <div className="cons-row" key={r.objectiveId}>
            <span>{r.name}</span>
            <span className="t-num">{r.consistency === null ? "—" : `${r.consistency}%`}</span>
          </div>
        ))}
      </div>
      <div>
        <h3 className="t-sm t-strong" style={{ marginBottom: 6 }}>
          Menos consistentes
        </h3>
        {bottom.map((r) => (
          <div className="cons-row" key={r.objectiveId}>
            <span>{r.name}</span>
            <span className="t-num">{r.consistency === null ? "—" : `${r.consistency}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendSection({ stats }: { stats: PeriodStats }) {
  const points = stats.series
    .map((s) => ({ day: s.day, pct: s.pct }))
    .filter((p): p is { day: string; pct: number } => p.pct !== null);

  if (points.length < 4) {
    return (
      <section className="section">
        <h2 className="section-title">Evolução</h2>
        <p className="t-sm t-muted">
          {points.length === 0
            ? "Sem dados suficientes para mostrar a evolução diária."
            : "Dados ainda insuficientes para um gráfico de evolução (precisa de ao menos 4 dias com registros)."}
        </p>
      </section>
    );
  }

  const maxPct = Math.max(100, ...points.map((p) => p.pct));
  const W = 100;
  const H = 36;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - (Math.min(v, maxPct) / maxPct) * (H - 4) - 2;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.pct).toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const avg = Math.round(points.reduce((a, p) => a + p.pct, 0) / points.length);

  return (
    <section className="section" aria-labelledby="rep-trend-title">
      <div className="section-head">
        <h2 className="section-title" id="rep-trend-title">
          Evolução diária
        </h2>
        <span className="t-sm t-muted t-num">média {avg}%</span>
      </div>
      <div className="card trend-card">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="trend-svg"
          role="img"
          aria-label={`Percentual diário de realização: ${points.map((p) => `${p.day}: ${p.pct}%`).join(", ")}`}
        >
          <path d={area} className="trend-area" />
          <path d={line} className="trend-line" />
          {points.map((p, i) => (
            <circle key={p.day} cx={x(i)} cy={y(p.pct)} r="1.1" className="trend-dot" />
          ))}
        </svg>
        <div className="trend-labels">
          <span className="t-xs t-muted">{formatDayShort(points[0].day)}</span>
          <span className="t-xs t-muted">{formatDayShort(points[points.length - 1].day)}</span>
        </div>
      </div>
    </section>
  );
}
