import { Link } from "react-router-dom";
import { Layers, Globe2, Lock, Clock } from "lucide-react";
import type { Collection } from "../lib/store";
import "./CollectionCard.css";

export function CollectionCard({ collection }: { collection: Collection }) {
  const { id, name, folder, emoji, cards, lastStudied, progress, isPublic, description } = collection;
  const aiCount = cards.filter((c) => c.aiGenerated).length;

  return (
    <Link to={`/app/c/${id}`} className="colcard hover-lift">
      <div className="colcard__top">
        <span className="colcard__emoji" aria-hidden>
          {emoji}
        </span>
        <span className="colcard__folder">
          {folder}
          {isPublic ? (
            <Globe2 size={11} strokeWidth={2} />
          ) : (
            <Lock size={11} strokeWidth={2} />
          )}
        </span>
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
    </Link>
  );
}
