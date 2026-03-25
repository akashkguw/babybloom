/**
 * useMomAlerts
 * Reads today's MomCare wellness data from IndexedDB and returns
 * time-aware alerts for the carousel — same shape as DynamicRedFlag
 * so they slot seamlessly into the existing priority system.
 *
 * Alerts fire at sensible times of day:
 * - Hydration: after 14:00 if water not checked off
 * - Meals: after 10:00 (breakfast), 14:00 (lunch), 19:00 (dinner)
 * - Sleep quality: after 10:00 if still "poor"
 * - Mood: after 16:00 if set to 1 (rough)
 * - Vitamin: after 12:00 if not taken
 */
import { useState, useEffect } from 'react';
import { today } from '@/lib/utils/date';
import { dg } from '@/lib/db';
import type { DynamicRedFlag } from './useDynamicRedFlags';

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

const STORAGE_KEY = 'momcare_today';

export default function useMomAlerts(): DynamicRedFlag[] {
  const [alerts, setAlerts] = useState<DynamicRedFlag[]>([]);

  useEffect(() => {
    const td = today();
    dg(STORAGE_KEY).then((saved: MomDay | null) => {
      const data = saved && saved.date === td ? saved : null;
      const flags: DynamicRedFlag[] = [];
      const hour = new Date().getHours();

      if (!data) {
        // No wellness data logged today at all
        if (hour >= 12) {
          flags.push({
            id: 'mom-nodata',
            emoji: '💜',
            text: 'No wellness check-in today — take a moment for yourself',
            severity: 'warning',
          });
        }
        setAlerts(flags);
        return;
      }

      // ── Hydration ──
      if (hour >= 14 && !data.water) {
        flags.push({
          id: 'mom-water',
          emoji: '💧',
          text: 'Remember to stay hydrated — it helps recovery & milk supply',
          severity: hour >= 16 ? 'critical' : 'warning',
        });
      }

      // ── Meals ──
      const mealsEaten = Object.values(data.meals).filter(Boolean).length;
      if (hour >= 10 && !data.meals.breakfast && mealsEaten === 0) {
        flags.push({
          id: 'mom-meal',
          emoji: '🍽️',
          text: 'Haven\'t eaten yet today — you need fuel to recover',
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

      // ── Sleep quality ──
      if (data.sleep === 1 && hour >= 10) {
        flags.push({
          id: 'mom-sleep',
          emoji: '😴',
          text: 'You reported poor sleep — try to rest when baby sleeps',
          severity: 'warning',
        });
      }

      // ── Mood ──
      if (data.mood === 1) {
        flags.push({
          id: 'mom-mood',
          emoji: '💜',
          text: 'You\'re having a rough day — that\'s okay, be gentle with yourself',
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

      // ── Vitamin ──
      if (!data.vitamin && hour >= 14) {
        flags.push({
          id: 'mom-vitamin',
          emoji: '💊',
          text: 'Don\'t forget your postnatal vitamin today',
          severity: 'warning',
        });
      }

      setAlerts(flags);
    });
  }, []);

  return alerts;
}
