import posthog from "posthog-js";

const UTM_SESSION_KEY = "flashr_utm";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function captureUtmContext(): Record<string, string> {
  try {
    if (sessionStorage.getItem(UTM_SESSION_KEY)) return getStoredUtm();
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of UTM_PARAMS) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }
    if (Object.keys(utm).length) sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utm));
    return utm;
  } catch {
    return {};
  }
}

export function getStoredUtm(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

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
