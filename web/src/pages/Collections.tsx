import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Sparkles, Grid3x3, List, ArrowUpDown, Filter, Trash2, X, Pencil, Check } from "lucide-react";

type SortKey = "name-asc" | "name-desc" | "cards-desc" | "cards-asc" | "progress-desc" | "progress-asc" | "created-desc" | "created-asc";
type FilterKey = "all" | "not-started" | "in-progress" | "mastered" | "ai";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc",      label: "Name A–Z" },
  { key: "name-desc",     label: "Name Z–A" },
  { key: "cards-desc",    label: "Most cards" },
  { key: "cards-asc",     label: "Fewest cards" },
  { key: "progress-desc", label: "Progress: highest" },
  { key: "progress-asc",  label: "Progress: lowest" },
  { key: "created-desc",  label: "Newest" },
  { key: "created-asc",   label: "Oldest" },
];

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "not-started", label: "Not started" },
  { key: "in-progress", label: "In progress" },
  { key: "mastered",    label: "Mastered" },
  { key: "ai",          label: "Has AI cards" },
];
import {
  foldersApi,
  selectCollections,
  selectCurrentUser,
  selectFolders,
  useDb,
} from "../lib/store";
import { CollectionCard } from "../components/CollectionCard";
import { CreateCollectionModal } from "../components/CreateCollectionModal";
import { EditCollectionModal } from "../components/EditCollectionModal";
import { Modal } from "../components/Modal";
import { NewFolderModal } from "../components/NewFolderModal";
import { RenameFolderModal } from "../components/RenameFolderModal";
import { UpgradePrompt } from "../components/UpgradePrompt";
import type { Collection } from "../lib/store";
import "./Collections.css";

const FREE_COLLECTION_LIMIT = 3;

export function Collections() {
  const navigate = useNavigate();
  const collections = useDb(selectCollections);
  const folders = useDb(selectFolders);
  const currentUser = useDb(selectCurrentUser);
  const isPro = currentUser?.plan === "pro";
  const atCollectionLimit = !isPro && collections.length >= FREE_COLLECTION_LIMIT;

  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchParams, setSearchParams] = useSearchParams();
  const folderParam = searchParams.get("folder");
  const [filter, setFilter] = useState<string>(folderParam ?? "All");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [filterType, setFilterType] = useState<FilterKey>("all");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [folderToRename, setFolderToRename] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  const [prevFolderParam, setPrevFolderParam] = useState(folderParam);
  if (prevFolderParam !== folderParam) {
    setPrevFolderParam(folderParam);
    setFilter(folderParam ?? "All");
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sortOpen, filterOpen]);

  function selectFilter(value: string) {
    setFilter(value);
    if (value === "All") {
      searchParams.delete("folder");
    } else {
      searchParams.set("folder", value);
    }
    setSearchParams(searchParams, { replace: true });
  }

  const folderFiltered =
    filter === "All" ? collections : collections.filter((c) => c.folder === filter);

  const typeFiltered =
    filterType === "all"         ? folderFiltered :
    filterType === "not-started" ? folderFiltered.filter((c) => c.progress === 0) :
    filterType === "in-progress" ? folderFiltered.filter((c) => c.progress > 0 && c.progress < 100) :
    filterType === "mastered"    ? folderFiltered.filter((c) => c.progress === 100) :
    folderFiltered.filter((c) => c.cards.some((card) => card.aiGenerated));

  const displayed = [...typeFiltered].sort((a, b) => {
    switch (sort) {
      case "name-asc":      return a.name.localeCompare(b.name);
      case "name-desc":     return b.name.localeCompare(a.name);
      case "cards-desc":    return b.cards.length - a.cards.length;
      case "cards-asc":     return a.cards.length - b.cards.length;
      case "progress-desc": return b.progress - a.progress;
      case "progress-asc":  return a.progress - b.progress;
      case "created-desc":  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "created-asc":   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });

  return (
    <div className="cols">
      <header className="cols__head">
        <div>
          <span className="text-meta">{collections.length} collections · {folders.length} folders</span>
          <h1 className="text-h1 cols__title">All collections</h1>
          <p className="text-body cols__subtitle">
            This is where all your knowledge lives. Click a collection to open it or start studying.
          </p>
        </div>
        <div className="cols__head-cta">
          <button
            className="btn-ghost"
            onClick={() => atCollectionLimit ? undefined : setCreateOpen(true)}
            disabled={atCollectionLimit}
            title={atCollectionLimit ? "Collection limit reached — upgrade to Pro" : undefined}
          >
            <Plus size={14} strokeWidth={2} />
            New collection
          </button>
          <a href="/app/upload" className="btn-primary">
            <Sparkles size={14} strokeWidth={2} />
            Create with AI
          </a>
        </div>
      </header>

      {atCollectionLimit && (
        <UpgradePrompt reason={`You've reached the ${FREE_COLLECTION_LIMIT}-collection limit on the Free plan. Upgrade for unlimited collections.`} />
      )}

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
              className={`cols__chip cols__chip--group ${filter === f.name ? "cols__chip--active" : ""}`}
            >
              <button className="cols__chip-main" onClick={() => selectFilter(f.name)}>
                <span>{f.emoji}</span>
                {f.name}
                <span className="cols__chip-count">{f.count}</span>
              </button>
              <button
                className="cols__chip-action"
                title={`Edit folder: ${f.name}`}
                aria-label={`Edit folder: ${f.name}`}
                onClick={(e) => { e.stopPropagation(); setFolderToRename(f.name); }}
              >
                <Pencil size={10} strokeWidth={2.2} />
              </button>
              <button
                className="cols__chip-del"
                title={`Delete folder ${f.name}`}
                aria-label={`Delete folder ${f.name}`}
                onClick={(e) => { e.stopPropagation(); setFolderToDelete(f.name); }}
              >
                <X size={11} strokeWidth={2.2} />
              </button>
            </div>
          ))}
          <button className="cols__chip cols__chip--add" onClick={() => setNewFolderOpen(true)} title="Add folder">
            <Plus size={12} strokeWidth={2} />
            New folder
          </button>
        </div>
        <div className="cols__view">
          <div className="cols__dropdown-wrap" ref={filterRef}>
            <button
              className={`cols__icon-btn ${filterType !== "all" ? "cols__icon-btn--active" : ""}`}
              title="Filter"
              onClick={() => { setFilterOpen((o) => !o); setSortOpen(false); }}
            >
              <Filter size={14} strokeWidth={1.8} />
            </button>
            {filterOpen && (
              <div className="cols__dropdown">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`cols__dropdown-item ${filterType === opt.key ? "cols__dropdown-item--active" : ""}`}
                    onClick={() => { setFilterType(opt.key); setFilterOpen(false); }}
                  >
                    {opt.label}
                    {filterType === opt.key && <Check size={12} strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cols__dropdown-wrap" ref={sortRef}>
            <button
              className={`cols__icon-btn ${sort !== "name-asc" ? "cols__icon-btn--active" : ""}`}
              title="Sort"
              onClick={() => { setSortOpen((o) => !o); setFilterOpen(false); }}
            >
              <ArrowUpDown size={14} strokeWidth={1.8} />
            </button>
            {sortOpen && (
              <div className="cols__dropdown">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`cols__dropdown-item ${sort === opt.key ? "cols__dropdown-item--active" : ""}`}
                    onClick={() => { setSort(opt.key); setSortOpen(false); }}
                  >
                    {opt.label}
                    {sort === opt.key && <Check size={12} strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cols__view-toggle">
            <button className={`cols__icon-btn ${view === "grid" ? "cols__icon-btn--active" : ""}`} onClick={() => setView("grid")} title="Grid">
              <Grid3x3 size={14} strokeWidth={1.8} />
            </button>
            <button className={`cols__icon-btn ${view === "list" ? "cols__icon-btn--active" : ""}`} onClick={() => setView("list")} title="List">
              <List size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="cols__empty">
          <span className="text-meta">Nothing here yet</span>
          <h2 className="text-h2 cols__empty-title">
            {filterType !== "all"
              ? `No collections match this filter.`
              : filter === "All"
              ? "Create your first collection."
              : `No collections in ${filter} — add one?`}
          </h2>
          <p className="text-body cols__empty-body">
            Collections hold your cards. Group them by subject, course, or whatever makes sense to you.
          </p>
          <button
            className="btn-primary cols__empty-cta"
            onClick={() => !atCollectionLimit && setCreateOpen(true)}
            disabled={atCollectionLimit}
          >
            <Plus size={14} strokeWidth={2} />
            New collection
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="cols__grid">
          {displayed.map((c) => (
            <CollectionCard key={c.id} collection={c} onEdit={() => setEditingCollection(c)} />
          ))}
        </div>
      ) : (
        <div className="cols__list">
          {displayed.map((c) => (
            <div key={c.id} className="cols__row" onClick={() => navigate(`/app/c/${c.id}`)}>
              <span className="cols__row-emoji">{c.emoji}</span>
              <div className="cols__row-main">
                <div className="cols__row-title">{c.name}</div>
                <div className="cols__row-meta">{c.folder} · {c.cards.length} cards · {c.lastStudied}</div>
              </div>
              <div className="cols__row-progress">
                <div className="cols__row-progress-bar">
                  <div className="cols__row-progress-fill" style={{ width: `${c.progress}%` }} />
                </div>
                <span>{c.progress}%</span>
              </div>
              <button
                className="cols__row-edit"
                title="Edit collection"
                onClick={(e) => { e.stopPropagation(); setEditingCollection(c); }}
              >
                <Pencil size={13} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateCollectionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => { setCreateOpen(false); navigate(`/app/c/${id}`); }}
        defaultFolder={filter !== "All" ? filter : folders[0]?.name ?? "Uncategorized"}
      />

      <NewFolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onCreated={(name) => selectFilter(name)} />

      {editingCollection && (
        <EditCollectionModal
          open
          onClose={() => setEditingCollection(null)}
          collectionId={editingCollection.id}
          initial={{
            name: editingCollection.name,
            folder: editingCollection.folder,
            emoji: editingCollection.emoji,
            description: editingCollection.description,
          }}
        />
      )}

      <RenameFolderModal
        name={folderToRename}
        onClose={() => setFolderToRename(null)}
        onRenamed={(oldName, newName) => {
          foldersApi.rename(oldName, newName);
          if (filter === oldName) selectFilter(newName);
          setFolderToRename(null);
        }}
        existingNames={folders.map((f) => f.name)}
      />

      <Modal
        open={folderToDelete !== null}
        onClose={() => setFolderToDelete(null)}
        title="Delete this folder?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setFolderToDelete(null)}>Cancel</button>
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
              The folder <strong className="cols__strong">{folderToDelete}</strong> will be removed.
              {count > 0 ? (
                <> Its {count} collection{count === 1 ? "" : "s"} stay safe — they'll move to <strong className="cols__strong">Uncategorized</strong>.</>
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
