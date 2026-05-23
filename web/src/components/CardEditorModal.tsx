import { useState } from "react";
import { cardsApi } from "../lib/store";
import { Modal } from "./Modal";
import type { Card } from "../lib/store";

export function CardEditorModal({
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
      void cardsApi.update(collectionId, card.id, { question: question.trim(), answer: answer.trim() }).catch(() => {});
    } else {
      void cardsApi.add(collectionId, { question: question.trim(), answer: answer.trim() }).catch(() => {});
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
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!question.trim() || !answer.trim()}>
            {card ? "Save changes" : "Add card"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="modal__body modal__body--flush modal__form">
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
