import { useNavigate } from "react-router-dom";
import { Layers, Globe2, Lock, Clock, Pencil } from "lucide-react";
import type { Collection } from "../lib/store";
import "./CollectionCard.css";

export function CollectionCard({
  collection,
  onEdit,
}: {
  collection: Collection;
  onEdit?: () => void;
}) {
  const navigate = useNavigate();
  const { id, name, folder, emoji, cards, lastStudied, progress, isPublic, description } = collection;
  const aiCount = cards.filter((c) => c.aiGenerated).length;

  return (
    <div
      className="colcard hover-lift"
      onClick={() => navigate(`/app/c/${id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/app/c/${id}`)}
    >
      <div className="colcard__top">
        <span className="colcard__emoji" aria-hidden>
          {emoji}
        </span>
        <div className="colcard__top-right">
          <span className="colcard__folder">
            {folder}
            {isPublic ? (
              <Globe2 size={11} strokeWidth={2} />
            ) : (
              <Lock size={11} strokeWidth={2} />
            )}
          </span>
          {onEdit && (
            <button
              className="colcard__edit-btn"
              title="Edit collection"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <h3 className="colcard__title">{name}</h3>
      <p className="colcard__desc">{description}</p>

      <div className="colcard__progress">
        <div className="colcard__progress-bar">
          <div className="colcard__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="colcard__progress-val">{progress}%</span>
      </div>

      <div className="colcard__foot">
        <span className="colcard__meta">
          <Layers size={12} strokeWidth={2} />
          {cards.length} cards
        </span>
        {aiCount > 0 && (
          <span className="colcard__meta colcard__meta--ai">
            <span className="colcard__ai-dot" />
            {aiCount} AI
          </span>
        )}
        <span className="colcard__meta colcard__meta--muted">
          <Clock size={12} strokeWidth={2} />
          {lastStudied}
        </span>
      </div>
    </div>
  );
}
