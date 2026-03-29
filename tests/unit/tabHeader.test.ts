import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * TabHeader UX consistency tests (#141)
 * Verifies that all non-Home tabs use the new TabHeader gradient banner
 * for visual consistency with the Home tab's hero section.
 */

const srcDir = path.resolve(__dirname, '../../src');

const readSrc = (rel: string) =>
  fs.readFileSync(path.join(srcDir, rel), 'utf8');

// ─── TabHeader component ───

describe('TabHeader component', () => {
  const tabHeader = readSrc('components/shared/TabHeader.tsx');

  it('exports TabHeader component', () => {
    expect(tabHeader).toContain('export const TabHeader');
  });

  it('uses gradient background matching Home hero style', () => {
    expect(tabHeader).toContain('linear-gradient');
  });

  it('includes decorative orbs for visual consistency with Home', () => {
    expect(tabHeader).toContain('rgba(255,255,255,0.08)');
    expect(tabHeader).toContain('rgba(255,255,255,0.05)');
  });

  it('uses glassmorphic icon container with backdrop-filter', () => {
    expect(tabHeader).toContain('backdropFilter');
    expect(tabHeader).toContain('blur');
  });

  it('uses white text for title and subtitle (matching Home hero)', () => {
    expect(tabHeader).toMatch(/color:\s*'white'/);
    expect(tabHeader).toContain('rgba(255,255,255,0.75)');
  });

  it('accepts icon, title, subtitle, and color props', () => {
    expect(tabHeader).toContain('icon: string');
    expect(tabHeader).toContain('title: string');
    expect(tabHeader).toContain('subtitle: string');
    expect(tabHeader).toContain('color: string');
  });

  it('has rounded corners consistent with Home hero (borderRadius 16)', () => {
    expect(tabHeader).toContain('borderRadius: 16');
  });

  it('has box-shadow for elevated card feel', () => {
    expect(tabHeader).toContain('boxShadow');
  });
});

// ─── Shared component index exports TabHeader ───

describe('Shared component exports', () => {
  const index = readSrc('components/shared/index.ts');

  it('exports TabHeader from shared index', () => {
    expect(index).toContain('TabHeader');
  });
});

// ─── All non-Home tabs use TabHeader ───

describe('Tab UX consistency — TabHeader usage', () => {
  const logTab = readSrc('tabs/LogTab.tsx');
  const guideTab = readSrc('tabs/GuideTab.tsx');
  const milestonesTab = readSrc('tabs/MilestonesTab.tsx');
  const safetyTab = readSrc('tabs/SafetyTab.tsx');

  it('LogTab imports and uses TabHeader', () => {
    expect(logTab).toContain('TabHeader');
    expect(logTab).toContain('<TabHeader');
  });

  it('GuideTab imports and uses TabHeader', () => {
    expect(guideTab).toContain('TabHeader');
    expect(guideTab).toContain('<TabHeader');
  });

  it('MilestonesTab imports and uses TabHeader', () => {
    expect(milestonesTab).toContain('TabHeader');
    expect(milestonesTab).toContain('<TabHeader');
  });

  it('SafetyTab imports and uses TabHeader', () => {
    expect(safetyTab).toContain('TabHeader');
    expect(safetyTab).toContain('<TabHeader');
  });
});

// ─── Accordion sections have consistent styling ───

describe('Accordion section styling consistency', () => {
  const guideTab = readSrc('tabs/GuideTab.tsx');
  const milestonesTab = readSrc('tabs/MilestonesTab.tsx');
  const safetyTab = readSrc('tabs/SafetyTab.tsx');

  it('GuideTab accordion headers have box-shadow', () => {
    expect(guideTab).toContain('boxShadow');
    expect(guideTab).toContain('0 2px 8px rgba(0,0,0,0.04)');
  });

  it('MilestonesTab accordion headers have box-shadow', () => {
    expect(milestonesTab).toContain('boxShadow');
    expect(milestonesTab).toContain('0 2px 8px rgba(0,0,0,0.04)');
  });

  it('SafetyTab accordion headers have box-shadow', () => {
    expect(safetyTab).toContain('boxShadow');
    expect(safetyTab).toContain('0 2px 8px rgba(0,0,0,0.04)');
  });

  it('GuideTab accordion headers have transition', () => {
    expect(guideTab).toContain('transition');
  });

  it('MilestonesTab accordion headers have transition', () => {
    expect(milestonesTab).toContain('transition');
  });

  it('SafetyTab accordion headers have transition', () => {
    expect(safetyTab).toContain('transition');
  });
});

// ─── LogTab entry card improvements ───

describe('LogTab entry card styling', () => {
  const logTab = readSrc('tabs/LogTab.tsx');

  it('log entry cards have colored left border accent', () => {
    expect(logTab).toContain('borderLeft');
    expect(logTab).toContain('logColors[sub]');
  });

  it('date navigator has card-like styling', () => {
    // Date navigator should have background, border, and shadow
    expect(logTab).toMatch(/borderRadius:\s*14/);
    expect(logTab).toContain('0 2px 8px rgba(0,0,0,0.04)');
  });
});
