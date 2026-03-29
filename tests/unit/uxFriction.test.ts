import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * UX friction fix tests for issue #145
 * Verifies: FAB clearance, contrast improvements, touch targets,
 * 911 confirmation, carousel hints, age pluralization, Pill WCAG compliance
 */

const srcDir = path.resolve(__dirname, '../../src');
const readSrc = (rel: string) =>
  fs.readFileSync(path.join(srcDir, rel), 'utf8');

const baseCss = readSrc('styles/base.css');
const homeTab = readSrc('tabs/HomeTab.tsx');
const safetyTab = readSrc('tabs/SafetyTab.tsx');
const logTab = readSrc('tabs/LogTab.tsx');
const guideTab = readSrc('tabs/GuideTab.tsx');
const pill = readSrc('components/shared/Pill.tsx');

// ─── 1. FAB clearance ───

describe('FAB overlap fix — bottom padding', () => {
  it('.ca padding-bottom accounts for FAB (>= 140px base)', () => {
    // Extract the padding-bottom value from the .ca rule with !important
    const match = baseCss.match(/\.ca\s*\{[^}]*padding-bottom:\s*calc\((\d+)px/);
    expect(match).toBeTruthy();
    const px = parseInt(match![1], 10);
    expect(px).toBeGreaterThanOrEqual(140);
  });
});

// ─── 2. Hero card contrast ───

describe('Hero card — text contrast', () => {
  it('stat labels (feeds/diapers/sleep) use >= 0.85 opacity', () => {
    // The stat labels should use high opacity white text
    const labelMatches = homeTab.match(/fontSize:\s*9,\s*color:\s*'rgba\(255,255,255,([\d.]+)\)',\s*fontWeight:\s*500/g);
    expect(labelMatches).toBeTruthy();
    for (const m of labelMatches!) {
      const opMatch = m.match(/rgba\(255,255,255,([\d.]+)\)/);
      expect(parseFloat(opMatch![1])).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('secondary detail text uses >= 0.8 opacity', () => {
    // The detail lines (e.g. "Formula · 4:29 PM") should be readable
    const detailMatches = homeTab.match(/fontSize:\s*8,\s*color:\s*'rgba\(255,255,255,([\d.]+)\)'/g);
    expect(detailMatches).toBeTruthy();
    for (const m of detailMatches!) {
      const opMatch = m.match(/rgba\(255,255,255,([\d.]+)\)/);
      expect(parseFloat(opMatch![1])).toBeGreaterThanOrEqual(0.8);
    }
  });
});

// ─── 3. NOW badge contrast ───

describe('Guide tab — NOW badge', () => {
  it('NOW badge background uses >= 33 hex opacity', () => {
    // Should use color + '33' or higher, not '22'
    expect(guideTab).toMatch(/background:\s*color\s*\+\s*'3[3-9a-fA-F]/);
  });

  it('NOW badge has visible border', () => {
    expect(guideTab).toMatch(/border:.*color.*44/);
  });
});

// ─── 4. Pill WCAG compliance ───

describe('Pill — active text contrast', () => {
  it('has isLightColor helper for WCAG contrast', () => {
    expect(pill).toContain('isLightColor');
  });

  it('uses dynamic text color based on background luminance', () => {
    expect(pill).toContain('activeTextColor');
    // Should not hardcode white for active state
    expect(pill).not.toMatch(/color:\s*active\s*\?\s*'white'/);
  });
});

// ─── 5. Emergency call confirmation ───

describe('SafetyTab — call confirmation modal', () => {
  it('has confirmCall state for preventing accidental dials', () => {
    expect(safetyTab).toContain('confirmCall');
    expect(safetyTab).toContain('setConfirmCall');
  });

  it('shows confirmation modal before calling', () => {
    // Should have a "Call Now" and "Cancel" button
    expect(safetyTab).toContain('Call Now');
    expect(safetyTab).toContain('Cancel');
  });

  it('phone link is inside confirmation modal, not directly on contact card', () => {
    // The tel: link should appear after "Call Now" text, inside the modal
    const telIdx = safetyTab.indexOf('href={`tel:');
    const callNowIdx = safetyTab.indexOf('Call Now');
    // tel: should be near (within 500 chars of) the Call Now button
    expect(Math.abs(telIdx - callNowIdx)).toBeLessThan(500);
  });
});

// ─── 6. Touch targets ───

describe('LogTab — edit/delete touch targets', () => {
  it('edit and delete buttons have minimum 44px touch targets', () => {
    expect(logTab).toMatch(/minWidth:\s*44/);
    expect(logTab).toMatch(/minHeight:\s*44/);
  });

  it('edit and delete buttons have adequate spacing (gap >= 12)', () => {
    // The parent flex container should have gap >= 12
    const editSection = logTab.slice(
      logTab.indexOf('handleEditClick(entry)') - 200,
      logTab.indexOf('handleEditClick(entry)') + 600
    );
    expect(editSection).toMatch(/gap:\s*1[2-9]|gap:\s*[2-9]\d/);
  });
});

// ─── 7. Age string pluralization ───

describe('HomeTab — age string pluralization', () => {
  it('handles singular day correctly', () => {
    // Should have day' + (ageDays !== 1 ? 's' : '') pattern
    expect(homeTab).toMatch(/day['"]?\s*\+\s*\(ageDays\s*!==\s*1/);
  });

  it('handles singular week correctly', () => {
    expect(homeTab).toMatch(/week['"]?\s*\+\s*\(ageWeeks\s*!==\s*1/);
  });
});

// ─── 8. Carousel affordance ───

describe('HomeTab — carousel discoverability', () => {
  it('shows pagination indicator (X of Y)', () => {
    expect(homeTab).toContain('of {slides.length}');
  });

  it('includes swipe hint text', () => {
    expect(homeTab).toMatch(/swipe/i);
  });
});
