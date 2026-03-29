import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Modal-outside-scroll structural invariant
 *
 * iOS Safari has a known bug: `position: fixed` elements inside an
 * `overflow: auto/scroll` container get clipped or lose touch events.
 *
 * Our fix: modals (.mo) must NEVER be rendered as children of the .ca
 * scroll container. They must be siblings via React Fragments.
 *
 * This test reads source files and verifies the invariant holds,
 * so it catches regressions before they ship.
 */

const srcDir = path.resolve(__dirname, '../../src');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(srcDir, rel), 'utf8');
}

/**
 * Checks that in the JSX source, no `className="mo"` appears between
 * the opening `className="ca"` tag and its matching close.
 *
 * This is a structural heuristic — it scans for the pattern where a .ca
 * div opens before a .mo div, without a closing </div> in between that
 * would indicate the .ca was already closed.
 */
function hasModalInsideCa(source: string): boolean {
  // Find all positions of className="ca" and className="mo"
  const caRegex = /className="ca"/g;
  const moRegex = /className="mo"/g;

  let caMatch;
  while ((caMatch = caRegex.exec(source)) !== null) {
    const caPos = caMatch.index;

    // After the .ca div opens, find the next Fragment close </> or the next
    // .mo. If .mo comes before the React Fragment close, it's nested inside.
    let moMatch;
    moRegex.lastIndex = caPos;
    while ((moMatch = moRegex.exec(source)) !== null) {
      const moPos = moMatch.index;

      // Count opening and closing div tags between caPos and moPos
      // to check if .ca has been closed before .mo appears
      const between = source.slice(caPos, moPos);
      const opens = (between.match(/<div[\s>]/g) || []).length;
      const closes = (between.match(/<\/div>/g) || []).length;

      // If closes >= opens, the .ca div was closed before .mo — correct!
      // If closes < opens, .mo is nested inside .ca — bug!
      if (closes < opens) {
        return true; // modal IS inside .ca — this is the bug we want to catch
      }
      break; // Only check the first .mo after this .ca
    }
  }
  return false;
}

describe('Modal-outside-scroll invariant — LogTab', () => {
  const src = readSrc('tabs/LogTab.tsx');

  it('LogTab renders a .ca scroll container', () => {
    expect(src).toContain('className="ca"');
  });

  it('LogTab renders modal overlay (.mo)', () => {
    expect(src).toContain('className="mo"');
  });

  it('LogTab uses React Fragment (<>...</>) to separate .ca and .mo', () => {
    // The return statement should start with a Fragment
    const returnBlock = src.slice(src.lastIndexOf('return ('));
    expect(returnBlock).toMatch(/return\s*\(\s*<>/);
  });

  it('modal (.mo) is NOT nested inside .ca scroll container', () => {
    expect(hasModalInsideCa(src)).toBe(false);
  });
});

describe('Modal-outside-scroll invariant — MilestonesTab', () => {
  const src = readSrc('tabs/MilestonesTab.tsx');

  it('MilestonesTab renders a .ca scroll container', () => {
    expect(src).toContain('className="ca"');
  });

  it('MilestonesTab renders modal overlay (.mo)', () => {
    expect(src).toContain('className="mo"');
  });

  it('MilestonesTab uses React Fragment to separate .ca and .mo', () => {
    const returnIdx = src.lastIndexOf('return (');
    const returnBlock = src.slice(returnIdx);
    expect(returnBlock).toMatch(/return\s*\(\s*<>/);
  });

  it('modal (.mo) is NOT nested inside .ca scroll container', () => {
    expect(hasModalInsideCa(src)).toBe(false);
  });
});

describe('Modal-outside-scroll invariant — base.css prerequisites', () => {
  const css = readSrc('styles/base.css');

  it('.mo has position: fixed', () => {
    expect(css).toMatch(/\.mo[\s\S]*?position:\s*fixed/);
  });

  it('.ca has overflow-y: auto (creates scroll context)', () => {
    expect(css).toMatch(/\.ca[\s\S]*?overflow-y:\s*auto/);
  });
});
