import { describe, it, expect } from 'vitest';
import { MILESTONES } from '@/lib/constants/milestones';
import fs from 'fs';
import path from 'path';

/**
 * Search fix (#127) — verifies the SearchModal covers all log types,
 * extracts all relevant fields, and searches milestones + red flags.
 */

// Read SearchModal source for structural assertions
const searchSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/modals/SearchModal.tsx'),
  'utf8'
);

describe('SearchModal — log type coverage', () => {
  // These are the log types that exist in the app's data model
  const requiredLogTypes = [
    'feed', 'diaper', 'sleep', 'tummy', 'growth',
    'temp', 'bath', 'massage', 'meds', 'allergy',
  ];

  // Extract the logTypes array from SearchModal source
  const logTypesMatch = searchSrc.match(/const logTypes\s*=\s*\[([^\]]+)\]/);
  const declaredTypes = logTypesMatch
    ? logTypesMatch[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, '')) || []
    : [];

  it('declares a logTypes array', () => {
    expect(logTypesMatch).not.toBeNull();
    expect(declaredTypes.length).toBeGreaterThan(0);
  });

  requiredLogTypes.forEach((type) => {
    it(`includes "${type}" in search logTypes`, () => {
      expect(declaredTypes).toContain(type);
    });
  });

  it('does not include non-existent log type "pump"', () => {
    expect(declaredTypes).not.toContain('pump');
  });
});

describe('SearchModal — field extraction completeness', () => {
  // All fields that should be searched for log entries
  const requiredFields = [
    'e.type', 'e.subType', 'e.amount', 'e.notes', 'e.food',
    'e.reaction', 'e.med', 'e.dose', 'e.weight', 'e.height',
    'e.head', 'e.temp', 'e.duration', 'e.waterTemp', 'e.color',
    'e.consistency', 'e.peeAmount', 'e.side',
  ];

  requiredFields.forEach((field) => {
    it(`extracts ${field} for text search`, () => {
      expect(searchSrc).toContain(field);
    });
  });
});

describe('SearchModal — milestone search', () => {
  it('imports MILESTONES constant', () => {
    expect(searchSrc).toContain("import { MILESTONES }");
  });

  it('searches motor milestones', () => {
    expect(searchSrc).toContain('m.motor');
  });

  it('searches cognitive milestones', () => {
    expect(searchSrc).toContain('m.cog');
  });

  it('searches social milestones', () => {
    expect(searchSrc).toContain('m.soc');
  });

  it('searches language milestones', () => {
    expect(searchSrc).toContain('m.lang');
  });

  it('searches red flags', () => {
    expect(searchSrc).toContain('m.red');
  });
});

describe('MILESTONES data integrity', () => {
  const keys = Object.keys(MILESTONES).map(Number);

  it('has milestone entries', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('each milestone has all required categories', () => {
    keys.forEach((k) => {
      const m = MILESTONES[k];
      expect(m).toHaveProperty('motor');
      expect(m).toHaveProperty('cog');
      expect(m).toHaveProperty('soc');
      expect(m).toHaveProperty('lang');
      expect(m).toHaveProperty('red');
      expect(Array.isArray(m.motor)).toBe(true);
      expect(Array.isArray(m.cog)).toBe(true);
      expect(Array.isArray(m.soc)).toBe(true);
      expect(Array.isArray(m.lang)).toBe(true);
      expect(Array.isArray(m.red)).toBe(true);
    });
  });

  it('each milestone has a label and emoji', () => {
    keys.forEach((k) => {
      const m = MILESTONES[k];
      expect(m.l).toBeTruthy();
      expect(m.e).toBeTruthy();
    });
  });
});
