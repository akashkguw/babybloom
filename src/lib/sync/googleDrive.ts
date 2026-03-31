/**
 * BabyBloom Cloud Sync — Google Drive API Wrapper
 *
 * Handles all Google Drive interactions for the sync engine.
 * Uses the appDataFolder scope — the most restrictive available.
 * Only BabyBloom can see these files; the user cannot browse them in Drive.
 *
 * Folder structure in appDataFolder:
 *   babybloom/
 *     manifest.enc          ← Family metadata + schema version
 *     device_{id}_state.enc ← Full state snapshot per device
 *     key_backup.enc        ← Optional: family key encrypted with passphrase
 *
 * Design §6 — Google Drive Integration
 */

import { dg, ds } from '@/lib/db';
import {
  GOOGLE_DRIVE_API,
  GOOGLE_DRIVE_UPLOAD_API,
  GOOGLE_DRIVE_SCOPE,
  DRIVE_FOLDER_NAME,
  DB_KEY_GOOGLE_TOKENS,
} from './types';
import type { GoogleTokens } from './types';

// ═══ OAUTH ═══

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
 * Get the current access token, refreshing if needed.
 * Throws if no tokens are stored or refresh fails.
 */
export async function getAccessToken(): Promise<string> {
  const tokens: GoogleTokens | null = await dg(DB_KEY_GOOGLE_TOKENS);
  if (!tokens) throw new DriveError('not_authenticated', 'No Google tokens found. Please sign in.');

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

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

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
 * Clear stored Google tokens (when sync is disabled).
 */
export async function clearTokens(): Promise<void> {
  await ds(DB_KEY_GOOGLE_TOKENS, null);
}

// ═══ FOLDER MANAGEMENT ═══

let cachedFolderId: string | null = null;

/**
 * Get or create the babybloom/ folder in appDataFolder.
 * Result is cached in memory for the session.
 */
export async function getOrCreateFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const token = await getAccessToken();

  // Search for existing folder
  const searchResp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
      q: `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and 'appDataFolder' in parents`,
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
    }),
    'GET',
    null,
    token,
  );

  const files = searchResp.files || [];
  if (files.length > 0) {
    cachedFolderId = files[0].id;
    return cachedFolderId!;
  }

  // Create folder
  const createResp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files`,
    'POST',
    {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['appDataFolder'],
    },
    token,
  );

  cachedFolderId = createResp.id;
  return cachedFolderId!;
}

// ═══ FILE OPERATIONS ═══

/**
 * Upload an encrypted blob to Google Drive.
 * Creates the file if it doesn't exist; updates it if it does.
 * Upload is atomic — either the full file is written or the old file remains.
 *
 * @param fileName - e.g. "device_abc123_state.enc"
 * @param data - Encrypted Uint8Array (BB2 format)
 */
export async function uploadFile(fileName: string, data: Uint8Array): Promise<string> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  // Check if file exists
  const existingId = await findFileId(fileName, folderId, token);

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
 * List all device state files in the babybloom/ folder.
 * Returns array of { name, id, modifiedTime }.
 */
export async function listDeviceFiles(): Promise<Array<{ name: string; id: string; modifiedTime: string }>> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder();

  const resp = await driveRequest(
    `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
      q: `'${folderId}' in parents and name contains 'device_' and name contains '_state.enc'`,
      spaces: 'appDataFolder',
      fields: 'files(id, name, modifiedTime)',
    }),
    'GET',
    null,
    token,
  );

  return resp.files || [];
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
      q: `name = '${fileName}' and '${folderId}' in parents`,
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
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
      throw new DriveError('forbidden', `Google Drive access denied: ${msg}`);
    case 404:
      throw new DriveError('not_found', `File not found: ${msg}`);
    case 429:
      throw new DriveError('rate_limited', 'Google Drive rate limit reached. Will retry shortly.');
    default:
      throw new DriveError('api_error', `Google Drive API error ${resp.status}: ${msg}`);
  }
}

function getGoogleClientId(): string {
  // Client ID is injected at build time via Vite environment variables
  return (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) || '';
}

// ═══ ERROR CLASS ═══

export type DriveErrorCode =
  | 'not_authenticated'
  | 'token_revoked'
  | 'token_refresh_failed'
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
      case 'storage_full':
        return 'Google Drive is full. Free up space or continue offline.';
      case 'offline':
        return 'Offline — will sync when connected.';
      case 'timeout':
        return 'Sync timed out. Will retry shortly.';
      default:
        return 'Sync paused. Will retry automatically.';
    }
  }
}
