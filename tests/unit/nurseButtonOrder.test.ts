import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Nurse Left / Nurse Right stable ordering in the quick-log grid (#169).
 *
 * Root causes:
 * 1. Sort step: usage-count sort could place Nurse Right before Nurse Left
 *    when Right is tapped more than Left.
 * 2. Priority step: warning/active promotions could put Right before Left in topItems
 *    after the pin step had correctly ordered them.
 */

const srcDir = path.resolve(__dirname, '../../src');
const homeTabSrc = fs.readFileSync(path.join(srcDir, 'tabs/HomeTab.tsx'), 'utf8');

// ─── Logic helpers mirrored from HomeTab.tsx ───────────────────────────────

interface QLItem {
  l: string;
  sortKey?: string;
  active?: boolean;
  highlight?: boolean;
  switchHint?: boolean;
}

function sortLabel(q: QLItem): string {
  return q.sortKey || q.l;
}

/**
 * Mirrors the sort + pin logic from HomeTab.tsx.
 */
function sortAndPin(
  pool: QLItem[],
  qlUsage: Record<string, number>,
  agePriority: Record<string, number>,
): QLItem[] {
  const totalUsage = Object.values(qlUsage).reduce((a, b) => a + b, 0);
  const hasUsage = totalUsage >= 10;

  const sorted = [...pool].sort((a, b) => {
    const aKey = sortLabel(a);
    const bKey = sortLabel(b);
    // Always keep Nurse Left before Nurse Right regardless of usage counts
    if (aKey === 'Nurse Left' && bKey === 'Nurse Right') return -1;
    if (aKey === 'Nurse Right' && bKey === 'Nurse Left') return 1;
    if (hasUsage) {
      const ua = qlUsage[aKey] || 0;
      const ub = qlUsage[bKey] || 0;
      if (ua !== ub) return ub - ua;
    }
    return (agePriority[aKey] || 99) - (agePriority[bKey] || 99);
  });

  const idxL = sorted.findIndex((q) => q.l === 'Nurse Left' || q.l === 'Switch Left');
  const idxR = sorted.findIndex((q) => q.l === 'Nurse Right' || q.l === 'Switch Right');
  if (idxL >= 0 && idxR >= 0) {
    const itemL = sorted[idxL];
    const itemR = sorted[idxR];
    const isNurseBtn = (q: QLItem) =>
      q.l === 'Nurse Left' || q.l === 'Switch Left' ||
      q.l === 'Nurse Right' || q.l === 'Switch Right';
    const without = sorted.filter((q) => !isNurseBtn(q));
    const insertAt = Math.min(idxL, idxR);
    const rowStart = insertAt - (insertAt % 4);
    without.splice(rowStart, 0, itemL, itemR);
    sorted.length = 0;
    sorted.push(...without);
  }
  return sorted;
}

/**
 * Mirrors the priority + topItems + enforcement logic from HomeTab.tsx.
 */
function computeVisibleItems(
  qlItems: QLItem[],
  quickLogWarnings: Record<string, unknown>,
  qlExpanded: boolean,
): QLItem[] {
  const priorityItems: QLItem[] = [];
  const normalItems: QLItem[] = [];
  for (const q of qlItems) {
    const hasWarn = !!(quickLogWarnings[q.l]);
    const isActive = !!q.active || !!q.highlight;
    if (hasWarn || isActive) priorityItems.push(q);
    else normalItems.push(q);
  }
  const topItems = [...priorityItems, ...normalItems.slice(0, Math.max(0, 8 - priorityItems.length))];
  // Enforce Nurse Left always before Nurse Right regardless of warning/active state
  const nLIdx = topItems.findIndex((q) => (q.sortKey || q.l) === 'Nurse Left');
  const nRIdx = topItems.findIndex((q) => (q.sortKey || q.l) === 'Nurse Right');
  if (nLIdx >= 0 && nRIdx >= 0 && nRIdx < nLIdx) {
    [topItems[nLIdx], topItems[nRIdx]] = [topItems[nRIdx], topItems[nLIdx]];
  }
  return qlExpanded ? qlItems : topItems.slice(0, 8);
}

// ─── Test data ──────────────────────────────────────────────────────────────

const agePriority6mo: Record<string, number> = {
  'Nurse Left': 1, 'Nurse Right': 2, 'Solids': 3, 'Formula': 4,
  'Pee': 5, 'Poop': 6, 'Sleep': 7, 'Tummy': 8,
  'Bath': 9, 'Massage': 10, 'Bottle': 11, 'Express': 12,
};

const basePool: QLItem[] = [
  { l: 'Nurse Left', sortKey: 'Nurse Left' },
  { l: 'Nurse Right', sortKey: 'Nurse Right' },
  { l: 'Formula' }, { l: 'Pee' }, { l: 'Poop' },
  { l: 'Sleep' }, { l: 'Tummy' }, { l: 'Bath' },
  { l: 'Massage' }, { l: 'Bottle' },
];

// ─── Sort & pin tests ────────────────────────────────────────────────────────

describe('Nurse Left/Right sort order (#169)', () => {
  it('Nurse Left appears before Nurse Right with no usage', () => {
    const result = sortAndPin(basePool, {}, agePriority6mo);
    const idxL = result.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = result.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeGreaterThanOrEqual(0);
    expect(idxR).toBeGreaterThanOrEqual(0);
    expect(idxL).toBeLessThan(idxR);
  });

  it('Nurse Left appears before Nurse Right when Right has far higher usage count', () => {
    // Usage inversion scenario: Right tapped 50 times, Left only 5
    const usage = { 'Nurse Right': 50, 'Nurse Left': 5 };
    const result = sortAndPin(basePool, usage, agePriority6mo);
    const idxL = result.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = result.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeGreaterThanOrEqual(0);
    expect(idxR).toBeGreaterThanOrEqual(0);
    expect(idxL).toBeLessThan(idxR);
  });

  it('Nurse Left before Nurse Right when total usage ≥ 10 (usage-sort active)', () => {
    const usage = { 'Nurse Right': 8, 'Nurse Left': 3, 'Pee': 2 }; // total = 13
    const result = sortAndPin(basePool, usage, agePriority6mo);
    const idxL = result.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = result.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });

  it('Nurse Left before Nurse Right for age < 6mo priority', () => {
    const agePri3mo: Record<string, number> = {
      'Nurse Left': 1, 'Nurse Right': 2, 'Formula': 3,
      'Pee': 4, 'Poop': 5, 'Sleep': 6,
    };
    const result = sortAndPin(basePool, {}, agePri3mo);
    const idxL = result.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = result.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });

  it('Nurse Left before Nurse Right for age ≥ 12mo priority', () => {
    const agePri12mo: Record<string, number> = {
      'Solids': 1, 'Sleep': 2, 'Pee': 3, 'Poop': 4, 'Formula': 5,
      'Bath': 6, 'Nurse Left': 7, 'Nurse Right': 8,
    };
    const result = sortAndPin(basePool, {}, agePri12mo);
    const idxL = result.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = result.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });

  it('Switch Left before Switch Right when timer is active', () => {
    // When Breast R timer is active: Left button shows as "Switch Left"
    const poolWithSwitch: QLItem[] = [
      { l: 'Switch Left', sortKey: 'Nurse Left' },
      { l: 'Switch Right', sortKey: 'Nurse Right' },
      { l: 'Formula' }, { l: 'Pee' }, { l: 'Poop' },
      { l: 'Sleep' }, { l: 'Tummy' }, { l: 'Bath' },
    ];
    const usage = { 'Nurse Right': 20, 'Nurse Left': 2 };
    const result = sortAndPin(poolWithSwitch, usage, agePriority6mo);
    const idxL = result.findIndex((q) => q.l === 'Switch Left');
    const idxR = result.findIndex((q) => q.l === 'Switch Right');
    expect(idxL).toBeGreaterThanOrEqual(0);
    expect(idxR).toBeGreaterThanOrEqual(0);
    expect(idxL).toBeLessThan(idxR);
  });
});

// ─── Priority / topItems enforcement tests ───────────────────────────────────

describe('Nurse Left/Right order in priority top-8 (#169)', () => {
  it('Left before Right when Right has warning but Left does not', () => {
    const sorted = sortAndPin(basePool, {}, agePriority6mo);
    const warnings: Record<string, unknown> = { 'Nurse Right': { level: 'warn', reason: 'test' } };
    const visible = computeVisibleItems(sorted, warnings, false);
    const idxL = visible.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = visible.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeGreaterThanOrEqual(0);
    expect(idxR).toBeGreaterThanOrEqual(0);
    expect(idxL).toBeLessThan(idxR);
  });

  it('Left before Right when Left has warning but Right does not', () => {
    const sorted = sortAndPin(basePool, {}, agePriority6mo);
    const warnings: Record<string, unknown> = { 'Nurse Left': { level: 'warn', reason: 'test' } };
    const visible = computeVisibleItems(sorted, warnings, false);
    const idxL = visible.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = visible.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });

  it('Left before Right when Right is active (timer running on Right)', () => {
    const poolWithActive: QLItem[] = basePool.map((q) =>
      sortLabel(q) === 'Nurse Right' ? { ...q, active: true } : q,
    );
    const sorted = sortAndPin(poolWithActive, { 'Nurse Right': 15, 'Nurse Left': 2 }, agePriority6mo);
    const visible = computeVisibleItems(sorted, {}, false);
    const idxL = visible.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = visible.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });

  it('Left before Right when both have warnings', () => {
    const sorted = sortAndPin(basePool, {}, agePriority6mo);
    const warnings: Record<string, unknown> = {
      'Nurse Left': { level: 'warn' },
      'Nurse Right': { level: 'warn' },
    };
    const visible = computeVisibleItems(sorted, warnings, false);
    const idxL = visible.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = visible.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });

  it('Left before Right in expanded view', () => {
    const sorted = sortAndPin(basePool, { 'Nurse Right': 30, 'Nurse Left': 1 }, agePriority6mo);
    const warnings: Record<string, unknown> = { 'Nurse Right': { level: 'danger' } };
    // Expanded: uses qlItems directly (already pinned)
    const visible = computeVisibleItems(sorted, warnings, true);
    const idxL = visible.findIndex((q) => sortLabel(q) === 'Nurse Left');
    const idxR = visible.findIndex((q) => sortLabel(q) === 'Nurse Right');
    expect(idxL).toBeLessThan(idxR);
  });
});

// ─── Source-level checks ────────────────────────────────────────────────────

describe('HomeTab source — nurse order enforcement code present (#169)', () => {
  it('sort has explicit Nurse Left before Nurse Right guard', () => {
    expect(homeTabSrc).toMatch(
      /aKey\s*===\s*'Nurse Left'\s*&&\s*bKey\s*===\s*'Nurse Right'\s*\)\s*return\s*-1/,
    );
    expect(homeTabSrc).toMatch(
      /aKey\s*===\s*'Nurse Right'\s*&&\s*bKey\s*===\s*'Nurse Left'\s*\)\s*return\s*1/,
    );
  });

  it('topItems has Left/Right swap enforcement after priority assembly', () => {
    // Should find the sortKey || l check for Nurse Left in topItems enforcement
    expect(homeTabSrc).toMatch(/nLIdx.*findIndex.*sortKey.*Nurse Left/);
    expect(homeTabSrc).toMatch(/nRIdx.*findIndex.*sortKey.*Nurse Right/);
    expect(homeTabSrc).toMatch(/nRIdx\s*<\s*nLIdx/);
  });
});
