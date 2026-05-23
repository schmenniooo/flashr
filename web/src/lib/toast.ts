import { useSyncExternalStore } from "react";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

const DISMISS_MS = 4000;

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function getSnapshot() {
  return toasts;
}

export function subscribeToasts(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useToasts() {
  return useSyncExternalStore(subscribeToasts, getSnapshot, getSnapshot);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function add(type: ToastType, message: string) {
  const id = Math.random().toString(36).slice(2, 9);
  toasts = [...toasts, { id, type, message }];
  emit();
  setTimeout(() => dismissToast(id), DISMISS_MS);
}

export const toast = {
  success: (message: string) => add("success", message),
  error:   (message: string) => add("error", message),
  info:    (message: string) => add("info", message),
};
