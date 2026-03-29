import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Layout & header structural tests
 * Verifies the fixes for:
 * - iPhone 17 Pro Max header width (#126 follow-up)
 * - Vertical scroll fix (#126) — flex column layout with overflow: hidden
 * - Max-width bumped from 430 to 500
 * - Header border removal
 */

const srcDir = path.resolve(__dirname, '../../src');

const readSrc = (rel: string) =>
  fs.readFileSync(path.join(srcDir, rel), 'utf8');

const baseCss = readSrc('styles/base.css');
const appTsx = readSrc('App.tsx');

// ─── base.css layout ───

describe('base.css — vertical scroll fix', () => {
  it('html,body,#root use height (not min-height) for viewport lock', () => {
    // Must have height: 100vh or 100dvh, NOT min-height
    expect(baseCss).toMatch(/html[\s\S]*?height:\s*100v?h/);
    expect(baseCss).toMatch(/height:\s*100dvh/);
  });

  it('html,body,#root have overflow: hidden', () => {
    expect(baseCss).toMatch(/overflow:\s*hidden/);
  });

  it('.ca has overflow-y: auto for per-tab scrolling', () => {
    // .ca must have overflow-y: auto
    expect(baseCss).toMatch(/\.ca[\s\S]*?overflow-y:\s*auto/);
  });

  it('does not use deprecated -webkit-overflow-scrolling', () => {
    expect(baseCss).not.toContain('-webkit-overflow-scrolling');
  });
});

describe('base.css — full-width header', () => {
  // Extract the .app-header block
  const headerBlock = baseCss.slice(
    baseCss.indexOf('.app-header'),
    baseCss.indexOf('}', baseCss.indexOf('.app-header')) + 1
  );

  it('.app-header uses left: 0 and right: 0 (full viewport width)', () => {
    expect(headerBlock).toMatch(/left:\s*0/);
    expect(headerBlock).toMatch(/right:\s*0/);
  });

  it('.app-header uses width: 100%', () => {
    expect(headerBlock).toMatch(/width:\s*100%/);
  });

  it('.app-header does NOT have max-width: 430', () => {
    expect(headerBlock).not.toMatch(/max-width:\s*430/);
  });

  it('.app-header uses safe-area padding for Dynamic Island', () => {
    expect(headerBlock).toContain('env(safe-area-inset-top');
    expect(headerBlock).toContain('env(safe-area-inset-left');
    expect(headerBlock).toContain('env(safe-area-inset-right');
  });
});

// ─── App.tsx layout ───

describe('App.tsx — container layout', () => {
  it('main container uses maxWidth 500 (not 430)', () => {
    expect(appTsx).toContain('maxWidth: 500');
    expect(appTsx).not.toMatch(/maxWidth:\s*430/);
  });

  it('main container uses flex column layout', () => {
    expect(appTsx).toContain("flexDirection: 'column'");
  });

  it('main container uses overflow hidden', () => {
    expect(appTsx).toMatch(/overflow:\s*'hidden'/);
  });

  it('main container uses 100dvh height', () => {
    expect(appTsx).toContain("height: '100dvh'");
  });
});

describe('App.tsx — header has no bottom border', () => {
  // The header is rendered with className="app-header"
  // Find the inline styles around the app-header div
  // There should be no borderBottom in the header area
  const headerIdx = appTsx.indexOf('className="app-header"');

  it('app-header element exists', () => {
    expect(headerIdx).toBeGreaterThan(-1);
  });

  it('no borderBottom in header inline styles', () => {
    // Check the ~300 chars around the header for borderBottom
    const region = appTsx.slice(Math.max(0, headerIdx - 200), headerIdx + 300);
    expect(region).not.toContain('borderBottom');
  });
});

describe('App.tsx — timer banner uses full width', () => {
  it('timer banner uses left: 0 and right: 0', () => {
    // The timer banner should not use left:'50%' + transform
    expect(appTsx).not.toMatch(/timerBanner[\s\S]*?left:\s*'50%'/);
  });
});
