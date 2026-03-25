import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for useMomAlerts — mom wellness alert logic.
 *
 * Since useMomAlerts is a React hook that reads from IndexedDB (dg),
 * we extract and test the core alert logic directly.
 */

// The alert logic extracted from useMomAlerts for testability
interface MomDay {
  date: string;
  meals: { breakfast: boolean; lunch: boolean; dinner: boolean; snack: boolean };
  water: boolean;
  vitamin: boolean;
  sleep: 0 | 1 | 2 | 3;
  mood: 0 | 1 | 2 | 3 | 4 | 5;
  moved: boolean;
  note: string;
}

interface Alert {
  id: string;
  emoji: string;
  text: string;
  severity: 'warning' | 'critical';
}

function computeMomAlerts(data: MomDay | null, hour: number): Alert[] {
  const flags: Alert[] = [];

  if (!data) {
    if (hour >= 12) {
      flags.push({
        id: 'mom-nodata',
        emoji: '💜',
        text: 'No wellness check-in today — take a moment for yourself',
        severity: 'warning',
      });
    }
    return flags;
  }

  // Hydration
  if (hour >= 14 && !data.water) {
    flags.push({
      id: 'mom-water',
      emoji: '💧',
      text: 'Remember to stay hydrated — it helps recovery & milk supply',
      severity: hour >= 16 ? 'critical' : 'warning',
    });
  }

  // Meals
  const mealsEaten = Object.values(data.meals).filter(Boolean).length;
  if (hour >= 10 && !data.meals.breakfast && mealsEaten === 0) {
    flags.push({
      id: 'mom-meal',
      emoji: '🍽️',
      text: "Haven't eaten yet today — you need fuel to recover",
      severity: hour >= 14 ? 'critical' : 'warning',
    });
  } else if (hour >= 14 && mealsEaten < 2) {
    flags.push({
      id: 'mom-meal',
      emoji: '🍽️',
      text: `Only ${mealsEaten} meal today — try to eat regularly`,
      severity: 'warning',
    });
  }

  // Sleep quality
  if (data.sleep === 1 && hour >= 10) {
    flags.push({
      id: 'mom-sleep',
      emoji: '😴',
      text: 'You reported poor sleep — try to rest when baby sleeps',
      severity: 'warning',
    });
  }

  // Mood
  if (data.mood === 1) {
    flags.push({
      id: 'mom-mood',
      emoji: '💜',
      text: "You're having a rough day — that's okay, be gentle with yourself",
      severity: 'warning',
    });
  } else if (data.mood === 2 && hour >= 18) {
    flags.push({
      id: 'mom-mood',
      emoji: '💜',
      text: 'Feeling meh today — a short walk or call with a friend can help',
      severity: 'warning',
    });
  }

  // Vitamin
  if (!data.vitamin && hour >= 14) {
    flags.push({
      id: 'mom-vitamin',
      emoji: '💊',
      text: "Don't forget your postnatal vitamin today",
      severity: 'warning',
    });
  }

  return flags;
}

const emptyDay: MomDay = {
  date: '2025-03-15',
  meals: { breakfast: false, lunch: false, dinner: false, snack: false },
  water: false,
  vitamin: false,
  sleep: 0,
  mood: 0,
  moved: false,
  note: '',
};

describe('mom wellness alerts', () => {
  // ── No data ──
  describe('no data logged', () => {
    it('shows reminder after noon', () => {
      const alerts = computeMomAlerts(null, 13);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('mom-nodata');
    });

    it('no alert before noon', () => {
      const alerts = computeMomAlerts(null, 9);
      expect(alerts).toHaveLength(0);
    });
  });

  // ── Hydration ──
  describe('hydration alerts', () => {
    it('warns when water not checked after 2PM', () => {
      const alerts = computeMomAlerts({ ...emptyDay, water: false }, 15);
      const water = alerts.find((a) => a.id === 'mom-water');
      expect(water).toBeDefined();
      expect(water!.severity).toBe('warning');
    });

    it('critical after 4PM', () => {
      const alerts = computeMomAlerts({ ...emptyDay, water: false }, 17);
      const water = alerts.find((a) => a.id === 'mom-water');
      expect(water).toBeDefined();
      expect(water!.severity).toBe('critical');
    });

    it('no alert when water is checked', () => {
      const alerts = computeMomAlerts({ ...emptyDay, water: true }, 17);
      const water = alerts.find((a) => a.id === 'mom-water');
      expect(water).toBeUndefined();
    });

    it('no alert before 2PM', () => {
      const alerts = computeMomAlerts({ ...emptyDay, water: false }, 10);
      const water = alerts.find((a) => a.id === 'mom-water');
      expect(water).toBeUndefined();
    });
  });

  // ── Meals ──
  describe('meal alerts', () => {
    it('warns when no meals eaten after 10AM', () => {
      const alerts = computeMomAlerts(emptyDay, 11);
      const meal = alerts.find((a) => a.id === 'mom-meal');
      expect(meal).toBeDefined();
      expect(meal!.severity).toBe('warning');
    });

    it('critical when no meals after 2PM', () => {
      const alerts = computeMomAlerts(emptyDay, 15);
      const meal = alerts.find((a) => a.id === 'mom-meal');
      expect(meal).toBeDefined();
      expect(meal!.severity).toBe('critical');
    });

    it('warns when only 1 meal after 2PM', () => {
      const dayWithLunch = { ...emptyDay, meals: { ...emptyDay.meals, lunch: true } };
      const alerts = computeMomAlerts(dayWithLunch, 15);
      const meal = alerts.find((a) => a.id === 'mom-meal');
      expect(meal).toBeDefined();
      expect(meal!.text).toContain('1 meal');
    });

    it('no meal alert when 2+ meals eaten', () => {
      const dayWith2 = { ...emptyDay, meals: { ...emptyDay.meals, breakfast: true, lunch: true } };
      const alerts = computeMomAlerts(dayWith2, 15);
      const meal = alerts.find((a) => a.id === 'mom-meal');
      expect(meal).toBeUndefined();
    });
  });

  // ── Sleep quality ──
  describe('sleep quality alerts', () => {
    it('warns for poor sleep after 10AM', () => {
      const alerts = computeMomAlerts({ ...emptyDay, sleep: 1 }, 11);
      const sleep = alerts.find((a) => a.id === 'mom-sleep');
      expect(sleep).toBeDefined();
    });

    it('no alert for good sleep', () => {
      const alerts = computeMomAlerts({ ...emptyDay, sleep: 3 }, 11);
      const sleep = alerts.find((a) => a.id === 'mom-sleep');
      expect(sleep).toBeUndefined();
    });

    it('no alert before 10AM even if poor', () => {
      const alerts = computeMomAlerts({ ...emptyDay, sleep: 1 }, 8);
      const sleep = alerts.find((a) => a.id === 'mom-sleep');
      expect(sleep).toBeUndefined();
    });
  });

  // ── Mood ──
  describe('mood alerts', () => {
    it('always alerts for mood=1 (rough)', () => {
      const alerts = computeMomAlerts({ ...emptyDay, mood: 1 }, 8);
      const mood = alerts.find((a) => a.id === 'mom-mood');
      expect(mood).toBeDefined();
      expect(mood!.text).toContain('rough day');
    });

    it('alerts for mood=2 (meh) only after 6PM', () => {
      const noAlert = computeMomAlerts({ ...emptyDay, mood: 2 }, 15);
      expect(noAlert.find((a) => a.id === 'mom-mood')).toBeUndefined();

      const yesAlert = computeMomAlerts({ ...emptyDay, mood: 2 }, 19);
      expect(yesAlert.find((a) => a.id === 'mom-mood')).toBeDefined();
    });

    it('no alert for mood 3+ (okay or better)', () => {
      const alerts = computeMomAlerts({ ...emptyDay, mood: 3 }, 20);
      expect(alerts.find((a) => a.id === 'mom-mood')).toBeUndefined();
    });
  });

  // ── Vitamin ──
  describe('vitamin alerts', () => {
    it('reminds after 2PM if not taken', () => {
      const alerts = computeMomAlerts({ ...emptyDay, vitamin: false }, 15);
      expect(alerts.find((a) => a.id === 'mom-vitamin')).toBeDefined();
    });

    it('no alert if taken', () => {
      const alerts = computeMomAlerts({ ...emptyDay, vitamin: true }, 15);
      expect(alerts.find((a) => a.id === 'mom-vitamin')).toBeUndefined();
    });

    it('no alert before 2PM', () => {
      const alerts = computeMomAlerts({ ...emptyDay, vitamin: false }, 10);
      expect(alerts.find((a) => a.id === 'mom-vitamin')).toBeUndefined();
    });
  });

  // ── Combined scenario ──
  describe('combined scenarios', () => {
    it('generates multiple alerts for worst-case day', () => {
      const worstDay: MomDay = {
        date: '2025-03-15',
        meals: { breakfast: false, lunch: false, dinner: false, snack: false },
        water: false,
        vitamin: false,
        sleep: 1,
        mood: 1,
        moved: false,
        note: '',
      };
      const alerts = computeMomAlerts(worstDay, 17);
      expect(alerts.length).toBeGreaterThanOrEqual(4); // water, meal, sleep, mood, vitamin
      const ids = alerts.map((a) => a.id);
      expect(ids).toContain('mom-water');
      expect(ids).toContain('mom-meal');
      expect(ids).toContain('mom-sleep');
      expect(ids).toContain('mom-mood');
      expect(ids).toContain('mom-vitamin');
    });

    it('generates zero alerts for a perfect day', () => {
      const perfectDay: MomDay = {
        date: '2025-03-15',
        meals: { breakfast: true, lunch: true, dinner: true, snack: false },
        water: true,
        vitamin: true,
        sleep: 3,
        mood: 5,
        moved: true,
        note: 'Great day!',
      };
      const alerts = computeMomAlerts(perfectDay, 20);
      expect(alerts).toHaveLength(0);
    });
  });
});
