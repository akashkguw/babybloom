import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Verify the Timer sub-tab has been removed from LogTab (#142).
 * The timer feature is still available in App.tsx (floating banner),
 * but the dedicated Timer sub-tab in LogTab is removed per user request.
 */

const srcDir = path.resolve(__dirname, '../../src');
const readSrc = (rel: string) =>
  fs.readFileSync(path.join(srcDir, rel), 'utf8');

const logTabSrc = readSrc('tabs/LogTab.tsx');

describe('LogTab — timer sub-tab removed (#142)', () => {
  it('does not have a timer sub-tab in the subs array', () => {
    // The subs array should not contain a timer entry
    expect(logTabSrc).not.toMatch(/id:\s*['"]timer['"]/);
  });

  it('does not import TimerView', () => {
    expect(logTabSrc).not.toMatch(/import\s+TimerView/);
  });

  it('does not render TimerView component', () => {
    expect(logTabSrc).not.toMatch(/<TimerView/);
  });

  it('does not hide UI elements for timer sub-tab', () => {
    // No conditions like sub !== 'timer' should remain
    expect(logTabSrc).not.toMatch(/sub\s*!==\s*['"]timer['"]/);
    expect(logTabSrc).not.toMatch(/sub\s*===\s*['"]timer['"]/);
  });

  it('still has the feed sub-tab as first entry', () => {
    // Feed should be the first sub-tab now that timer is removed
    const subsMatch = logTabSrc.match(/const subs[\s\S]*?\[([^\]]+)\]/);
    expect(subsMatch).toBeTruthy();
    const firstId = subsMatch![1].match(/id:\s*'(\w+)'/);
    expect(firstId).toBeTruthy();
    expect(firstId![1]).toBe('feed');
  });

  it('still has stats sub-tab', () => {
    expect(logTabSrc).toMatch(/id:\s*['"]stats['"]/);
  });

  it('still imports StatsView', () => {
    expect(logTabSrc).toMatch(/import\s+StatsView/);
  });
});
