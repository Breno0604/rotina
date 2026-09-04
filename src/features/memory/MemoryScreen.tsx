import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  MEMORY_CATEGORIES,
  MEMORY_SOURCES,
  memoryCategoryLabel,
  type MemoryCategory,
  type MemoryState,
} from "../../types/domain";
import { useInstallationId } from "../../app/installation";
import { useMemories } from "../../hooks/useQueries";
import { useToast } from "../../components/Toast";
import { Button } from "../../components/Button";
import { EmptyState, ErrorState, LoadingState, InfoNote } from "../../components/StateViews";
import { ConfirmSheet, Sheet } from "../../components/Sheet";
import { Select, TextArea } from "../../components/Field";
import {
  IconArchive,
  IconBookmark,
  IconCheck,
  IconPencil,
  IconPlus,
  IconStar,
  IconTrash,
} from "../../components/Icon";

export function MemoryScreen() {
  const installationId = useInstallationId();
  const memories = useMemories();
  const update = useMutation(api.memories.update);
  const confirmValid = useMutation(api.memories.confirmStillValid);
  const remove = useMutation(api.memories.remove);
  const { toast } = useToast();

  const [editor, setEditor] = useState<{ open: boolean; memory: Doc<"memories"> | null }>({
    open: false,
    memory: null,
  });
  const [toDelete, setToDelete] = useState<Doc<"memories"> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = useMemo(() => (memories ?? []).filter((m) => m.state !== "arquivada"), [memories]);
  const archived = useMemo(() => (memories ?? []).filter((m) => m.state === "arquivada"), [memories]);

  if (memories === undefined) return <LoadingState label="Carregando contexto pessoal…" />;
  if (memories === null) return <ErrorState message="Não foi possível carregar as memórias." />;

  async function patch(id: string, fields: { pinned?: boolean; state?: MemoryState }) {
    setBusyId(id);
    try {
      await update({ installationId, id: id as never, ...fields });
    } catch {
      toast("Não foi possível atualizar.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove({ installationId, id: toDelete._id });
      toast("Memória excluída.");
      setToDelete(null);
    } catch {
      toast("Não foi possível excluir.", "error");
    }
  }

  async function revalidate(id: string) {
    setBusyId(id);
    try {
      await confirmValid({ installationId, id: id as never });
      toast("Memória confirmada como atual.");
    } catch {
      toast("Não foi possível confirmar.", "error");
    } finally {
      setBusyId(null);
    }
  }

  const pinned = active.filter((m) => m.pinned);
  const groups = MEMORY_CATEGORIES.map((cat) => ({
    ...cat,
    items: active.filter((m) => m.category === cat.id && !m.pinned),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Contexto pessoal</h1>
          <p className="page-sub">
            O que a IA sabe sobre você — para análises mais precisas ao longo do tempo.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<IconPlus size={18} />}
          onClick={() => setEditor({ open: true, memory: null })}
        >
          Nova memória
        </Button>
      </div>

      <InfoNote tone="accent">
        Memórias <strong>declaradas</strong> são o que você informa;{" "}
        <strong>observadas</strong> são padrões que a IA sugeriu a partir dos dados —
        e você sempre decide se elas ficam. Você pode editar ou excluir qualquer memória.
      </InfoNote>

      {memories.length === 0 ? (
        <EmptyState
          icon={<IconBookmark size={24} />}
          title="Nenhuma memória ainda"
          body="Conte coisas relevantes sobre sua rotina, preferências e dificuldades. Quanto mais contexto, melhores as análises da IA."
          action={
            <Button
              variant="primary"
              icon={<IconPlus size={18} />}
              onClick={() => setEditor({ open: true, memory: null })}
            >
              Nova memória
            </Button>
          }
        />
      ) : (
        <>
          {pinned.length > 0 && (
            <MemoryGroup
              title="Fixadas"
              items={pinned}
              onEdit={(m) => setEditor({ open: true, memory: m })}
              onPin={(m) => patch(m._id, { pinned: !m.pinned })}
              onRevalidate={(m) => revalidate(m._id)}
              onArchive={(m) => patch(m._id, { state: "arquivada" })}
              onDelete={(m) => setToDelete(m)}
              busyId={busyId}
            />
          )}
          {groups.map((g) => (
            <MemoryGroup
              key={g.id}
              title={g.label}
              items={g.items}
              onEdit={(m) => setEditor({ open: true, memory: m })}
              onPin={(m) => patch(m._id, { pinned: !m.pinned })}
              onRevalidate={(m) => revalidate(m._id)}
              onArchive={(m) => patch(m._id, { state: "arquivada" })}
              onDelete={(m) => setToDelete(m)}
              busyId={busyId}
            />
          ))}

          {archived.length > 0 && (
            <section className="section">
              <h2 className="section-title">Arquivadas</h2>
              <div className="list">
                {archived.map((m) => (
                  <div className="card memory-item muted-memory" key={m._id}>
                    <p className="t-sm">{m.content}</p>
                    <div className="memory-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconArchive size={14} />}
                        loading={busyId === m._id}
                        onClick={() => patch(m._id, { state: "ativa" })}
                      >
                        Restaurar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<IconTrash size={14} />}
                        onClick={() => setToDelete(m)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {editor.open && (
        <MemorySheet
          memory={editor.memory}
          onClose={() => setEditor({ open: false, memory: null })}
        />
      )}
      <ConfirmSheet
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir memória"
        confirmLabel="Excluir"
        danger
        message="Essa memória será removida permanentemente do seu contexto pessoal."
      />
    </>
  );
}

function sourceBadge(source: "declared" | "observed") {
  const s = MEMORY_SOURCES.find((x) => x.id === source);
  return s ? (
    <span className={`badge ${source === "observed" ? "badge-accent" : ""}`}>{s.label}</span>
  ) : null;
}

function MemoryGroup({
  title,
  items,
  onEdit,
  onPin,
  onRevalidate,
  onArchive,
  onDelete,
  busyId,
}: {
  title: string;
  items: Doc<"memories">[];
  onEdit: (m: Doc<"memories">) => void;
  onPin: (m: Doc<"memories">) => void;
  onRevalidate: (m: Doc<"memories">) => void;
  onArchive: (m: Doc<"memories">) => void;
  onDelete: (m: Doc<"memories">) => void;
  busyId: string | null;
}) {
  return (
    <section className="section" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <div className="list">
        {items.map((m) => (
          <div className="card memory-item" key={m._id}>
            <p className="memory-content">{m.content}</p>
            <div className="memory-meta">
              {sourceBadge(m.source)}
              {m.state !== "ativa" && (
                <span className="badge badge-warn">{m.state === "possivelmente_desatualizada" ? "Possivelmente desatualizada" : "Arquivada"}</span>
              )}
              <span className="memory-cat t-xs t-muted">{memoryCategoryLabel(m.category)}</span>
            </div>
            <div className="memory-actions">
              <Button
                variant="ghost"
                className="btn-icon-sm"
                aria-label={m.pinned ? "Desafixar memória" : "Fixar memória"}
                aria-pressed={m.pinned}
                loading={busyId === m._id}
                onClick={() => onPin(m)}
              >
                <IconStar size={16} className={m.pinned ? "pinned" : undefined} />
              </Button>
              <Button
                variant="ghost"
                className="btn-icon-sm"
                aria-label="Editar memória"
                onClick={() => onEdit(m)}
              >
                <IconPencil size={15} />
              </Button>
              {m.state === "possivelmente_desatualizada" && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<IconCheck size={14} />}
                  loading={busyId === m._id}
                  onClick={() => onRevalidate(m)}
                >
                  Confirmar
                </Button>
              )}
              <Button
                variant="ghost"
                className="btn-icon-sm"
                aria-label="Arquivar memória"
                onClick={() => onArchive(m)}
              >
                <IconArchive size={16} />
              </Button>
              <Button
                variant="ghost"
                className="btn-icon-sm"
                aria-label="Excluir memória"
                onClick={() => onDelete(m)}
              >
                <IconTrash size={15} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MemorySheet({
  memory,
  onClose,
}: {
  memory: Doc<"memories"> | null;
  onClose: () => void;
}) {
  const installationId = useInstallationId();
  const createDeclared = useMutation(api.memories.createDeclared);
  const update = useMutation(api.memories.update);
  const { toast } = useToast();

  const [content, setContent] = useState(memory?.content ?? "");
  const [category, setCategory] = useState<MemoryCategory>(memory?.category ?? "produtividade");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function save() {
    const clean = content.trim();
    if (clean.length === 0) {
      setError("Escreva a memória (ou exclua a caixa para cancelar).");
      return;
    }
    setSaving(true);
    try {
      if (memory) {
        await update({ installationId, id: memory._id, content: clean, category });
        toast("Memória atualizada.");
      } else {
        await createDeclared({ installationId, content: clean, category });
        toast("Memória adicionada ao seu contexto.");
      }
      onClose();
    } catch {
      toast("Não foi possível salvar.", "error");
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={memory ? "Editar memória" : "Nova memória"}>
      <TextArea
        label="Conteúdo"
        required
        placeholder="Ex.: Tenho mais concentração pela manhã. / Inglês é minha prioridade."
        value={content}
        maxLength={600}
        rows={3}
        onChange={(e) => {
          setContent(e.target.value);
          setError(undefined);
        }}
        error={error}
        data-autofocus
      />
      <Select
        label="Categoria"
        value={category}
        onChange={(e) => setCategory(e.target.value as MemoryCategory)}
      >
        {MEMORY_CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <div className="sheet-actions">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save} loading={saving} block>
          {memory ? "Salvar alterações" : "Criar memória"}
        </Button>
      </div>
    </Sheet>
  );
}
