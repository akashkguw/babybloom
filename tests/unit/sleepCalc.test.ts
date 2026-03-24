/**
 * Tests for calcSleepMins - date-aware sleep duration calculation
 */
declare const process: { exit(code: number): never };

// Inline the function for testing (avoids vitest/rollup dependency issue)
function calcSleepMins(
  sleepDate: string,
  sleepTime: string,
  wakeDate: string,
  wakeTime: string
): number {
  const [sy, sm, sd] = sleepDate.split('-').map(Number);
  const [sh, smin] = sleepTime.split(':').map(Number);
  const [wy, wm, wd] = wakeDate.split('-').map(Number);
  const [wh, wmin] = wakeTime.split(':').map(Number);

  const sleepMs = new Date(sy, sm - 1, sd, sh, smin).getTime();
  const wakeMs = new Date(wy, wm - 1, wd, wh, wmin).getTime();

  const diffMins = Math.round((wakeMs - sleepMs) / 60000);

  if (diffMins > 0 && diffMins < 1440) return diffMins;
  return 0;
}

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function expect(actual: number) {
  return {
    toBe(expected: number) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
  };
}

console.log('calcSleepMins tests:');

// Same-day nap
test('same day nap: 14:00 to 15:30 = 90 min', () => {
  expect(calcSleepMins('2026-03-23', '14:00', '2026-03-23', '15:30')).toBe(90);
});

// Cross-midnight sleep (common case)
test('cross midnight: 21:00 to 06:00 next day = 540 min (9h)', () => {
  expect(calcSleepMins('2026-03-23', '21:00', '2026-03-24', '06:00')).toBe(540);
});

// Cross-midnight sleep late evening to early morning
test('cross midnight: 23:00 to 07:00 next day = 480 min (8h)', () => {
  expect(calcSleepMins('2026-03-23', '23:00', '2026-03-24', '07:00')).toBe(480);
});

// Short nap
test('short nap: 30 min', () => {
  expect(calcSleepMins('2026-03-23', '13:00', '2026-03-23', '13:30')).toBe(30);
});

// Edge: wake up right at midnight
test('edge: sleep at 22:00, wake at 00:00 = 120 min', () => {
  expect(calcSleepMins('2026-03-23', '22:00', '2026-03-24', '00:00')).toBe(120);
});

// Edge: sleep right at midnight
test('edge: sleep at 00:00, wake at 06:00 = 360 min', () => {
  expect(calcSleepMins('2026-03-24', '00:00', '2026-03-24', '06:00')).toBe(360);
});

// Edge: over 24 hours should return 0 (unrealistic for baby)
test('over 24h returns 0', () => {
  expect(calcSleepMins('2026-03-22', '14:00', '2026-03-24', '14:00')).toBe(0);
});

// Edge: wake before sleep returns 0
test('wake before sleep returns 0', () => {
  expect(calcSleepMins('2026-03-24', '14:00', '2026-03-24', '13:00')).toBe(0);
});

// Edge: same time returns 0
test('same time returns 0', () => {
  expect(calcSleepMins('2026-03-24', '14:00', '2026-03-24', '14:00')).toBe(0);
});

// BUG FIX: This was the key edge case the old code got wrong
// Old code: only compared times → wM(14*60) - sM(13*60) = 60 min (WRONG)
// New code: uses dates → 25 hours > 24h cap → returns 0 (correct: unrealistic)
test('same-ish time different days returns 0 (over 24h)', () => {
  expect(calcSleepMins('2026-03-23', '13:00', '2026-03-24', '14:00')).toBe(0);
});

// BUG FIX: Old code compared only times and would get wrong result
// Old code: wM(6*60) - sM(22*60) = -960, +1440 = 480 — same result, but by coincidence
// New code: uses dates properly → 480 min (correct)
test('overnight sleep computes correctly with dates', () => {
  expect(calcSleepMins('2026-03-23', '22:00', '2026-03-24', '06:00')).toBe(480);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
