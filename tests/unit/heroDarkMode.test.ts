import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Hero widget dark-mode background bleed fix (#138)
 *
 * Verifies that the hero widget has proper isolation and
 * neutral box-shadow to prevent background bleed in dark mode.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../../src');
const homeTab = fs.readFileSync(path.join(srcDir, 'tabs/HomeTab.tsx'), 'utf8');

// Extract the hero widget region (from the "Hero — baby dashboard" comment
// to the closing of the outer div's style block)
const heroStart = homeTab.indexOf('Hero — baby dashboard');
const heroRegion = homeTab.slice(heroStart, heroStart + 1200);

describe('Hero widget — dark mode background bleed fix (#138)', () => {
  it('hero container uses isolation: isolate to prevent gradient bleed', () => {
    expect(heroRegion).toContain("isolation: 'isolate'");
  });

  it('hero container uses WebkitBackfaceVisibility: hidden for anti-aliasing', () => {
    expect(heroRegion).toContain("WebkitBackfaceVisibility: 'hidden'");
  });

  it('hero box-shadow does NOT use colored primary (C.p) shadow', () => {
    // The old shadow used ${C.p}33 which created a pink bleed in dark mode
    expect(heroRegion).not.toMatch(/boxShadow:.*\$\{C\.p\}/);
    expect(heroRegion).not.toMatch(/boxShadow:.*C\.p/);
  });

  it('hero box-shadow uses neutral rgba shadows', () => {
    expect(heroRegion).toMatch(/boxShadow:.*rgba\(0,\s*0,\s*0/);
  });

  it('hero container still has overflow: hidden and borderRadius', () => {
    expect(heroRegion).toContain("overflow: 'hidden'");
    expect(heroRegion).toContain('borderRadius: 16');
  });
});
