import { useState } from "react";
import { X } from "lucide-react";
import { collectionsApi, selectFolders, useDb } from "../lib/store";
import { Modal } from "./Modal";

export function EditCollectionModal({
  open,
  onClose,
  collectionId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  initial: { name: string; folder: string; emoji: string; description: string };
}) {
  const folders = useDb(selectFolders);
  const [name, setName] = useState(initial.name);
  const [folder, setFolder] = useState(initial.folder);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [description, setDescription] = useState(initial.description);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName(initial.name);
      setFolder(initial.folder);
      setEmoji(initial.emoji);
      setDescription(initial.description);
    }
  }

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
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="modal__field">
          <span className="text-meta">Folder</span>
          <select className="input" value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f.name} value={f.name}>
                {f.emoji} {f.name}
              </option>
            ))}
            <option value="">Uncategorized</option>
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
