import * as Sentry from '@sentry/react';

// DSN is injected at build time via VITE_SENTRY_DSN env var — never hardcode
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

// Keys that may contain baby/health/personal data — strip from all Sentry payloads
const SENSITIVE_KEYS = new Set([
  'logs', 'birth', 'babyName', 'name', 'phone', 'email',
  'emergencyContacts', 'meds', 'allergies', 'vaccines',
  'temperature', 'weight', 'height', 'headCirc',
  'firsts', 'teeth', 'profiles', 'activeProfile',
  'feedTimerApp', 'timerState', 'notes',
]);

/** Recursively strip sensitive keys from any object */
function scrub<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrub) as T;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      cleaned[k] = '[Redacted]';
    } else {
      cleaned[k] = typeof v === 'object' ? scrub(v) : v;
    }
  }
  return cleaned as T;
}

export function initSentry() {
  // Only init in production with a valid DSN
  if (import.meta.env.DEV || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // PRIVACY: never send IP, cookies, or user-identifiable info
    sendDefaultPii: false,

    // Performance — sample 20% of transactions
    tracesSampleRate: 0.2,

    // PRIVACY: disable session replay entirely — it captures DOM with baby data
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filter noisy errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'AbortError',
      /Loading chunk .* failed/,
    ],

    beforeSend(event) {
      // Scrub breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          data: b.data ? scrub(b.data) : b.data,
        }));
      }

      // Scrub extra context
      if (event.extra) event.extra = scrub(event.extra);
      if (event.contexts) event.contexts = scrub(event.contexts);

      // Scrub request body/query strings that might contain data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.query_string) event.request.query_string = '[Redacted]';
      }

      // Never attach user identity
      delete event.user;

      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Drop XHR/fetch breadcrumbs that might log IndexedDB data in URLs
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        return breadcrumb;
      }
      // Drop console breadcrumbs (may contain logged baby data)
      if (breadcrumb.category === 'console') {
        return null;
      }
      return breadcrumb;
    },
  });
}

export { Sentry };
