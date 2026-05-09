import { Sparkles, Pencil, Trash2 } from "lucide-react";
import type { DraftCard } from "./types";

export function DraftCardItem({
  draft,
  index,
  editingId,
  onToggle,
  onEdit,
  onSetEditing,
}: {
  draft: DraftCard;
  index: number;
  editingId: string | null;
  onToggle: () => void;
  onEdit: (field: "question" | "answer", value: string) => void;
  onSetEditing: (id: string | null) => void;
}) {
  return (
    <article className={`up__draft ${draft.keep ? "up__draft--keep" : "up__draft--skip"}`}>
      <div className="up__draft-idx">
        <span className="text-meta">#{String(index + 1).padStart(2, "0")}</span>
        <span className="up__ai-pill">
          <Sparkles size={10} strokeWidth={2} />
          AI
        </span>
      </div>

      {editingId === draft.id ? (
        <div className="up__draft-edit">
          <label className="text-meta">Question</label>
          <textarea
            className="up__draft-textarea"
            value={draft.question}
            onChange={(e) => onEdit("question", e.target.value)}
            rows={2}
          />
          <label className="text-meta up__draft-answer-label">Answer</label>
          <textarea
            className="up__draft-textarea"
            value={draft.answer}
            onChange={(e) => onEdit("answer", e.target.value)}
            rows={3}
          />
          <button
            className="btn-ghost up__draft-done"
            onClick={() => onSetEditing(null)}
          >
            Done
          </button>
        </div>
      ) : (
        <div className="up__draft-body">
          <div>
            <span className="text-meta">Question</span>
            <p>{draft.question}</p>
          </div>
          <div>
            <span className="text-meta">Answer</span>
            <p className="up__draft-answer">{draft.answer}</p>
          </div>
        </div>
      )}

      <div className="up__draft-side">
        <button
          className="up__draft-icon"
          title="Edit"
          onClick={() => onSetEditing(editingId === draft.id ? null : draft.id)}
        >
          <Pencil size={13} strokeWidth={1.8} />
        </button>
        <button
          className="up__draft-icon up__draft-icon--danger"
          title="Skip"
          onClick={onToggle}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
        <label className="up__switch">
          <input type="checkbox" checked={draft.keep} onChange={onToggle} />
          <span />
        </label>
      </div>
    </article>
  );
}
