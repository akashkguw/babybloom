import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/base.css';
import { isNative, initNativeApp, hideSplash, setStatusBarStyle } from '@/lib/native';

// Initialize Sentry — wrapped so a failure never blocks the app
import('@/lib/sentry')
  .then(({ initSentry }) => initSentry())
  .catch(() => { /* Sentry unavailable — app runs fine without it */ });

// Initialize native platform features (Capacitor)
if (isNative) {
  initNativeApp();
  // Hide splash screen after a short delay to let React render
  setTimeout(() => hideSplash(), 500);
  // Set initial status bar style (dark mode is default)
  setStatusBarStyle(true);
}

// Service worker registration is handled by vite-plugin-pwa (registerType: 'autoUpdate')
// VitePWA now uses sw-v2.js — unregister the old sw.js on existing installs.
// Only applies to web builds; native apps don't use service workers.
if (!isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      // Unregister the legacy sw.js; VitePWA now registers sw-v2.js instead.
      // This forces iOS to re-register the SW with the new filename, which
      // guarantees existing installs pick up the latest assets.
      const url = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? '';
      if (url.endsWith('/sw.js')) {
        reg.unregister();
      }
    });
  });
  // Clear caches from the old cacheId ('babybloom'). The new cacheId is
  // 'babybloom-v2', so only delete caches matching the OLD precache pattern.
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        // Old Workbox caches: 'babybloom-precache-*' and 'babybloom-runtime'
        // Do NOT delete 'babybloom-v2-*' — that's the current live cache.
        if (name.startsWith('babybloom-precache') || name === 'babybloom-runtime') {
          caches.delete(name);
        }
      });
    });
  }
}

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

// Standalone error boundary — zero dependency on Sentry
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Try to report to Sentry if available, but never throw
    try {
      import('@/lib/sentry').then(({ Sentry }) => {
        Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
      });
    } catch {
      // Sentry not available — that's fine
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666', margin: '1rem 0' }}>
            The error has been reported automatically.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: '#6C63FF',
              color: '#fff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
