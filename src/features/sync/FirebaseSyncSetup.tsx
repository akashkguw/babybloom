/**
 * FirebaseSyncSetup — UI for configuring Firebase Realtime Database autosync.
 *
 * Shows either:
 *  - Setup form (if not yet configured): paste Firebase config + enter sync key
 *  - Status panel (if configured): shows sync status, last synced time, and disconnect option
 */
import { useState } from 'react';
import { C } from '@/lib/constants/colors';
import { Button as Btn, Card as Cd, Icon as Ic } from '@/components/shared';
import { parseFirebaseConfig, isValidSyncKey, generateSyncKey } from './firebaseSyncUtils';
import type { FirebaseConfig } from './firebaseSyncUtils';
import type { FirebaseSyncState } from './useFirebaseSync';

interface Props {
  syncState: FirebaseSyncState;
}

const SETUP_INSTRUCTIONS = `1. Go to console.firebase.google.com → create a project.
2. Build → Realtime Database → Create database (Start in test mode).
3. Project Settings → Your apps → Add web app → copy the firebaseConfig.
4. Paste the config below and enter a sync key shared across your devices.`;

function statusLabel(state: FirebaseSyncState): { text: string; color: string } {
  switch (state.status) {
    case 'connecting': return { text: 'Connecting…', color: C.tl };
    case 'syncing':    return { text: 'Syncing…',    color: C.s };
    case 'synced':     return { text: 'Synced',       color: C.ok };
    case 'error':      return { text: 'Error',        color: C.w };
    default:           return { text: 'Not configured', color: C.tl };
  }
}

export default function FirebaseSyncSetup({ syncState }: Props) {
  const [configInput, setConfigInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setParseError(null);
    const config = parseFirebaseConfig(configInput);
    if (!config) {
      setParseError('Could not parse Firebase config. Make sure it includes apiKey, databaseURL, and appId.');
      return;
    }
    const trimKey = keyInput.trim();
    if (!isValidSyncKey(trimKey)) {
      setParseError('Sync key must be at least 4 characters and contain no special characters (. # $ [ ] /).');
      return;
    }
    setSaving(true);
    try {
      await syncState.saveConfig(config as FirebaseConfig, trimKey);
      setConfigInput('');
      setKeyInput('');
    } catch {
      setParseError('Failed to save — check your Firebase config.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Firebase autosync? Your local data will not be deleted.')) return;
    await syncState.removeConfig();
  };

  // ── Status panel (configured) ──────────────────────────────────────────
  if (syncState.configured) {
    const { text: statusText, color: statusColor } = statusLabel(syncState);
    const lastSync = syncState.lastSynced
      ? new Date(syncState.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    return (
      <div>
        <Cd style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ic n="cloud" s={18} c={statusColor} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.t }}>Firebase Autosync</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{statusText}</span>
          </div>

          <div style={{ fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
            Sync key: <span style={{ fontFamily: 'monospace', color: C.t }}>{syncState.syncKey}</span>
            {lastSync && (
              <><br />Last synced: {lastSync}</>
            )}
          </div>

          {syncState.error && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 11, color: C.w,
            }}>
              {syncState.error}
            </div>
          )}
        </Cd>

        <div style={{ fontSize: 11, color: C.tl, marginBottom: 12, lineHeight: 1.5 }}>
          All devices using the same sync key and Firebase project will automatically share data.
        </div>

        <Btn label="Disconnect autosync" onClick={handleDisconnect} outline />
      </div>
    );
  }

  // ── Setup form (not yet configured) ───────────────────────────────────
  return (
    <div>
      <div style={{
        padding: '12px 14px', borderRadius: 12, marginBottom: 14,
        background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
        fontSize: 12, color: C.tl, lineHeight: 1.6,
        whiteSpace: 'pre-line' as const,
      }}>
        <div style={{ fontWeight: 700, color: C.t, marginBottom: 6 }}>Setup steps:</div>
        {SETUP_INSTRUCTIONS}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t, marginBottom: 6 }}>
          Firebase config (paste from console)
        </div>
        <textarea
          value={configInput}
          onChange={(e) => setConfigInput(e.target.value)}
          placeholder={`{\n  apiKey: "AIza...",\n  authDomain: "...",\n  databaseURL: "https://....firebaseio.com",\n  projectId: "...",\n  appId: "1:..."\n}`}
          style={{
            width: '100%',
            height: 120,
            background: C.cd,
            border: '1px solid ' + C.b,
            borderRadius: 12,
            padding: 12,
            fontSize: 11,
            fontFamily: 'monospace',
            color: C.t,
            resize: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t, marginBottom: 6 }}>
          Sync key <span style={{ fontSize: 11, fontWeight: 400, color: C.tl }}>(same on all devices)</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="e.g. mybaby2025"
            style={{
              flex: 1,
              background: C.cd,
              border: '1px solid ' + C.b,
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13,
              color: C.t,
              outline: 'none',
            }}
          />
          <button
            onClick={() => setKeyInput(generateSyncKey())}
            title="Generate random key"
            style={{
              background: C.cd, border: '1px solid ' + C.b,
              borderRadius: 12, padding: '0 14px', cursor: 'pointer',
              fontSize: 11, color: C.tl,
            }}
          >
            Random
          </button>
        </div>
      </div>

      {parseError && (
        <div style={{
          marginBottom: 10, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 11, color: C.w,
        }}>
          {parseError}
        </div>
      )}

      <Btn
        label={saving ? 'Connecting…' : 'Enable autosync'}
        onClick={handleSave}
        color={C.s}
        full
      />

      <div style={{ fontSize: 11, color: C.tl, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
        Your data syncs within your own Firebase project — no BabyBloom server involved.
      </div>
    </div>
  );
}
