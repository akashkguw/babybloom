import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Verify the timer widget back/collapse feature (#143).
 * When a feed timer or sleep is active, users can collapse the timer view
 * back to the full quick log grid, with a compact banner to re-expand.
 */

const srcDir = path.resolve(__dirname, '../../src');
const readSrc = (rel: string) =>
  fs.readFileSync(path.join(srcDir, rel), 'utf8');

const homeTabSrc = readSrc('tabs/HomeTab.tsx');

describe('HomeTab — timer collapse/back button (#143)', () => {
  it('has timerCollapsed state variable', () => {
    expect(homeTabSrc).toMatch(/\[timerCollapsed,\s*setTimerCollapsed\]/);
  });

  it('has a back button in the timer view', () => {
    // The "← All actions" back button should exist
    expect(homeTabSrc).toContain('← All actions');
    expect(homeTabSrc).toMatch(/setTimerCollapsed\(true\)/);
  });

  it('has a collapsed timer banner that expands on click', () => {
    // The collapsed banner with data-testid should exist
    expect(homeTabSrc).toContain('timer-collapsed-banner');
    // Clicking it should re-expand (set collapsed to false)
    expect(homeTabSrc).toMatch(/setTimerCollapsed\(false\)/);
  });

  it('uses showTimerView to conditionally render timer vs grid', () => {
    // showTimerView combines hasActiveTimer and !timerCollapsed
    expect(homeTabSrc).toMatch(/showTimerView\s*=\s*hasActiveTimer\s*&&\s*!timerCollapsed/);
    // Timer view uses showTimerView instead of hasActiveTimer
    expect(homeTabSrc).toMatch(/if\s*\(showTimerView\)/);
  });

  it('collapsed banner shows Done/Wake action button', () => {
    // The collapsed banner should have a quick action button
    const bannerIdx = homeTabSrc.indexOf('timer-collapsed-banner');
    expect(bannerIdx).toBeGreaterThan(-1);
    const bannerSection = homeTabSrc.slice(bannerIdx, bannerIdx + 2000);
    // It should have stopFeedTimer or Wake Up action
    expect(bannerSection).toMatch(/stopFeedTimer|Wake Up/);
  });

  it('auto-resets timerCollapsed when feed timer ends', () => {
    // useEffect watching feedTimerApp to reset collapsed state
    expect(homeTabSrc).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!feedTimerApp\)\s*setTimerCollapsed\(false\)/);
  });

  it('collapsed banner shows timer emoji, label and elapsed time', () => {
    const bannerIdx = homeTabSrc.indexOf('timer-collapsed-banner');
    expect(bannerIdx).toBeGreaterThan(-1);
    const bannerSection = homeTabSrc.slice(bannerIdx, bannerIdx + 1500);
    // Shows emoji
    expect(bannerSection).toContain('timerEmoji');
    // Shows label
    expect(bannerSection).toContain('timerLabel');
    // Shows since time
    expect(bannerSection).toContain('timerSince');
  });
});
