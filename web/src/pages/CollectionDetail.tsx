import { useState } from "react";
import { Link, useParams, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Sparkles,
  Share2,
  Pencil,
  Trash2,
  Layers,
} from "lucide-react";
import {
  cardsApi,
  collectionsApi,
  selectCollection,
  selectCurrentUser,
  useDb,
} from "../lib/store";
import { CardEditorModal } from "../components/CardEditorModal";
import { EditCollectionModal } from "../components/EditCollectionModal";
import { Modal } from "../components/Modal";
import { MoveCardModal } from "../components/MoveCardModal";
import { UpgradePrompt } from "../components/UpgradePrompt";
import type { Card } from "../lib/store";
import { usePostHog } from "@posthog/react";
import "./CollectionDetail.css";

export function CollectionDetail() {
  const { id } = useParams();
  const posthog = usePostHog();
  const navigate = useNavigate();
  const collection = useDb(selectCollection(id ?? ""));
  const currentUser = useDb(selectCurrentUser);
  const isPro = currentUser?.plan === "pro";
  const atCardLimit = !isPro && (collection?.cards.length ?? 0) >= 50;

  const [editingCollection, setEditingCollection] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardModal, setCardModal] = useState<
    { mode: "create" } | { mode: "edit"; card: Card } | null
  >(null);
  const [movingCard, setMovingCard] = useState<Card | null>(null);

  if (!collection) return <Navigate to="/app/collections" replace />;

  const aiCount = collection.cards.filter((c) => c.aiGenerated).length;
  const masteryCounts = {
    new: collection.cards.filter((c) => c.mastery === "new").length,
    learning: collection.cards.filter((c) => c.mastery === "learning").length,
    known: collection.cards.filter((c) => c.mastery === "known").length,
  };

  function handleDelete() {
    posthog.capture("collection_deleted", { collection_id: collection!.id, collection_name: collection!.name, card_count: collection!.cards.length });
    void collectionsApi.remove(collection!.id).catch(() => {});
    navigate("/app/collections");
  }

  function handleDeleteCard(cardId: string) {
    if (!window.confirm("Delete this card? This can't be undone.")) return;
    void cardsApi.remove(collection!.id, cardId).catch(() => {});
  }

  return (
    <div className="cdet">
      <Link to="/app/collections" className="cdet__back">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to collections
      </Link>

      <header className="cdet__head">
        <div className="cdet__head-main">
          <div className="cdet__identity">
            <span className="cdet__emoji">{collection.emoji}</span>
            <div>
              <span className="text-meta">{collection.folder}</span>
              <h1 className="text-h1 cdet__title">{collection.name}</h1>
              <p className="text-body cdet__desc">
                {collection.description || "No description yet."}
              </p>
            </div>
          </div>

          <div className="cdet__actions">
            <button className="btn-ghost" aria-label="Share collection" title="Share">
              <Share2 size={14} strokeWidth={2} />
            </button>
            <button
              className="btn-ghost"
              aria-label="Edit collection"
              title="Edit collection"
              onClick={() => setEditingCollection(true)}
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
            <button
              className="btn-ghost cdet__danger-btn"
              aria-label="Delete collection"
              title="Delete collection"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
            <Link
              to={`/app/c/${collection.id}/study`}
              className="btn-primary"
              aria-disabled={collection.cards.length === 0}
              onClick={(e) => { if (collection.cards.length === 0) e.preventDefault(); }}
            >
              <BookOpen size={14} strokeWidth={2} />
              Start studying
            </Link>
          </div>
        </div>

        <div className="cdet__stats">
          <div className="cdet__stat">
            <Layers size={14} strokeWidth={1.8} />
            <span>{collection.cards.length} cards</span>
          </div>
          <div className="cdet__stat">
            <Sparkles size={14} strokeWidth={1.8} color="var(--color-accent-light)" />
            <span>{aiCount} AI-generated</span>
          </div>
          <div className="cdet__progress">
            <div className="cdet__progress-label">
              <span>Progress</span>
              <span>{collection.progress}%</span>
            </div>
            <div className="cdet__progress-bar">
              <div className="cdet__progress-seg cdet__progress-seg--known" style={{ flex: masteryCounts.known }} />
              <div className="cdet__progress-seg cdet__progress-seg--learning" style={{ flex: masteryCounts.learning }} />
              <div className="cdet__progress-seg cdet__progress-seg--new" style={{ flex: masteryCounts.new }} />
            </div>
            <div className="cdet__progress-legend">
              <span><span className="legend-dot legend-dot--known" /> {masteryCounts.known} known</span>
              <span><span className="legend-dot legend-dot--learning" /> {masteryCounts.learning} learning</span>
              <span><span className="legend-dot legend-dot--new" /> {masteryCounts.new} new</span>
            </div>
          </div>
        </div>
      </header>

      <section className="cdet__cards-section">
        <div className="cdet__cards-head">
          <h2 className="text-h2">Cards</h2>
          <div className="cdet__cards-actions">
            <button
              className="btn-ghost"
              onClick={() => !atCardLimit && setCardModal({ mode: "create" })}
              disabled={atCardLimit}
              title={atCardLimit ? "Card limit reached — upgrade to Pro" : undefined}
            >
              <Plus size={14} strokeWidth={2} />
              Add card
            </button>
            <Link to="/app/upload" className="btn-ghost">
              <Sparkles size={14} strokeWidth={2} />
              Extend with AI
            </Link>
          </div>
        </div>

        {atCardLimit && (
          <UpgradePrompt reason="You've reached the 50-card limit per collection on the Free plan. Upgrade for unlimited cards." />
        )}

        <div className="cdet__cards">
          {collection.cards.map((card, i) => (
            <article key={card.id} className="cdet__card">
              <div className="cdet__card-index">
                <span className="text-meta">#{String(i + 1).padStart(2, "0")}</span>
                <span className={`cdet__dot cdet__dot--${card.mastery}`} title={card.mastery} />
              </div>
              <div className="cdet__card-body">
                <div className="cdet__card-q">
                  <span className="text-meta">Question</span>
                  <p>{card.question}</p>
                </div>
                <div className="cdet__card-a">
                  <span className="text-meta">Answer</span>
                  <p>{card.answer}</p>
                </div>
              </div>
              <div className="cdet__card-side">
                {card.aiGenerated && (
                  <span className="cdet__ai-pill">
                    <Sparkles size={10} strokeWidth={2} />
                    AI
                  </span>
                )}
                <button
                  className="cdet__card-icon"
                  aria-label="Move to another collection"
                  title="Move to another collection"
                  onClick={() => setMovingCard(card)}
                >
                  <Layers size={13} strokeWidth={1.8} />
                </button>
                <button
                  className="cdet__card-icon"
                  aria-label="Edit card"
                  title="Edit"
                  onClick={() => setCardModal({ mode: "edit", card })}
                >
                  <Pencil size={13} strokeWidth={1.8} />
                </button>
                <button
                  className="cdet__card-icon cdet__card-icon--danger"
                  aria-label="Delete card"
                  title="Delete"
                  onClick={() => handleDeleteCard(card.id)}
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </div>
            </article>
          ))}

          <button className="cdet__add-card" onClick={() => setCardModal({ mode: "create" })}>
            <Plus size={16} strokeWidth={2} />
            Create new card
          </button>
        </div>
      </section>

      {cardModal && (
        <CardEditorModal
          open
          onClose={() => setCardModal(null)}
          collectionId={collection.id}
          card={cardModal.mode === "edit" ? cardModal.card : undefined}
        />
      )}

      {movingCard && (
        <MoveCardModal
          open
          onClose={() => setMovingCard(null)}
          card={movingCard}
          fromCollectionId={collection.id}
        />
      )}

      <EditCollectionModal
        open={editingCollection}
        onClose={() => setEditingCollection(false)}
        collectionId={collection.id}
        initial={{
          name: collection.name,
          folder: collection.folder,
          emoji: collection.emoji,
          description: collection.description,
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this collection?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="modal__btn-danger" onClick={handleDelete}>
              <Trash2 size={13} strokeWidth={2} />
              Delete forever
            </button>
          </>
        }
      >
        <p className="text-body">
          <strong className="modal__strong">{collection.name}</strong> and all{" "}
          {collection.cards.length} card{collection.cards.length === 1 ? "" : "s"} will be
          removed. This can't be undone.
        </p>
      </Modal>
    </div>
  );
}
