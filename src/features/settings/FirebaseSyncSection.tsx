import React from 'react';
import { C } from '@/lib/constants/colors';
import Icon from '@/components/shared/Icon';
import type { SyncStatus } from '@/hooks/useFirebaseSync';

interface FirebaseSyncSectionProps {
  syncStatus?: SyncStatus;
  lastSyncedAt?: number | null;
}

/**
 * Displays Firebase autosync status in Settings.
 * Firebase credentials are bundled by the app at build time (VITE_ env vars) —
 * users never need to enter credentials.
 */
export default function FirebaseSyncSection({ syncStatus, lastSyncedAt }: FirebaseSyncSectionProps) {
  const statusColor =
    syncStatus === 'synced' ? C.ok
    : syncStatus === 'error' ? '#FF5252'
    : syncStatus === 'syncing' ? C.s
    : C.tl;

  const statusLabel =
    syncStatus === 'synced'
      ? lastSyncedAt
        ? `Synced at ${new Date(lastSyncedAt).toLocaleTimeString()}`
        : 'Synced'
    : syncStatus === 'syncing' ? 'Syncing…'
    : syncStatus === 'error' ? 'Sync error — check connection'
    : 'Sync enabled';

  const statusIcon =
    syncStatus === 'synced' ? 'check'
    : syncStatus === 'error' ? 'alert-triangle'
    : syncStatus === 'syncing' ? 'clock'
    : 'database';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon n={statusIcon} s={14} c={statusColor} />
        <span
          data-testid="sync-status-label"
          style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
