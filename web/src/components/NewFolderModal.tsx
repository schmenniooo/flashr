import { useState } from "react";
import { Plus } from "lucide-react";
import { foldersApi, selectFolders, useDb } from "../lib/store";
import { Modal } from "./Modal";

export function NewFolderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (name: string) => void;
}) {
  const folders = useDb(selectFolders);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [error, setError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setEmoji("📁");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("A folder with that name already exists.");
      return;
    }
    foldersApi.create(trimmed, emoji || "📁");
    onCreated?.(trimmed);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New folder"
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!name.trim()}
          >
            <Plus size={14} strokeWidth={2} />
            Create folder
          </button>
        </>
      }
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label className="modal__field">
          <span className="text-meta">Name</span>
          <input
            className="input"
            autoFocus
            placeholder="e.g. Work, School, Languages…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
          />
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
        {error && (
          <div className="auth__error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
