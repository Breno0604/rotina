/* Loading / empty / error / info state views. */

import type { ReactNode } from "react";
import { Button } from "./Button";
import { IconAlert, IconInfo } from "./Icon";

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="skel-list" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel-row">
          <span className="skel skel-line" style={{ width: "55%" }} />
          <span className="skel skel-line" style={{ width: "25%" }} />
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="state-box" role="status">
      <span className="spinner" aria-hidden />
      <p className="t-sm t-muted">{label ?? "Carregando…"}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="state-box">
      {icon && <span className="state-icon" aria-hidden>{icon}</span>}
      <h3>{title}</h3>
      {body && <p className="t-sm t-muted">{body}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-box" role="alert">
      <span className="state-icon">
        <IconAlert size={24} />
      </span>
      <h3>{title}</h3>
      {message && <p className="t-sm t-muted">{message}</p>}
      {onRetry && (
        <div className="state-action">
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}

export function InfoNote({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warn" | "accent";
}) {
  return (
    <div className={`info-note${tone !== "default" ? ` info-note-${tone}` : ""}`}>
      {tone === "warn" ? (
        <IconAlert size={16} aria-hidden />
      ) : (
        <IconInfo size={16} aria-hidden />
      )}
      <p className="t-sm">{children}</p>
    </div>
  );
}
