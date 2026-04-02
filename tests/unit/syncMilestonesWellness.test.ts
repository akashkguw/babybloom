import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for sync bug fixes:
 *   1. Milestones deep-merge (nested week → checks structure)
 *   2. spd() race condition guard during sync apply
 *   3. Wellness data included in cloud sync as private backup
 */

const mergeSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/merge.ts'),
  'utf8'
);

const snapshotSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/snapshot.ts'),
  'utf8'
);

const typesSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/types.ts'),
  'utf8'
);

const appSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/App.tsx'),
  'utf8'
);

// ─── Milestones deep-merge ───

describe('Milestones — deep-merge nested structure', () => {
  it('merge.ts exports a mergeMilestones function', () => {
    expect(mergeSrc).toContain('export function mergeMilestones(');
  });

  it('mergeMilestones handles nested objects (week → checks)', () => {
    // Should iterate inner keys when val is an object
    expect(mergeSrc).toContain("typeof val === 'object'");
    expect(mergeSrc).toContain('Object.entries(val)');
  });

  it('mergeMilestones deep-merges inner boolean flags', () => {
    // Inner loop should apply "once true, always true" rule
    const fnStart = mergeSrc.indexOf('export function mergeMilestones');
    const fnRegion = mergeSrc.slice(fnStart, fnStart + 800);
    expect(fnRegion).toContain('innerVal === true');
    expect(fnRegion).toContain('result[key][innerKey]');
  });

  it('mergeSnapshots uses mergeMilestones instead of mergeBooleanFlags for milestones', () => {
    const snapshotsRegion = mergeSrc.slice(
      mergeSrc.indexOf('function mergeSnapshots'),
      mergeSrc.indexOf('function mergeSnapshots') + 2000
    );
    expect(snapshotsRegion).toContain('mergeMilestones(');
    expect(snapshotsRegion).not.toMatch(/mergeBooleanFlags\([^)]*milestones/);
  });

  it('StateSnapshot type allows nested milestones structure', () => {
    expect(typesSrc).toContain('Record<string, boolean>');
    // milestones type should allow nested objects
    const milestonesLine = typesSrc.split('\n').find(l => l.includes('milestones:'));
    expect(milestonesLine).toBeTruthy();
    expect(milestonesLine).toContain('Record<string,');
  });
});

// ─── spd() race condition guard ───

describe('App — spd() sync race condition guard', () => {
  it('has a syncApplyingRef guard ref', () => {
    expect(appSrc).toContain('syncApplyingRef');
    expect(appSrc).toContain('useRef(false)');
  });

  it('spd() checks syncApplyingRef before writing profileData', () => {
    const spdStart = appSrc.indexOf('const spd = (field:');
    expect(spdStart).toBeGreaterThan(-1);
    const spdRegion = appSrc.slice(spdStart, spdStart + 600);
    expect(spdRegion).toContain('syncApplyingRef.current');
  });

  it('onSyncApplied sets syncApplyingRef to true before reloading state', () => {
    const handlerStart = appSrc.indexOf('const onSyncApplied');
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerRegion = appSrc.slice(handlerStart, handlerStart + 200);
    expect(handlerRegion).toContain('syncApplyingRef.current = true');
  });

  it('onSyncApplied releases syncApplyingRef after state updates', () => {
    const handlerStart = appSrc.indexOf('const onSyncApplied');
    const handlerRegion = appSrc.slice(handlerStart, handlerStart + 1200);
    expect(handlerRegion).toContain('syncApplyingRef.current = false');
  });
});

// ─── Wellness cloud backup ───

describe('Wellness — cloud sync backup', () => {
  it('StateSnapshot type includes optional wellness field', () => {
    expect(typesSrc).toContain('wellness?:');
  });

  it('buildSnapshot reads momcare_today and momcare_history from IndexedDB', () => {
    expect(snapshotSrc).toContain("dg('momcare_today')");
    expect(snapshotSrc).toContain("dg('momcare_history')");
  });

  it('buildSnapshot includes wellness in the returned snapshot', () => {
    const buildFn = snapshotSrc.slice(
      snapshotSrc.indexOf('async function buildSnapshot'),
      snapshotSrc.indexOf('// ═══ SNAPSHOT APPLY')
    );
    expect(buildFn).toContain('wellness:');
  });

  it('applySnapshot restores wellness data from snapshot', () => {
    const applyFn = snapshotSrc.slice(
      snapshotSrc.indexOf('async function applySnapshot'),
      snapshotSrc.indexOf('// ═══ MIGRATION')
    );
    expect(applyFn).toContain('snapshot.wellness');
    expect(applyFn).toContain("ds('momcare_today'");
    expect(applyFn).toContain("ds('momcare_history'");
  });

  it('mergeSnapshots preserves only local device wellness (not merged across devices)', () => {
    const mergeFn = mergeSrc.slice(
      mergeSrc.indexOf('function mergeSnapshots'),
      mergeSrc.indexOf('function mergeSnapshots') + 3000
    );
    expect(mergeFn).toContain('wellness: local.wellness');
  });
});
