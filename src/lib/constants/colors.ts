// Color themes for light and dark modes
// Each color has semantic meaning: p=primary, s=secondary, t=text, b=border, etc.

export interface Colors {
  bg: string;  // background
  cd: string;  // card
  p: string;   // primary
  pl: string;  // primary light
  s: string;   // secondary
  sl: string;  // secondary light
  a: string;   // accent
  al: string;  // accent light
  w: string;   // warning
  wl: string;  // warning light
  t: string;   // text
  tl: string;  // text light
  b: string;   // border
  ok: string;  // ok/success
  okl: string; // ok light
  bl: string;  // blue
  bll: string; // blue light
  pu: string;  // purple
  pul: string; // purple light
}

export const C_LIGHT: Colors = {
  bg: "#FFF8F0",
  cd: "#FFFFFF",
  p: "#FF6B8A",
  pl: "#FFE0E8",
  s: "#6C63FF",
  sl: "#E8E6FF",
  a: "#00C9A7",
  al: "#E0FFF8",
  w: "#FFB347",
  wl: "#FFF3E0",
  t: "#2D2D3A",
  tl: "#8E8E9A",
  b: "#F0EBE3",
  ok: "#4CAF50",
  okl: "#E8F5E9",
  bl: "#42A5F5",
  bll: "#E3F2FD",
  pu: "#AB47BC",
  pul: "#F3E5F5",
};

export const C_DARK: Colors = {
  bg: "#1A1A2E",
  cd: "#16213E",
  p: "#FF6B8A",
  pl: "#3D1F2E",
  s: "#8B83FF",
  sl: "#2A2654",
  a: "#00C9A7",
  al: "#1A3330",
  w: "#FFB347",
  wl: "#3D2E1A",
  t: "#E8E8F0",
  tl: "#7A7A8E",
  b: "#2A2A4A",
  ok: "#4CAF50",
  okl: "#1A3320",
  bl: "#42A5F5",
  bll: "#1A2A3E",
  pu: "#CE93D8",
  pul: "#2E1F3E",
};

// Mutable color object that is applied at runtime
export const C: Colors = Object.assign({}, C_LIGHT);

/**
 * Apply theme to the app
 * Updates the global C object and document styles
 */
export function applyTheme(dark: boolean): void {
  Object.assign(C, dark ? C_DARK : C_LIGHT);

  // Update document background and text color
  document.body.style.background = C.bg;
  document.body.style.color = C.t;

  // Update theme color meta tag to match nav gradient start
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', dark ? C.sl : C.a);
  }

  // Make status bar transparent so the header gradient shows through
  const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBarMeta) {
    statusBarMeta.setAttribute('content', 'black-translucent');
  }

  // Update CSS custom properties for modal background
  document.documentElement.style.setProperty(
    '--modal-bg',
    dark ? '#16213E' : '#fff'
  );
}
