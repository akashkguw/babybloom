import { ML_PER_OZ } from '@/lib/utils/volume';
import { autoSleepType } from '@/lib/utils/date';

export interface VoiceParseResult {
  cat: 'feed' | 'diaper' | 'sleep' | 'temp' | 'bath' | 'massage' | 'meds' | 'allergy' | 'growth';
  entry: Record<string, any>;
}

export default function parseVoice(text: string): VoiceParseResult | null {
  const t = text.toLowerCase().trim().replace(/[.,!?]+$/, '');
  let result: VoiceParseResult | null = null;

  // Extract time if mentioned (e.g., "at 2:30", "at 2 30 PM")
  let timeOverride: string | null = null;
  const tm = t.match(/(?:at\s+)?(\d{1,2})[:\s](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (tm) {
    let hr = parseInt(tm[1]);
    const mn = parseInt(tm[2]);
    const ap = tm[3] ? tm[3].replace(/\./g, '').toLowerCase() : null;
    if (ap === 'pm' && hr < 12) hr += 12;
    if (ap === 'am' && hr === 12) hr = 0;
    if (hr >= 0 && hr < 24 && mn >= 0 && mn < 60) {
      timeOverride = String(hr).padStart(2, '0') + ':' + String(mn).padStart(2, '0');
    }
  }

  // Extract oz/ml amounts
  const ozM = t.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)/);
  const mlM = t.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliter)/);
  const minM = t.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|minutes)/);

  // Temperature
  let tempM = t.match(/(?:temp|temperature|fever)\s*(?:is|was|of)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?\s*f|fahrenheit|degrees)?/i);
  if (!tempM) tempM = t.match(/(\d{2,3}\.\d+)\s*(?:°?\s*f|fahrenheit|degrees|temp)/i);

  // ═══ FEEDING ═══
  if (/breast\s*(?:feed|fed)?\s*(?:left|l\b)/i.test(t) || /left\s*breast/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Breast L' } };
    if (minM) result.entry.mins = parseFloat(minM[1]);
    if (minM) result.entry.amount = minM[1] + ' min';
  } else if (/breast\s*(?:feed|fed)?\s*(?:right|r\b)/i.test(t) || /right\s*breast/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Breast R' } };
    if (minM) result.entry.mins = parseFloat(minM[1]);
    if (minM) result.entry.amount = minM[1] + ' min';
  } else if (/nurs(?:ed|ing)\s.*left|left\s.*nurs/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Breast L' } };
    if (minM) result.entry.mins = parseFloat(minM[1]);
    if (minM) result.entry.amount = minM[1] + ' min';
  } else if (/nurs(?:ed|ing)\s.*right|right\s.*nurs/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Breast R' } };
    if (minM) result.entry.mins = parseFloat(minM[1]);
    if (minM) result.entry.amount = minM[1] + ' min';
  } else if ((/breast\s*(?:feed|fed)?/i.test(t) || /\bnurs(?:ed|ing|e)\b/i.test(t)) && !/left|right|l\b|r\b/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Breast L' } };
    if (minM) result.entry.mins = parseFloat(minM[1]);
    if (minM) result.entry.amount = minM[1] + ' min';
  } else if (/formula/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Formula' } };
    if (ozM) {
      result.entry.oz = parseFloat(ozM[1]);
      result.entry.amount = ozM[1] + ' oz';
    } else if (mlM) {
      result.entry.oz = Math.round((parseFloat(mlM[1]) / 29.5735) * 10) / 10;
      result.entry.amount = mlM[1] + ' ml';
    } else if (minM) {
      result.entry.mins = parseFloat(minM[1]);
      result.entry.amount = minM[1] + ' min';
    }
  } else if (/pumped\s*(?:milk|breast)|expressed/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Pumped Milk' } };
    if (ozM) {
      result.entry.oz = parseFloat(ozM[1]);
      result.entry.amount = ozM[1] + ' oz';
    } else if (mlM) {
      result.entry.oz = Math.round((parseFloat(mlM[1]) / 29.5735) * 10) / 10;
      result.entry.amount = mlM[1] + ' ml';
    }
  } else if (/bottle/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Bottle' } };
    if (ozM) {
      result.entry.oz = parseFloat(ozM[1]);
      result.entry.amount = ozM[1] + ' oz';
    } else if (mlM) {
      result.entry.oz = Math.round((parseFloat(mlM[1]) / 29.5735) * 10) / 10;
      result.entry.amount = mlM[1] + ' ml';
    } else if (minM) {
      result.entry.mins = parseFloat(minM[1]);
      result.entry.amount = minM[1] + ' min';
    }
  } else if (/(?:fed|feed|ate|eating|nursed)\s+(\d+(?:\.\d+)?)\s*(?:oz|ounce)/i.test(t)) {
    const fOz = t.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounce)/);
    result = { cat: 'feed', entry: { type: 'Bottle', oz: parseFloat(fOz![1]), amount: fOz![1] + ' oz' } };
  } else if (/solid|puree|cereal|banana|avocado|sweet potato|rice|oat/i.test(t)) {
    result = { cat: 'feed', entry: { type: 'Solids', notes: t } };

    // ═══ DIAPER ═══
  } else if (/both|wet\s*and\s*dirty|mixed/i.test(t)) {
    result = { cat: 'diaper', entry: { type: 'Both' } };
  } else if (/poop|poopy|dirty\s*diaper|dirty|bowel|bm\b|diarrhea/i.test(t)) {
    result = { cat: 'diaper', entry: { type: 'Dirty' } };
    if (/green/i.test(t)) result.entry.notes = 'Green';
    if (/watery|runny|diarrhea/i.test(t)) result.entry.notes = 'Watery/runny';
  } else if (/wet\s*diaper|wet|pee|urine/i.test(t)) {
    result = { cat: 'diaper', entry: { type: 'Wet' } };
  } else if (/diaper\s*change|changed\s*diaper|diaper/i.test(t)) {
    result = { cat: 'diaper', entry: { type: /poop|dirty/i.test(t) ? 'Dirty' : 'Wet' } };

    // ═══ SLEEP ═══
  } else if (/woke\s*up|wake\s*up|awake|waking/i.test(t)) {
    result = { cat: 'sleep', entry: { type: 'Wake Up' } };
  } else if (/night\s*sleep|bedtime|bed\s*time|going\s*to\s*(?:bed|sleep)\s*(?:for\s*the\s*)?night|nap|napping|sleeping|fell\s*asleep|dozed|sleep/i.test(t)) {
    result = { cat: 'sleep', entry: { type: autoSleepType() } };
  } else if (/tummy\s*time/i.test(t)) {
    result = { cat: 'sleep', entry: { type: 'Tummy Time' } };
    if (minM) {
      result.entry.mins = parseFloat(minM[1]);
      result.entry.amount = minM[1] + ' min';
    }

    // ═══ HEALTH ═══
  } else if (tempM) {
    result = { cat: 'temp', entry: { type: 'Temperature', value: parseFloat(tempM[1]), notes: tempM[1] + '°F' } };
  } else if (/massage|massaged|rubdown|oil\s*massage/i.test(t)) {
    result = { cat: 'massage', entry: { type: 'Full Body' } };
    if (/leg|feet|foot/i.test(t)) result.entry.type = 'Legs & Feet';
    if (/tummy|belly|stomach/i.test(t)) result.entry.type = 'Tummy';
    if (/back/i.test(t)) result.entry.type = 'Back';
    if (/arm|hand/i.test(t)) result.entry.type = 'Arms';
    if (/face|head/i.test(t)) result.entry.type = 'Face & Head';
    if (/coconut/i.test(t)) result.entry.oil = 'Coconut';
    if (/sesame/i.test(t)) result.entry.oil = 'Sesame';
    if (/olive/i.test(t)) result.entry.oil = 'Olive';
    if (/almond/i.test(t)) result.entry.oil = 'Almond';
    if (minM) {
      result.entry.duration = minM[1];
      result.entry.amount = minM[1] + ' min';
    }
  } else if (/bath|bathed|shower/i.test(t)) {
    result = { cat: 'bath', entry: { type: 'Bath' } };
  } else if (/medicine|tylenol|ibuprofen|advil|motrin|gripe|vitamin|drops/i.test(t)) {
    result = { cat: 'meds', entry: { type: 'Medicine', notes: t } };
  } else if (/allergy|allergic|rash|hives|reaction|swelling/i.test(t)) {
    result = { cat: 'allergy', entry: { type: 'Allergy', notes: t } };

    // ═══ GROWTH ═══
  } else if (/weigh|weight|pound|lb/i.test(t)) {
    const wM = t.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound)/);
    if (wM) result = { cat: 'growth', entry: { type: 'Weight', value: parseFloat(wM[1]), unit: 'lb', notes: wM[1] + ' lbs' } };
  } else if (/height|length|inch|cm|tall/i.test(t)) {
    const hM = t.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|cm)/);
    if (hM) result = { cat: 'growth', entry: { type: 'Height', value: parseFloat(hM[1]), notes: hM[1] + (hM[0].includes('cm') ? ' cm' : ' in') } };
  }

  if (result && timeOverride) result.entry.time = timeOverride;
  return result;
}

export { parseVoice };
