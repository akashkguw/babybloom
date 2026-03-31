/**
 * Native platform integration via Capacitor
 *
 * This module provides a bridge between the web app and native APIs.
 * On web, all calls gracefully no-op. On iOS/Android, they use native plugins.
 */

import { Capacitor } from '@capacitor/core';

/** True when running inside a native iOS or Android shell */
export const isNative = Capacitor.isNativePlatform();

/** Current platform: 'ios' | 'android' | 'web' */
export const platform = Capacitor.getPlatform();

// ──────────────────────────────────────────────
// Status Bar
// ──────────────────────────────────────────────

let StatusBar: any = null;

async function loadStatusBar() {
  if (!isNative) return;
  try {
    const mod = await import('@capacitor/status-bar');
    StatusBar = mod.StatusBar;
  } catch {
    // Plugin not available
  }
}

/** Set the status bar style for the current theme */
export async function setStatusBarStyle(darkMode: boolean) {
  if (!StatusBar) await loadStatusBar();
  if (!StatusBar) return;
  try {
    await StatusBar.setStyle({
      style: darkMode ? 'LIGHT' : 'DARK', // Light text for dark bg, dark text for light bg
    });
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({
        color: darkMode ? '#1A1A2E' : '#FFF8F0',
      });
    }
  } catch {
    // Graceful fallback
  }
}

// ──────────────────────────────────────────────
// Haptics
// ──────────────────────────────────────────────

let Haptics: any = null;
let ImpactStyle: any = null;
let NotificationType: any = null;

async function loadHaptics() {
  if (!isNative) return;
  try {
    const mod = await import('@capacitor/haptics');
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
    NotificationType = mod.NotificationType;
  } catch {
    // Plugin not available
  }
}

/** Light haptic tap — use for button presses and toggles */
export async function hapticTap() {
  if (!Haptics) await loadHaptics();
  if (!Haptics) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Graceful fallback
  }
}

/** Medium haptic — use for confirming actions (log saved, timer started) */
export async function hapticConfirm() {
  if (!Haptics) await loadHaptics();
  if (!Haptics) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Graceful fallback
  }
}

/** Warning haptic — use for alerts and important notices */
export async function hapticWarning() {
  if (!Haptics) await loadHaptics();
  if (!Haptics) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // Graceful fallback
  }
}

// ──────────────────────────────────────────────
// Keyboard
// ──────────────────────────────────────────────

let Keyboard: any = null;

async function loadKeyboard() {
  if (!isNative) return;
  try {
    const mod = await import('@capacitor/keyboard');
    Keyboard = mod.Keyboard;
  } catch {
    // Plugin not available
  }
}

/** Hide the native keyboard */
export async function hideKeyboard() {
  if (!Keyboard) await loadKeyboard();
  if (!Keyboard) return;
  try {
    await Keyboard.hide();
  } catch {
    // Graceful fallback
  }
}

// ──────────────────────────────────────────────
// Local Notifications (replaces web Notification API)
// ──────────────────────────────────────────────

let LocalNotifications: any = null;

async function loadLocalNotifications() {
  if (!isNative) return;
  try {
    const mod = await import('@capacitor/local-notifications');
    LocalNotifications = mod.LocalNotifications;
  } catch {
    // Plugin not available
  }
}

/** Schedule a local notification (native) or show a web notification (web) */
export async function sendNotification(title: string, body: string) {
  if (isNative) {
    if (!LocalNotifications) await loadLocalNotifications();
    if (!LocalNotifications) return;
    try {
      const perms = await LocalNotifications.requestPermissions();
      if (perms.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 1000) },
              sound: undefined,
              smallIcon: 'ic_stat_babybloom',
              iconColor: '#FF6B8A',
            },
          ],
        });
      }
    } catch {
      // Graceful fallback
    }
  } else {
    // Web fallback — use the existing Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="80">🍼</text></svg>',
      });
    }
  }
}

// ──────────────────────────────────────────────
// App lifecycle (back button, URL open, etc.)
// ──────────────────────────────────────────────

let App: any = null;

async function loadApp() {
  if (!isNative) return;
  try {
    const mod = await import('@capacitor/app');
    App = mod.App;
  } catch {
    // Plugin not available
  }
}

/** Initialize native app lifecycle handlers */
export async function initNativeApp() {
  if (!isNative) return;

  if (!App) await loadApp();
  if (!App) return;

  // Handle Android back button — close the app if on the main screen
  App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // Handle deep links (e.g., babybloom://quick?action=diaper or babybloom://oauth?code=...)
  App.addListener('appUrlOpen', ({ url }: { url: string }) => {
    try {
      const u = new URL(url);
      // OAuth callback — dispatch dedicated event for CloudSync to handle
      if (u.host === 'oauth' || u.pathname === '/oauth') {
        window.dispatchEvent(new CustomEvent('babybloom:oauth', { detail: { url } }));
        return;
      }
      const params = u.searchParams;
      // Dispatch a custom event that App.tsx can listen for
      window.dispatchEvent(
        new CustomEvent('babybloom:deeplink', { detail: { params } })
      );
    } catch {
      // Invalid URL — ignore
    }
  });
}

// ──────────────────────────────────────────────
// Splash Screen
// ──────────────────────────────────────────────

let SplashScreen: any = null;

async function loadSplashScreen() {
  if (!isNative) return;
  try {
    const mod = await import('@capacitor/splash-screen');
    SplashScreen = mod.SplashScreen;
  } catch {
    // Plugin not available
  }
}

/** Hide the native splash screen (call after app is ready) */
export async function hideSplash() {
  if (!SplashScreen) await loadSplashScreen();
  if (!SplashScreen) return;
  try {
    await SplashScreen.hide();
  } catch {
    // Graceful fallback
  }
}
