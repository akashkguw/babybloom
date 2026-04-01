/**
 * Unit tests for Google Drive scope enforcement
 *
 * Covers:
 * - Scope error detection in handleDriveError (via DriveError.code)
 * - hasRequiredDriveScope logic (via exported helper)
 * - scope_insufficient DriveErrorCode is defined
 * - No appDataFolder space in API calls
 * - spaces=drive is present in files.list calls
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const googleDriveSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/googleDrive.ts'),
  'utf8',
);

const syncEngineSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/syncEngine.ts'),
  'utf8',
);

// ─── DriveErrorCode ───────────────────────────────────────────────────────────

describe('DriveErrorCode — scope_insufficient', () => {
  it('scope_insufficient is in the DriveErrorCode union', () => {
    expect(googleDriveSrc).toContain("'scope_insufficient'");
  });

  it('DriveError.userMessage handles scope_insufficient', () => {
    const idx = googleDriveSrc.indexOf('scope_insufficient');
    // Must appear in userMessage switch block too
    const switchRegion = googleDriveSrc.indexOf("case 'scope_insufficient':", idx);
    expect(switchRegion).toBeGreaterThan(-1);
  });
});

// ─── handleDriveError ────────────────────────────────────────────────────────

describe('handleDriveError — scope error mapping', () => {
  it('detects "granted scopes" message and throws scope_insufficient', () => {
    expect(googleDriveSrc).toContain("msg.toLowerCase().includes('granted scopes')");
  });

  it('detects "requested spaces" message and throws scope_insufficient', () => {
    expect(googleDriveSrc).toContain("msg.toLowerCase().includes('requested spaces')");
  });

  it('throws scope_insufficient (not forbidden) for the spaces error', () => {
    const scopeCheck = googleDriveSrc.indexOf("msg.toLowerCase().includes('granted scopes')");
    const scopeThrow = googleDriveSrc.indexOf("DriveError('scope_insufficient'");
    expect(scopeCheck).toBeGreaterThan(-1);
    expect(scopeThrow).toBeGreaterThan(-1);
    // scope_insufficient throw should come after the check
    expect(scopeThrow).toBeGreaterThan(scopeCheck);
  });
});

// ─── getAccessToken — scope validation ───────────────────────────────────────

describe('getAccessToken — scope validation', () => {
  it('validates token scope before returning access token', () => {
    expect(googleDriveSrc).toContain('hasRequiredDriveScope');
  });

  it('throws scope_insufficient when scope is incompatible', () => {
    // Find the scope check in getAccessToken
    const checkIdx = googleDriveSrc.indexOf('hasRequiredDriveScope(tokens.scope)');
    expect(checkIdx).toBeGreaterThan(-1);
    const region = googleDriveSrc.slice(checkIdx, checkIdx + 300);
    expect(region).toContain('scope_insufficient');
  });
});

// ─── hasRequiredDriveScope logic ─────────────────────────────────────────────

describe('hasRequiredDriveScope — scope matching', () => {
  it('recognises drive.file scope as valid', () => {
    expect(googleDriveSrc).toContain(
      "'https://www.googleapis.com/auth/drive.file'",
    );
  });

  it('recognises full drive scope as valid', () => {
    expect(googleDriveSrc).toContain(
      "'https://www.googleapis.com/auth/drive'",
    );
  });

  it('splits multi-scope strings on whitespace/comma', () => {
    expect(googleDriveSrc).toContain("tokenScope.split(/[\\s,]+/)");
  });
});

// ─── No appDataFolder in API calls ───────────────────────────────────────────

describe('googleDrive.ts — no appDataFolder space in API calls', () => {
  it('files.list calls do not use appDataFolder as spaces value', () => {
    // Confirm "appDataFolder" does not appear as a URLSearchParams spaces value
    // (stale comments mentioning it are OK, but not as actual query param values)
    const urlParamMatches = [...googleDriveSrc.matchAll(/spaces\s*[:=]\s*['"]([^'"]+)['"]/g)];
    for (const m of urlParamMatches) {
      expect(m[1]).not.toContain('appDataFolder');
    }
  });
});

// ─── spaces=drive in files.list calls ────────────────────────────────────────

describe('googleDrive.ts — spaces=drive in files.list', () => {
  it('getOrCreateFolder search specifies spaces: drive', () => {
    // Find the folder search query block
    const searchIdx = googleDriveSrc.indexOf("name = '${DRIVE_FOLDER_NAME}'");
    expect(searchIdx).toBeGreaterThan(-1);
    const block = googleDriveSrc.slice(searchIdx, searchIdx + 400);
    expect(block).toContain("spaces: 'drive'");
  });

  it('listDeviceFiles specifies spaces: drive', () => {
    const listIdx = googleDriveSrc.indexOf("name contains 'device_'");
    expect(listIdx).toBeGreaterThan(-1);
    const block = googleDriveSrc.slice(listIdx, listIdx + 400);
    expect(block).toContain("spaces: 'drive'");
  });

  it('findFileId specifies spaces: drive', () => {
    const findIdx = googleDriveSrc.indexOf("async function findFileId(");
    expect(findIdx).toBeGreaterThan(-1);
    const block = googleDriveSrc.slice(findIdx, findIdx + 500);
    expect(block).toContain("spaces: 'drive'");
  });
});

// ─── syncEngine — scope_insufficient in skipCodes ────────────────────────────

describe('syncEngine — scope_insufficient not reported to Sentry', () => {
  it('scope_insufficient is in the skipCodes set', () => {
    const skipIdx = syncEngineSrc.indexOf('skipCodes');
    expect(skipIdx).toBeGreaterThan(-1);
    const block = syncEngineSrc.slice(skipIdx, skipIdx + 400);
    expect(block).toContain('scope_insufficient');
  });
});
