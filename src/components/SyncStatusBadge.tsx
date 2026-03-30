import React from 'react';
import type { SyncStatus } from '@/hooks/useFirebaseSync';
import { Icon } from '@/components/shared/Icon';
import { C } from '@/lib/constants/colors';

interface SyncStatusBadgeProps {
  status?: SyncStatus;
  lastSyncedAt?: number | null;
}

const STATUS_CONFIG: Record<Exclude<SyncStatus, 'idle'>, { icon: string; color: string; label: string }> = {
  syncing: { icon: 'clock', color: C.s, label: 'Syncing…' },
  synced: { icon: 'check', color: C.ok, label: 'Synced' },
  error: { icon: 'alert-triangle', color: '#FF5252', label: 'Sync error' },
};

/**
 * Small badge shown in the app header reflecting Firestore autosync state.
 * Renders nothing when status is idle or undefined (Firebase not configured).
 */
export default function SyncStatusBadge({ status, lastSyncedAt }: SyncStatusBadgeProps) {
  if (!status || status === 'idle') return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;

  const title =
    lastSyncedAt && status === 'synced'
      ? `Synced at ${new Date(lastSyncedAt).toLocaleTimeString()}`
      : cfg.label;

  return (
    <div
      title={title}
      aria-label={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 7px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.18)',
      }}
    >
      <Icon n={cfg.icon} s={13} c={cfg.color} />
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}
