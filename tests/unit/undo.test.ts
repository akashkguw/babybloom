import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Undo mechanism — structural & logic tests
 *
 * Verifies the fixes for #130 (undo not working) and #131 (undo banner not showing):
 *
 * 1. The undo banner must be rendered OUTSIDE the .ca scroll container.
 *    On iOS Safari, `position: fixed` inside an `overflow: auto` ancestor
 *    (especially one with a CSS `transform` animation like fadeIn) can fail
 *    to position relative to the viewport — the banner would scroll with the
 *    content and be invisible at the top of the scroll area.
 *
 * 2. undoLog must use a `prevLogs` snapshot to restore state, NOT id-based
 *    filtering. The old approach failed for merged timer feeds because the
 *    undo entry stored a freshly generated id that didn't match any real
 *    log entry in the array — so the filter removed nothing.
 *
 * 3. Every setUndoEntry call (quickLog, timer merge, timer new) must pass
 *    a `prevLogs` snapshot so undo always has the pre-mutation state.
 */

const srcDir = path.resolve(__dirname, '../../src');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(srcDir, rel), 'utf8');
}

const homeTab = readSrc('tabs/HomeTab.tsx');

/**
 * Find the main component return block — the one that starts with `<>` (Fragment).
 * Uses the multiline pattern `return (\n    <>` to distinguish from inner returns.
 */
function getMainReturnBlock(): string {
  const match = homeTab.match(/return\s*\(\s*\n\s*<>/);
  expect(match).not.toBeNull();
  return homeTab.slice(match!.index!);
}

// ─── Structural: undo banner outside .ca scroll container ───

describe('Undo banner — outside .ca scroll container (fixes #131)', () => {
  it('HomeTab renders a .ca scroll container', () => {
    expect(homeTab).toContain('className="ca"');
  });

  it('HomeTab renders an undo-banner element', () => {
    expect(homeTab).toContain('className="undo-banner"');
  });

  it('undo-banner is NOT nested inside .ca scroll container', () => {
    // In the main component return, the undo-banner must appear BEFORE the
    // .ca div — meaning it's a sibling (inside a Fragment), not a child of .ca.
    const returnBlock = getMainReturnBlock();

    const undoBannerPos = returnBlock.indexOf('className="undo-banner"');
    const caPos = returnBlock.indexOf('className="ca"');

    // Both must exist in the return block
    expect(undoBannerPos).toBeGreaterThan(-1);
    expect(caPos).toBeGreaterThan(-1);

    // The undo-banner must appear BEFORE the .ca div
    expect(undoBannerPos).toBeLessThan(caPos);
  });

  it('HomeTab main return uses React Fragment to separate undo banner and .ca', () => {
    const returnBlock = getMainReturnBlock();
    expect(returnBlock).toMatch(/^return\s*\(\s*\n\s*<>/);
  });

  it('undo-banner has position: fixed and zIndex >= 1000', () => {
    const bannerIdx = homeTab.indexOf('className="undo-banner"');
    const region = homeTab.slice(Math.max(0, bannerIdx - 50), bannerIdx + 300);
    expect(region).toMatch(/position:\s*'fixed'/);
    expect(region).toMatch(/zIndex:\s*(\d+)/);
    const zMatch = region.match(/zIndex:\s*(\d+)/);
    expect(Number(zMatch![1])).toBeGreaterThanOrEqual(1000);
  });
});

// ─── Structural: undoLog uses prevLogs snapshot ───

describe('undoLog — prevLogs snapshot approach (fixes #130)', () => {
  it('undoEntry state type includes prevLogs field', () => {
    expect(homeTab).toMatch(/useState<\{[^}]*prevLogs:\s*Logs[^}]*\}\s*\|\s*null>/);
  });

  it('undoLog restores prevLogs instead of id-based filtering', () => {
    const undoLogIdx = homeTab.indexOf('function undoLog()');
    expect(undoLogIdx).toBeGreaterThan(-1);
    const undoLogBlock = homeTab.slice(undoLogIdx, undoLogIdx + 300);

    // Must reference prevLogs for restoration
    expect(undoLogBlock).toContain('prevLogs');
    expect(undoLogBlock).toContain('setLogs');

    // Must NOT use the old id-based filter approach
    expect(undoLogBlock).not.toContain('.filter(');
    expect(undoLogBlock).not.toContain('entry.id');
  });

  it('undoLog clears the undo entry and timer', () => {
    const undoLogIdx = homeTab.indexOf('function undoLog()');
    const undoLogBlock = homeTab.slice(undoLogIdx, undoLogIdx + 400);

    expect(undoLogBlock).toContain('setUndoEntry(null)');
    expect(undoLogBlock).toContain('clearTimeout');
  });
});

// ─── Structural: all setUndoEntry calls include prevLogs ───

describe('setUndoEntry — all callers pass prevLogs snapshot', () => {
  // Find all setUndoEntry calls that create a new entry (not null/timer clears).
  // These calls span multiple lines, so use a multiline search that captures
  // from `setUndoEntry({` to the closing `});` on a later line.
  function findUndoEntryCalls(): string[] {
    const calls: string[] = [];
    let searchFrom = 0;
    const marker = 'setUndoEntry({ ';
    while (true) {
      const idx = homeTab.indexOf(marker, searchFrom);
      if (idx === -1) break;
      // Grab enough context to include the full call (these are single-line or multi-line)
      const chunk = homeTab.slice(idx, idx + 500);
      const endBrace = chunk.indexOf('});');
      if (endBrace > -1) {
        calls.push(chunk.slice(0, endBrace + 2));
      }
      searchFrom = idx + 1;
    }
    return calls;
  }

  const calls = findUndoEntryCalls();

  it('has at least 3 setUndoEntry creation calls (quickLog, timer merge, timer new)', () => {
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('every setUndoEntry creation call includes prevLogs', () => {
    for (const call of calls) {
      expect(call).toContain('prevLogs');
    }
  });

  it('quickLog captures prevLogs before mutating logs', () => {
    const quickLogIdx = homeTab.indexOf('function quickLog(');
    const quickLogEnd = homeTab.indexOf('function undoLog(');
    const quickLogBlock = homeTab.slice(quickLogIdx, quickLogEnd);

    // prevLogs snapshot must be taken BEFORE setLogs is called
    const prevLogsPos = quickLogBlock.indexOf('const prevLogs');
    const setLogsPos = quickLogBlock.indexOf('setLogs(next)');

    expect(prevLogsPos).toBeGreaterThan(-1);
    expect(setLogsPos).toBeGreaterThan(-1);
    expect(prevLogsPos).toBeLessThan(setLogsPos);
  });

  it('stopFeedTimer captures prevLogs before mergeIntoLastFeed', () => {
    const stopTimerIdx = homeTab.indexOf('function stopFeedTimer()');
    const nextFnIdx = homeTab.indexOf('function switchFeedSide(');
    const stopTimerBlock = homeTab.slice(stopTimerIdx, nextFnIdx);

    // For the merge path: prevLogs must be captured before mergeIntoLastFeed
    const mergeIdx = stopTimerBlock.indexOf('mergeIntoLastFeed(');
    const prevLogsBeforeMerge = stopTimerBlock.lastIndexOf('const prevLogs', mergeIdx);

    expect(mergeIdx).toBeGreaterThan(-1);
    expect(prevLogsBeforeMerge).toBeGreaterThan(-1);
    expect(prevLogsBeforeMerge).toBeLessThan(mergeIdx);
  });

  it('stopFeedTimer captures prevLogs before new entry setLogs', () => {
    const stopTimerIdx = homeTab.indexOf('function stopFeedTimer()');
    const nextFnIdx = homeTab.indexOf('function switchFeedSide(');
    const stopTimerBlock = homeTab.slice(stopTimerIdx, nextFnIdx);

    // For the non-merge path: find the second prevLogs assignment
    const firstPrevLogs = stopTimerBlock.indexOf('const prevLogs');
    const secondPrevLogs = stopTimerBlock.indexOf('const prevLogs', firstPrevLogs + 1);
    // Find the setLogs call in the non-merge path (after the merge return)
    const returnIdx = stopTimerBlock.indexOf('return;', firstPrevLogs);
    const setLogsAfterReturn = stopTimerBlock.indexOf('setLogs(next)', returnIdx);

    expect(secondPrevLogs).toBeGreaterThan(-1);
    expect(setLogsAfterReturn).toBeGreaterThan(-1);
    expect(secondPrevLogs).toBeLessThan(setLogsAfterReturn);
  });
});

// ─── CSS: undo animation exists ───

describe('Undo banner — CSS animation', () => {
  const css = readSrc('styles/base.css');

  it('ql-undo-slide keyframes exist with slide-in from top', () => {
    expect(css).toMatch(/@keyframes ql-undo-slide/);
    expect(css).toMatch(/translateY\(-100%\)/);
  });

  it('.undo-banner has safe-area padding for iOS notch', () => {
    expect(css).toMatch(/\.undo-banner[\s\S]*?env\(safe-area-inset-top/);
  });
});
