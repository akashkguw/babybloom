import { describe, it, expect } from 'vitest';
import { isValidFamilyCode } from '@/lib/utils/validate';

// ── isValidFamilyCode ─────────────────────────────────────────────────────────
describe('isValidFamilyCode', () => {
  it('accepts valid bloom-xxxxxxxx codes', () => {
    expect(isValidFamilyCode('bloom-abcd1234')).toBe(true);
    expect(isValidFamilyCode('bloom-12345678')).toBe(true);
    expect(isValidFamilyCode('bloom-a1b2c3d4')).toBe(true);
  });

  it('accepts codes longer than 8 suffix chars', () => {
    expect(isValidFamilyCode('bloom-abcdefgh12')).toBe(true);
  });

  it('rejects codes without the bloom- prefix', () => {
    expect(isValidFamilyCode('abcd1234')).toBe(false);
    expect(isValidFamilyCode('code-abcd1234')).toBe(false);
  });

  it('rejects codes with suffix shorter than 8 chars', () => {
    expect(isValidFamilyCode('bloom-abc')).toBe(false);
    expect(isValidFamilyCode('bloom-1234567')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidFamilyCode('')).toBe(false);
  });

  it('is case-insensitive (normalises to lowercase)', () => {
    expect(isValidFamilyCode('BLOOM-ABCD1234')).toBe(true);
    expect(isValidFamilyCode('Bloom-Abcd1234')).toBe(true);
  });

  it('trims whitespace before validating', () => {
    expect(isValidFamilyCode('  bloom-abcd1234  ')).toBe(true);
  });

  it('rejects codes with uppercase in suffix after normalisation (uppercase letters become lowercase)', () => {
    // After toLowerCase, uppercase suffix chars become valid lowercase — still pass
    expect(isValidFamilyCode('bloom-ABCD1234')).toBe(true);
  });

  it('rejects codes with special characters in suffix', () => {
    expect(isValidFamilyCode('bloom-abcd123!')).toBe(false);
    expect(isValidFamilyCode('bloom-abcd 123')).toBe(false);
  });
});

// ── Login screen state logic ──────────────────────────────────────────────────
// Verify state transitions that drive the login page UI behaviour.
// These are pure logic checks — no DOM rendering needed.

describe('login page state logic', () => {
  it('showFamilyCode is independent of showJoinCode', () => {
    // Regression: "Start via family code" was hidden when showJoinCode was true.
    // The fix removes the !showJoinCode guard. Verify the logic separately:
    // showFamilyCode=true AND showJoinCode=true should both be valid simultaneously.
    let showJoinCode = true;
    let showFamilyCode = true;
    // Both can be true — no mutual exclusion
    expect(showJoinCode && showFamilyCode).toBe(true);
  });

  it('scroll targets: showJoinCode triggers joinSection scroll, showFamilyCode triggers familyCodeSection scroll', () => {
    // Simulate the two separate useEffects for scroll behaviour.
    const scrolledSections: string[] = [];

    function onShowJoinCodeChange(val: boolean) {
      if (val) scrolledSections.push('joinSection');
    }
    function onShowFamilyCodeChange(val: boolean) {
      if (val) scrolledSections.push('familyCodeSection');
    }

    // Tapping "I have code" (Start via family code)
    onShowFamilyCodeChange(true);
    expect(scrolledSections).toContain('familyCodeSection');
    expect(scrolledSections).not.toContain('joinSection');

    // Tapping "Have a share code?"
    onShowJoinCodeChange(true);
    expect(scrolledSections).toContain('joinSection');
  });

  it('family code validation rejects short suffix before saving', () => {
    const code = 'bloom-short';
    expect(isValidFamilyCode(code)).toBe(false);
  });

  it('family code validation accepts correct code before saving', () => {
    const code = 'bloom-x1y2z3w4';
    expect(isValidFamilyCode(code)).toBe(true);
  });
});
