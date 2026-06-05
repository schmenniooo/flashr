import { api } from "../api";
import { state, setState, recalcProgress, recountFolders } from "./db";
import { toast } from "../toast";
import type { Collection, Card } from "../../types";

// ─────────────────────────────────────────────────────────────
// Backend ↔ frontend mapping
// ─────────────────────────────────────────────────────────────

type BackendCard = {
  id: string;
  question: string;
  answer: string;
  ai_generated: boolean;
  created_at: string;
  mastery: "new" | "learning" | "known";
  interval: number;
  ease_factor: number;
  repetitions: number;
  due_date: string | null;
};

type BackendCollection = {
  id: string;
  name: string;
  folder: string;
  emoji: string;
  description: string;
  is_public: boolean;
  created_at: string;
  cards: BackendCard[];
};

export type { BackendCard, BackendCollection };

export function mapCard(bc: BackendCard, masteryMap: Record<string, Card["mastery"]>): Card {
  return {
    id: bc.id,
    question: bc.question,
    answer: bc.answer,
    aiGenerated: bc.ai_generated,
    // Use backend-computed mastery for reviewed cards; fall back to localStorage for new ones.
    mastery: bc.repetitions > 0 ? bc.mastery : (masteryMap[bc.id] ?? bc.mastery ?? "new"),
    dueDate: bc.due_date ?? null,
    interval: bc.interval ?? 1,
    easeFactor: bc.ease_factor ?? 2.5,
    repetitions: bc.repetitions ?? 0,
  };
}

export function mapCollection(bc: BackendCollection, masteryMap: Record<string, Card["mastery"]>, existing?: Collection): Collection {
  const cards = bc.cards.map((k) => mapCard(k, masteryMap));
  const progress = cards.length === 0 ? 0 : Math.round(
    (cards.reduce((s, k) => s + (k.mastery === "known" ? 1 : k.mastery === "learning" ? 0.5 : 0), 0) / cards.length) * 100
  );
  return {
    id: bc.id,
    name: bc.name,
    folder: bc.folder,
    emoji: bc.emoji,
    description: bc.description,
    isPublic: bc.is_public,
    createdAt: bc.created_at,
    cards,
    lastStudied: existing?.lastStudied ?? "never",
    progress,
  };
}

// ─────────────────────────────────────────────────────────────
// Collections actions
// ─────────────────────────────────────────────────────────────

export const collectionsApi = {
  async load(): Promise<void> {
    setState((db) => ({ ...db, collectionsLoading: true }));
    try {
      const res = await api<{ collections: BackendCollection[] }>("/collections");
      setState((db) => {
        const collections = res.collections.map((bc) =>
          mapCollection(bc, db.masteryMap, db.collections.find((c) => c.id === bc.id))
        );
        const known = new Set(db.folders.map((f) => f.name));
        const merged = [...db.folders];
        for (const c of collections) {
          if (c.folder && !known.has(c.folder)) {
            merged.push({ name: c.folder, emoji: "📁", count: 0 });
            known.add(c.folder);
          }
        }
        return { ...db, collections, folders: recountFolders(merged, collections), collectionsLoading: false };
      });
    } catch (err) {
      setState((db) => ({ ...db, collectionsLoading: false }));
      throw err;
    }
  },

  async create(input: {
    name: string;
    folder: string;
    emoji?: string;
    description?: string;
  }): Promise<Collection> {
    try {
      const bc = await api<BackendCollection>("/collections", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          folder: input.folder === "Uncategorized" ? "" : input.folder,
          emoji: input.emoji || "📚",
          description: input.description || "",
        }),
      });
      const col = mapCollection(bc, state.masteryMap);
      setState((db) => {
        const collections = [col, ...db.collections];
        const known = new Set(db.folders.map((f) => f.name));
        const folders = col.folder && !known.has(col.folder)
          ? [...db.folders, { name: col.folder, emoji: "📁", count: 0 }]
          : db.folders;
        return { ...db, collections, folders: recountFolders(folders, collections) };
      });
      toast.success(`Collection "${col.name}" created`);
      return col;
    } catch (err) {
      toast.error("Failed to create collection");
      throw err;
    }
  },

  async update(id: string, patch: Partial<Omit<Collection, "id" | "cards">>): Promise<void> {
    const snapshot = state.collections.find(c => c.id === id);

    setState((db) => {
      const existing = db.collections.find(c => c.id === id);
      if (!existing) return db;
      const updated = recalcProgress({ ...existing, ...patch });
      const collections = db.collections.map(c => c.id === id ? updated : c);
      const known = new Set(db.folders.map(f => f.name));
      const folders = updated.folder && !known.has(updated.folder)
        ? [...db.folders, { name: updated.folder, emoji: "📁", count: 0 }]
        : db.folders;
      return { ...db, collections, folders: recountFolders(folders, collections) };
    });

    try {
      const bc = await api<BackendCollection>(`/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: patch.name,
          folder: patch.folder === "Uncategorized" ? "" : patch.folder,
          emoji: patch.emoji,
          description: patch.description,
        }),
      });
      setState((db) => {
        const existing = db.collections.find(c => c.id === id);
        const updated = recalcProgress({
          ...mapCollection(bc, db.masteryMap, existing),
          cards: existing?.cards ?? [],
          lastStudied: patch.lastStudied ?? existing?.lastStudied ?? "never",
        });
        const collections = db.collections.map(c => c.id === id ? updated : c);
        const known = new Set(db.folders.map(f => f.name));
        const folders = updated.folder && !known.has(updated.folder)
          ? [...db.folders, { name: updated.folder, emoji: "📁", count: 0 }]
          : db.folders;
        return { ...db, collections, folders: recountFolders(folders, collections) };
      });
    toast.success("Collection updated");
    } catch (err) {
      if (snapshot) {
        setState((db) => {
          const collections = db.collections.map(c => c.id === id ? snapshot : c);
          return { ...db, collections, folders: recountFolders(db.folders, collections) };
        });
      }
      toast.error("Failed to update collection");
      throw err;
    }
  },

  async remove(id: string): Promise<void> {
    const name = state.collections.find((c) => c.id === id)?.name;
    try {
      await api(`/collections/${id}`, { method: "DELETE" });
      setState((db) => {
        const collections = db.collections.filter((c) => c.id !== id);
        return { ...db, collections, folders: recountFolders(db.folders, collections) };
      });
      toast.success(name ? `"${name}" deleted` : "Collection deleted");
    } catch (err) {
      toast.error("Failed to delete collection");
      throw err;
    }
  },

  touch(id: string) {
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === id ? { ...c, lastStudied: "just now" } : c,
      ),
    }));
  },
};
