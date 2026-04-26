import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Sparkles, Grid3x3, List, ArrowUpDown, Filter, Trash2, X } from "lucide-react";
import {
  collectionsApi,
  foldersApi,
  selectCollections,
  selectFolders,
  useDb,
} from "../lib/store";
import { CollectionCard } from "../components/CollectionCard";
import { Modal } from "../components/Modal";
import { NewFolderModal } from "../components/NewFolderModal";
import "./Collections.css";

export function Collections() {
  const navigate = useNavigate();
  const collections = useDb(selectCollections);
  const folders = useDb(selectFolders);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchParams, setSearchParams] = useSearchParams();
  const folderParam = searchParams.get("folder");
  const [filter, setFilter] = useState<string>(folderParam ?? "All");
  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  const [prevFolderParam, setPrevFolderParam] = useState(folderParam);
  if (prevFolderParam !== folderParam) {
    setPrevFolderParam(folderParam);
    setFilter(folderParam ?? "All");
  }

  function selectFilter(value: string) {
    setFilter(value);
    if (value === "All") {
      searchParams.delete("folder");
    } else {
      searchParams.set("folder", value);
    }
    setSearchParams(searchParams, { replace: true });
  }

  const filtered =
    filter === "All" ? collections : collections.filter((c) => c.folder === filter);

  return (
    <div className="cols">
      <header className="cols__head">
        <div>
          <span className="text-meta">{collections.length} collections · {folders.length} folders</span>
          <h1 className="text-h1" style={{ marginTop: 8 }}>All collections</h1>
          <p className="text-body" style={{ marginTop: 4 }}>
            This is where all your knowledge lives. Click a collection to open it or start studying.
          </p>
        </div>
        <div className="cols__head-cta">
          <button className="btn-ghost" onClick={() => setCreateOpen(true)}>
            <Plus size={14} strokeWidth={2} />
            New collection
          </button>
          <Link to="/app/upload" className="btn-primary">
            <Sparkles size={14} strokeWidth={2} />
            Create with AI
          </Link>
        </div>
      </header>

      <div className="cols__toolbar">
        <div className="cols__filters">
          <button
            className={`cols__chip ${filter === "All" ? "cols__chip--active" : ""}`}
            onClick={() => selectFilter("All")}
          >
            All <span className="cols__chip-count">{collections.length}</span>
          </button>
          {folders.map((f) => (
            <div
              key={f.name}
              className={`cols__chip cols__chip--group ${
                filter === f.name ? "cols__chip--active" : ""
              }`}
            >
              <button
                className="cols__chip-main"
                onClick={() => selectFilter(f.name)}
              >
                <span>{f.emoji}</span>
                {f.name}
                <span className="cols__chip-count">{f.count}</span>
              </button>
              <button
                className="cols__chip-del"
                title={`Delete folder ${f.name}`}
                aria-label={`Delete folder ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderToDelete(f.name);
                }}
              >
                <X size={11} strokeWidth={2.2} />
              </button>
            </div>
          ))}
          <button
            className="cols__chip cols__chip--add"
            onClick={() => setNewFolderOpen(true)}
            title="Add folder"
          >
            <Plus size={12} strokeWidth={2} />
            New folder
          </button>
        </div>
        <div className="cols__view">
          <button className="cols__icon-btn" title="Filter">
            <Filter size={14} strokeWidth={1.8} />
          </button>
          <button className="cols__icon-btn" title="Sort">
            <ArrowUpDown size={14} strokeWidth={1.8} />
          </button>
          <div className="cols__view-toggle">
            <button
              className={`cols__icon-btn ${view === "grid" ? "cols__icon-btn--active" : ""}`}
              onClick={() => setView("grid")}
              title="Grid"
            >
              <Grid3x3 size={14} strokeWidth={1.8} />
            </button>
            <button
              className={`cols__icon-btn ${view === "list" ? "cols__icon-btn--active" : ""}`}
              onClick={() => setView("list")}
              title="List"
            >
              <List size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cols__empty">
          <span className="text-meta">Nothing here yet</span>
          <h2 className="text-h2" style={{ marginTop: 8 }}>
            {filter === "All"
              ? "Create your first collection."
              : `No collections in ${filter} — add one?`}
          </h2>
          <p className="text-body" style={{ marginTop: 4, maxWidth: 420 }}>
            Collections hold your cards. Group them by subject, course, or whatever makes sense to you.
          </p>
          <button className="btn-primary" onClick={() => setCreateOpen(true)} style={{ marginTop: 16 }}>
            <Plus size={14} strokeWidth={2} />
            New collection
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="cols__grid">
          {filtered.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <div className="cols__list">
          {filtered.map((c) => (
            <Link key={c.id} to={`/app/c/${c.id}`} className="cols__row">
              <span className="cols__row-emoji">{c.emoji}</span>
              <div className="cols__row-main">
                <div className="cols__row-title">{c.name}</div>
                <div className="cols__row-meta">
                  {c.folder} · {c.cards.length} cards · {c.lastStudied}
                </div>
              </div>
              <div className="cols__row-progress">
                <div className="cols__row-progress-bar">
                  <div
                    className="cols__row-progress-fill"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
                <span>{c.progress}%</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateCollectionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          navigate(`/app/c/${id}`);
        }}
        defaultFolder={filter !== "All" ? filter : folders[0]?.name ?? "Uncategorized"}
      />

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreated={(name) => selectFilter(name)}
      />

      <Modal
        open={folderToDelete !== null}
        onClose={() => setFolderToDelete(null)}
        title="Delete this folder?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setFolderToDelete(null)}>
              Cancel
            </button>
            <button
              className="modal__btn-danger"
              onClick={() => {
                if (!folderToDelete) return;
                foldersApi.remove(folderToDelete);
                if (filter === folderToDelete) selectFilter("All");
                setFolderToDelete(null);
              }}
            >
              <Trash2 size={13} strokeWidth={2} />
              Delete folder
            </button>
          </>
        }
      >
        {folderToDelete && (() => {
          const count = collections.filter((c) => c.folder === folderToDelete).length;
          return (
            <p className="text-body">
              The folder <strong style={{ color: "var(--color-text)" }}>{folderToDelete}</strong>{" "}
              will be removed.
              {count > 0 ? (
                <>
                  {" "}
                  Its {count} collection{count === 1 ? "" : "s"} stay safe — they'll move to{" "}
                  <strong style={{ color: "var(--color-text)" }}>Uncategorized</strong>.
                </>
              ) : (
                " It's empty, so nothing else changes."
              )}
            </p>
          );
        })()}
      </Modal>
    </div>
  );
}

function CreateCollectionModal({
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const col = collectionsApi.create({
      name: name.trim(),
      folder,
      emoji: emoji || "📚",
      description: description.trim(),
    });
    onCreated(col.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New collection"
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
            type="submit"
          >
            <Plus size={14} strokeWidth={2} />
            Create
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="modal__body" style={{ padding: 0 }}>
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
          <select
            className="input"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            {folders.map((f) => (
              <option key={f.name} value={f.name}>
                {f.emoji} {f.name}
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
            placeholder="Optional — what's this collection about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}
