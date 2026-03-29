import { describe, it, expect } from 'vitest';

/**
 * Tests for quick log mutual exclusion logic (issue #153).
 *
 * Certain activities are logically impossible to do simultaneously:
 *   - Cannot bathe a baby while feeding (any timer active)
 *   - Cannot bathe a baby while sleeping
 *   - Cannot do tummy time while sleeping
 *   - Cannot log solids while breastfeeding timer is active
 *   - Cannot start sleep while a timed activity is running
 *   - Cannot do massage while any timed activity is running
 */

interface FeedTimer {
  type: string;
  startTime: number;
}

/**
 * Replicates the `dis` computation for each quick log item from HomeTab.tsx.
 */
function computeDisabled(
  item: string,
  feedTimer: FeedTimer | null,
  isSleeping: boolean,
  qlTapOnly: Record<string, boolean> = {}
): boolean {
  const isTimerActive = !!feedTimer;
  const isFeedingTimerActive = !!(
    feedTimer &&
    (feedTimer.type === 'Breast L' || feedTimer.type === 'Breast R')
  );

  switch (item) {
    case 'Bath':
      return isTimerActive || isSleeping;

    case 'Massage':
      return isTimerActive;

    case 'Solids':
      return isFeedingTimerActive || isSleeping;

    case 'Sleep':
      // 'Sleep' button (not 'Wake Up') — disabled while any timer is active
      return !isSleeping && isTimerActive;

    case 'Wake Up':
      // Always tappable when baby is sleeping
      return false;

    case 'Tummy': {
      const tapOnly = qlTapOnly['Tummy'] ?? false;
      if (tapOnly) {
        return isFeedingTimerActive || isSleeping;
      } else {
        return (feedTimer !== null && feedTimer.type !== 'Tummy Time') || isSleeping;
      }
    }

    case 'Formula':
    case 'Bottle':
      return isTimerActive;

    default:
      return false;
  }
}

const breastLTimer: FeedTimer = { type: 'Breast L', startTime: Date.now() };
const breastRTimer: FeedTimer = { type: 'Breast R', startTime: Date.now() };
const tummyTimer: FeedTimer  = { type: 'Tummy Time', startTime: Date.now() };

describe('Quick Log mutual exclusion — Bath', () => {
  it('Bath is enabled when no timer and not sleeping', () => {
    expect(computeDisabled('Bath', null, false)).toBe(false);
  });

  it('Bath is disabled when breastfeeding timer (Breast L) is active', () => {
    expect(computeDisabled('Bath', breastLTimer, false)).toBe(true);
  });

  it('Bath is disabled when breastfeeding timer (Breast R) is active', () => {
    expect(computeDisabled('Bath', breastRTimer, false)).toBe(true);
  });

  it('Bath is disabled when tummy time timer is active', () => {
    expect(computeDisabled('Bath', tummyTimer, false)).toBe(true);
  });

  it('Bath is disabled when baby is sleeping (no timer)', () => {
    expect(computeDisabled('Bath', null, true)).toBe(true);
  });

  it('Bath is disabled when feeding AND sleeping', () => {
    expect(computeDisabled('Bath', breastLTimer, true)).toBe(true);
  });
});

describe('Quick Log mutual exclusion — Massage', () => {
  it('Massage is enabled when no timer active', () => {
    expect(computeDisabled('Massage', null, false)).toBe(false);
  });

  it('Massage is disabled when breastfeeding timer is active', () => {
    expect(computeDisabled('Massage', breastLTimer, false)).toBe(true);
  });

  it('Massage is disabled when tummy time timer is active', () => {
    expect(computeDisabled('Massage', tummyTimer, false)).toBe(true);
  });

  it('Massage is enabled while sleeping (no timer — can massage after waking)', () => {
    // Massage while sleeping is debatable but we only disable it during active timers
    expect(computeDisabled('Massage', null, true)).toBe(false);
  });
});

describe('Quick Log mutual exclusion — Solids', () => {
  it('Solids is enabled when no timer and not sleeping', () => {
    expect(computeDisabled('Solids', null, false)).toBe(false);
  });

  it('Solids is disabled while breastfeeding timer is active', () => {
    expect(computeDisabled('Solids', breastLTimer, false)).toBe(true);
  });

  it('Solids is disabled while baby is sleeping', () => {
    expect(computeDisabled('Solids', null, true)).toBe(true);
  });

  it('Solids is enabled while tummy time timer runs (not a feeding conflict)', () => {
    expect(computeDisabled('Solids', tummyTimer, false)).toBe(false);
  });
});

describe('Quick Log mutual exclusion — Sleep / Wake Up', () => {
  it('Sleep button is enabled when no timer and not sleeping', () => {
    expect(computeDisabled('Sleep', null, false)).toBe(false);
  });

  it('Sleep button is disabled while any timer is active (cannot start sleep mid-feed)', () => {
    expect(computeDisabled('Sleep', breastLTimer, false)).toBe(true);
  });

  it('Sleep button is disabled during tummy time timer', () => {
    expect(computeDisabled('Sleep', tummyTimer, false)).toBe(true);
  });

  it('Wake Up button is always enabled regardless of state', () => {
    expect(computeDisabled('Wake Up', breastLTimer, true)).toBe(false);
    expect(computeDisabled('Wake Up', null, true)).toBe(false);
    expect(computeDisabled('Wake Up', null, false)).toBe(false);
  });
});

describe('Quick Log mutual exclusion — Tummy Time (tap-only mode)', () => {
  it('Tummy tap-only is disabled during breastfeeding timer', () => {
    expect(computeDisabled('Tummy', breastLTimer, false, { Tummy: true })).toBe(true);
  });

  it('Tummy tap-only is disabled while sleeping', () => {
    expect(computeDisabled('Tummy', null, true, { Tummy: true })).toBe(true);
  });

  it('Tummy tap-only is enabled when no timer and not sleeping', () => {
    expect(computeDisabled('Tummy', null, false, { Tummy: true })).toBe(false);
  });
});

describe('Quick Log mutual exclusion — Tummy Time (timer mode)', () => {
  it('Tummy timer is disabled during breastfeeding timer', () => {
    expect(computeDisabled('Tummy', breastLTimer, false, {})).toBe(true);
  });

  it('Tummy timer is enabled when tummy time timer is active (its own timer)', () => {
    // dis = feedTimer.type !== 'Tummy Time' → false when tummy timer active
    expect(computeDisabled('Tummy', tummyTimer, false, {})).toBe(false);
  });

  it('Tummy timer is disabled while sleeping', () => {
    expect(computeDisabled('Tummy', null, true, {})).toBe(true);
  });
});

describe('Quick Log mutual exclusion — no false positives', () => {
  it('Pee is never disabled by mutual exclusion rules', () => {
    expect(computeDisabled('Pee', breastLTimer, false)).toBe(false);
    expect(computeDisabled('Pee', null, true)).toBe(false);
  });

  it('Poop is never disabled by mutual exclusion rules', () => {
    expect(computeDisabled('Poop', breastLTimer, false)).toBe(false);
    expect(computeDisabled('Poop', null, true)).toBe(false);
  });
});
