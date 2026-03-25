import { describe, it, expect } from 'vitest';
import parseVoice from '@/features/voice/parseVoice';

describe('parseVoice', () => {
  // ── FEEDING ──
  describe('feeding recognition', () => {
    it('parses left breast feed', () => {
      const r = parseVoice('breast feed left');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('feed');
      expect(r!.entry.type).toBe('Breast L');
    });

    it('parses right breast feed', () => {
      const r = parseVoice('breast right');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('feed');
      expect(r!.entry.type).toBe('Breast R');
    });

    it('parses left nursing', () => {
      const r = parseVoice('nursed on left for 15 minutes');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('feed');
      expect(r!.entry.type).toBe('Breast L');
      expect(r!.entry.mins).toBe(15);
    });

    it('defaults bare breastfeed to Breast L', () => {
      const r = parseVoice('breastfeed');
      expect(r).not.toBeNull();
      expect(r!.entry.type).toBe('Breast L');
    });

    it('parses formula with oz amount', () => {
      const r = parseVoice('formula 4.5 oz');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('feed');
      expect(r!.entry.type).toBe('Formula');
      expect(r!.entry.oz).toBe(4.5);
    });

    it('parses formula with ml amount (converts to oz)', () => {
      const r = parseVoice('formula 120 ml');
      expect(r).not.toBeNull();
      expect(r!.entry.type).toBe('Formula');
      expect(r!.entry.oz).toBeGreaterThan(3.5);
      expect(r!.entry.oz).toBeLessThan(4.5);
    });

    it('parses bottle feed', () => {
      const r = parseVoice('bottle 3 oz');
      expect(r).not.toBeNull();
      expect(r!.entry.type).toBe('Bottle');
      expect(r!.entry.oz).toBe(3);
    });

    it('parses pumped milk', () => {
      const r = parseVoice('pumped breast milk 4 oz');
      expect(r).not.toBeNull();
      expect(r!.entry.type).toBe('Pumped Milk');
      expect(r!.entry.oz).toBe(4);
    });

    it('parses solids', () => {
      const r = parseVoice('had some banana puree');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('feed');
      expect(r!.entry.type).toBe('Solids');
    });

    it('parses "fed 4 oz" as bottle feed', () => {
      const r = parseVoice('fed 4 oz');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('feed');
      expect(r!.entry.oz).toBe(4);
    });
  });

  // ── DIAPER ──
  describe('diaper recognition', () => {
    it('parses wet diaper', () => {
      const r = parseVoice('wet diaper');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('diaper');
      expect(r!.entry.type).toBe('Wet');
    });

    it('parses dirty diaper', () => {
      const r = parseVoice('poopy diaper');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('diaper');
      expect(r!.entry.type).toBe('Dirty');
    });

    it('parses both wet and dirty', () => {
      const r = parseVoice('wet and dirty diaper');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('diaper');
      expect(r!.entry.type).toBe('Both');
    });

    it('detects green stool note', () => {
      const r = parseVoice('green poop');
      expect(r).not.toBeNull();
      expect(r!.entry.notes).toBe('Green');
    });

    it('detects watery stool note', () => {
      const r = parseVoice('diarrhea');
      expect(r).not.toBeNull();
      expect(r!.entry.notes).toBe('Watery/runny');
    });
  });

  // ── SLEEP ──
  describe('sleep recognition', () => {
    it('parses wake up', () => {
      const r = parseVoice('woke up');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('sleep');
      expect(r!.entry.type).toBe('Wake Up');
    });

    it('parses nap/sleep', () => {
      const r = parseVoice('napping');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('sleep');
    });

    it('parses bedtime', () => {
      const r = parseVoice('going to bed for the night');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('sleep');
    });
  });

  // ── TUMMY TIME ──
  describe('tummy time recognition', () => {
    it('parses tummy time', () => {
      const r = parseVoice('tummy time');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('tummy');
      expect(r!.entry.type).toBe('Tummy Time');
    });

    it('parses tummy time with duration', () => {
      const r = parseVoice('tummy time 10 minutes');
      expect(r).not.toBeNull();
      expect(r!.entry.mins).toBe(10);
    });
  });

  // ── HEALTH ──
  describe('health recognition', () => {
    it('parses temperature', () => {
      const r = parseVoice('temp is 101.5 F');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('temp');
      expect(r!.entry.value).toBe(101.5);
    });

    it('parses massage with body part', () => {
      const r = parseVoice('leg massage 15 minutes');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('massage');
      expect(r!.entry.type).toBe('Legs & Feet');
      expect(r!.entry.duration).toBe('15');
    });

    it('parses massage with oil type', () => {
      const r = parseVoice('coconut oil massage');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('massage');
      expect(r!.entry.oil).toBe('Coconut');
    });

    it('parses bath', () => {
      const r = parseVoice('gave baby a bath');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('bath');
    });

    it('parses medicine', () => {
      const r = parseVoice('gave tylenol');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('meds');
    });

    it('parses allergy/reaction', () => {
      const r = parseVoice('allergic reaction with hives');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('allergy');
    });
  });

  // ── GROWTH ──
  describe('growth recognition', () => {
    it('parses weight in lbs', () => {
      const r = parseVoice('weighs 12.5 lbs');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('growth');
      expect(r!.entry.value).toBe(12.5);
    });

    it('parses height in inches', () => {
      const r = parseVoice('height is 24 inches');
      expect(r).not.toBeNull();
      expect(r!.cat).toBe('growth');
      expect(r!.entry.value).toBe(24);
    });
  });

  // ── TIME OVERRIDE ──
  describe('time extraction', () => {
    it('extracts time from utterance', () => {
      const r = parseVoice('wet diaper at 2:30 PM');
      expect(r).not.toBeNull();
      expect(r!.entry.time).toBe('14:30');
    });

    it('handles AM times', () => {
      const r = parseVoice('bottle 4 oz at 6:00 AM');
      expect(r).not.toBeNull();
      expect(r!.entry.time).toBe('06:00');
    });

    it('handles midnight (12 AM)', () => {
      const r = parseVoice('woke up at 12:15 AM');
      expect(r).not.toBeNull();
      expect(r!.entry.time).toBe('00:15');
    });
  });

  // ── BOUNDS VALIDATION ──
  describe('post-parse bounds validation', () => {
    it('rejects out-of-range temperature', () => {
      const r = parseVoice('temp is 50 degrees');
      expect(r).toBeNull(); // 50°F is below LIMITS.tempF.min (90)
    });

    it('rejects out-of-range weight', () => {
      const r = parseVoice('weighs 0.1 lbs');
      expect(r).toBeNull(); // below LIMITS.weightLbs.min (1)
    });

    it('returns null for unrecognized input', () => {
      expect(parseVoice('hello world')).toBeNull();
      expect(parseVoice('')).toBeNull();
    });
  });
});
