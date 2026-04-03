import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for the forced re-auth migration:
 *   - Migration clears ONLY OAuth tokens (not family key, folder ID, data)
 *   - Migration is version-gated (runs once)
 *   - Migration only triggers for legacy scope tokens
 *   - App.tsx runs migration before starting sync engine
 */

const typesSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/types.ts'),
  'utf8',
);
const engineSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/syncEngine.ts'),
  'utf8',
);
const appSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/App.tsx'),
  'utf8',
);

describe('Forced re-auth migration — types', () => {
  it('DB_KEY_SYNC_MIGRATION_VERSION constant exists', () => {
    expect(typesSrc).toContain("DB_KEY_SYNC_MIGRATION_VERSION = 'sync_migration_version'");
  });
});

describe('Forced re-auth migration — syncEngine', () => {
  it('exports runSyncMigrations function', () => {
    expect(engineSrc).toContain('export async function runSyncMigrations');
  });

  it('migration is version-gated with CURRENT_MIGRATION_VERSION', () => {
    expect(engineSrc).toContain('const CURRENT_MIGRATION_VERSION = 1');
    expect(engineSrc).toContain('if (version >= CURRENT_MIGRATION_VERSION) return');
  });

  it('migration 1 checks for legacy drive scope in stored tokens', () => {
    const fnStart = engineSrc.indexOf('export async function runSyncMigrations');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1500);
    expect(fnRegion).toContain('GOOGLE_DRIVE_SCOPE_LEGACY');
    expect(fnRegion).toContain('hasLegacy');
  });

  it('migration 1 only clears tokens, not family key or folder ID', () => {
    const fnStart = engineSrc.indexOf('export async function runSyncMigrations');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1500);
    // Clears tokens
    expect(fnRegion).toContain("ds('family_google_tokens', null)");
    // Does NOT clear family key
    expect(fnRegion).not.toContain('family_key');
    // Does NOT clear folder ID
    expect(fnRegion).not.toContain('sync_shared_folder_id');
    // Does NOT clear device ID
    expect(fnRegion).not.toContain('sync_device_id');
    // Does NOT touch logs or profile data
    expect(fnRegion).not.toContain('logs');
    expect(fnRegion).not.toContain('profileData');
  });

  it('migration preserves sync_enabled so user sees reconnect banner', () => {
    const fnStart = engineSrc.indexOf('export async function runSyncMigrations');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1500);
    // Should NOT clear sync_enabled
    expect(fnRegion).not.toContain("ds('sync_enabled'");
    expect(fnRegion).not.toContain('DB_KEY_SYNC_ENABLED');
  });

  it('migration stores version after completion', () => {
    const fnStart = engineSrc.indexOf('export async function runSyncMigrations');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1500);
    expect(fnRegion).toContain('ds(DB_KEY_SYNC_MIGRATION_VERSION, CURRENT_MIGRATION_VERSION)');
  });

  it('skips migration if no tokens exist', () => {
    const fnStart = engineSrc.indexOf('export async function runSyncMigrations');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1500);
    expect(fnRegion).toContain("tokens?.scope");
  });
});

describe('Forced re-auth migration — App.tsx wiring', () => {
  it('imports runSyncMigrations', () => {
    expect(appSrc).toContain('runSyncMigrations');
  });

  it('runs migration before starting sync engine', () => {
    const migrationIdx = appSrc.indexOf('runSyncMigrations()');
    const engineIdx = appSrc.indexOf('startSyncEngine()', migrationIdx);
    expect(migrationIdx).toBeGreaterThan(-1);
    expect(engineIdx).toBeGreaterThan(migrationIdx);
  });

  it('migration failure is non-fatal (caught before engine starts)', () => {
    const callIdx = appSrc.indexOf('runSyncMigrations()');
    const region = appSrc.slice(
      callIdx,
      callIdx + 260,
    );
    expect(region).toContain('.catch(');
  });
});
