import { fmtVol } from '@/lib/utils/volume';
import { autoSleepType } from '@/lib/utils/date';
import { safeNum, LIMITS } from '@/lib/utils/validate';

export interface ShortcutAction {
  cat: string;
  entry: Record<string, any>;
}

export const QUICK_MAP: Record<string, ShortcutAction | (() => ShortcutAction)> = {
  breast_l: { cat: 'feed', entry: { type: 'Breast L' } },
  breast_r: { cat: 'feed', entry: { type: 'Breast R' } },
  nurse_l: { cat: 'feed', entry: { type: 'Breast L' } },
  nurse_r: { cat: 'feed', entry: { type: 'Breast R' } },
  bottle: { cat: 'feed', entry: { type: 'Formula' } },
  formula: { cat: 'feed', entry: { type: 'Formula' } },
  pumped: { cat: 'feed', entry: { type: 'Pumped Milk' } },
  wet: { cat: 'diaper', entry: { type: 'Wet' } },
  dirty: { cat: 'diaper', entry: { type: 'Dirty' } },
  both: { cat: 'diaper', entry: { type: 'Both' } },
  nap: () => ({ cat: 'sleep', entry: { type: autoSleepType() } }),
  sleep: () => ({ cat: 'sleep', entry: { type: autoSleepType() } }),
  wake: { cat: 'sleep', entry: { type: 'Wake Up' } },
  night: () => ({ cat: 'sleep', entry: { type: autoSleepType() } }),
  tummy: { cat: 'tummy', entry: { type: 'Tummy Time' } },
  bath: { cat: 'bath', entry: { type: 'Bath' } },
  pump: { cat: 'feed', entry: { type: 'Pump' } },
  massage: { cat: 'massage', entry: { type: 'Full Body' } },
};

function resolveQuickMap(key: string): ShortcutAction | undefined {
  const val = QUICK_MAP[key];
  if (!val) return undefined;
  return typeof val === 'function' ? val() : val;
}

export function handleShortcutAction(
  quick: string | null,
  voice: string | null,
  volumeUnit: 'ml' | 'oz',
  parseVoice?: (text: string) => any
): ShortcutAction | null {
  const params = new URLSearchParams(window.location.search);

  let result: ShortcutAction | null = null;

  if (quick && QUICK_MAP[quick]) {
    result = resolveQuickMap(quick) || null;
    // Check for extra params
    if (result) {
      const oz = params.get('oz');
      if (oz) {
        const ozVal = safeNum(oz, LIMITS.feedOz.min, LIMITS.feedOz.max);
        if (ozVal > 0) {
          result.entry.oz = ozVal;
          result.entry.amount = fmtVol(ozVal, volumeUnit);
        }
      }
      const min = params.get('min');
      if (min) {
        const minVal = safeNum(min, LIMITS.feedMins.min, LIMITS.feedMins.max);
        if (minVal > 0) {
          result.entry.mins = minVal;
          result.entry.amount = minVal + ' min';
        }
      }
    }
  } else if (voice && parseVoice) {
    result = parseVoice(voice);
  }

  // Clean URL without reload
  if (result) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  return result;
}
