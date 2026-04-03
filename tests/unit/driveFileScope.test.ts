import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for drive.file scope migration:
 *   1. Types: new scope constants, DB keys, manifest file registry
 *   2. googleDrive: dual scope acceptance, manifest-based file listing, ID-based download
 *   3. syncEngine: manifest-based discovery, state_file_id registration
 *   4. keyManager: BK2 format with manifest file ID
 *   5. CloudSync: manifest file ID in QR export and join flows
 */

const typesSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/types.ts'),
  'utf8'
);

const gdriveSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/googleDrive.ts'),
  'utf8'
);

const engineSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/syncEngine.ts'),
  'utf8'
);

const keyMgrSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/lib/sync/keyManager.ts'),
  'utf8'
);

const cloudSyncSrc = fs.readFileSync(
  path.resolve(__dirname, '../../src/features/sync/CloudSync.tsx'),
  'utf8'
);

// ─── Types ───

describe('Types — drive.file scope constants', () => {
  it('GOOGLE_DRIVE_SCOPE is drive.file (not full drive)', () => {
    expect(typesSrc).toContain("GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'");
  });

  it('GOOGLE_DRIVE_SCOPE_LEGACY preserves full drive scope for backward compat', () => {
    expect(typesSrc).toContain("GOOGLE_DRIVE_SCOPE_LEGACY = 'https://www.googleapis.com/auth/drive'");
  });

  it('DB_KEY_MANIFEST_FILE_ID constant exists', () => {
    expect(typesSrc).toContain("DB_KEY_MANIFEST_FILE_ID = 'sync_manifest_file_id'");
  });

  it('SyncManifest devices include state_file_id', () => {
    expect(typesSrc).toContain('state_file_id?: string');
  });

  it('SyncManifest has manifest_file_id', () => {
    expect(typesSrc).toContain('manifest_file_id?: string');
  });
});

// ─── googleDrive ───

describe('googleDrive — dual scope and manifest-based discovery', () => {
  it('hasRequiredDriveScope accepts both drive.file and full drive', () => {
    const fnStart = gdriveSrc.indexOf('function hasRequiredDriveScope');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 300);
    expect(fnRegion).toContain('GOOGLE_DRIVE_SCOPE');
    expect(fnRegion).toContain('GOOGLE_DRIVE_SCOPE_LEGACY');
  });

  it('exports hasLegacyFullDriveScope function', () => {
    expect(gdriveSrc).toContain('export async function hasLegacyFullDriveScope');
  });

  it('exports listDeviceFilesFromManifest function', () => {
    expect(gdriveSrc).toContain('export async function listDeviceFilesFromManifest');
  });

  it('listDeviceFilesFromManifest reads device.state_file_id from manifest', () => {
    const fnStart = gdriveSrc.indexOf('async function listDeviceFilesFromManifest');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 600);
    expect(fnRegion).toContain('device.state_file_id');
  });

  it('listDeviceFilesFromManifest keeps file IDs even when metadata lookup fails', () => {
    const fnStart = gdriveSrc.indexOf('async function listDeviceFilesFromManifest');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 1100);
    expect(fnRegion).toContain('device.state_file_id');
    expect(fnRegion).toContain('metadata lookup fails');
    expect(fnRegion).toContain('modifiedTime:');
  });

  it('exports downloadFileById function', () => {
    expect(gdriveSrc).toContain('export async function downloadFileById');
  });

  it('getOrCreateFolder checks stored folder ID before search (drive.file primary path)', () => {
    const fnStart = gdriveSrc.indexOf('async function getOrCreateFolder');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 3600);
    // Stored ID check must come before the search query
    const storedIdIdx = fnRegion.indexOf('getSharedFolderId');
    const searchIdx = fnRegion.indexOf('name =');
    expect(storedIdIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeGreaterThan(storedIdIdx);
  });

  it('getOrCreateFolder can recover folder ID from stored manifest file ID', () => {
    const fnStart = gdriveSrc.indexOf('async function getOrCreateFolder');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 2600);
    expect(fnRegion).toContain('DB_KEY_MANIFEST_FILE_ID');
    expect(fnRegion).toContain('parents');
    expect(fnRegion).toContain('setSharedFolderId(parentId)');
  });

  it('getOrCreateFolder prevents silent new-folder creation when stored shared folder is inaccessible', () => {
    const fnStart = gdriveSrc.indexOf('async function getOrCreateFolder');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 3000);
    expect(fnRegion).toContain('storedIdInaccessible');
    expect(fnRegion).toContain('Shared sync folder is no longer accessible');
  });

  it('folder search runs before create to reduce duplicate-folder creation', () => {
    const fnStart = gdriveSrc.indexOf('async function getOrCreateFolder');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 3400);
    const searchIdx = fnRegion.indexOf("name = '${DRIVE_FOLDER_NAME}'");
    const createIdx = fnRegion.indexOf('No folder found — create a new one');
    expect(searchIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(searchIdx);
  });

  it('uploadFile accepts optional knownFileId to PATCH by ID (prevents manifest duplication)', () => {
    const fnStart = gdriveSrc.indexOf('export async function uploadFile');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 600);
    expect(fnRegion).toContain('knownFileId?: string');
    expect(fnRegion).toContain('knownFileId || await findFileId');
  });

  it('uploadFile falls back to POST create when PATCH is denied for app write access', () => {
    const fnStart = gdriveSrc.indexOf('export async function uploadFile');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 3400);
    expect(fnRegion).toContain('shouldCreateNewFileAfterPatchFailure(resp)');
    expect(fnRegion).toContain('const createResp = await fetchWithTimeout');
    expect(fnRegion).toContain('files?uploadType=multipart');
  });

  it('uploadFile does not auto-create a replacement manifest when known manifest patch is denied', () => {
    const fnStart = gdriveSrc.indexOf('export async function uploadFile');
    const fnRegion = gdriveSrc.slice(fnStart, fnStart + 3200);
    expect(fnRegion).toContain('knownFileId && fileName === MANIFEST_FILE');
    expect(fnRegion).toContain('Shared manifest is not app-authorized');
    expect(fnRegion).toContain('Stored sync manifest is missing');
  });

  it('has helper to detect app write-access denied 403 responses', () => {
    expect(gdriveSrc).toContain('async function isAppWriteAccessDenied');
    expect(gdriveSrc).toContain("msg.includes('has not granted the app')");
  });

  it('falls back to create when PATCH target file ID is stale (404)', () => {
    expect(gdriveSrc).toContain('async function shouldCreateNewFileAfterPatchFailure');
    expect(gdriveSrc).toContain('if (resp.status === 404) return true;');
  });
});

// ─── syncEngine ───

describe('syncEngine — manifest-based file registry', () => {
  it('imports listDeviceFilesFromManifest and downloadFileById', () => {
    expect(engineSrc).toContain('listDeviceFilesFromManifest');
    expect(engineSrc).toContain('downloadFileById');
  });

  it('imports hasLegacyFullDriveScope', () => {
    expect(engineSrc).toContain('hasLegacyFullDriveScope');
  });

  it('captures stateFileId from uploadFile return value', () => {
    expect(engineSrc).toContain('const stateFileId = await uploadFile(stateFileName, encryptedState)');
  });

  it('passes stateFileId to ensureManifest', () => {
    expect(engineSrc).toContain('ensureManifest(deviceId, deviceName, key, stateFileId)');
  });

  it('ensureManifest registers state_file_id in manifest.devices', () => {
    const fnStart = engineSrc.indexOf('async function ensureManifest');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 2000);
    expect(fnRegion).toContain('state_file_id: stateFileId');
  });

  it('ensureManifest stores manifest_file_id after upload', () => {
    const fnStart = engineSrc.indexOf('async function ensureManifest');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 3200);
    expect(fnRegion).toContain('manifest.manifest_file_id = manifestFileId');
    expect(fnRegion).toContain("ds(DB_KEY_MANIFEST_FILE_ID, manifestFileId)");
  });

  it('ensureManifest tries stored manifest file ID before name-based download', () => {
    const fnStart = engineSrc.indexOf('async function ensureManifest');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1400);
    const storedIdx = fnRegion.indexOf('DB_KEY_MANIFEST_FILE_ID');
    const downloadByIdIdx = fnRegion.indexOf('downloadFileById');
    const downloadByNameIdx = fnRegion.indexOf('downloadFile(MANIFEST_FILE)');
    expect(storedIdx).toBeGreaterThan(-1);
    expect(downloadByIdIdx).toBeGreaterThan(storedIdx);
    expect(downloadByNameIdx).toBeGreaterThan(downloadByIdIdx);
  });

  it('ensureManifest fails fast when stored manifest ID is missing instead of creating a new split manifest', () => {
    const fnStart = engineSrc.indexOf('async function ensureManifest');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1900);
    expect(fnRegion).toContain('Stored sync manifest is missing');
    expect(fnRegion).toContain("throw new DriveError(");
  });

  it('ensureManifest surfaces key mismatch/corruption errors instead of silently recreating manifest', () => {
    const fnStart = engineSrc.indexOf('async function ensureManifest');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 2400);
    expect(fnRegion).toContain('isValidBB2Header');
    expect(fnRegion).toContain('Sync key mismatch');
    expect(fnRegion).toContain('Sync manifest is corrupted or incompatible');
  });

  it('runSyncCycle uses manifest-based discovery with fallback to folder listing', () => {
    const cycleStart = engineSrc.indexOf('async function runSyncCycle');
    const cycleRegion = engineSrc.slice(cycleStart, cycleStart + 4000);
    // Primary: manifest-based
    expect(cycleRegion).toContain('listDeviceFilesFromManifest(manifest)');
    // Fallback: legacy folder listing
    expect(cycleRegion).toContain('listDeviceFiles()');
  });

  it('runSyncCycle uses downloadFileById for partner files', () => {
    const cycleStart = engineSrc.indexOf('async function runSyncCycle');
    const cycleRegion = engineSrc.slice(cycleStart, cycleStart + 4000);
    expect(cycleRegion).toContain('downloadFileById(file.id)');
  });

  it('runSyncCycle forces download attempts when modifiedTime is missing', () => {
    const cycleStart = engineSrc.indexOf('async function runSyncCycle');
    const cycleRegion = engineSrc.slice(cycleStart, cycleStart + 5000);
    expect(cycleRegion).toContain('if (!f.modifiedTime) return true;');
  });

  it('runSyncCycle surfaces partner access failures instead of silently going green', () => {
    const cycleStart = engineSrc.indexOf('async function runSyncCycle');
    const cycleRegion = engineSrc.slice(cycleStart, cycleStart + 6500);
    expect(cycleRegion).toContain('partnerReadFailures');
    expect(cycleRegion).toContain('Partner files are not accessible');
  });

  it('ensureManifest returns the manifest for use in sync cycle', () => {
    // The function signature should return SyncManifest
    expect(engineSrc).toContain('): Promise<SyncManifest>');
    // The sync cycle should capture the return value
    expect(engineSrc).toContain('const manifest = await ensureManifest(');
  });

  it('ensureManifest passes stored manifest file ID to uploadFile to prevent duplication', () => {
    const fnStart = engineSrc.indexOf('async function ensureManifest');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 3800);
    // Must pass storedManifestId as 3rd arg to uploadFile so it PATCHes instead of creating
    expect(fnRegion).toContain('uploadFile(MANIFEST_FILE, encrypted, storedManifestId');
  });

  it('disableSync clears manifest file ID to avoid stale links after folder reset', () => {
    const fnStart = engineSrc.indexOf('export async function disableSync');
    const fnRegion = engineSrc.slice(fnStart, fnStart + 1000);
    expect(fnRegion).toContain('DB_KEY_MANIFEST_FILE_ID');
    expect(fnRegion).toContain('partnerFileTimestamps.clear()');
  });
});

// ─── keyManager ───

describe('keyManager — BK2 format with manifest file ID', () => {
  it('exportKeyAndFolderForQR accepts optional manifestFileId', () => {
    const fnStart = keyMgrSrc.indexOf('async function exportKeyAndFolderForQR');
    const fnRegion = keyMgrSrc.slice(fnStart, fnStart + 300);
    expect(fnRegion).toContain('manifestFileId?: string');
  });

  it('exportKeyAndFolderForQR includes m field when manifestFileId is provided', () => {
    const fnStart = keyMgrSrc.indexOf('async function exportKeyAndFolderForQR');
    const fnRegion = keyMgrSrc.slice(fnStart, fnStart + 400);
    expect(fnRegion).toContain("payload.m = manifestFileId");
  });

  it('importKeyAndFolderFromQR returns manifestFileId', () => {
    expect(keyMgrSrc).toContain('manifestFileId: string | null');
    const fnStart = keyMgrSrc.indexOf('async function importKeyAndFolderFromQR');
    const fnRegion = keyMgrSrc.slice(fnStart, fnStart + 1400);
    expect(fnRegion).toContain('manifestFileId: m || null');
  });
});

// ─── CloudSync UI ───

describe('CloudSync — manifest file ID in QR flows', () => {
  it('imports DB_KEY_MANIFEST_FILE_ID', () => {
    expect(cloudSyncSrc).toContain('DB_KEY_MANIFEST_FILE_ID');
  });

  it('has helper to ensure manifest file ID exists (trigger sync if missing)', () => {
    const helperStart = cloudSyncSrc.indexOf('const ensureManifestFileId');
    const helperRegion = cloudSyncSrc.slice(helperStart, helperStart + 700);
    expect(helperRegion).toContain('dg(DB_KEY_MANIFEST_FILE_ID)');
    expect(helperRegion).toContain("triggerSync('manual')");
  });

  it('handleInvite ensures manifest file ID and passes to exportKeyAndFolderForQR', () => {
    const inviteStart = cloudSyncSrc.indexOf('const handleInvite');
    const inviteRegion = cloudSyncSrc.slice(inviteStart, inviteStart + 1000);
    expect(inviteRegion).toContain('ensureManifestFileId()');
    expect(inviteRegion).toContain('if (!manifestFileId)');
    expect(inviteRegion).toContain('exportKeyAndFolderForQR(key, folderId, manifestFileId');
  });

  it('handleShowQR ensures manifest file ID and passes to exportKeyAndFolderForQR', () => {
    const showStart = cloudSyncSrc.indexOf('const handleShowQR');
    const showRegion = cloudSyncSrc.slice(showStart, showStart + 700);
    expect(showRegion).toContain('ensureManifestFileId()');
    expect(showRegion).toContain('if (!manifestFileId)');
    expect(showRegion).toContain('exportKeyAndFolderForQR(key, folderId, manifestFileId');
  });

  it('handleJoin requires folder ID and manifest file ID from QR scan', () => {
    const joinStart = cloudSyncSrc.indexOf('const handleJoin');
    const joinRegion = cloudSyncSrc.slice(joinStart, joinStart + 1000);
    expect(joinRegion).toContain('result.folderId');
    expect(joinRegion).toContain('result.manifestFileId');
    expect(joinRegion).toContain('outdated');
    expect(joinRegion).toContain('DB_KEY_MANIFEST_FILE_ID');
  });

  it('join/oauth flow tracks pending folder picker binding for drive.file permissions', () => {
    expect(cloudSyncSrc).toContain('DB_KEY_SYNC_PENDING_FOLDER_ID');
    expect(cloudSyncSrc).toContain('bindSharedFolder');
    expect(cloudSyncSrc).toContain('showFolderPicker');
  });
});
