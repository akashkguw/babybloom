import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Theme-color meta tag — must match nav gradient start (#149)
 *
 * The dynamic island / status bar area color is controlled by the
 * <meta name="theme-color"> tag. It must match the nav bar gradient
 * start color in both light and dark modes.
 *
 * Light nav gradient: linear-gradient(135deg, #FF6B8A, …)
 * Dark nav gradient:  linear-gradient(135deg, C.sl, C.pl)
 *   where C.sl = #2A2654
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../../src');
const colorsFile = fs.readFileSync(path.join(srcDir, 'lib/constants/colors.ts'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const appFile = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');

describe('Theme-color matches nav gradient start (#149)', () => {
  it('applyTheme sets light-mode theme-color to #FF6B8A (nav gradient start)', () => {
    // The applyTheme function should use #FF6B8A for light mode, not C.a or C.bg
    expect(colorsFile).toContain("'#FF6B8A'");
    // Verify it's used in the theme-color context (not C.a which is teal)
    const themeColorSection = colorsFile.slice(
      colorsFile.indexOf('theme color meta'),
      colorsFile.indexOf('status bar transparent') > -1
        ? colorsFile.indexOf('status bar transparent')
        : colorsFile.indexOf('statusBarMeta')
    );
    expect(themeColorSection).toContain('#FF6B8A');
    expect(themeColorSection).not.toContain('C.a');
  });

  it('applyTheme sets dark-mode theme-color to C.sl (nav gradient start)', () => {
    const themeColorSection = colorsFile.slice(
      colorsFile.indexOf('theme color meta'),
      colorsFile.indexOf('statusBarMeta')
    );
    expect(themeColorSection).toContain('C.sl');
  });

  it('index.html initial theme-color matches dark mode nav start (#2A2654)', () => {
    // App defaults to dark mode, so initial theme-color should match dark nav
    expect(indexHtml).toContain('<meta name="theme-color" content="#2A2654"');
  });

  it('light nav gradient starts with #FF6B8A', () => {
    // Verify the light mode nav gradient in App.tsx starts with #FF6B8A
    expect(appFile).toContain("linear-gradient(135deg, #FF6B8A");
  });

  it('dark nav gradient starts with C.sl', () => {
    // Verify the dark mode nav gradient in App.tsx starts with C.sl
    expect(appFile).toMatch(/linear-gradient\(135deg,\s*\$\{C\.sl\}/);
  });

  it('C_DARK.sl is #2A2654 (must match index.html initial theme-color)', () => {
    expect(colorsFile).toMatch(/sl:\s*["']#2A2654["']/);
  });
});
