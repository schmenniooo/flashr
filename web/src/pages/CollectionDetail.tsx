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
  X,
} from "lucide-react";
import {
  cardsApi,
  collectionsApi,
  selectCollection,
  selectFolders,
  useDb,
} from "../lib/store";
import { Modal } from "../components/Modal";
import type { Card } from "../lib/store";
import "./CollectionDetail.css";

export function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const collection = useDb(selectCollection(id ?? ""));
  const folders = useDb(selectFolders);

  const [editingCollection, setEditingCollection] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardModal, setCardModal] = useState<
    { mode: "create" } | { mode: "edit"; card: Card } | null
  >(null);

  if (!collection) return <Navigate to="/app/collections" replace />;

  const aiCount = collection.cards.filter((c) => c.aiGenerated).length;
  const masteryCounts = {
    new: collection.cards.filter((c) => c.mastery === "new").length,
    learning: collection.cards.filter((c) => c.mastery === "learning").length,
    known: collection.cards.filter((c) => c.mastery === "known").length,
  };

  function handleDelete() {
    collectionsApi.remove(collection!.id);
    navigate("/app/collections");
  }

  function handleDeleteCard(cardId: string) {
    if (!window.confirm("Delete this card? This can't be undone.")) return;
    cardsApi.remove(collection!.id, cardId);
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
              <h1 className="text-h1" style={{ marginTop: 4 }}>
                {collection.name}
              </h1>
              <p className="text-body" style={{ marginTop: 6 }}>
                {collection.description || "No description yet."}
              </p>
            </div>
          </div>

          <div className="cdet__actions">
            <button className="btn-ghost" title="Share">
              <Share2 size={14} strokeWidth={2} />
            </button>
            <button
              className="btn-ghost"
              title="Edit collection"
              onClick={() => setEditingCollection(true)}
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
            <button
              className="btn-ghost cdet__danger-btn"
              title="Delete collection"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
            <Link
              to={`/app/c/${collection.id}/study`}
              className="btn-primary"
              aria-disabled={collection.cards.length === 0}
              onClick={(e) => {
                if (collection.cards.length === 0) e.preventDefault();
              }}
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
            <button className="btn-ghost" onClick={() => setCardModal({ mode: "create" })}>
              <Plus size={14} strokeWidth={2} />
              Add card
            </button>
            <Link to="/app/upload" className="btn-ghost">
              <Sparkles size={14} strokeWidth={2} />
              Extend with AI
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
                  title="Edit"
                  onClick={() => setCardModal({ mode: "edit", card })}
                >
                  <Pencil size={13} strokeWidth={1.8} />
                </button>
                <button
                  className="cdet__card-icon cdet__card-icon--danger"
                  title="Delete"
                  onClick={() => handleDeleteCard(card.id)}
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </div>
            </article>
          ))}

          <button
            className="cdet__add-card"
            onClick={() => setCardModal({ mode: "create" })}
          >
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
        folders={folders.map((f) => f.name)}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this collection?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="modal__btn-danger" onClick={handleDelete}>
              <Trash2 size={13} strokeWidth={2} />
              Delete forever
            </button>
          </>
        }
      >
        <p className="text-body">
          <strong style={{ color: "var(--color-text)" }}>{collection.name}</strong> and all{" "}
          {collection.cards.length} card{collection.cards.length === 1 ? "" : "s"} will be removed.
          This can't be undone.
        </p>
      </Modal>
    </div>
  );
}

function CardEditorModal({
  open,
  onClose,
  collectionId,
  card,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  card?: Card;
}) {
  const [question, setQuestion] = useState(card?.question ?? "");
  const [answer, setAnswer] = useState(card?.answer ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    if (card) {
      cardsApi.update(collectionId, card.id, {
        question: question.trim(),
        answer: answer.trim(),
      }).catch(console.error);
    } else {
      cardsApi.add(collectionId, {
        question: question.trim(),
        answer: answer.trim(),
      }).catch(console.error);
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? "Edit card" : "New card"}
      size="md"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!question.trim() || !answer.trim()}
          >
            {card ? "Save changes" : "Add card"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label className="modal__field">
          <span className="text-meta">Question</span>
          <textarea
            className="input"
            rows={3}
            autoFocus
            placeholder="What does Kₘ describe?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className="modal__field">
          <span className="text-meta">Answer</span>
          <textarea
            className="input"
            rows={5}
            placeholder="The substrate concentration at which v = ½ Vₘₐₓ…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}

function EditCollectionModal({
  open,
  onClose,
  collectionId,
  initial,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  initial: { name: string; folder: string; emoji: string; description: string };
  folders: string[];
}) {
  const [name, setName] = useState(initial.name);
  const [folder, setFolder] = useState(initial.folder);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [description, setDescription] = useState(initial.description);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    collectionsApi.update(collectionId, {
      name: name.trim(),
      folder,
      emoji: emoji || "📚",
      description: description.trim(),
    }).catch(console.error);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit collection"
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            <X size={13} strokeWidth={2} />
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={!name.trim()}>
            Save
          </button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label className="modal__field">
          <span className="text-meta">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="modal__field">
          <span className="text-meta">Folder</span>
          <select className="input" value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </label>
        <label className="modal__field">
          <span className="text-meta">Emoji</span>
          <input
            className="input"
            maxLength={4}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            style={{ maxWidth: 80, textAlign: "center", fontSize: 18 }}
          />
        </label>
        <label className="modal__field">
          <span className="text-meta">Description</span>
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}
