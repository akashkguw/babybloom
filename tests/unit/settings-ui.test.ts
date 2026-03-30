import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Settings page UI/UX tests
 * Verifies fixes for:
 * - #134: Excessive white space at top of Settings page
 * - #135: Settings icon visibility in header + arrow-left icon missing from icons.ts
 * - #136: Professional Settings page layout with grouped sections and Icon-based headers
 */

const settingsTsx = fs.readFileSync(
  path.resolve(__dirname, '../../src/features/settings/Settings.tsx'),
  'utf8'
);

const iconsTs = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/constants/icons.ts'),
  'utf8'
);

// ─── #134: White space fix ───

describe('Settings header — no excessive top whitespace (#134)', () => {
  const headerRegion = settingsTsx.slice(
    settingsTsx.indexOf('{/* Header */}'),
    settingsTsx.indexOf('{/* Header */}') + 1200
  );

  it('does NOT use app-header className (avoids fixed-position CSS with large safe-area padding)', () => {
    expect(headerRegion).not.toContain('className="app-header"');
  });

  it('Settings header uses position: sticky', () => {
    expect(headerRegion).toContain("position: 'sticky'");
  });

  it('Settings header has controlled inline padding', () => {
    expect(headerRegion).toMatch(/padding.*12px/);
  });

  it('Settings header handles safe-area-inset-top via paddingTop', () => {
    expect(headerRegion).toContain('env(safe-area-inset-top');
  });
});

// ─── #135: Icon visibility ───

describe('Settings header — icon visibility (#135)', () => {
  const headerRegion = settingsTsx.slice(
    settingsTsx.indexOf('{/* Header */}'),
    settingsTsx.indexOf('{/* Header */}') + 1200
  );

  it('has a settings gear icon in the header', () => {
    expect(headerRegion).toContain('n="settings"');
  });

  it('settings icon uses a visible primary color', () => {
    expect(headerRegion).toMatch(/n="settings"[\s\S]*?c=\{C\.p\}/);
  });

  it('back button uses arrow-left icon', () => {
    expect(headerRegion).toContain('n="arrow-left"');
  });

  it('arrow-left icon is defined in icons.ts', () => {
    expect(iconsTs).toContain('"arrow-left"');
  });
});

// ─── #136: Professional layout ───

describe('Settings page — professional layout (#136)', () => {
  it('Section component uses iconName prop (Icon-based headers, not emojis)', () => {
    expect(settingsTsx).toContain('iconName');
  });

  it('has GroupLabel components for visual hierarchy', () => {
    expect(settingsTsx).toContain('GroupLabel');
  });

  it('groups settings into Profile & Region section', () => {
    expect(settingsTsx).toContain('Profile & Region');
  });

  it('groups settings into Preferences section', () => {
    expect(settingsTsx).toContain('Preferences');
  });

  it('groups settings into Data & Support section', () => {
    expect(settingsTsx).toContain('Data & Support');
  });

  it('Firebase sync is inside Share & Sync Data section (not a standalone section)', () => {
    // There should be no standalone "Firebase Autosync" section
    expect(settingsTsx).not.toContain('Firebase Autosync');
    // Firebase sync should appear under "Share & Sync Data"
    expect(settingsTsx).toContain('Share & Sync Data');
    // FirebaseSyncSection should still be rendered
    expect(settingsTsx).toContain('FirebaseSyncSection');
  });

  it('uses Icon components for all section headers', () => {
    // Every Section call should use iconName, not icon with emojis
    const sectionCalls = settingsTsx.match(/<Section\s/g) || [];
    const iconNameCalls = settingsTsx.match(/iconName="/g) || [];
    expect(sectionCalls.length).toBe(iconNameCalls.length);
  });

  it('does not use emoji-based section icons', () => {
    // The old Section component used icon prop with emojis like "👶", "🌍", etc.
    // New Section uses iconName with Icon component names
    expect(settingsTsx).not.toMatch(/<Section[^>]*icon="[^a-z]/);
  });
});

// ─── Icons availability ───

describe('Icons — required icons exist in icons.ts', () => {
  const requiredIcons = [
    'arrow-left', 'settings', 'users', 'bell', 'mic',
    'palette', 'database', 'book', 'alert-triangle', 'info',
  ];

  for (const icon of requiredIcons) {
    it(`"${icon}" icon path is defined`, () => {
      // Icon keys may be quoted ("arrow-left") or unquoted (settings)
      expect(iconsTs).toMatch(new RegExp(`["']?${icon.replace('-', '\\-')}["']?\\s*:`));
    });
  }
});
