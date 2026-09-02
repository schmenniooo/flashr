import type { Collection, Folder } from "../types";
import type { StoredUser } from "./store/db";

export function buildExportPayload(
  user: StoredUser,
  collections: Collection[],
  folders: Folder[],
) {
  const { password: _password, id: _id, ...profile } = user;
  return {
    exportedAt: new Date().toISOString(),
    profile,
    folders,
    collections,
  };
}

export function downloadUserDataExport(
  user: StoredUser,
  collections: Collection[],
  folders: Folder[],
) {
  const payload = buildExportPayload(user, collections, folders);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flashr-export-${user.username || "account"}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
