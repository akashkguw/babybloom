import { fmtVol } from '@/lib/utils/volume';
import { autoSleepType } from '@/lib/utils/date';

export interface ShortcutAction {
  cat: string;
  entry: Record<string, any>;
}

export const QUICK_MAP: Record<string, ShortcutAction | (() => ShortcutAction)> = {
  breast_l: { cat: 'feed', entry: { type: 'Breast L' } },
  breast_r: { cat: 'feed', entry: { type: 'Breast R' } },
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
  tummy: { cat: 'sleep', entry: { type: 'Tummy Time' } },
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
      if (oz) result.entry.oz = parseFloat(oz);
      const min = params.get('min');
      if (min) {
        result.entry.mins = parseFloat(min);
        result.entry.amount = min + ' min';
      }
      if (oz) {
        result.entry.amount = fmtVol(parseFloat(oz), volumeUnit);
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
