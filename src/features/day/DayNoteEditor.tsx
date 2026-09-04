/* Daily observation (§7) — optional free text, saved automatically with a
   debounce. Feedback state is always visible (saving / saved). */

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useInstallationId } from "../../app/installation";
import { useDayNote } from "../../hooks/useQueries";
import { IconCheck } from "../../components/Icon";

type SaveStatus = "idle" | "saving" | "saved";

export function DayNoteEditor({ dayKey }: { dayKey: string }) {
  const installationId = useInstallationId();
  const note = useDayNote(dayKey);
  const setNote = useMutation(api.dailyNotes.set);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<number | null>(null);
  const initialised = useRef(false);
  /** last loaded note content — source of truth for "did the user change it?" */
  const loadedRef = useRef("");

  // The component survives route changes between days, so when the day
  // changes we must discard the previous day's text (and any pending save)
  // instead of leaking it into the new day.
  useEffect(() => {
    initialised.current = false;
    setText("");
    setStatus("idle");
  }, [dayKey]);

  // Load the day's note when data arrives.
  useEffect(() => {
    if (note === undefined) return; // still loading
    loadedRef.current = note?.note ?? "";
    if (!initialised.current) {
      initialised.current = true;
      setText(loadedRef.current);
    }
  }, [note, dayKey]);

  // Debounced autosave on change (after initial load). Saving only when the
  // text actually differs from what's stored avoids rewriting the same value
  // and creating empty note rows for days the user never touched.
  useEffect(() => {
    if (!initialised.current) return;
    if (text === loadedRef.current) {
      setStatus("idle");
      return;
    }
    setStatus("saving");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        await setNote({ installationId, dayKey, note: text });
        loadedRef.current = text;
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 700);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dayKey]);

  const statusLabel =
    status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : "";

  return (
    <div className="note-box">
      <div className="note-head">
        <label className="section-title" htmlFor={`note-${dayKey}`}>
          Observação do dia
        </label>
        <span className="note-status t-xs t-muted" aria-live="polite">
          {status === "saved" && <IconCheck size={12} aria-hidden />}
          {statusLabel}
        </span>
      </div>
      <textarea
        id={`note-${dayKey}`}
        className="field-control"
        rows={2}
        placeholder="Como foi o seu dia? (opcional)"
        value={text}
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
