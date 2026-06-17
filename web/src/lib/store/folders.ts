import { api } from "../api";
import { state, setState, recountFolders } from "./db";
import { toast } from "../toast";

export const foldersApi = {
  create(name: string, emoji = "📁") {
    setState((db) => {
      if (db.folders.some((f) => f.name === name)) return db;
      return { ...db, folders: [...db.folders, { name, emoji, count: 0 }] };
    });
    toast.success(`Folder "${name}" created`);
  },

  rename(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const affected = state.collections.filter((c) => c.folder === oldName);
    setState((db) => {
      if (db.folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase() && f.name !== oldName)) return db;
      return {
        ...db,
        folders: db.folders.map((f) => f.name === oldName ? { ...f, name: trimmed } : f),
        collections: db.collections.map((c) => c.folder === oldName ? { ...c, folder: trimmed } : c),
      };
    });
    toast.success(`Folder renamed to "${trimmed}"`);
    void Promise.all(
      affected.map((c) =>
        api(`/collections/${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ folder: trimmed }),
        }).catch(console.error),
      ),
    );
  },

  remove(name: string) {
    const affected = state.collections.filter((c) => c.folder === name);
    setState((db) => ({
      ...db,
      folders: db.folders.filter((f) => f.name !== name),
      collections: db.collections.map((c) =>
        c.folder === name ? { ...c, folder: "" } : c,
      ),
    }));
    toast.success(`Folder "${name}" deleted`);
    void Promise.all(
      affected.map((c) =>
        api(`/collections/${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ folder: "" }),
        }).catch(console.error),
      ),
    );
  },
};

export { recountFolders };
