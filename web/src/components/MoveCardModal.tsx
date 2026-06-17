import { useState } from "react";
import { X } from "lucide-react";
import { cardsApi, selectCollections, useDb } from "../lib/store";
import { Modal } from "./Modal";
import type { Card } from "../lib/store";

export function MoveCardModal({
  open,
  onClose,
  card,
  fromCollectionId,
}: {
  open: boolean;
  onClose: () => void;
  card: Card;
  fromCollectionId: string;
}) {
  const allCollections = useDb(selectCollections);
  const targets = allCollections.filter((c) => c.id !== fromCollectionId);
  const [toId, setToId] = useState(targets[0]?.id ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!toId) return;
    void cardsApi.move(fromCollectionId, card.id, toId).catch(() => {});
    onClose();
  }

  const preview = card.question.length > 60
    ? card.question.slice(0, 60) + "…"
    : card.question;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move card"
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            <X size={13} strokeWidth={2} />
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={!toId}>Move</button>
        </>
      }
    >
      <form onSubmit={submit} className="modal__body modal__body--flush modal__form">
        <p className="text-body">
          Move <strong className="modal__strong">{preview}</strong> to:
        </p>
        {targets.length === 0 ? (
          <p className="text-meta">No other collections to move this card to.</p>
        ) : (
          <label className="modal__field">
            <span className="text-meta">Destination collection</span>
            <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
              {targets.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </label>
        )}
      </form>
    </Modal>
  );
}
