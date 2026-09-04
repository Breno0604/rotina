import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { IconAlert } from "./Icon";

interface FieldShellProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  htmlFor: string;
  children: ReactNode;
}

function FieldShell({ label, required, hint, error, htmlFor, children }: FieldShellProps) {
  return (
    <div className="field" data-invalid={error ? "true" : "false"}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <span className="field-error" id={`${htmlFor}-error`} role="alert">
          <IconAlert size={15} />
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint" id={`${htmlFor}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export interface TextInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ label, hint, error, id, required, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy =
      error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
    return (
      <FieldShell label={label} required={required} hint={hint} error={error} htmlFor={inputId}>
        <input
          ref={ref}
          id={inputId}
          className="field-control"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, hint, error, id, required, rows = 3, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy =
      error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
    return (
      <FieldShell label={label} required={required} hint={hint} error={error} htmlFor={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className="field-control"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, hint, error, id, required, children, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy =
      error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
    return (
      <FieldShell label={label} required={required} hint={hint} error={error} htmlFor={inputId}>
        <select
          ref={ref}
          id={inputId}
          className="field-control"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
      </FieldShell>
    );
  },
);
