import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AI_ERROR_MESSAGES, GROQ_MODELS, APP_NAME, PALETTES } from "../../types/domain";
import { useInstallationId } from "../../app/installation";
import { usePrefs, type ThemePref } from "../../app/prefs";
import { useHasKey } from "../../hooks/useHasKey";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { ConfirmSheet } from "../../components/Sheet";
import { Select } from "../../components/Field";
import {
  IconCheck,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconInfo,
  IconKey,
  IconMoon,
  IconSun,
  IconTrash,
  IconUpload,
} from "../../components/Icon";
import { keyStore } from "../../services/keyStore";
import { testKey } from "../../services/ai/service";

const APP_VERSION = "0.1.0";

export function SettingsScreen() {
  const installationId = useInstallationId();
  const { prefs, setTheme, setPalette, setModel } = usePrefs();
  const { has, refresh } = useHasKey();
  const { toast } = useToast();
  const clearAll = useMutation(api.data.clearAllData);

  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);

  const resolvedTheme =
    prefs.theme === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : prefs.theme;

  const objectives = useQuery(api.objectives.list, { installationId });
  const records = useQuery(api.records.listByRange, { installationId });
  const notes = useQuery(api.dailyNotes.list, { installationId });
  const memories = useQuery(api.memories.list, { installationId });
  const analyses = useQuery(api.analyses.list, { installationId });
  const importData = useMutation(api.data.importData);

  const dataReady =
    objectives !== undefined && records !== undefined && notes !== undefined &&
    memories !== undefined && analyses !== undefined;

  const configured = has === true;

  async function saveKey() {
    const value = keyInput.trim();
    if (!value) return;
    setKeyBusy("save");
    try {
      await keyStore.set(value);
      setKeyInput("");
      refresh();
      toast("Chave salva neste navegador.");
    } catch {
      toast("Não foi possível salvar a chave.", "error");
    } finally {
      setKeyBusy(null);
    }
  }

  async function removeKey() {
    setKeyBusy("remove");
    try {
      await keyStore.remove();
      refresh();
      toast("Chave removida deste navegador.");
    } catch {
      toast("Não foi possível remover a chave.", "error");
    } finally {
      setKeyBusy(null);
    }
  }

  async function runTest() {
    setKeyBusy("test");
    setTestResult(null);
    const result = await testKey(prefs.model);
    if (result.ok) {
      setTestResult({ ok: true, text: "Conexão OK — chave válida." });
    } else {
      const msg = AI_ERROR_MESSAGES[result.code];
      setTestResult({
        ok: false,
        text: result.detail ? `${msg} (${result.detail.slice(0, 140)})` : msg,
      });
    }
    setKeyBusy(null);
  }

  function exportData() {
    if (!objectives || !records || !notes || !memories || !analyses) return;
    const payload = {
      app: APP_NAME,
      version: 1,
      exportedAt: new Date().toISOString(),
      installationId,
      objectives: objectives.map((d) => ({ exportId: d._id, name: d.name, targetMinutes: d.targetMinutes, active: d.active, createdDayKey: d.createdDayKey, deactivatedDayKey: d.deactivatedDayKey, createdAt: d.createdAt, updatedAt: d.updatedAt })),
      records: records.map((d) => ({ exportId: d._id, dayKey: d.dayKey, objectiveId: d.objectiveId, activityName: d.activityName, targetMinutes: d.targetMinutes, minutes: d.minutes, observation: d.observation, createdAt: d.createdAt })),
      dailyNotes: notes.map((d) => ({ dayKey: d.dayKey, note: d.note, updatedAt: d.updatedAt })),
      memories: memories.map((d) => ({ content: d.content, category: d.category, source: d.source, confidence: d.confidence, state: d.state, pinned: d.pinned, evidenceCount: d.evidenceCount, createdAt: d.createdAt, updatedAt: d.updatedAt })),
      analyses: analyses.map((d) => ({ kind: d.kind, periodStart: d.periodStart, periodEnd: d.periodEnd, periodLabel: d.periodLabel, resumo: d.resumo, contentJson: d.contentJson, infoUsed: d.infoUsed, model: d.model, createdAt: d.createdAt })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freebuff-dados-${installationId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup exportado.");
  }

  async function onImportFile(file: File) {
    setImportBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        objectives?: unknown[];
        records?: unknown[];
        dailyNotes?: unknown[];
        memories?: unknown[];
        analyses?: unknown[];
      };
      if (!Array.isArray(data.objectives) || !Array.isArray(data.records)) {
        throw new Error("formato");
      }
      await importData({
        installationId,
        objectives: data.objectives as never[],
        records: data.records as never[],
        dailyNotes: (data.dailyNotes ?? []) as never[],
        memories: (data.memories ?? []) as never[],
        analyses: (data.analyses ?? []) as never[],
      });
      toast("Importação concluída.");
    } catch {
      toast("Arquivo inválido. Use um backup exportado por este aplicativo.", "error");
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmWipeAll() {
    if (!wipeArmed) {
      setWipeArmed(true);
      return;
    }
    setWipeBusy(true);
    try {
      await clearAll({ installationId });
      toast("Todos os seus dados foram apagados.");
      setConfirmWipe(false);
      setWipeArmed(false);
    } catch {
      toast("Não foi possível apagar os dados.", "error");
      setWipeBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configurações</h1>
        </div>
      </div>

      <SettingsGroup title="IA" icon={<IconKey size={16} />}>
        {configured ? (
          <div className="key-status">
            <p className="t-sm">
              <span className="badge badge-primary">
                <IconCheck size={12} /> Chave configurada
              </span>{" "}
              <span className="t-muted">•••• •••• {prefs.model}</span>
            </p>
            <div className="sheet-actions-right">
              <Button variant="secondary" size="sm" loading={keyBusy === "test"} onClick={runTest}>
                Testar
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={keyBusy === "remove"}
                onClick={removeKey}
              >
                Remover chave
              </Button>
            </div>
            {testResult && (
              <p className={`t-sm ${testResult.ok ? "ok-text" : "err-text"}`}>{testResult.text}</p>
            )}
          </div>
        ) : (
          <div className="field">
            <label className="field-label" htmlFor="groq-key">
              Chave da API Groq
            </label>
            <div className="input-wrap">
              <input
                id="groq-key"
                className="field-control"
                type={showKey ? "text" : "password"}
                value={keyInput}
                autoComplete="off"
                placeholder="gsk_…"
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setTestResult(null);
                }}
              />
              <button
                type="button"
                className="input-toggle"
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
            <p className="field-hint">
              Crie uma chave em <strong>console.groq.com</strong> (gratuito). A chave fica
              armazenada somente neste navegador (IndexedDB) e nunca é enviada para o servidor.
            </p>
            <Button variant="primary" loading={keyBusy === "save"} disabled={!keyInput.trim()} onClick={saveKey}>
              Salvar chave
            </Button>
            {testResult && (
              <p className={`t-sm ${testResult.ok ? "ok-text" : "err-text"}`}>{testResult.text}</p>
            )}
          </div>
        )}
        <ModelField current={prefs.model} onChange={setModel} />
      </SettingsGroup>

      <SettingsGroup title="Aparência" icon={<IconInfo size={16} />}>
        <div className="segmented" role="group" aria-label="Tema">
          {(
            [
              ["auto", "Automático"],
              ["light", "Claro"],
              ["dark", "Escuro"],
            ] as [ThemePref, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="seg-btn"
              aria-pressed={prefs.theme === id}
              onClick={() => setTheme(id)}
            >
              {id === "light" && <IconSun size={15} aria-hidden />}
              {id === "dark" && <IconMoon size={15} aria-hidden />}
              {label}
            </button>
          ))}
        </div>
        <fieldset className="palette-fieldset">
          <legend className="t-xs t-muted">Cor do tema</legend>
          <div className="palette-grid" role="group" aria-label="Cor do tema">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                className="palette-btn"
                aria-pressed={prefs.palette === p.id}
                aria-label={`Cor ${p.label}`}
                onClick={() => setPalette(p.id)}
              >
                <span
                  className="palette-swatch"
                  style={{ background: resolvedTheme === "dark" ? p.swatch.dark : p.swatch.light }}
                >
                  {prefs.palette === p.id && <IconCheck size={14} aria-hidden />}
                </span>
                <span className="palette-label">{p.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </SettingsGroup>

      <SettingsGroup title="Dados" icon={<IconInfo size={16} />}>
        <p className="t-sm t-muted" style={{ marginBottom: 12 }}>
          Seus dados ficam no banco do aplicativo, separados por instalação (este navegador).
        </p>
        <div className="settings-actions">
          <Button variant="secondary" icon={<IconDownload size={16} />} disabled={!dataReady} onClick={exportData}>
            Exportar backup
          </Button>
          <Button
            variant="secondary"
            icon={<IconUpload size={16} />}
            disabled={importBusy}
            onClick={() => fileRef.current?.click()}
          >
            {importBusy ? "Importando…" : "Importar backup"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
            }}
          />
        </div>
        <div className="danger-zone">
          <p className="t-sm t-strong">Apagar todos os dados</p>
          <p className="t-sm t-muted">Remove objetivos, registros, memórias e análises desta instalação.</p>
          <Button variant="danger" icon={<IconTrash size={16} />} onClick={() => setConfirmWipe(true)}>
            Apagar tudo
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup title={`Sobre o ${APP_NAME}`} icon={<IconInfo size={16} />}>
        <p className="t-sm">
          Versão {APP_VERSION}. Sem cadastro: os dados são separados por esta instalação
          (navegador). A chave da IA nunca sai do seu aparelho. A IA interpreta os dados;
          os cálculos são feitos localmente.
        </p>
        <div className="install-id">
          <span className="t-xs t-muted">ID desta instalação</span>
          <code>{installationId}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(installationId);
                toast("ID copiado.");
              } catch {
                toast("Não foi possível copiar.", "error");
              }
            }}
          >
            Copiar
          </Button>
        </div>
      </SettingsGroup>

      <ConfirmSheet
        open={confirmWipe}
        onClose={() => {
          setConfirmWipe(false);
          setWipeArmed(false);
        }}
        onConfirm={confirmWipeAll}
        title="Apagar todos os dados"
        confirmLabel={wipeArmed ? "Confirmar apagamento definitivo" : "Apagar tudo"}
        danger
        loading={wipeBusy}
        message={
          wipeArmed ? (
            "Tem certeza? Esta ação não pode ser desfeita."
          ) : (
            <>
              Objetivos, registros, observações, memórias e análises desta instalação serão
              removidos do banco. Considere exportar um backup antes.
            </>
          )
        }
      />
    </>
  );
}

function SettingsGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="section settings-group">
      <h2 className="section-title settings-group-title">
        <span aria-hidden>{icon}</span>
        {title}
      </h2>
      <div className="card">{children}</div>
    </section>
  );
}

/** Model selector (curated list + custom value). */
export function ModelField({
  current,
  onChange,
}: {
  current: string;
  onChange: (model: string) => void;
}) {
  const known = GROQ_MODELS.some((m) => m.id === current);
  const value = known ? current : "__custom";
  return (
    <div className="field" style={{ marginTop: 16 }}>
      <Select
        label="Modelo de IA"
        hint="Modelos da Groq mudam com o tempo — ajuste se necessário."
        value={value}
        onChange={(e) => {
          if (e.target.value !== "__custom") onChange(e.target.value);
        }}
      >
        {GROQ_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.hint}
          </option>
        ))}
        <option value="__custom">Outro modelo (digitar)…</option>
      </Select>
      {!known && (
        <div className="input-wrap" style={{ marginTop: 8 }}>
          <input
            className="field-control"
            type="text"
            value={current}
            aria-label="Modelo personalizado"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
