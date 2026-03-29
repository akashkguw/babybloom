import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Verify the nurse switch button behavior (#146).
 * When a breast timer is active and the user views the all-actions grid,
 * the OTHER breast button should become a "Switch" action instead of being disabled.
 */

const srcDir = path.resolve(__dirname, '../../src');
const readSrc = (rel: string) =>
  fs.readFileSync(path.join(srcDir, rel), 'utf8');

const homeTabSrc = readSrc('tabs/HomeTab.tsx');

describe('HomeTab — nurse switch button in all-actions grid (#146)', () => {
  it('qlBreastL becomes "Switch Left" when right breast timer is active', () => {
    // When feedTimer.type === 'Breast R', left button label should be 'Switch Left'
    expect(homeTabSrc).toMatch(/otherBreastActive\s*\?\s*'Switch Left'\s*:\s*'Nurse Left'/);
  });

  it('qlBreastR becomes "Switch Right" when left breast timer is active', () => {
    // When feedTimer.type === 'Breast L', right button label should be 'Switch Right'
    expect(homeTabSrc).toMatch(/otherBreastActiveR\s*\?\s*'Switch Right'\s*:\s*'Nurse Right'/);
  });

  it('switch button calls switchFeedSide instead of startFeedTimer', () => {
    // qlBreastL fn should call switchFeedSide('Breast L') when other breast is active
    expect(homeTabSrc).toMatch(/otherBreastActive\s*\?\s*\(\)\s*=>\s*switchFeedSide\('Breast L'\)/);
    // qlBreastR fn should call switchFeedSide('Breast R') when other breast is active
    expect(homeTabSrc).toMatch(/otherBreastActiveR\s*\?\s*\(\)\s*=>\s*switchFeedSide\('Breast R'\)/);
  });

  it('switch button shows 🔄 emoji instead of 🤱', () => {
    // The emoji should change to the switch icon when other breast is active
    expect(homeTabSrc).toMatch(/otherBreastActive\s*\?\s*'🔄'\s*:\s*'🤱'/);
    expect(homeTabSrc).toMatch(/otherBreastActiveR\s*\?\s*'🔄'\s*:\s*'🤱'/);
  });

  it('breast buttons are only disabled for non-breast timers', () => {
    // dis should be true only when feedTimer exists AND is not Breast L or Breast R
    // This means breast buttons stay enabled during breast timers (for switching)
    expect(homeTabSrc).toMatch(
      /dis:\s*feedTimer\s*&&\s*feedTimer\.type\s*!==\s*'Breast L'\s*&&\s*feedTimer\.type\s*!==\s*'Breast R'/
    );
  });

  it('switch button has switchHint styling flag', () => {
    // switchHint property should be set based on whether the other breast is active
    expect(homeTabSrc).toMatch(/switchHint:\s*otherBreastActive/);
    expect(homeTabSrc).toMatch(/switchHint:\s*otherBreastActiveR/);
  });

  it('grid renders switch hint with distinct background color', () => {
    // The grid button style should use C.sl (secondary light) for switchHint buttons
    expect(homeTabSrc).toMatch(/q\.switchHint\s*\?\s*C\.sl/);
  });

  it('grid renders switch hint label with secondary color', () => {
    // The label color should use C.s for switchHint buttons
    expect(homeTabSrc).toMatch(/q\.switchHint\s*\?\s*C\.s\s*:/);
  });

  it('has sortKey for stable sorting when label changes', () => {
    // Each breast button should have a sortKey that stays consistent
    expect(homeTabSrc).toMatch(/sortKey:\s*'Nurse Left'/);
    expect(homeTabSrc).toMatch(/sortKey:\s*'Nurse Right'/);
  });

  it('pinning logic handles both original and switch labels', () => {
    // The pin logic should find buttons by both labels
    expect(homeTabSrc).toMatch(/q\.l\s*===\s*'Nurse Left'\s*\|\|\s*q\.l\s*===\s*'Switch Left'/);
    expect(homeTabSrc).toMatch(/q\.l\s*===\s*'Nurse Right'\s*\|\|\s*q\.l\s*===\s*'Switch Right'/);
  });

  it('qlCategoryInfo has entries for Switch Left and Switch Right', () => {
    // Long-press info should work for switch labels too
    expect(homeTabSrc).toContain("'Switch Left':");
    expect(homeTabSrc).toContain("'Switch Right':");
  });
});
