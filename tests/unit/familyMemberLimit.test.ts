import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const profileManagerSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/features/profiles/ProfileManager.tsx'),
  'utf8'
);

const appSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/App.tsx'),
  'utf8'
);

// ─── MAX_FAMILY_MEMBERS constant ───

describe('MAX_FAMILY_MEMBERS constant (#184)', () => {
  it('is exported from ProfileManager.tsx', () => {
    expect(profileManagerSrc).toContain('export const MAX_FAMILY_MEMBERS');
  });

  it('is set to 3', () => {
    expect(profileManagerSrc).toMatch(/MAX_FAMILY_MEMBERS\s*=\s*3/);
  });

  it('is not a magic number — uses the constant in the UI limit check', () => {
    expect(profileManagerSrc).toContain('profiles.length >= MAX_FAMILY_MEMBERS');
  });
});

// ─── UI enforcement ───

describe('ProfileManager UI — blocks adding when at limit (#184)', () => {
  it('shows "Family is full" message when limit is reached', () => {
    expect(profileManagerSrc).toContain('Family is full');
  });

  it('mentions the maximum members in the full message', () => {
    expect(profileManagerSrc).toMatch(/maximum \{MAX_FAMILY_MEMBERS\} members allowed/);
  });

  it('hides the "Add Baby" button when at the limit', () => {
    // The "+ Add Baby" button is inside a conditional that only renders when
    // profiles.length < MAX_FAMILY_MEMBERS
    const limitBlock = profileManagerSrc.slice(
      profileManagerSrc.indexOf('profiles.length >= MAX_FAMILY_MEMBERS')
    );
    // The "Family is full" block comes BEFORE the "+ Add Baby" button
    const fullMsgIdx = limitBlock.indexOf('Family is full');
    const addBtnIdx = limitBlock.indexOf('+ Add Baby');
    expect(fullMsgIdx).toBeGreaterThanOrEqual(0);
    expect(addBtnIdx).toBeGreaterThan(fullMsgIdx);
  });
});

// ─── API-level enforcement in App.tsx ───

describe('addProfile in App.tsx — rejects when at limit (#184)', () => {
  it('imports MAX_FAMILY_MEMBERS from ProfileManager', () => {
    expect(appSrc).toContain("import { MAX_FAMILY_MEMBERS } from '@/features/profiles/ProfileManager'");
  });

  it('guards addProfile with profiles.length >= MAX_FAMILY_MEMBERS check', () => {
    expect(appSrc).toContain('profiles.length >= MAX_FAMILY_MEMBERS');
  });

  it('returns early (rejects add) when limit is exceeded', () => {
    // Check that there's a return statement in the guard
    const guardRegion = appSrc.slice(
      appSrc.indexOf('profiles.length >= MAX_FAMILY_MEMBERS'),
      appSrc.indexOf('profiles.length >= MAX_FAMILY_MEMBERS') + 200
    );
    expect(guardRegion).toContain('return');
  });

  it('shows a toast message when the limit is exceeded', () => {
    const guardRegion = appSrc.slice(
      appSrc.indexOf('profiles.length >= MAX_FAMILY_MEMBERS'),
      appSrc.indexOf('profiles.length >= MAX_FAMILY_MEMBERS') + 200
    );
    expect(guardRegion).toContain('toast');
  });
});

// ─── Logic unit tests (pure JS simulation) ───

describe('addProfile logic — pure unit tests (#184)', () => {
  const MAX = 3;

  function makeProfiles(count: number) {
    return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Baby ${i + 1}` }));
  }

  function simulateAdd(profiles: { id: number; name: string }[], newProfile: { id: number; name: string }) {
    if (profiles.length >= MAX) return { success: false, profiles };
    return { success: true, profiles: [...profiles, newProfile] };
  }

  it('allows adding when under the limit', () => {
    const profiles = makeProfiles(2);
    const result = simulateAdd(profiles, { id: 3, name: 'Baby 3' });
    expect(result.success).toBe(true);
    expect(result.profiles).toHaveLength(3);
  });

  it('blocks adding when exactly at the limit', () => {
    const profiles = makeProfiles(3);
    const result = simulateAdd(profiles, { id: 4, name: 'Baby 4' });
    expect(result.success).toBe(false);
    expect(result.profiles).toHaveLength(3);
  });

  it('blocks adding when over the limit (existing data edge case)', () => {
    const profiles = makeProfiles(4);
    const result = simulateAdd(profiles, { id: 5, name: 'Baby 5' });
    expect(result.success).toBe(false);
    expect(result.profiles).toHaveLength(4);
  });

  it('allows adding after a member is deleted (slot opens up)', () => {
    const profiles = makeProfiles(3);
    const afterDelete = profiles.filter((p) => p.id !== 3); // delete one
    const result = simulateAdd(afterDelete, { id: 99, name: 'New Baby' });
    expect(result.success).toBe(true);
    expect(result.profiles).toHaveLength(3);
  });

  it('allows adding to an empty family', () => {
    const result = simulateAdd([], { id: 1, name: 'First Baby' });
    expect(result.success).toBe(true);
    expect(result.profiles).toHaveLength(1);
  });
});
