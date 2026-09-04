import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/Button";
import { IconPencil, IconTrash } from "../../components/Icon";
import { formatMinutes } from "../../lib/format";

interface RecordListProps {
  records: Doc<"records">[];
  onEdit: (record: Doc<"records">) => void;
  onDelete: (record: Doc<"records">) => void;
  emptyHint?: string;
}

export function RecordList({ records, onEdit, onDelete, emptyHint }: RecordListProps) {
  if (records.length === 0) {
    return (
      <div className="record-list">
        <p className="record-list-empty t-sm">
          {emptyHint ?? "Nenhum registro neste dia."}
        </p>
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <ul className="record-list">
      {sorted.map((r) => (
        <li className="record-row" key={r._id}>
          <div className="record-main">
            <div className="record-line">
              <span className="record-name">{r.activityName}</span>
              <span className="record-min t-num">{formatMinutes(r.minutes)}</span>
            </div>
            {r.observation && <p className="record-obs t-sm t-muted">{r.observation}</p>}
            <div className="record-tags">
              {r.objectiveId === null && <span className="badge">fora dos objetivos</span>}
              {r.targetMinutes !== null && (
                <span className="badge">meta {formatMinutes(r.targetMinutes)}</span>
              )}
            </div>
          </div>
          <div className="record-actions">
            <Button
              variant="ghost"
              className="btn-icon-sm"
              onClick={() => onEdit(r)}
              aria-label={`Editar registro de ${r.activityName}`}
            >
              <IconPencil size={15} />
            </Button>
            <Button
              variant="ghost"
              className="btn-icon-sm"
              onClick={() => onDelete(r)}
              aria-label={`Excluir registro de ${r.activityName}`}
            >
              <IconTrash size={15} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
