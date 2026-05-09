import { suggestions as suggestionCatalog } from "../../data/mock";
import { state, setState } from "./db";
import { collectionsApi } from "./collections";
import type { Db } from "./db";
import type { Collection, Suggestion } from "../../types";

const MAX_SUGGESTIONS = 4;
const EMPTY_SUGGESTIONS: Suggestion[] = [];

let suggestionsCache: {
  users: Db["users"];
  collections: Db["collections"];
  session: Db["session"];
  result: Suggestion[];
} | null = null;

export const selectSuggestionsForUser = (db: Db): Suggestion[] => {
  if (
    suggestionsCache &&
    suggestionsCache.users === db.users &&
    suggestionsCache.collections === db.collections &&
    suggestionsCache.session === db.session
  ) {
    return suggestionsCache.result;
  }

  const user = db.session
    ? db.users.find((u) => u.id === db.session!.userId)
    : null;

  let result: Suggestion[];
  if (!user || user.learnerTypes.length === 0) {
    result = EMPTY_SUGGESTIONS;
  } else {
    const types = new Set(user.learnerTypes);
    const dismissed = new Set(user.dismissedSuggestions);
    const existingNames = new Set(db.collections.map((c) => c.name.toLowerCase()));
    const filtered = suggestionCatalog
      .filter((s) => s.learnerTypes.some((t) => types.has(t)))
      .filter((s) => !dismissed.has(s.id))
      .filter((s) => !existingNames.has(s.title.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS);
    result = filtered.length === 0 ? EMPTY_SUGGESTIONS : filtered;
  }

  suggestionsCache = {
    users: db.users,
    collections: db.collections,
    session: db.session,
    result,
  };
  return result;
};

export const suggestionsApi = {
  dismiss(id: string) {
    const session = state.session;
    if (!session) return;
    setState((db) => ({
      ...db,
      users: db.users.map((u) =>
        u.id === session.userId
          ? {
              ...u,
              dismissedSuggestions: u.dismissedSuggestions.includes(id)
                ? u.dismissedSuggestions
                : [...u.dismissedSuggestions, id],
            }
          : u,
      ),
    }));
  },

  async accept(id: string): Promise<Collection | null> {
    const session = state.session;
    if (!session) return null;
    const suggestion = suggestionCatalog.find((s) => s.id === id);
    if (!suggestion) return null;

    setState((db) => ({
      ...db,
      users: db.users.map((u) =>
        u.id === session.userId
          ? {
              ...u,
              dismissedSuggestions: u.dismissedSuggestions.includes(id)
                ? u.dismissedSuggestions
                : [...u.dismissedSuggestions, id],
            }
          : u,
      ),
    }));

    setState((db) => {
      if (db.folders.some((f) => f.name === suggestion.folder)) return db;
      return {
        ...db,
        folders: [
          ...db.folders,
          { name: suggestion.folder, emoji: suggestion.folderEmoji, count: 0 },
        ],
      };
    });

    return collectionsApi.create({
      name: suggestion.title,
      folder: suggestion.folder,
      emoji: suggestion.emoji,
      description: suggestion.description,
    });
  },
};
