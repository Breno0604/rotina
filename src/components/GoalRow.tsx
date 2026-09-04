/* Progress bar + goal row — the "performance vs target" display used on the
   day screen and reports. Number + target text always accompany the bar
   (color is never the only signal). */

import { useId } from "react";
import { formatMinutes } from "../lib/format";

interface ProgressBarProps {
  /** percent 0..N (may exceed 100) */
  value: number | null;
  label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const id = useId();
  if (value === null) {
    return <div className="progress" role="img" aria-label={`${label}: sem meta definida`} />;
  }
  const shown = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-labelledby={id}
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span id={id} className="sr-only">
        {label}
      </span>
      <div
        className="progress-fill"
        data-over={value > 100 ? "true" : "false"}
        style={{ width: `${shown}%` }}
      />
    </div>
  );
}

export interface GoalRowProps {
  name: string;
  actualMinutes: number;
  targetMinutes: number;
  /** integer percent or null (no target) */
  pct: number | null;
  /** extra content under the row (records, badges) */
  extra?: React.ReactNode;
  /** right-side meta replacing the default pct when provided */
  right?: React.ReactNode;
}

/** Bullet-style row: name · actual/target · progress bar · percent. */
export function GoalRow({ name, actualMinutes, targetMinutes, pct, extra, right }: GoalRowProps) {
  const reached = pct !== null && pct >= 100;
  return (
    <div className="goal-row">
      <div className="goal-top">
        <span className="goal-name t-strong">{name}</span>
        <span className="goal-right">
          {right ?? (
            <span className={`goal-pct t-num${pct === null ? " t-muted" : ""}`}>
              {pct === null ? "—" : `${pct}%`}
            </span>
          )}
        </span>
      </div>
      <div className="goal-mid">
        <span className="goal-min t-num t-sm t-muted">
          {formatMinutes(actualMinutes)}
          <span className="goal-sep"> / </span>
          {targetMinutes > 0 ? formatMinutes(targetMinutes) : "sem meta"}
          {reached && (
            <span className="badge badge-primary goal-ok" aria-hidden>
              ok
            </span>
          )}
        </span>
      </div>
      {targetMinutes > 0 && (
        <ProgressBar
          value={pct}
          label={`${name}: ${formatMinutes(actualMinutes)} de ${formatMinutes(targetMinutes)} (${pct ?? "—"}%)`}
        />
      )}
      {extra && <div className="goal-extra">{extra}</div>}
    </div>
  );
}
