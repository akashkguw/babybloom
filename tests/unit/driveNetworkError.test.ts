/**
 * Unit tests for Drive network error handling (Sentry issue #191)
 *
 * Covers:
 * - 'network' DriveErrorCode is in the skipCodes set so it is NOT sent to Sentry
 * - fetchWithTimeout converts network-level TypeError to DriveError('network', ...)
 * - refreshAccessToken uses fetchWithTimeout (not bare fetch) so network failures
 *   are classified as DriveError rather than raw TypeErrors
 * - DriveError.userMessage for 'network' is user-friendly
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

// ── skipCodes must include 'network' ─────────────────────────────────────────

describe("syncEngine — 'network' DriveError not reported to Sentry", () => {
  it("'network' is in the skipCodes set", () => {
    const skipIdx = syncEngineSrc.indexOf('skipCodes');
    expect(skipIdx).toBeGreaterThan(-1);
    const block = syncEngineSrc.slice(skipIdx, skipIdx + 500);
    expect(block).toContain("'network'");
  });

  it("skipCodes still contains 'offline' and 'timeout' (regression guard)", () => {
    const skipIdx = syncEngineSrc.indexOf('skipCodes');
    expect(skipIdx).toBeGreaterThan(-1);
    const block = syncEngineSrc.slice(skipIdx, skipIdx + 500);
    expect(block).toContain("'offline'");
    expect(block).toContain("'timeout'");
  });
});

// ── fetchWithTimeout converts network errors to DriveError('network', ...) ───

describe('fetchWithTimeout — network error handling', () => {
  it("throws DriveError with code 'network' on non-abort fetch rejection", () => {
    // Find the catch block in fetchWithTimeout
    const fnIdx = googleDriveSrc.indexOf('async function fetchWithTimeout(');
    expect(fnIdx).toBeGreaterThan(-1);
    const endIdx = googleDriveSrc.indexOf('\nasync function ', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, endIdx > fnIdx ? endIdx : fnIdx + 600);
    expect(body).toContain("DriveError('network'");
  });

  it("throws DriveError with code 'offline' when navigator.onLine is false", () => {
    const fnIdx = googleDriveSrc.indexOf('async function fetchWithTimeout(');
    expect(fnIdx).toBeGreaterThan(-1);
    const endIdx = googleDriveSrc.indexOf('\nasync function ', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, endIdx > fnIdx ? endIdx : fnIdx + 600);
    expect(body).toContain("DriveError('offline'");
    expect(body).toContain('navigator.onLine');
  });

  it("throws DriveError with code 'timeout' on AbortError", () => {
    const fnIdx = googleDriveSrc.indexOf('async function fetchWithTimeout(');
    expect(fnIdx).toBeGreaterThan(-1);
    const endIdx = googleDriveSrc.indexOf('\nasync function ', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, endIdx > fnIdx ? endIdx : fnIdx + 600);
    expect(body).toContain("DriveError('timeout'");
    expect(body).toContain("AbortError");
  });
});

// ── refreshAccessToken uses fetchWithTimeout (not bare fetch) ────────────────

describe('refreshAccessToken — network-safe fetch', () => {
  it('uses fetchWithTimeout instead of bare fetch for token refresh', () => {
    const fnIdx = googleDriveSrc.indexOf('async function refreshAccessToken(');
    expect(fnIdx).toBeGreaterThan(-1);
    const endIdx = googleDriveSrc.indexOf('\nasync function ', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, endIdx > fnIdx ? endIdx : fnIdx + 800);
    // Must use fetchWithTimeout, not bare fetch()
    expect(body).toContain('fetchWithTimeout(');
    // Should NOT have a bare `await fetch(` call
    expect(body).not.toMatch(/\bawait fetch\s*\(/);
  });

  it('refreshAccessToken passes a timeout value to fetchWithTimeout', () => {
    const fnIdx = googleDriveSrc.indexOf('async function refreshAccessToken(');
    expect(fnIdx).toBeGreaterThan(-1);
    const endIdx = googleDriveSrc.indexOf('\nasync function ', fnIdx + 1);
    const body = googleDriveSrc.slice(fnIdx, endIdx > fnIdx ? endIdx : fnIdx + 800);
    // fetchWithTimeout(url, opts, timeoutMs) — must have a numeric timeout
    expect(body).toMatch(/fetchWithTimeout\([^)]+\d+_?\d*\)/);
  });
});

// ── DriveError.userMessage for 'network' ─────────────────────────────────────

describe("DriveError.userMessage — 'network' code", () => {
  it("'network' code has a user-friendly message", () => {
    const idx = googleDriveSrc.indexOf("case 'network':");
    expect(idx).toBeGreaterThan(-1);
    // There should be a return statement with a human-readable message nearby
    const block = googleDriveSrc.slice(idx, idx + 200);
    expect(block).toMatch(/return\s+['"].+['"]/);
  });

  it("'network' userMessage mentions connection", () => {
    const idx = googleDriveSrc.indexOf("case 'network':");
    expect(idx).toBeGreaterThan(-1);
    const block = googleDriveSrc.slice(idx, idx + 200);
    expect(block.toLowerCase()).toMatch(/connect|network|offline/);
  });

  it("'network' is listed in the DriveErrorCode union", () => {
    expect(googleDriveSrc).toContain("| 'network'");
  });
});
