import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initSentry } from '@/lib/sentry';
import App from './App';
import './styles/base.css';

// Initialize Sentry error tracking (production only)
initSentry();

// Service worker registration is handled by vite-plugin-pwa (registerType: 'autoUpdate')
// Clean up any old service workers from v1 that might cache stale pages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      // If a SW is active but not from vite-plugin-pwa, unregister it
      if (reg.active && reg.active.scriptURL && reg.active.scriptURL.endsWith('/sw.js')) {
        reg.unregister();
      }
    });
  });
  // Also clear old v1 caches
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name.startsWith('babybloom-v')) {
          caches.delete(name);
        }
      });
    });
  }
}

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

// Fallback UI when the app crashes
function CrashFallback() {
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
