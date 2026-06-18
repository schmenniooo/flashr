import posthog from "posthog-js";

export function capture(event: string, properties?: Record<string, unknown>): void {
  try {
    posthog.capture(event, properties);
  } catch {
    // analytics must never interrupt the user flow
  }
}

export function identify(id: string, properties?: Record<string, unknown>): void {
  try {
    posthog.identify(id, properties);
  } catch {
    // analytics must never interrupt the user flow
  }
}

export function reset(): void {
  try {
    posthog.reset();
  } catch {
    // analytics must never interrupt the user flow
  }
}

export function captureException(error: Error, properties?: Record<string, unknown>): void {
  try {
    posthog.captureException(error, properties);
  } catch {
    // analytics must never interrupt the user flow
  }
}
