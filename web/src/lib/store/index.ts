// Core engine
export { useDb, selectNow, resetLocalDb } from "./db";
export type { StoredUser, Session } from "./db";

// Selectors
export {
  selectBootstrapping,
  selectSession,
  selectCurrentUser,
  selectCollections,
  selectFolders,
  selectCollection,
  selectTotalCards,
  selectCardsDueToday,
  selectKnownCards,
} from "./db";

// Domain actions
export { auth } from "./auth";
export { collectionsApi } from "./collections";
export { cardsApi } from "./cards";
export { foldersApi } from "./folders";
export { suggestionsApi, selectSuggestionsForUser } from "./suggestions";
export { billingApi } from "./billing";

// Domain types (single import point for the whole app)
export type { Card, Collection, Folder, LearnerType, Suggestion, User } from "../../types";

// Expose dev helpers on window for browser console access.
if (typeof window !== "undefined") {
  import("./auth").then(({ auth }) => {
    (window as unknown as Record<string, unknown>).flashrSignInAsDemo = () => auth.signInAsDemo();
  });
}

