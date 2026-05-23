import { useState } from "react";
import { Plus } from "lucide-react";
import { collectionsApi, selectFolders, useDb } from "../lib/store";
import { Modal } from "./Modal";

export function CreateCollectionModal({
  open,
  onClose,
  onCreated,
  defaultFolder,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  defaultFolder: string;
}) {
  const folders = useDb(selectFolders);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [folder, setFolder] = useState(defaultFolder);
  const [description, setDescription] = useState("");

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setEmoji("📚");
      setFolder(defaultFolder);
      setDescription("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const col = await collectionsApi.create({
        name: name.trim(),
        folder,
        emoji: emoji || "📚",
        description: description.trim(),
      });
      onCreated(col.id);
    } catch {
      // toast already shown by store
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New collection"
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!name.trim()} type="submit">
            <Plus size={14} strokeWidth={2} />
            Create
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="modal__body modal__body--flush">
        <label className="modal__field">
          <span className="text-meta">Name</span>
          <input
            className="input"
            autoFocus
            placeholder="e.g. Organic Chemistry — Ch. 4"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="modal__field">
          <span className="text-meta">Folder</span>
          <select className="input" value={folder} onChange={(e) => setFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f.name} value={f.name}>{f.emoji} {f.name}</option>
            ))}
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </label>
        <label className="modal__field">
          <span className="text-meta">Emoji</span>
          <input
            className="input modal__emoji-input"
            maxLength={4}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          />
        </label>
        <label className="modal__field">
          <span className="text-meta">Description</span>
          <textarea
            className="input"
            rows={2}
            placeholder="Optional — what's this collection about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}
