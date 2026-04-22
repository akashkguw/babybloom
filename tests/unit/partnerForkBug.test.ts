/**
 * Regression test for the silent-fork bug in getOrCreateFolder.
 *
 * Before the fix: Parent B with a cleared IndexedDB (no stored folder ID,
 * no manifest file ID) would silently POST a brand-new "BabyBloom Sync"
 * folder — forking the family into two parallel Drive folders with no
 * warning to either parent.
 *
 * After the fix: getOrCreateFolder() refuses to auto-create unless called
 * with `allowCreate: true` (only the explicit Parent-A onboarding paths
 * do that). Parent B's device throws DriveError('not_found') instead of
 * silently forking, which surfaces the "Reconnect partner sync" prompt in
 * the UI.
 *
 * Fault path in src/lib/sync/googleDrive.ts (pre-fix):
 *   1. cachedFolderId is null (fresh import)
 *   2. getSharedFolderId() → null        (IDB cleared / never scanned QR)
 *   3. dg(DB_KEY_MANIFEST_FILE_ID) → null
 *   4. name-search returns empty          (drive.file hides Parent A's folder)
 *   5. POST /files creates a new folder   ← silent fork happened here
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── in-memory IndexedDB replacement ─────────────────────────────────────────
const store: Record<string, any> = {};
vi.mock('@/lib/db', () => ({
  dg: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  ds: vi.fn((key: string, val: any) => {
    store[key] = val;
    return Promise.resolve();
  }),
}));

// ── fetch mock at the network boundary ──────────────────────────────────────
const fetchSpy = vi.fn();
global.fetch = fetchSpy as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Silent-fork guard: Parent B with no linked folder must NOT create one', () => {
  beforeEach(async () => {
    // Reset module-level cachedFolderId inside googleDrive.ts
    vi.resetModules();
    // Wipe the mock store, but seed a valid OAuth token so getAccessToken passes.
    for (const k of Object.keys(store)) delete store[k];
    store['family_google_tokens'] = {
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      expires_at: Date.now() + 3_600_000,
      scope: 'https://www.googleapis.com/auth/drive.file',
    };
    fetchSpy.mockReset();
  });

  it('throws not_found instead of silently creating a duplicate folder', async () => {
    fetchSpy.mockImplementation(async (url: any, opts: any = {}) => {
      const u = String(url);
      const method = (opts.method || 'GET').toUpperCase();

      // Name-search query — Parent B can't see Parent A's folder under drive.file.
      if (method === 'GET' && u.includes('/files?') && u.includes('mimeType')) {
        return jsonResponse({ files: [] });
      }

      // If the guard ever regresses, this is what would hit:
      if (method === 'POST' && u.endsWith('/drive/v3/files')) {
        return jsonResponse({ id: 'ORPHAN_FOLDER_THAT_SHOULD_NEVER_EXIST' });
      }

      return jsonResponse({ error: 'unexpected url', url: u, method }, 500);
    });

    const { getOrCreateFolder, DriveError } = await import('@/lib/sync/googleDrive');

    await expect(getOrCreateFolder()).rejects.toMatchObject({
      name: 'DriveError',
      code: 'not_found',
    });
    // Make sure the assertion above isn't matching some other thrown shape.
    expect(DriveError).toBeDefined();

    // Crucially: no folder-create POST was made.
    const createCall = fetchSpy.mock.calls.find(
      ([, o]: any[]) =>
        (o?.method || '').toUpperCase() === 'POST' &&
        String(o?.body || '').includes('application/vnd.google-apps.folder'),
    );
    expect(createCall).toBeUndefined();

    // And IndexedDB still has no fabricated folder ID.
    expect(store['sync_shared_folder_id']).toBeUndefined();
  });

  it('allowCreate=true still lets Parent A create on first-time setup', async () => {
    fetchSpy.mockImplementation(async (url: any, opts: any = {}) => {
      const u = String(url);
      const method = (opts.method || 'GET').toUpperCase();

      if (method === 'GET' && u.includes('/files?') && u.includes('mimeType')) {
        return jsonResponse({ files: [] });
      }

      if (method === 'POST' && u.endsWith('/drive/v3/files')) {
        return jsonResponse({ id: 'PARENT_A_NEW_FOLDER_ID' });
      }

      return jsonResponse({ error: 'unexpected url', url: u, method }, 500);
    });

    const { getOrCreateFolder } = await import('@/lib/sync/googleDrive');
    const id = await getOrCreateFolder(true);

    expect(id).toBe('PARENT_A_NEW_FOLDER_ID');
    expect(store['sync_shared_folder_id']).toBe('PARENT_A_NEW_FOLDER_ID');
  });

  it('happy path: returns stored folder ID without creating one', async () => {
    // Parent B previously scanned QR and stored the real shared folder ID.
    store['sync_shared_folder_id'] = 'PARENT_A_REAL_FOLDER_ID';

    fetchSpy.mockImplementation(async (url: any) => {
      const u = String(url);
      // Verify-access GET for the stored folder ID.
      if (u.includes('/files/PARENT_A_REAL_FOLDER_ID')) {
        return jsonResponse({ id: 'PARENT_A_REAL_FOLDER_ID', name: 'BabyBloom Sync' });
      }
      return jsonResponse({ error: 'should not reach here' }, 500);
    });

    const { getOrCreateFolder } = await import('@/lib/sync/googleDrive');
    const returnedId = await getOrCreateFolder();

    expect(returnedId).toBe('PARENT_A_REAL_FOLDER_ID');
    // No folder-create POST should have been made.
    const createCall = fetchSpy.mock.calls.find(
      ([, o]: any[]) => (o?.method || '').toUpperCase() === 'POST',
    );
    expect(createCall).toBeUndefined();
  });
});
