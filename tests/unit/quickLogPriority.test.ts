import { describe, it, expect } from 'vitest';

/**
 * Tests for quick log top-8 priority logic.
 * Warning/active items should always appear in the visible top 8,
 * displacing normal items when necessary.
 */

interface QLItem {
  l: string;
  active?: boolean;
  highlight?: boolean;
}

/**
 * Replicates the priority partitioning logic from HomeTab.tsx quick log section.
 */
function computeVisibleItems(
  qlItems: QLItem[],
  quickLogWarnings: Record<string, unknown>,
  qlExpanded: boolean
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
  return qlExpanded ? qlItems : topItems.slice(0, 8);
}

describe('Quick Log top-8 priority', () => {
  const items: QLItem[] = [
    { l: 'Nurse L' },
    { l: 'Nurse R' },
    { l: 'Formula' },
    { l: 'Pee' },
    { l: 'Poop' },
    { l: 'Sleep' },
    { l: 'Solids' },
    { l: 'Tummy' },
    { l: 'Bath' },     // position 9
    { l: 'Massage' },  // position 10
  ];

  it('shows first 8 items when no warnings', () => {
    const visible = computeVisibleItems(items, {}, false);
    expect(visible).toHaveLength(8);
    expect(visible.map(i => i.l)).toEqual([
      'Nurse L', 'Nurse R', 'Formula', 'Pee', 'Poop', 'Sleep', 'Solids', 'Tummy',
    ]);
  });

  it('promotes warning item from position 9+ into top 8', () => {
    const warnings = { 'Bath': { level: 'warn', reason: 'test' } };
    const visible = computeVisibleItems(items, warnings, false);
    expect(visible).toHaveLength(8);
    expect(visible.map(i => i.l)).toContain('Bath');
    // Bath should displace a normal item (Tummy, which was last normal in top 8)
    expect(visible.map(i => i.l)).not.toContain('Tummy');
  });

  it('promotes multiple warning items from beyond position 8', () => {
    const warnings = {
      'Bath': { level: 'warn', reason: 'test' },
      'Massage': { level: 'danger', reason: 'test' },
    };
    const visible = computeVisibleItems(items, warnings, false);
    expect(visible).toHaveLength(8);
    expect(visible.map(i => i.l)).toContain('Bath');
    expect(visible.map(i => i.l)).toContain('Massage');
  });

  it('promotes active items into top 8', () => {
    const itemsWithActive = items.map(i =>
      i.l === 'Massage' ? { ...i, active: true } : i
    );
    const visible = computeVisibleItems(itemsWithActive, {}, false);
    expect(visible).toHaveLength(8);
    expect(visible.map(i => i.l)).toContain('Massage');
  });

  it('promotes highlighted items into top 8', () => {
    const itemsWithHighlight = items.map(i =>
      i.l === 'Bath' ? { ...i, highlight: true } : i
    );
    const visible = computeVisibleItems(itemsWithHighlight, {}, false);
    expect(visible).toHaveLength(8);
    expect(visible.map(i => i.l)).toContain('Bath');
  });

  it('handles more than 8 priority items gracefully', () => {
    // All 10 items have warnings — only first 8 shown
    const warnings: Record<string, unknown> = {};
    for (const i of items) warnings[i.l] = { level: 'warn', reason: 'test' };
    const visible = computeVisibleItems(items, warnings, false);
    expect(visible).toHaveLength(8);
    // All visible items should be priority items
    for (const v of visible) {
      expect(warnings[v.l]).toBeTruthy();
    }
  });

  it('shows all items when expanded regardless of warnings', () => {
    const visible = computeVisibleItems(items, {}, true);
    expect(visible).toHaveLength(10);
    expect(visible).toEqual(items);
  });

  it('priority items appear before normal items', () => {
    const warnings: Record<string, unknown> = { 'Bath': { level: 'warn', reason: 'test' } };
    const visible = computeVisibleItems(items, warnings, false);
    const bathIdx = visible.findIndex(i => i.l === 'Bath');
    // Bath (priority) should appear before the normal items that fill remaining slots
    const normalInVisible = visible.filter(i => !warnings[i.l]);
    const firstNormalIdx = visible.findIndex(i => normalInVisible.includes(i));
    expect(bathIdx).toBeLessThan(firstNormalIdx);
  });

  it('fewer than 8 items shows all', () => {
    const fewItems = items.slice(0, 5);
    const visible = computeVisibleItems(fewItems, {}, false);
    expect(visible).toHaveLength(5);
  });
});
