import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Sparkles,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Layers,
} from "lucide-react";
import { collections } from "../data/mock";
import "./CollectionDetail.css";

export function CollectionDetail() {
  const { id } = useParams();
  const collection = collections.find((c) => c.id === id);

  if (!collection) return <Navigate to="/collections" replace />;

  const aiCount = collection.cards.filter((c) => c.aiGenerated).length;
  const masteryCounts = {
    new: collection.cards.filter((c) => c.mastery === "new").length,
    learning: collection.cards.filter((c) => c.mastery === "learning").length,
    known: collection.cards.filter((c) => c.mastery === "known").length,
  };

  return (
    <div className="cdet">
      <Link to="/collections" className="cdet__back">
        <ArrowLeft size={14} strokeWidth={2} />
        Zurück zu Collections
      </Link>

      <header className="cdet__head">
        <div className="cdet__head-main">
          <div className="cdet__identity">
            <span className="cdet__emoji">{collection.emoji}</span>
            <div>
              <span className="text-meta">{collection.folder}</span>
              <h1 className="text-h1" style={{ marginTop: 4 }}>
                {collection.name}
              </h1>
              <p className="text-body" style={{ marginTop: 6 }}>
                {collection.description}
              </p>
            </div>
          </div>

          <div className="cdet__actions">
            <button className="btn-ghost" title="Teilen">
              <Share2 size={14} strokeWidth={2} />
            </button>
            <button className="btn-ghost" title="Mehr">
              <MoreHorizontal size={14} strokeWidth={2} />
            </button>
            <Link to={`/c/${collection.id}/study`} className="btn-primary">
              <BookOpen size={14} strokeWidth={2} />
              Lernen starten
            </Link>
          </div>
        </div>

        <div className="cdet__stats">
          <div className="cdet__stat">
            <Layers size={14} strokeWidth={1.8} />
            <span>{collection.cards.length} Karten</span>
          </div>
          <div className="cdet__stat">
            <Sparkles size={14} strokeWidth={1.8} color="var(--color-accent-light)" />
            <span>{aiCount} KI-generiert</span>
          </div>
          <div className="cdet__progress">
            <div className="cdet__progress-label">
              <span>Fortschritt</span>
              <span>{collection.progress}%</span>
            </div>
            <div className="cdet__progress-bar">
              <div className="cdet__progress-seg cdet__progress-seg--known" style={{ flex: masteryCounts.known }} />
              <div className="cdet__progress-seg cdet__progress-seg--learning" style={{ flex: masteryCounts.learning }} />
              <div className="cdet__progress-seg cdet__progress-seg--new" style={{ flex: masteryCounts.new }} />
            </div>
            <div className="cdet__progress-legend">
              <span><span className="legend-dot legend-dot--known" /> {masteryCounts.known} gekonnt</span>
              <span><span className="legend-dot legend-dot--learning" /> {masteryCounts.learning} am lernen</span>
              <span><span className="legend-dot legend-dot--new" /> {masteryCounts.new} neu</span>
            </div>
          </div>
        </div>
      </header>

      <section className="cdet__cards-section">
        <div className="cdet__cards-head">
          <h2 className="text-h2">Karten</h2>
          <div className="cdet__cards-actions">
            <button className="btn-ghost">
              <Plus size={14} strokeWidth={2} />
              Karte hinzufügen
            </button>
            <Link to="/upload" className="btn-ghost">
              <Sparkles size={14} strokeWidth={2} />
              Mit KI erweitern
            </Link>
          </div>
        </div>

        <div className="cdet__cards">
          {collection.cards.map((card, i) => (
            <article key={card.id} className="cdet__card">
              <div className="cdet__card-index">
                <span className="text-meta">#{String(i + 1).padStart(2, "0")}</span>
                <span className={`cdet__dot cdet__dot--${card.mastery}`} title={card.mastery} />
              </div>
              <div className="cdet__card-body">
                <div className="cdet__card-q">
                  <span className="text-meta">Frage</span>
                  <p>{card.question}</p>
                </div>
                <div className="cdet__card-a">
                  <span className="text-meta">Antwort</span>
                  <p>{card.answer}</p>
                </div>
              </div>
              <div className="cdet__card-side">
                {card.aiGenerated && (
                  <span className="cdet__ai-pill">
                    <Sparkles size={10} strokeWidth={2} />
                    KI
                  </span>
                )}
                <button className="cdet__card-icon" title="Bearbeiten">
                  <Pencil size={13} strokeWidth={1.8} />
                </button>
                <button className="cdet__card-icon cdet__card-icon--danger" title="Löschen">
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </div>
            </article>
          ))}

          <button className="cdet__add-card">
            <Plus size={16} strokeWidth={2} />
            Neue Karte erstellen
          </button>
        </div>
      </section>
    </div>
  );
}
