// Thin wrapper around fetch that:
//  - Prefixes /api (or VITE_API_URL in prod where the frontend lives on a
//    different origin, e.g. flashr.io → api.flashr.io)
//  - Attaches the JWT from localStorage as Authorization: Bearer <token>
//  - On 401: silently attempts one token refresh via the flashr_rt http-only
//    cookie, retries the request, then dispatches 'flashr:logout' if refresh fails
//  - Throws ApiError with the server's error message on non-2xx responses

import { STORAGE_KEYS } from "./storageKeys";

const TOKEN_KEY = STORAGE_KEYS.TOKEN;
export const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ─── Silent refresh ───────────────────────────────────────────────────────────

// Deduplicates concurrent refresh attempts — all callers await the same promise.
let _refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshOnce(): Promise<boolean> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token?: string };
      if (data.token) {
        setToken(data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  _retried = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  const text = await res.text();
  const body = text ? safeParse(text) : null;

  // On 401: attempt a silent token refresh and retry the original request once.
  // Skip retry for the refresh and logout endpoints to prevent infinite loops.
  if (res.status === 401 && !_retried && path !== "/auth/refresh" && path !== "/auth/logout") {
    const refreshed = await tryRefreshOnce();
    if (refreshed) return api<T>(path, init, true);
    // Refresh failed — clear local token and signal the store to wipe the session.
    setToken(null);
    window.dispatchEvent(new CustomEvent("flashr:logout"));
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
