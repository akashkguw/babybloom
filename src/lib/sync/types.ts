/**
 * BabyBloom Cloud Sync — Type Definitions
 *
 * All types required by the encrypted cloud sync system.
 * Implements the design from BabyBloom_Cloud_Sync_Design.docx.
 */

// ═══ SYNC-AUGMENTED LOG ENTRIES ═══
// Every mutable entry gains modified_at (required) and deleted_at (optional).
// modified_at is set on create and every edit — used for LWW conflict resolution.
// deleted_at is set on soft-delete — tombstone propagates deletion across devices.

export interface SyncMeta {
  modified_at: string;    // ISO 8601 — last modification time
  deleted_at?: string | null; // ISO 8601 — soft-delete marker; null = not deleted
}

export interface SyncLogEntry extends SyncMeta {
  id: number;
  date: string;   // YYYY-MM-DD
  time?: string;  // HH:MM
  type?: string;
  notes?: string;
}

export interface SyncFeedEntry extends SyncLogEntry {
  type?: 'Breast L' | 'Breast R' | 'Formula' | 'Pumped Milk' | 'Bottle';
  oz?: number;
  amount?: string;
  duration?: string;
  mins?: number;
}

export interface SyncDiaperEntry extends SyncLogEntry {
  type?: 'Wet' | 'Dirty' | 'Both';
  color?: string;
  consistency?: string;
  peeAmount?: string;
}

export interface SyncSleepEntry extends SyncLogEntry {
  type?: 'Nap' | 'Night Sleep' | 'Wake Up';
  amount?: string;
  mins?: number;
  duration?: string;
  sleepHrs?: string;
  sleepMins?: string;
}

export interface SyncGrowthEntry extends SyncLogEntry {
  weight?: number;
  height?: number;
}

export interface SyncTempEntry extends SyncLogEntry {
  temp?: number;
}

export interface SyncBathEntry extends SyncLogEntry {
  waterTemp?: number;
  duration?: string;
}

export interface SyncMassageEntry extends SyncLogEntry {
  type?: string;
  duration?: string;
}

export interface SyncMedsEntry extends SyncLogEntry {
  med?: string;
  dose?: string;
  reason?: string;
}

export interface SyncTummyEntry extends SyncLogEntry {
  type?: 'Tummy Time';
  sleepMins?: string;
  mins?: number;
}

export interface SyncAllergyEntry extends SyncLogEntry {
  food?: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
}

export interface SyncFirstEntry extends SyncMeta {
  id: number;
  date?: string;
  label?: string;
  title?: string;
  emoji?: string;
  notes?: string;
}

export interface SyncEmergencyContact extends SyncMeta {
  id: number;
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface SyncProfile extends SyncMeta {
  name?: string;
  dob?: string;
  gender?: string;
  weight?: number;
  height?: number;
  feedingType?: 'breast' | 'formula' | 'combination';
  feedingMethod?: 'bottle' | 'breast' | 'both';
  volumeUnit?: 'oz' | 'ml';
  temperatureUnit?: 'F' | 'C';
}

// ═══ STATE SNAPSHOT ═══
// Full plaintext state before encryption. Written per-device to Google Drive.

export interface SyncLogs {
  feed: SyncFeedEntry[];
  diaper: SyncDiaperEntry[];
  sleep: SyncSleepEntry[];
  growth: SyncGrowthEntry[];
  temp: SyncTempEntry[];
  bath: SyncBathEntry[];
  massage: SyncMassageEntry[];
  meds: SyncMedsEntry[];
  allergy: SyncAllergyEntry[];
  pump?: SyncFeedEntry[];
  tummy?: SyncTummyEntry[];
}

export interface StateSnapshot {
  schema_version: 2;
  device_id: string;
  device_name: string;
  snapshot_at: string;       // ISO 8601 — when snapshot was taken
  profile: SyncProfile;
  logs: SyncLogs;
  firsts: SyncFirstEntry[];
  /** tooth index → eruption date (YYYY-MM-DD) */
  teeth: Record<string, string>;
  /** week number → { checkKey → achieved boolean } (nested milestone checks) */
  milestones: Record<string, Record<string, boolean> | boolean>;
  /** country code → { schedule key → completed boolean } */
  vaccines: Record<string, Record<string, boolean>>;
  emergency_contacts: SyncEmergencyContact[];
  /** Device-local wellness data (private, not merged across devices — backup only) */
  wellness?: {
    today?: any;
    history?: any[];
  };
}

// ═══ MANIFEST ═══
// Family metadata stored in manifest.enc

export interface SyncManifest {
  schema_version: 2;
  family_id: string;
  created_at: string;
  minimum_schema_version: number;
  /** device_id → { device_name, last_seen } */
  devices: Record<string, { device_name: string; last_seen: string }>;
}

// ═══ ENCRYPTED FILE FORMAT (BB2) ═══
// Binary layout:
//   Bytes 0-3:   Magic "BB2\x00"
//   Bytes 4-5:   Format version uint16 big-endian = 1
//   Bytes 6-17:  IV (12 bytes, random)
//   Bytes 18-21: Plaintext length uint32 big-endian
//   Bytes 22-N:  AES-256-GCM ciphertext + 16-byte GCM auth tag

export const BB2_MAGIC = new Uint8Array([0x42, 0x42, 0x32, 0x00]); // "BB2\x00"
export const BB2_FORMAT_VERSION = 1;
export const BB2_HEADER_SIZE = 22; // magic(4) + version(2) + iv(12) + plen(4)
export const BB2_IV_SIZE = 12;
export const BB2_TAG_SIZE = 16;

// ═══ KEY FORMATS ═══

/** Family key QR code prefix for BK1: format */
export const FAMILY_KEY_PREFIX = 'BK1:';

/** IndexedDB key for storing family key material (web) */
export const DB_KEY_FAMILY_KEY = 'family_key';
/** IndexedDB key for storing Google OAuth tokens (web) */
export const DB_KEY_GOOGLE_TOKENS = 'family_google_tokens';
/** IndexedDB key for storing device ID */
export const DB_KEY_DEVICE_ID = 'sync_device_id';
/** IndexedDB key for storing sync-enabled flag */
export const DB_KEY_SYNC_ENABLED = 'sync_enabled';
/** IndexedDB key for last sync timestamp */
export const DB_KEY_LAST_SYNC = 'sync_last_at';
/** IndexedDB key for sync status message */
export const DB_KEY_SYNC_STATUS = 'sync_status';

// ═══ SYNC ENGINE ═══

export type SyncState = 'idle' | 'uploading' | 'downloading' | 'merging' | 'applying' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncAt?: string;       // ISO 8601
  errorMessage?: string;
  deviceCount?: number;      // how many partner devices detected
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  scope: string;
}

// ═══ DUPLICATE DETECTION ═══

/** Time window (ms) within which two entries with same date/type are fuzzy-deduped */
export const FUZZY_DEDUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/** Days after which tombstones are permanently purged */
export const TOMBSTONE_PURGE_DAYS = 30;

/** Clock skew threshold — warn user if > this many ms */
export const CLOCK_SKEW_WARN_MS = 2 * 60 * 1000; // 2 minutes

/** Passphrase minimum character length for key backup */
export const PASSPHRASE_MIN_LENGTH = 12;

/** PBKDF2 iterations for passphrase-based key backup */
export const PBKDF2_ITERATIONS = 100_000;

/** Google Drive scope — full drive access so both parents can read each other's
 *  encrypted files in the shared folder. drive.file is insufficient because it
 *  only exposes files the *current user's* app instance created, which prevents
 *  Parent B from listing/downloading Parent A's state files (and vice-versa). */
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/** IndexedDB key for the shared Google Drive folder ID */
export const DB_KEY_SHARED_FOLDER_ID = 'sync_shared_folder_id';

/** Family key + folder ID QR code prefix for BK2: format */
export const FAMILY_KEY_PREFIX_V2 = 'BK2:';

/** Google Drive API base URL */
export const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const GOOGLE_DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/** BabyBloom shared folder name in Google Drive (visible to both parents) */
export const DRIVE_FOLDER_NAME = 'BabyBloom Sync';
