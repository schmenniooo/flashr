import { Sparkles, Layers, CheckCircle2 } from "lucide-react";
import { DraftCardItem } from "./DraftCardItem";
import type { DraftCard } from "./types";

export function ReviewStep({
  drafts,
  onToggle,
  onEdit,
  editingId,
  onSetEditing,
  target,
  onTarget,
  keepCount,
  onBack,
  onSave,
  collections,
}: {
  drafts: DraftCard[];
  onToggle: (id: string) => void;
  onEdit: (id: string, field: "question" | "answer", value: string) => void;
  editingId: string | null;
  onSetEditing: (id: string | null) => void;
  target: string;
  onTarget: (id: string) => void;
  keepCount: number;
  onBack: () => void;
  onSave: () => void;
  collections: { id: string; emoji: string; name: string }[];
}) {
  return (
    <div className="up__review fade-in">
      <div className="up__review-bar">
        <div>
          <h2 className="text-h2">
            <Sparkles
              size={16}
              strokeWidth={2}
              color="var(--color-accent)"
              className="up__review-icon"
            />
            {drafts.length} cards generated
          </h2>
          <p className="text-body">
            Keep, skip, or edit each one. Only selected cards get saved.
          </p>
        </div>
      </div>

      <div className="up__drafts">
        {drafts.map((d, i) => (
          <DraftCardItem
            key={d.id}
            draft={d}
            index={i}
            editingId={editingId}
            onToggle={() => onToggle(d.id)}
            onEdit={(field, value) => onEdit(d.id, field, value)}
            onSetEditing={onSetEditing}
          />
        ))}
      </div>

      <div className="up__save-bar">
        <div className="up__save-summary">
          <Layers size={14} strokeWidth={2} />
          <strong>{keepCount}</strong> of {drafts.length} cards will be saved
        </div>
        <div className="up__save-target">
          <label className="text-meta">Save to</label>
          <select className="up__select" value={target} onChange={(e) => onTarget(e.target.value)}>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} · {c.name}
              </option>
            ))}
            <option value="__new">+ Create new collection</option>
          </select>
        </div>
        <div className="up__save-actions">
          <button className="btn-ghost" onClick={onBack}>
            Discard
          </button>
          <button className="btn-primary" disabled={keepCount === 0} onClick={onSave}>
            <CheckCircle2 size={14} strokeWidth={2} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
