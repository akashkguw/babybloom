/**
 * BabyBloom Cloud Sync — Google Drive API Wrapper
 *
 * Handles all Google Drive interactions for the sync engine.
 * Uses a regular Google Drive folder (shared between partners) instead of
 * appDataFolder, so two parents with different Google accounts can both
 * read/write encrypted state files to the same folder.
 *
 * Folder structure in Google Drive:
 *   BabyBloom Sync/
 *     manifest.enc          ← Family metadata + schema version
 *     device_{id}_state.enc ← Full state snapshot per device
 *     key_backup.enc        ← Optional: family key encrypted with passphrase
 *
 * Flow:
 *   Parent A: Creates "BabyBloom Sync" folder → shares it with Parent B's email
 *   Parent B: Receives folder ID via QR code (BK2: format) → accesses shared folder
 *
 * Design §6 — Google Drive Integration (updated for cross-account sync)
 */

import { dg, ds } from '@/lib/db';
import {
  GOOGLE_DRIVE_API,
  GOOGLE_DRIVE_UPLOAD_API,
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_DRIVE_SCOPE_LEGACY,
  DRIVE_FOLDER_NAME,
  DB_KEY_GOOGLE_TOKENS,
  DB_KEY_SHARED_FOLDER_ID,
  DB_KEY_MANIFEST_FILE_ID,
} from './types';
import type { GoogleTokens } from './types';

// ═══ OAUTH ═══

const OAUTH_VERIFIER_KEY = 'bb_oauth_verifier';
const OAUTH_VERIFIER_BACKUP_KEY = 'bb_oauth_verifier_backup';

function setOAuthVerifier(verifier: string): void {
  try { sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier); } catch { /* storage unavailable */ }
  try { localStorage.setItem(OAUTH_VERIFIER_BACKUP_KEY, verifier); } catch { /* storage unavailable */ }
}

function getOAuthVerifier(): string | null {
  let verifier: string | null = null;
  try { verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY); } catch { /* storage unavailable */ }
  if (verifier) return verifier;
  try { verifier = localStorage.getItem(OAUTH_VERIFIER_BACKUP_KEY); } catch { /* storage unavailable */ }
  return verifier;
}

function clearOAuthVerifier(): void {
  try { sessionStorage.removeItem(OAUTH_VERIFIER_KEY); } catch { /* storage unavailable */ }
  try { localStorage.removeItem(OAUTH_VERIFIER_BACKUP_KEY); } catch { /* storage unavailable */ }
}

/**
 * Check if Google tokens exist and are (likely) valid.
 */
export async function hasValidTokens(): Promise<boolean> {
  const tokens: GoogleTokens | null = await dg(DB_KEY_GOOGLE_TOKENS);
  if (!tokens) return false;
  // Consider valid if not expired (with 5-min buffer)
  return tokens.expires_at > Date.now() + 5 * 60 * 1000;
}

/**
 * Check if a token scope string covers the required Drive access.
 * Accepts both drive.file (new, cheaper verification) and full drive (legacy).
 * Existing users with the full drive scope continue to work seamlessly.
 */
function hasRequiredDriveScope(tokenScope: string): boolean {
  const scopes = tokenScope.split(/[\s,]+/);
  return scopes.some(
    (s) => s === GOOGLE_DRIVE_SCOPE || s === GOOGLE_DRIVE_SCOPE_LEGACY,
  );
}

/**
 * Check if the stored token has the legacy full drive scope.
 * Used to decide whether folder-search queries are available (full drive)
 * or we must use manifest-based file discovery (drive.file).
 */
export async function hasLegacyFullDriveScope(): Promise<boolean> {
  const tokens: GoogleTokens | null = await dg(DB_KEY_GOOGLE_TOKENS);
  if (!tokens?.scope) return false;
  return tokens.scope.split(/[\s,]+/).some(
    (s) => s === GOOGLE_DRIVE_SCOPE_LEGACY,
  );
}

/**
 * Get the current access token, refreshing if needed.
 * Throws if no tokens are stored, scope is insufficient, or refresh fails.
 */
export async function getAccessToken(): Promise<string> {
  const tokens: GoogleTokens | null = await dg(DB_KEY_GOOGLE_TOKENS);
  if (!tokens) throw new DriveError('not_authenticated', 'No Google tokens found. Please sign in.');

  // Validate that the stored token scope covers Drive file access.
  // Tokens granted with only drive.appdata (old version) will fail all file ops.
  // Auto-clear stale tokens so the UI shows the "Connect Google Drive" prompt
  // instead of silently failing on every sync attempt.
  if (tokens.scope && !hasRequiredDriveScope(tokens.scope)) {
    await clearTokens();
    throw new DriveError(
      'scope_insufficient',
      'Google Drive permissions need updating. Please re-connect Google Drive.',
    );
  }

  // If token is still valid, return it
  if (tokens.expires_at > Date.now() + 60 * 1000) {
    return tokens.access_token;
  }

  // Refresh the token
  return refreshAccessToken(tokens.refresh_token);
}

/**
 * Refresh the access token using the stored refresh token.
 * Updates stored tokens on success.
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  // The client ID and token endpoint — in production these come from env vars
  const clientId = getGoogleClientId();

  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      ...(getGoogleClientSecret() ? { client_secret: getGoogleClientSecret() } : {}),
    }) as unknown as BodyInit,
  }, 30_000);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 400) {
      throw new DriveError('token_revoked', 'Google Drive access was revoked. Please sign in again.');
    }
    throw new DriveError('token_refresh_failed', `Token refresh failed: ${err.error_description || response.status}`);
  }

  const data = await response.json();
  const existing: GoogleTokens | null = await dg(DB_KEY_GOOGLE_TOKENS);
  const updated: GoogleTokens = {
    access_token: data.access_token,
    refresh_token: existing?.refresh_token || refreshToken, // refresh token doesn't always rotate
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope || existing?.scope || GOOGLE_DRIVE_SCOPE,
  };

  await ds(DB_KEY_GOOGLE_TOKENS, updated);
  return updated.access_token;
}

/**
 * Store new Google tokens after successful OAuth.
 */
export async function storeTokens(tokens: GoogleTokens): Promise<void> {
  await ds(DB_KEY_GOOGLE_TOKENS, tokens);
}

/**
 * Build the Google OAuth2 authorization URL with PKCE.
 * Redirect URI: babybloom://oauth (native) or {origin}/oauth (web)
 */
export async function buildAuthUrl(): Promise<{ url: string; codeVerifier: string }> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error(
    '[BabyBloom] Google OAuth Client ID is not configured.\n' +
    'Set VITE_GOOGLE_CLIENT_ID in your CI/build environment, or hardcode it in GOOGLE_CLIENT_ID_FALLBACK in googleDrive.ts.\n' +
    'This is a one-time developer setup — end users never manage this.'
  );

  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = btoa(String.fromCharCode(...verifierBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const challengeBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  );
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(challengeBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const isNativeApp = typeof window !== 'undefined' &&
    ((window as any).__CAPACITOR_PLATFORM__ !== undefined ||
     navigator.userAgent.includes('Capacitor'));

  // Web redirect URI must match exactly what's registered in Google Cloud Console.
  // import.meta.env.BASE_URL is '/babybloom/' on GitHub Pages and '/' on native builds,
  // so this produces the correct URL in every environment automatically:
  //   PWA prod:  https://akashkguw.github.io/babybloom/oauth
  //   Local dev: http://localhost:5173/babybloom/oauth
  //   Native:    babybloom://oauth
  const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || '/';
  const redirectUri = isNativeApp
    ? 'babybloom://oauth'
    : `${window.location.origin}${base.replace(/\/$/, '')}/oauth/`;

  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         'code',
    scope:                 GOOGLE_DRIVE_SCOPE,
    access_type:           'offline',
    prompt:                'consent',
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, codeVerifier };
}

/**
 * Exchange an OAuth authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<void> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, redirect_uri: redirectUri,
      grant_type: 'authorization_code', code_verifier: codeVerifier,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    }).toString(),
  }, 30_000);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new DriveError('token_refresh_failed', `OAuth exchange failed: ${err.error_description || response.status}`);
  }
  const data = await response.json();
  await storeTokens({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000,
    scope:         data.scope || GOOGLE_DRIVE_SCOPE,
  });
}

/**
 * Initiate Google Sign-In — stores PKCE verifier and returns the auth URL.
 * Caller is responsible for opening the URL (window.open or Capacitor Browser).
 */
export async function initiateGoogleSignIn(): Promise<string> {
  const { url, codeVerifier } = await buildAuthUrl();
  setOAuthVerifier(codeVerifier);
  return url;
}

/**
 * Handle the OAuth redirect callback URL.
 * Exchanges the authorization code for tokens and stores them.
 */
export async function handleOAuthCallback(callbackUrl: string): Promise<void> {
  const u = new URL(callbackUrl);
  const code  = u.searchParams.get('code');
  const error = u.searchParams.get('error');
  if (error) throw new DriveError('not_authenticated', `Google sign-in denied: ${error}`);
  if (!code)  throw new DriveError('not_authenticated', 'No authorization code in callback URL.');
  const codeVerifier = getOAuthVerifier();
  if (!codeVerifier) throw new DriveError('not_authenticated', 'OAuth session expired. Please try signing in again.');
  const isNativeApp = callbackUrl.startsWith('babybloom://');
  const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || '/';
  const redirectUri = isNativeApp
    ? 'babybloom://oauth'
    : `${window.location.origin}${base.replace(/\/$/, '')}/oauth/`;
  await exchangeCodeForTokens(code, codeVerifier, redirectUri);
  clearOAuthVerifier();
}

/**
 * Check if the user is authenticated with Google Drive.
 * Alias for hasValidTokens — used by CloudSync UI.
 */
export const isAuthenticated = hasValidTokens;

/**
 * Clear stored Google tokens (when sync is disabled).
 */
export async function clearTokens(): Promise<void> {
  await ds(DB_KEY_GOOGLE_TOKENS, null);
  // Also clear the in-memory folder cache so stale folder IDs from a
  // previous account don't bypass the accessibility check in getOrCreateFolder().
  cachedFolderId = null;
}

// ═══ FOLDER MANAGEMENT ═══

let cachedFolderId: string | null = null;

/**
 * Persist the shared folder ID in IndexedDB so both parents can find it.
 * Called by Parent A after creating the folder, and by Parent B after scanning the QR.
 */
export async function setSharedFolderId(folderId: string): Promise<void> {
  cachedFolderId = folderId;
  await ds(DB_KEY_SHARED_FOLDER_ID, folderId);
}

/**
 * Load the shared folder ID from IndexedDB.
 * Returns null if no folder has been set up yet.
 */
export async function getSharedFolderId(): Promise<string | null> {
  if (cachedFolderId) return cachedFolderId;
  const id = await dg(DB_KEY_SHARED_FOLDER_ID);
  if (id && typeof id === 'string') {
    cachedFolderId = id;
    return id;
  }
  return null;
}

/**
 * Clear the stored shared folder ID (when sync is disabled).
 */
export async function clearSharedFolderId(): Promise<void> {
  cachedFolderId = null;
  await ds(DB_KEY_SHARED_FOLDER_ID, null);
}

/**
 * Get or create the BabyBloom Sync folder in the user's Google Drive.
 *
 * For Parent A (folder creator): creates a new folder in Drive root and stores its ID.
 * For Parent B (joiner): uses the folder ID received from the QR code (stored in IndexedDB).
 *
 * With drive.file scope, folder-search queries only see folders this app created.
 * Parent B's app can't "discover" Parent A's shared folder via search — it must
 * use the stored folder ID from the BK2 QR code. This is why the stored ID check
 * comes first and we only fall through to search if we have legacy full drive scope.
 *
 * Result is cached in memory for the session.
 */
export async function getOrCreateFolder(): Promise<string> {
  // Check in-memory cache first
  if (cachedFolderId) return cachedFolderId;

  // Check IndexedDB for stored folder ID (set by QR import or previous session).
  // This is the PRIMARY path for Parent B with drive.file scope.
  const storedId = await getSharedFolderId();
  let hadStoredId = false;
  let storedIdInaccessible = false;
  if (storedId) {
    hadStoredId = true;
    // Verify the folder is still accessible (works with both scopes — shared folders
    // are accessible by file ID even with drive.file when the user has permission)
    try {
      const token = await getAccessToken();
      const resp = await driveRequest(
        `${GOOGLE_DRIVE_API}/files/${storedId}?fields=id,name,trashed`,
        'GET',
        null,
        token,
      );
      if (resp.id && !resp.trashed) {
        cachedFolderId = storedId;
        return cachedFolderId;
      }
    } catch {
      // Folder no longer accessible — we will try manifest-derived recovery below.
      storedIdInaccessible = true;
    }
  }

  const token = await getAccessToken();
  const storedManifestId = await dg(DB_KEY_MANIFEST_FILE_ID) as string | null;
  if (storedManifestId) {
    try {
      const manifestMeta = await driveRequest(
        `${GOOGLE_DRIVE_API}/files/${storedManifestId}?fields=id,parents,trashed`,
        'GET',
        null,
        token,
      );
      const parentId = Array.isArray(manifestMeta.parents) ? manifestMeta.parents[0] : null;
      if (manifestMeta.id && !manifestMeta.trashed && parentId) {
        cachedFolderId = parentId;
        await setSharedFolderId(parentId);
        return parentId;
      }
    } catch {
      // Fall through to search/create.
    }
  }

  // If we had a stored shared folder ID but cannot access it anymore and
  // couldn't recover via manifest linkage, stop here instead of creating a
  // brand-new folder (which causes silent partner desync and folder sprawl).
  if (hadStoredId && storedIdInaccessible) {
    throw new DriveError(
      'not_found',
      'Shared sync folder is no longer accessible. Reconnect partner sync with a fresh invite code.',
    );
  }

  const hasFullScope = await hasLegacyFullDriveScope();

  // Attempt name-based search before creating.
  // With drive.file, this only returns folders this app/account can discover,
  // but that is enough to avoid duplicate folder creation on repeated setup.
  try {
    const searchResp = await driveRequest(
      `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
        q: `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, ownedByMe, shared)',
        orderBy: 'createdTime desc',
        spaces: 'drive',
      }),
      'GET',
      null,
      token,
    );

    const files = searchResp.files || [];
    if (files.length > 0) {
      // Prefer an already shared folder when duplicates exist.
      const preferred = files.find((f: any) => !!f.shared) || files[0];
      const id: string = preferred.id;
      cachedFolderId = id;
      await setSharedFolderId(id);
      return id;
    }
  } catch {
    // Ignore search failures and fall back to create path below.
  }

  // No folder found — create a new one (Parent A path).
  // This works with drive.file scope because the app is creating the folder.
  const createResp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files`,
    'POST',
    {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    token,
  );

  const newId: string = createResp.id;
  cachedFolderId = newId;
  await setSharedFolderId(newId);
  return newId;
}

/**
 * Share the sync folder with a partner's Google account.
 * Called by Parent A to give Parent B read+write access.
 *
 * @param email - Partner's Google email address
 */
export async function shareFolderWithPartner(email: string): Promise<void> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  await driveRequest(
    `${GOOGLE_DRIVE_API}/files/${folderId}/permissions`,
    'POST',
    {
      role: 'writer',
      type: 'user',
      emailAddress: email,
    },
    token,
  );
}

/**
 * Accept a shared folder by ID (Parent B path).
 * Verifies that the folder exists and is accessible, then stores the ID.
 *
 * @param folderId - The folder ID received from the QR code (BK2 format)
 */
export async function acceptSharedFolder(folderId: string): Promise<void> {
  const token = await getAccessToken();

  // Verify the folder is accessible to this user
  const resp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files/${folderId}?fields=id,name,trashed`,
    'GET',
    null,
    token,
  );

  if (!resp.id || resp.trashed) {
    throw new DriveError('not_found', 'Shared folder not found or has been deleted. Ask your partner to re-share.');
  }

  await setSharedFolderId(folderId);
}

// ═══ FILE OPERATIONS ═══

/**
 * Upload an encrypted blob to Google Drive.
 * Creates the file if it doesn't exist; updates it if it does.
 * Upload is atomic — either the full file is written or the old file remains.
 *
 * @param fileName - e.g. "device_abc123_state.enc"
 * @param data - Encrypted Uint8Array (BB2 format)
 * @param knownFileId - Optional: if we already know the Drive file ID, PATCH it
 *   directly instead of searching by name. Critical for drive.file scope where
 *   folder-search queries can't find files created by a partner's app instance.
 */
export async function uploadFile(fileName: string, data: Uint8Array, knownFileId?: string): Promise<string> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  // Use known file ID if provided, otherwise search by name in folder.
  // With drive.file scope, findFileId only finds files this app instance created.
  // For shared files (like manifest.enc created by the partner), we MUST use knownFileId.
  const existingId = knownFileId || await findFileId(fileName, folderId, token);

  const metadata = {
    name: fileName,
    parents: existingId ? undefined : [folderId],
  };

  const boundary = 'babybloom_bb2_boundary';
  const metadataJson = JSON.stringify(metadata);

  // Multipart upload: metadata + binary data
  const body = buildMultipartBody(boundary, metadataJson, data);

  const url = existingId
    ? `${GOOGLE_DRIVE_UPLOAD_API}/files/${existingId}?uploadType=multipart`
    : `${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=multipart`;

  const method = existingId ? 'PATCH' : 'POST';

  const resp = await fetchWithTimeout(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: body as unknown as BodyInit,
  }, 60_000);

  // If PATCH targets a stale/deleted file ID (404) or a non-app-authorized file
  // (drive.file write denied), create a fresh app-authorized file and continue.
  // Exception: never auto-create a replacement for a known shared manifest ID,
  // because that silently forks families into separate manifests.
  if (existingId && await shouldCreateNewFileAfterPatchFailure(resp)) {
    if (knownFileId && fileName === MANIFEST_FILE) {
      if (resp.status === 404) {
        throw new DriveError(
          'not_found',
          'Stored sync manifest is missing. Ask your partner to share a fresh sync code.',
        );
      }
      if (await isAppWriteAccessDenied(resp)) {
        throw new DriveError(
          'forbidden',
          'Shared manifest is not app-authorized on this device. Re-link the shared folder in Cloud Sync and tap Sync again.',
        );
      }
    }

    const createMetadataJson = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });
    const createBody = buildMultipartBody(boundary, createMetadataJson, data);
    const createResp = await fetchWithTimeout(
      `${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: createBody as unknown as BodyInit,
      },
      60_000,
    );
    await handleDriveError(createResp);
    const created = await createResp.json();
    return created.id as string;
  }

  await handleDriveError(resp);

  const result = await resp.json();
  return result.id as string;
}

/**
 * Download an encrypted blob from Google Drive by file name.
 * Returns null if the file doesn't exist.
 */
export async function downloadFile(fileName: string): Promise<Uint8Array | null> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  const fileId = await findFileId(fileName, folderId, token);
  if (!fileId) return null;

  const resp = await fetchWithTimeout(
    `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    60_000,
  );

  if (resp.status === 404) return null;
  await handleDriveError(resp);

  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * List all device state files in the BabyBloom Sync folder.
 * Returns array of { name, id, modifiedTime }.
 *
 * With drive.file scope: folder-listing queries only return files this app created.
 * Partner files won't appear. The sync engine should prefer listDeviceFilesFromManifest()
 * and fall back to this only with legacy full drive scope.
 */
export async function listDeviceFiles(): Promise<Array<{ name: string; id: string; modifiedTime: string }>> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  const resp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
      q: `'${folderId}' in parents and name contains 'device_' and name contains '_state.enc' and trashed = false`,
      fields: 'files(id, name, modifiedTime)',
      spaces: 'drive',
    }),
    'GET',
    null,
    token,
  );

  return resp.files || [];
}

/**
 * List device state files using the manifest's file registry.
 * Works with drive.file scope because it accesses files by known ID.
 *
 * Reads the manifest to get each device's registered state_file_id,
 * then fetches metadata for each file by ID (which works even for
 * partner files shared via the folder permission).
 *
 * @param manifest - The decrypted manifest containing device file IDs
 * @returns Array of { name, id, modifiedTime } matching listDeviceFiles() format
 */
export async function listDeviceFilesFromManifest(
  manifest: { devices: Record<string, { state_file_id?: string }> },
): Promise<Array<{ name: string; id: string; modifiedTime: string }>> {
  const token = await getAccessToken();
  const results: Array<{ name: string; id: string; modifiedTime: string }> = [];

  for (const [deviceId, device] of Object.entries(manifest.devices)) {
    if (!device.state_file_id) continue;
    try {
      const resp = await driveRequest(
        `${GOOGLE_DRIVE_API}/files/${device.state_file_id}?fields=id,name,modifiedTime,trashed`,
        'GET',
        null,
        token,
      );
      if (resp.id && !resp.trashed) {
        results.push({
          name: resp.name || `device_${deviceId}_state.enc`,
          id: resp.id,
          modifiedTime: resp.modifiedTime || '',
        });
      }
    } catch {
      // If metadata lookup fails under drive.file, still return the ID so the
      // sync engine can attempt direct media download by file ID.
      results.push({
        name: `device_${deviceId}_state.enc`,
        id: device.state_file_id,
        modifiedTime: '',
      });
    }
  }

  return results;
}

/**
 * Download a file by its Google Drive file ID (instead of by name + folder search).
 * Works with drive.file scope for shared files when the user has folder permission.
 */
export async function downloadFileById(fileId: string): Promise<Uint8Array | null> {
  const token = await getAccessToken();

  const resp = await fetchWithTimeout(
    `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    60_000,
  );

  if (resp.status === 404) return null;
  await handleDriveError(resp);

  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Get the modification time of a specific file.
 * Returns null if file doesn't exist.
 * Used to check if partner's state has changed since last sync.
 */
export async function getFileModifiedTime(fileName: string): Promise<string | null> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  const fileId = await findFileId(fileName, folderId, token);
  if (!fileId) return null;

  const resp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files/${fileId}?fields=modifiedTime`,
    'GET',
    null,
    token,
  );

  return resp.modifiedTime || null;
}

/**
 * Delete a file from Google Drive.
 * Used when sync is disabled and user chooses "Delete cloud data".
 */
export async function deleteFile(fileName: string): Promise<void> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  const fileId = await findFileId(fileName, folderId, token);
  if (!fileId) return;

  const resp = await fetchWithTimeout(
    `${GOOGLE_DRIVE_API}/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
    30_000,
  );

  if (resp.status === 404 || resp.status === 204) return;
  await handleDriveError(resp);
}

// ═══ NAMED FILE HELPERS ═══

/** File name for this device's state snapshot */
export function deviceStateFileName(deviceId: string): string {
  return `device_${deviceId}_state.enc`;
}

/** File name for the previous-generation backup */
export function deviceStatePrevFileName(deviceId: string): string {
  return `device_${deviceId}_state_prev.enc`;
}

/** File name for manifest */
export const MANIFEST_FILE = 'manifest.enc';

/** File name for key backup */
export const KEY_BACKUP_FILE = 'key_backup.enc';

// ═══ INTERNAL HELPERS ═══

async function findFileId(
  fileName: string,
  folderId: string,
  token: string,
): Promise<string | null> {
  const resp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
      q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    }),
    'GET',
    null,
    token,
  );

  const files = resp.files || [];
  return files.length > 0 ? files[0].id : null;
}

async function driveRequest(
  url: string,
  method: string,
  body: unknown,
  token: string,
): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const resp = await fetchWithTimeout(url, opts, 30_000);
  await handleDriveError(resp);
  return resp.json();
}

function buildMultipartBody(boundary: string, metadata: string, data: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const header = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const footer = enc.encode(`\r\n--${boundary}--`);

  const total = new Uint8Array(header.length + data.length + footer.length);
  total.set(header, 0);
  total.set(data, header.length);
  total.set(footer, header.length + data.length);
  return total;
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new DriveError('timeout', `Drive request timed out after ${timeoutMs / 1000}s`);
    }
    if (!navigator.onLine) {
      throw new DriveError('offline', 'No internet connection');
    }
    throw new DriveError('network', `Network error: ${err?.message || 'unknown'}`);
  } finally {
    clearTimeout(timer);
  }
}

async function isAppWriteAccessDenied(resp: Response): Promise<boolean> {
  if (resp.status !== 403) return false;
  let msg = '';
  try {
    const body = await resp.clone().json();
    msg = String(body?.error?.message || '').toLowerCase();
  } catch {
    return false;
  }
  return msg.includes('has not granted the app') && msg.includes('write access');
}

async function shouldCreateNewFileAfterPatchFailure(resp: Response): Promise<boolean> {
  if (resp.status === 404) return true;
  return isAppWriteAccessDenied(resp);
}

async function handleDriveError(resp: Response): Promise<void> {
  if (resp.ok) return;

  let errorBody: any = {};
  try { errorBody = await resp.clone().json(); } catch { /* ignore */ }
  const msg = errorBody?.error?.message || '';

  switch (resp.status) {
    case 401:
      throw new DriveError('token_revoked', 'Google Drive access was revoked. Please sign in again.');
    case 403:
      if (msg.toLowerCase().includes('storage')) {
        throw new DriveError('storage_full', 'Google Drive storage is full. Free up space to resume sync.');
      }
      if (msg.toLowerCase().includes('granted scopes') || msg.toLowerCase().includes('requested spaces')) {
        throw new DriveError('scope_insufficient', `Google Drive access denied: ${msg}`);
      }
      throw new DriveError('forbidden', `Google Drive access denied: ${msg}`);
    case 404:
      throw new DriveError('not_found', `File not found: ${msg}`);
    case 429:
      throw new DriveError('rate_limited', 'Google Drive rate limit reached. Will retry shortly.');
    default:
      throw new DriveError('api_error', `Google Drive API error ${resp.status}: ${msg}`);
  }
}

// ── Google OAuth Client ID ──────────────────────────────────────────────────
//
// The Client ID is NOT a secret. For PKCE flows there is no client secret.
// Set VITE_GOOGLE_CLIENT_ID in your environment (CI / build config) once and
// it's baked into every build. End users never see or manage this.
//
// To register a Client ID:
//   1. console.cloud.google.com → APIs & Services → Credentials
//   2. Create OAuth 2.0 Client ID → Web application
//   3. Authorized redirect URIs: https://yourdomain.com/oauth  (+ babybloom://oauth for native)
//   4. Set VITE_GOOGLE_CLIENT_ID in your CI/CD environment variables
//
const GOOGLE_CLIENT_ID_FALLBACK = '292704039059-2aqdvdicdf749e2ana47m7dd1b9s9ucc.apps.googleusercontent.com';
// Client secret is required by Google for web app token exchange.
// It is NOT truly secret for a public client (it's in the JS bundle) but Google requires it.
// Get it from: console.cloud.google.com → Credentials → your OAuth 2.0 Client ID → Client secret
const GOOGLE_CLIENT_SECRET_FALLBACK = ''; // paste your client secret here

// ── Google API Key (for Picker API) ─────────────────────────────────────────
//
// The Picker API requires a separate API key (not the OAuth Client ID).
// Create one at: console.cloud.google.com → APIs & Services → Credentials → Create API Key
// Then restrict it to the Google Picker API.
//
const GOOGLE_API_KEY_FALLBACK = ''; // paste your API key here

function getGoogleClientId(): string {
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID)
    || GOOGLE_CLIENT_ID_FALLBACK;
}

function getGoogleClientSecret(): string {
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_SECRET)
    || GOOGLE_CLIENT_SECRET_FALLBACK;
}

function getGoogleApiKey(): string {
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_API_KEY)
    || GOOGLE_API_KEY_FALLBACK;
}

// ═══ GOOGLE PICKER (folder selection for Parent B) ═══

let pickerApiLoaded = false;

/**
 * Load the Google Picker API library (gapi + picker module).
 * Safe to call multiple times — only loads once.
 */
async function loadPickerApi(): Promise<void> {
  if (pickerApiLoaded) return;

  // Load gapi.js if not already present
  if (!(window as any).gapi) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    });
  }

  // Load the picker module within gapi
  await new Promise<void>((resolve, reject) => {
    (window as any).gapi.load('picker', {
      callback: () => { pickerApiLoaded = true; resolve(); },
      onerror: () => reject(new Error('Failed to load Google Picker module')),
    });
  });
}

/**
 * Show a Google Picker dialog for the user to select a shared folder.
 *
 * Used by Parent B to explicitly select the shared folder.
 * The user sees a folder browser filtered to "Shared with me"
 * and taps the BabyBloom Sync folder.
 *
 * @returns The selected folder's Google Drive ID, or null if cancelled.
 */
export async function showFolderPicker(): Promise<string | null> {
  await loadPickerApi();

  const token = await getAccessToken();
  const apiKey = getGoogleApiKey();
  const google = (window as any).google;

  if (!google?.picker) {
    throw new DriveError('api_error', 'Google Picker failed to load. Please try again.');
  }

  return new Promise((resolve) => {
    // "Shared with me" folder view — this is where Parent A's folder appears
    const sharedFoldersView = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setMimeTypes('application/vnd.google-apps.folder')
      .setSelectFolderEnabled(true)
      .setOwnedByMe(false);

    // "My Drive" folder view (fallback / testing / same-account use)
    const myFoldersView = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setMimeTypes('application/vnd.google-apps.folder')
      .setSelectFolderEnabled(true);

    const builder = new google.picker.PickerBuilder()
      .setTitle('Select the "BabyBloom Sync" folder your partner shared')
      .addView(sharedFoldersView)
      .addView(myFoldersView)
      .setOAuthToken(token)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const folder = data.docs?.[0];
          resolve(folder?.id || null);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      });

    // API key is optional but recommended — Picker works without it
    // if the OAuth token has sufficient scope
    if (apiKey) {
      builder.setDeveloperKey(apiKey);
    }

    builder.build().setVisible(true);
  });
}

// ═══ ERROR CLASS ═══

export type DriveErrorCode =
  | 'not_authenticated'
  | 'token_revoked'
  | 'token_refresh_failed'
  | 'scope_insufficient'
  | 'storage_full'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'api_error'
  | 'timeout'
  | 'offline'
  | 'network';

export class DriveError extends Error {
  code: DriveErrorCode;

  constructor(code: DriveErrorCode, message: string) {
    super(message);
    this.name = 'DriveError';
    this.code = code;
  }

  /** User-facing message for each error type */
  get userMessage(): string {
    switch (this.code) {
      case 'not_authenticated':
        return 'Please sign into Google to enable cloud sync.';
      case 'token_revoked':
        return 'Google Drive access was revoked. Re-enable sync in Settings.';
      case 'token_refresh_failed':
        return 'Google sign-in expired. Re-connect Google Drive in Settings → Cloud Sync.';
      case 'scope_insufficient':
        return 'Google Drive permissions need to be updated. Please re-connect Google Drive in Settings → Cloud Sync.';
      case 'storage_full':
        return 'Google Drive is full. Free up space or continue offline.';
      case 'forbidden':
        return 'Google Drive denied access. Check folder sharing and the selected Google account.';
      case 'not_found':
        return 'Cloud link is outdated or folder access is missing for this Google account. Reconnect partner sync with a fresh invite code.';
      case 'rate_limited':
        return 'Google Drive is busy. Will retry automatically.';
      case 'offline':
        return 'Offline — will sync when connected.';
      case 'network':
        return 'Sync unavailable — check your connection. Will retry automatically.';
      case 'timeout':
        return 'Sync timed out. Will retry shortly.';
      default:
        return 'Sync paused. Will retry automatically.';
    }
  }
}
