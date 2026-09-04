import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  CHAT_KEY,
  AI_ERROR_MESSAGES,
  memoryCategoryLabel,
  type MemoryCandidate,
} from "../../types/domain";
import { useInstallationId } from "../../app/installation";
import { usePrefs } from "../../app/prefs";
import {
  useObjectives,
  useRecordsRange,
  useDayNote,
  useMemories,
} from "../../hooks/useQueries";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { EmptyState, InfoNote, LoadingState } from "../../components/StateViews";
import { ConfirmSheet } from "../../components/Sheet";
import { IconBot, IconCheck, IconSend, IconSparkle, IconTrash } from "../../components/Icon";
import { todayKey } from "../../lib/dates";
import { computePeriodStats, buildDataSummary } from "../../lib/calculations";
import {
  buildMemoryContext,
  buildObservationsContext,
  systemChatPrompt,
  type MemoryLine,
} from "../../services/ai/prompts";
import { runChat } from "../../services/ai/service";

interface StoredMsg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface ChatMsg extends StoredMsg {
  offer?: MemoryCandidate;
}

function loadHistory(): StoredMsg[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredMsg[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .slice(-20);
  } catch {
    return [];
  }
}

export function AssistantScreen() {
  const installationId = useInstallationId();
  const { prefs } = usePrefs();
  const { toast } = useToast();
  const objectives = useObjectives();
  const todayRecords = useRecordsRange(todayKey(), todayKey());
  const todayNote = useDayNote(todayKey());
  const memories = useMemories();
  const createMemory = useMutation(api.memories.createDeclared);

  const [messages, setMessages] = useState<ChatMsg[]>(loadHistory);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [handledOfferTs, setHandledOfferTs] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_KEY,
        JSON.stringify(messages.slice(-20).map(({ role, content, ts }) => ({ role, content, ts }))),
      );
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  const system = useMemo(() => {
    if (!memories || !objectives || !todayRecords || todayNote === undefined) return null;
    const lines: MemoryLine[] = memories.map((m) => ({
      content: m.content,
      source: m.source,
      confidence: m.confidence,
      state: m.state,
      pinned: m.pinned,
    }));
    const stats = computePeriodStats(objectives, todayRecords, todayKey(), todayKey());
    const summary = JSON.stringify(buildDataSummary(stats));
    const ctx = buildMemoryContext(lines);
    const observations = buildObservationsContext([
      {
        dayKey: todayKey(),
        note: todayNote?.note ?? "",
        records: todayRecords,
      },
    ]);
    return `${systemChatPrompt(ctx)}\n\n## Hoje (dados consolidados)\n${summary}${
      observations ? `\n\n${observations}` : ""
    }`;
  }, [memories, objectives, todayRecords, todayNote]);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const pendingOffer: { ts: number; candidate: MemoryCandidate } | null =
    lastAssistant && lastAssistant.offer
      ? { ts: lastAssistant.ts, candidate: lastAssistant.offer }
      : null;
  const showOffer = pendingOffer !== null && handledOfferTs !== pendingOffer.ts;

  if (!system) return <LoadingState label="Preparando assistente…" />;
  const systemText: string = system;

  function pushUser(text: string) {
    setMessages((prev) => [...prev, { role: "user", content: text, ts: Date.now() }]);
  }

  async function send(rawText?: string) {
    const content = (rawText ?? draft).trim();
    if (!content || sending) return;
    setDraft("");
    setErrorCode(null);
    pushUser(content);
    setSending(true);
    const userTs = Date.now();
    try {
      const result = await runChat({
        model: prefs.model,
        system: systemText,
        history: messages.map(({ role, content: c }) => ({ role, content: c })),
        userMessage: content,
      });
      if (result.ok) {
        const assistantMsg: ChatMsg = {
          role: "assistant",
          content: result.data.resposta,
          ts: Date.now(),
          ...(result.data.memoriaSugerida
            ? { offer: result.data.memoriaSugerida }
            : {}),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setErrorCode(result.code);
        setMessages((prev) => prev.filter((m) => !(m.role === "user" && m.ts === userTs)));
        setDraft(content);
      }
    } catch {
      setErrorCode("unknown");
      setMessages((prev) => prev.filter((m) => !(m.role === "user" && m.ts === userTs)));
      setDraft(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function saveOffer(candidate: MemoryCandidate, offerTs: number) {
    setSavingOffer(true);
    try {
      await createMemory({
        installationId,
        content: candidate.conteudo,
        category: candidate.categoria,
      });
      toast("Memória salva no seu contexto pessoal.");
      setHandledOfferTs(offerTs);
    } catch {
      toast("Não foi possível salvar a memória.", "error");
    } finally {
      setSavingOffer(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Assistente</h1>
          <p className="page-sub">
            Converse livremente — a IA pode sugerir guardar aprendizados no seu contexto.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            className="btn-icon"
            aria-label="Limpar conversa"
            onClick={() => setClearing(true)}
          >
            <IconTrash size={18} />
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={<IconBot size={24} />}
          title="Como foi o seu dia?"
          body={
            <>
              Escreva algo como: <em>“Hoje não consegui programar porque estava muito cansado.”</em>{" "}
              ou <em>“Percebi que rendo melhor logo pela manhã.”</em>
            </>
          }
        />
      ) : (
        <div
          className="chat-log"
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label="Conversa com o assistente"
        >
          {messages.map((m) => (
            <div key={m.ts} className={`msg msg-${m.role}`}>
              {m.role === "assistant" && (
                <span className="msg-role">
                  <IconSparkle size={13} aria-hidden /> Assistente
                </span>
              )}
              <p className="msg-text">{m.content}</p>
              {m.role === "assistant" &&
                showOffer &&
                pendingOffer?.ts === m.ts &&
                m.offer && (
                  <div className="offer-card">
                    <p className="t-sm t-strong">
                      Isso parece relevante para o seu contexto pessoal. Deseja guardar?
                    </p>
                    <p className="t-sm">“{m.offer.conteudo}”</p>
                    <span className="badge">{memoryCategoryLabel(m.offer.categoria)}</span>
                    <div className="offer-actions">
                      <Button variant="ghost" size="sm" onClick={() => setHandledOfferTs(m.ts)}>
                        Não, obrigado
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<IconCheck size={15} />}
                        loading={savingOffer}
                        onClick={() => saveOffer(m.offer as MemoryCandidate, m.ts)}
                      >
                        Guardar no contexto
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          ))}
          {sending && (
            <div className="msg msg-assistant">
              <span className="msg-role">
                <IconSparkle size={13} aria-hidden /> Assistente
              </span>
              <p className="msg-text msg-typing">
                <span className="spinner" aria-hidden />
                <span className="sr-only">Assistente respondendo</span>
              </p>
            </div>
          )}
          {errorCode && (
            <InfoNote tone="warn">
              {AI_ERROR_MESSAGES[errorCode as keyof typeof AI_ERROR_MESSAGES] ?? AI_ERROR_MESSAGES.unknown}
              <Button variant="secondary" size="sm" style={{ marginTop: 8 }} onClick={() => send()}>
                Tentar novamente
              </Button>
            </InfoNote>
          )}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          className="field-control composer-input"
          type="text"
          value={draft}
          maxLength={1000}
          placeholder="Escreva uma mensagem…"
          aria-label="Mensagem para o assistente"
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
        />
        <Button
          type="submit"
          variant="accent"
          className="btn-icon"
          aria-label="Enviar mensagem"
          disabled={draft.trim().length === 0 || sending}
          loading={sending}
        >
          {!sending && <IconSend size={18} />}
        </Button>
      </form>

      <ConfirmSheet
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={() => {
          setMessages([]);
          setHandledOfferTs(null);
          setClearing(false);
        }}
        title="Limpar conversa"
        confirmLabel="Limpar"
        danger
        message="O histórico desta conversa será apagado neste aparelho. As memórias salvas permanecem."
      />
    </>
  );
}
