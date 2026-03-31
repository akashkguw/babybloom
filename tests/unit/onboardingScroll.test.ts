import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for onboarding/login page scroll fix (#183)
 * Verifies that WelcomeCarousel outer container uses overflowX: hidden
 * (not overflow: hidden) so vertical scroll is not blocked.
 */

const srcDir = path.resolve(__dirname, '../../src');
const carousel = fs.readFileSync(
  path.join(srcDir, 'components/onboarding/WelcomeCarousel.tsx'),
  'utf8'
);

describe('WelcomeCarousel — scroll fix (#183)', () => {
  it('outer container does NOT use overflow: hidden (blocks vertical scroll)', () => {
    // The outer fixed container must not have the blanket overflow: 'hidden'
    // Find the outer return div block (position: fixed, inset: 0, zIndex: 9999)
    const outerBlock = carousel.slice(
      carousel.indexOf("position: 'fixed', inset: 0, zIndex: 9999"),
      carousel.indexOf('animation:', carousel.indexOf("position: 'fixed', inset: 0, zIndex: 9999")) + 200
    );
    expect(outerBlock).not.toContain("overflow: 'hidden'");
  });

  it('outer container uses overflowX: hidden to clip horizontal slide transitions', () => {
    const outerBlock = carousel.slice(
      carousel.indexOf("position: 'fixed', inset: 0, zIndex: 9999"),
      carousel.indexOf('animation:', carousel.indexOf("position: 'fixed', inset: 0, zIndex: 9999")) + 200
    );
    expect(outerBlock).toContain("overflowX: 'hidden'");
  });

  it('inner scroll area has overflowY: auto', () => {
    expect(carousel).toContain("overflowY: 'auto'");
  });

  it('inner scroll area has WebkitOverflowScrolling touch for iOS momentum scroll', () => {
    expect(carousel).toContain("WebkitOverflowScrolling: 'touch'");
  });
});
