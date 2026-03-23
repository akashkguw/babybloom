import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/base.css';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
