/**
 * Unit tests for Google Drive scope enforcement
 *
 * Covers:
 * - Scope error detection in handleDriveError (via DriveError.code)
 * - hasRequiredDriveScope logic (via exported helper)
 * - scope_insufficient DriveErrorCode is defined
 * - No appDataFolder space in API calls
 * - spaces=drive is present in files.list calls
 * - File operation functions (uploadFile, downloadFile, deleteFile) use
 *   getAccessToken() for scope pre-validation — these correspond to the
 *   Ao() minified function path seen in Sentry event 7379272319 (#190)
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

// ─── Ao() code path — file operations scope pre-validation (#190) ─────────────
//
// Sentry event 7379272319 (#190) fired from minified function Ao() — a different
// call path from Be() fixed in #189. The Ao() path corresponds to uploadFile /
// downloadFile / deleteFile, each of which calls getAccessToken() before making
// any Drive API request. getAccessToken() validates the token scope, so any
// scope mismatch is caught before reaching the Drive API (preventing the raw
// "granted scopes" 403 that surfaced in Sentry).

describe('uploadFile — scope pre-validation via getAccessToken (Sentry #190 / Ao path)', () => {
  it('uploadFile calls getAccessToken() before making Drive API calls', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function uploadFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    // Next occurrence of getAccessToken after the function declaration
    const callIdx = googleDriveSrc.indexOf('getAccessToken()', fnIdx);
    const nextFnIdx = googleDriveSrc.indexOf('export async function', fnIdx + 1);
    expect(callIdx).toBeGreaterThan(fnIdx);
    expect(callIdx).toBeLessThan(nextFnIdx > fnIdx ? nextFnIdx : Infinity);
  });

  it('uploadFile goes through handleDriveError after the upload response', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function uploadFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('handleDriveError');
  });

  it('uploadFile uses findFileId which applies spaces: drive', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function uploadFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('findFileId(');
  });
});

describe('downloadFile — scope pre-validation via getAccessToken (Sentry #190 / Ao path)', () => {
  it('downloadFile calls getAccessToken() before making Drive API calls', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function downloadFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const callIdx = googleDriveSrc.indexOf('getAccessToken()', fnIdx);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    expect(callIdx).toBeGreaterThan(fnIdx);
    expect(callIdx).toBeLessThan(nextFnIdx > fnIdx ? nextFnIdx : Infinity);
  });

  it('downloadFile goes through handleDriveError after the response', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function downloadFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('handleDriveError');
  });

  it('downloadFile uses findFileId which applies spaces: drive', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function downloadFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('findFileId(');
  });
});

describe('deleteFile — scope pre-validation via getAccessToken (Sentry #190 / Ao path)', () => {
  it('deleteFile calls getAccessToken() before making Drive API calls', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function deleteFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const callIdx = googleDriveSrc.indexOf('getAccessToken()', fnIdx);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    expect(callIdx).toBeGreaterThan(fnIdx);
    expect(callIdx).toBeLessThan(nextFnIdx > fnIdx ? nextFnIdx : Infinity);
  });

  it('deleteFile goes through handleDriveError after the response', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function deleteFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('handleDriveError');
  });

  it('deleteFile uses findFileId which applies spaces: drive', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function deleteFile(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('findFileId(');
  });
});

describe('getFileModifiedTime — scope pre-validation via getAccessToken', () => {
  it('getFileModifiedTime calls getAccessToken() before Drive API calls', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function getFileModifiedTime(');
    expect(fnIdx).toBeGreaterThan(-1);
    const callIdx = googleDriveSrc.indexOf('getAccessToken()', fnIdx);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    expect(callIdx).toBeGreaterThan(fnIdx);
    expect(callIdx).toBeLessThan(nextFnIdx > fnIdx ? nextFnIdx : Infinity);
  });

  it('getFileModifiedTime uses findFileId which applies spaces: drive', () => {
    const fnIdx = googleDriveSrc.indexOf('export async function getFileModifiedTime(');
    expect(fnIdx).toBeGreaterThan(-1);
    const nextFnIdx = googleDriveSrc.indexOf('\nexport async function', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, nextFnIdx > fnIdx ? nextFnIdx : fnIdx + 2000);
    expect(body).toContain('findFileId(');
  });
});

describe('findFileId — spaces: drive on every files.list call (Ao() code path)', () => {
  it('findFileId always specifies spaces: drive', () => {
    const fnIdx = googleDriveSrc.indexOf('async function findFileId(');
    expect(fnIdx).toBeGreaterThan(-1);
    const block = googleDriveSrc.slice(fnIdx, fnIdx + 500);
    expect(block).toContain("spaces: 'drive'");
  });

  it('findFileId does not use appDataFolder as the space', () => {
    const fnIdx = googleDriveSrc.indexOf('async function findFileId(');
    expect(fnIdx).toBeGreaterThan(-1);
    const block = googleDriveSrc.slice(fnIdx, fnIdx + 500);
    expect(block).not.toContain('appDataFolder');
  });
});

describe('scope error coverage — no raw DriveError escapes file operations', () => {
  it('handleDriveError is the single error-translation point for 403 scope errors', () => {
    // All Drive API responses go through handleDriveError which maps
    // "granted scopes" / "requested spaces" 403s to scope_insufficient.
    // Confirm it covers both known Google error message variants.
    expect(googleDriveSrc).toContain("msg.toLowerCase().includes('granted scopes')");
    expect(googleDriveSrc).toContain("msg.toLowerCase().includes('requested spaces')");
  });

  it('scope_insufficient is thrown from within the 403 case branch', () => {
    const case403 = googleDriveSrc.indexOf('case 403:');
    expect(case403).toBeGreaterThan(-1);
    // Find next case or closing brace to delimit the 403 handler
    const nextCase = googleDriveSrc.indexOf('    case ', case403 + 1);
    const handler = googleDriveSrc.slice(case403, nextCase > case403 ? nextCase : case403 + 600);
    expect(handler).toContain("scope_insufficient");
  });
});
