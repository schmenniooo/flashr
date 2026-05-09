import { useState } from "react";
import { Modal } from "./Modal";

export function RenameFolderModal({
  name,
  onClose,
  onRenamed,
  existingNames,
}: {
  name: string | null;
  onClose: () => void;
  onRenamed: (oldName: string, newName: string) => void;
  existingNames: string[];
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const [prevName, setPrevName] = useState(name);
  if (prevName !== name) {
    setPrevName(name);
    if (name) {
      setValue(name);
      setError("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || !name) return;
    if (trimmed === name) { onClose(); return; }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== name)) {
      setError("A folder with that name already exists.");
      return;
    }
    onRenamed(name, trimmed);
  }

  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      title="Rename folder"
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!value.trim()}>Rename</button>
        </>
      }
    >
      <form onSubmit={submit}>
        <label className="modal__field">
          <span className="text-meta">New name</span>
          <input
            className="input"
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
          />
          {error && <span className="modal__field-error">{error}</span>}
        </label>
      </form>
    </Modal>
  );
}
