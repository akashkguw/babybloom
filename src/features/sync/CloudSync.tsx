/**
 * BabyBloom Cloud Sync — Settings UI
 *
 * Simplified UX with minimal screens:
 *   main → google_auth (if needed) → back to main
 *   main → invite (email + QR in one screen) → back to main
 *   main → join (scan/paste in one screen) → google_auth → main
 *
 * Design §7 — Happy Path Flows
 */
import { useState, useEffect, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { Card as Cd, Button as Btn, Icon as Ic } from '@/components/shared';
import { toast } from '@/lib/utils/toast';
import QRCode from '@/features/sync/QRCode';
import QRScanner from '@/features/sync/QRScanner';
import {
  createFamilyKey,
  storeFamilyKey,
  loadFamilyKey,
  exportKeyAndFolderForQR,
  importKeyAndFolderFromQR,
} from '@/lib/sync/keyManager';
import {
  enableSync,
  disableSync,
  isSyncEnabled,
  triggerSync,
  onSyncStatus,
} from '@/lib/sync/syncEngine';
import {
  initiateGoogleSignIn,
  isAuthenticated,
  getOrCreateFolder,
  shareFolderWithPartner,
  setSharedFolderId,
  showFolderPicker,
  acceptSharedFolder,
} from '@/lib/sync/googleDrive';
import type { SyncStatus } from '@/lib/sync/types';
import {
  DB_KEY_MANIFEST_FILE_ID,
  DB_KEY_SHARED_FOLDER_ID,
  DB_KEY_SYNC_PENDING_FOLDER_ID,
} from '@/lib/sync/types';
import { dg, ds } from '@/lib/db';
import { Sentry } from '@/lib/sentry';

// ═══ TYPES ═══

type View = 'main' | 'google_auth' | 'invite' | 'join';

interface CloudSyncProps {
  onClose: () => void;
}

// ═══ HELPERS ═══

function formatLastSync(lastSyncAt?: string): string {
  if (!lastSyncAt) return 'Never';
  try {
    const ms = Date.now() - new Date(lastSyncAt).getTime();
    if (ms < 60_000) return 'Just now';
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} hr ago`;
    return new Date(lastSyncAt).toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}

function syncStateLabel(status: SyncStatus): string {
  switch (status.state) {
    case 'uploading':   return 'Uploading…';
    case 'downloading': return 'Downloading…';
    case 'merging':     return 'Merging data…';
    case 'applying':    return 'Applying changes…';
    case 'error':       return status.errorMessage || 'Sync error';
    default:            return status.lastSyncAt ? `Synced ${formatLastSync(status.lastSyncAt)}` : 'Ready';
  }
}

const DOT_COLOR: Record<string, string> = {
  idle:        '#22c55e',
  uploading:   '#f59e0b',
  downloading: '#f59e0b',
  merging:     '#f59e0b',
  applying:    '#f59e0b',
  error:       '#ef4444',
};

// QR auto-dismiss for security
const QR_DISMISS_SECONDS = 60;

// ═══ MAIN COMPONENT ═══

export default function CloudSync({ onClose }: CloudSyncProps) {
  const [view, setView] = useState<View>('main');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [googleAuthed, setGoogleAuthed] = useState(false);
  // Invite flow
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [familyKeyQR, setFamilyKeyQR] = useState('');
  const [qrCountdown, setQrCountdown] = useState(QR_DISMISS_SECONDS);
  const [bindingFolder, setBindingFolder] = useState(false);

  // Join flow
  const [showScanner, setShowScanner] = useState(false);
  const [pasteCode, setPasteCode] = useState('');

  // Partner data is "pending" only after at least one successful sync run
  // completes with zero detected partner devices.
  const partnerWaiting =
    syncEnabled &&
    googleAuthed &&
    !!syncStatus.lastSyncAt &&
    (syncStatus.deviceCount ?? 0) === 0;

  // With drive.file scope, partner-shared files can require explicit folder
  // selection (Google Picker) before this app can read/write them.
  const bindSharedFolder = useCallback(async (expectedFolderId?: string | null): Promise<boolean> => {
    setBindingFolder(true);
    try {
      const pickedFolderId = await showFolderPicker();
      if (!pickedFolderId) {
        toast('Folder selection cancelled. Select the shared BabyBloom Sync folder to finish setup.');
        return false;
      }

      const expected = expectedFolderId || await dg(DB_KEY_SHARED_FOLDER_ID) as string | null;
      if (expected && pickedFolderId !== expected) {
        toast('Wrong folder selected. Please choose the BabyBloom Sync folder shared by your partner.');
        return false;
      }

      await setSharedFolderId(pickedFolderId);
      await ds(DB_KEY_SYNC_PENDING_FOLDER_ID, null);
      return true;
    } catch (err: any) {
      toast('Could not open Google folder picker: ' + (err?.message || 'unknown'));
      return false;
    } finally {
      setBindingFolder(false);
    }
  }, []);

  // ── Load initial state ──
  useEffect(() => {
    Promise.all([isSyncEnabled(), isAuthenticated()]).then(([enabled, authed]) => {
      setSyncEnabled(enabled);
      setGoogleAuthed(authed);
      setLoading(false);
    });

    const unsub = onSyncStatus((status) => {
      setSyncStatus(status);
      setSyncing(status.state !== 'idle' && status.state !== 'error');
      if (status.state === 'error') {
        isAuthenticated().then((a) => setGoogleAuthed(a));
      }
    });

    const onOAuth = () => {
      isAuthenticated().then((authed) => {
        if (authed) {
          (async () => {
            setGoogleAuthed(true);
            setView('main');

            const pendingFolderId = await dg(DB_KEY_SYNC_PENDING_FOLDER_ID) as string | null;
            if (pendingFolderId) {
              try {
                await acceptSharedFolder(pendingFolderId);
                await ds(DB_KEY_SYNC_PENDING_FOLDER_ID, null);
              } catch {
                await disableSync(false);
                setSyncEnabled(false);
                toast('This Google account cannot access the shared sync folder. Sync was paused. Ask your partner to share to this email, then join again.');
                return;
              }
            }

            toast('Google Drive connected! Syncing now…');
            triggerSync('manual').catch(() => {});
          })();
        }
      });
    };
    window.addEventListener('babybloom:oauth', onOAuth);
    return () => { unsub(); window.removeEventListener('babybloom:oauth', onOAuth); };
  }, [bindSharedFolder]);

  // ── QR countdown (invite screen) ──
  useEffect(() => {
    if (!familyKeyQR) return;
    setQrCountdown(QR_DISMISS_SECONDS);
    const iv = setInterval(() => {
      setQrCountdown((n) => {
        if (n <= 1) { clearInterval(iv); setFamilyKeyQR(''); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [familyKeyQR]);

  // ── Enable sync (reuses existing family key if present) ──
  const handleEnable = useCallback(async () => {
    try {
      setLoading(true);
      let key = await loadFamilyKey();
      const hadKey = !!key;
      if (!key) { key = await createFamilyKey(); await storeFamilyKey(key); }
      await enableSync();
      setSyncEnabled(true);
      if (!googleAuthed) {
        setView('google_auth');
        toast(hadKey ? 'Sync re-enabled! Connect Google Drive.' : 'Sync enabled! Connect Google Drive.');
      } else {
        setView('main');
        toast(hadKey ? 'Sync re-enabled!' : 'Cloud sync enabled!');
        triggerSync('manual').catch(() => {});
      }
    } catch (err: any) {
      toast('Failed to enable sync: ' + (err?.message || 'unknown'));
      Sentry.captureException(err, { tags: { action: 'enable_sync' } });
    } finally {
      setLoading(false);
    }
  }, [googleAuthed]);

  // Ensure manifest file ID exists before generating share codes.
  // With drive.file scope, partner discovery depends on this ID.
  const ensureManifestFileId = useCallback(async (): Promise<string | undefined> => {
    let manifestFileId = (await dg(DB_KEY_MANIFEST_FILE_ID)) as string | undefined;
    if (manifestFileId) return manifestFileId;
    try {
      await triggerSync('manual');
    } catch {
      // Fall through — caller will handle missing manifest ID with user guidance.
    }
    manifestFileId = (await dg(DB_KEY_MANIFEST_FILE_ID)) as string | undefined;
    return manifestFileId || undefined;
  }, []);

  // ── Join partner (from QR or pasted code) ──
  const handleJoin = useCallback(async (qrData: string) => {
    setShowScanner(false);
    const result = await importKeyAndFolderFromQR(qrData);
    if (!result) { toast('Invalid sync code. Check and try again.'); return; }
    if (!result.folderId || !result.manifestFileId) {
      toast('This sync code is outdated. Ask your partner to tap Sync and share a new code.');
      return;
    }
    try {
      await storeFamilyKey(result.key);
      if (googleAuthed) {
        try {
          await acceptSharedFolder(result.folderId);
          await ds(DB_KEY_SYNC_PENDING_FOLDER_ID, null);
        } catch {
          toast('This Google account cannot access the shared sync folder. Ask your partner to share the folder to this email first.');
          return;
        }
      } else {
        await setSharedFolderId(result.folderId);
        await ds(DB_KEY_SYNC_PENDING_FOLDER_ID, result.folderId);
      }
      await ds(DB_KEY_MANIFEST_FILE_ID, result.manifestFileId);

      await enableSync();
      setSyncEnabled(true);
      if (!googleAuthed) {
        toast('Key imported! Sign in with Google.');
        setView('google_auth');
      } else {
        toast('Joined family sync. Tap Sync once on both phones.');
        setView('main');
        triggerSync('manual').catch(() => {});
      }
    } catch (err: any) {
      toast('Failed to join: ' + (err?.message || 'unknown'));
      Sentry.captureException(err, { tags: { action: 'join_sync' } });
    }
  }, [googleAuthed]);

  // ── Invite: share folder + generate QR ──
  const handleInvite = useCallback(async () => {
    if (!partnerEmail.trim() || !partnerEmail.includes('@')) {
      toast('Enter a valid email address.'); return;
    }
    try {
      setInviteLoading(true);
      const folderId = await getOrCreateFolder();
      await shareFolderWithPartner(partnerEmail.trim());
      const key = await loadFamilyKey();
      if (!key) { toast('Family key not found.'); return; }
      const manifestFileId = await ensureManifestFileId();
      if (!manifestFileId) {
        toast('Could not prepare sync code. Tap Sync once, then try Invite again.');
        return;
      }
      const qr = await exportKeyAndFolderForQR(key, folderId, manifestFileId || undefined);
      setFamilyKeyQR(qr);
      toast('Folder shared. Ask partner to scan code, sign in, then tap Sync once.');
    } catch (err: any) {
      toast('Failed: ' + (err?.message || 'unknown'));
      Sentry.captureException(err, { tags: { action: 'share_folder' } });
    } finally {
      setInviteLoading(false);
    }
  }, [partnerEmail, ensureManifestFileId]);

  // ── Show QR without re-sharing ──
  const handleShowQR = useCallback(async () => {
    try {
      const key = await loadFamilyKey();
      if (!key) { toast('Family key not found.'); return; }
      const folderId = await getOrCreateFolder();
      const manifestFileId = await ensureManifestFileId();
      if (!manifestFileId) {
        toast('Could not prepare sync code. Tap Sync once, then try again.');
        return;
      }
      setFamilyKeyQR(await exportKeyAndFolderForQR(key, folderId, manifestFileId || undefined));
    } catch (err: any) {
      toast('Failed: ' + (err?.message || 'unknown'));
    }
  }, [ensureManifestFileId]);

  // ── Google sign-in ──
  const handleGoogleAuth = useCallback(async () => {
    try {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;
      const popup = isStandalone ? null : window.open('', '_self');
      const url = await initiateGoogleSignIn();
      if (popup) { popup.location.href = url; } else { window.location.href = url; }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Client ID is not configured')) {
        toast('Google sign-in not configured.'); console.error(msg);
      } else {
        toast('Sign-in failed: ' + msg);
        Sentry.captureException(err, { tags: { action: 'oauth_initiate' } });
      }
    }
  }, []);

  const handleRelinkFolder = useCallback(async () => {
    const expectedFolderId = await dg(DB_KEY_SHARED_FOLDER_ID) as string | null;
    const bound = await bindSharedFolder(expectedFolderId);
    if (!bound) return;
    toast('Shared folder linked. Syncing now…');
    triggerSync('manual').catch(() => {});
  }, [bindSharedFolder]);

  // ── Disable sync ──
  const handleDisable = useCallback(async () => {
    if (!window.confirm('Disable cloud sync? Your local data will be kept.')) return;
    await disableSync(false);
    setSyncEnabled(false);
    toast('Cloud sync disabled.');
    setView('main');
  }, []);

  // ── Render ──
  if (loading) {
    return <Shell onClose={onClose}><div style={{ padding: 40, textAlign: 'center', color: C.tl }}>Loading…</div></Shell>;
  }

  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t, margin: 0 }}>
            {view === 'main' ? '☁️ Cloud Sync' : view === 'invite' ? '👥 Invite Partner' : view === 'join' ? '🔗 Join Family' : '🔑 Google Sign-In'}
          </h3>
          {view === 'main' && <div style={{ fontSize: 12, color: C.tl }}>End-to-end encrypted</div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Ic n="x" s={22} c={C.tl} />
        </button>
      </div>

      {/* ────────────────── MAIN ────────────────── */}
      {view === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sync status */}
          {syncEnabled && (
            <Cd style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: DOT_COLOR[syncStatus.state] || '#22c55e', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>
                    {syncStateLabel(syncStatus)}
                  </div>
                  {syncStatus.deviceCount != null && syncStatus.deviceCount > 0 && (
                    <div style={{ fontSize: 11, color: C.tl }}>
                      {syncStatus.deviceCount} partner device{syncStatus.deviceCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <Btn label={syncing ? '…' : 'Sync'} onClick={() => { if (!syncing) triggerSync('manual'); }} outline small />
              </div>
            </Cd>
          )}

          {/* Not connected banner */}
          {syncEnabled && !googleAuthed && (
            <button
              onClick={() => setView('google_auth')}
              style={{
                display: 'block', width: '100%', padding: '12px 14px', borderRadius: 10,
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                fontSize: 12, color: '#1d4ed8', lineHeight: 1.6, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <strong>Google Drive not connected.</strong> Tap to sign in and start syncing.
            </button>
          )}

          {/* Setup checklist */}
          {syncEnabled && (
            <Cd style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t, marginBottom: 6 }}>
                First-time setup checklist
              </div>
              <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.6 }}>
                1. On one phone: use <strong>Invite Partner</strong> to share the folder by email.
              </div>
              <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.6 }}>
                2. On the other phone: use <strong>Join Family</strong> with the QR/code.
              </div>
              <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.6 }}>
                3. Both parents sign in with Google.
              </div>
              <div style={{ fontSize: 11, color: C.tl, lineHeight: 1.6 }}>
                4. Tap <strong>Sync</strong> on both phones once.
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: '#2563eb' }}>
                Cross-account sync requires folder sharing one time.
              </div>
              {googleAuthed && (
                <button
                  onClick={handleRelinkFolder}
                  disabled={bindingFolder}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    cursor: bindingFolder ? 'default' : 'pointer',
                    fontSize: 11,
                    color: '#2563eb',
                    fontWeight: 600,
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  {bindingFolder ? 'Linking shared folder…' : 'Re-link shared folder'}
                </button>
              )}
            </Cd>
          )}

          {/* Partner-pending status */}
          {partnerWaiting && (
            <div
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.3)',
                fontSize: 12,
                color: '#1d4ed8',
                lineHeight: 1.6,
              }}
            >
              <strong>Waiting for partner data.</strong> Confirm folder share is done, both devices are signed in, and each parent taps Sync once.
            </div>
          )}

          {/* Not yet enabled */}
          {!syncEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.7 }}>
                Encrypted backup to Google Drive. Both parents can sync and see the same data in real time.
              </div>
              <Btn label="Enable Cloud Sync" onClick={handleEnable} color={C.s} full />
              <button
                onClick={() => setView('join')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: C.tl, padding: '6px 0', textAlign: 'center',
                }}
              >
                Already have a partner code? <span style={{ color: '#3b82f6', fontWeight: 600 }}>Join their sync</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Btn label="Invite Partner" onClick={() => { setPartnerEmail(''); setFamilyKeyQR(''); setView('invite'); }} color={C.a} full />
              <Btn label="Disable Sync" onClick={handleDisable} outline full />
            </div>
          )}

          {/* Privacy */}
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(34,197,94,0.06)', fontSize: 10, color: C.tl, lineHeight: 1.5,
          }}>
            🔒 Zero-knowledge — your data is encrypted before leaving the device. Google never sees it.
          </div>
        </div>
      )}

      {/* ────────────────── INVITE ────────────────── */}
      {view === 'invite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* If QR is already generated, show it */}
          {familyKeyQR ? (
            <>
              <div style={{
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
                fontSize: 11, color: '#d97706', lineHeight: 1.5,
              }}>
                Show this to your partner only. Auto-hides in {qrCountdown}s.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', borderRadius: 16, padding: 20 }}>
                <QRCode data={familyKeyQR} size={200} />
                <div style={{ fontSize: 10, color: '#888', marginTop: 8 }}>Partner scans this to join</div>
              </div>
              <Btn
                label="Copy code instead"
                onClick={() => {
                  navigator.clipboard.writeText(familyKeyQR).then(() => toast('Code copied!'));
                }}
                outline full
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
                Enter your partner's Google email to share the sync folder, then show them the QR code.
              </div>
              <input
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="partner@gmail.com"
                style={{
                  background: C.cd, border: '1px solid ' + C.b,
                  borderRadius: 12, padding: '10px 14px', fontSize: 14, color: C.t,
                  width: '100%', boxSizing: 'border-box',
                }}
              />
              <Btn
                label={inviteLoading ? 'Sharing…' : 'Share & Generate Code'}
                onClick={handleInvite}
                color={C.s} full
              />
              <button
                onClick={handleShowQR}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: '#3b82f6', padding: '4px 0', textAlign: 'center',
                }}
              >
                Already shared? Show code only
              </button>
            </>
          )}
          <Btn label="← Back" onClick={() => { setFamilyKeyQR(''); setView('main'); }} outline />
        </div>
      )}

      {/* ────────────────── JOIN ────────────────── */}
      {view === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
            Ask your partner to go to Cloud Sync → Invite Partner, then scan or paste the code below.
            Cross-account sync works only after your partner shares the BabyBloom Sync folder (one-time).
          </div>

          {/* QR scanner */}
          {showScanner ? (
            <QRScanner onScan={handleJoin} onClose={() => setShowScanner(false)} />
          ) : (
            <Btn label="Scan QR Code" onClick={() => setShowScanner(true)} color={C.s} full />
          )}

          {/* Divider */}
          {!showScanner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: C.b }} />
              <span style={{ fontSize: 11, color: C.tl }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.b }} />
            </div>
          )}

          {/* Paste code */}
          {!showScanner && (
            <>
              <textarea
                value={pasteCode}
                onChange={(e) => setPasteCode(e.target.value)}
                placeholder="Paste sync code here (BK2:…)"
                rows={3}
                style={{
                  background: C.cd, border: '1px solid ' + C.b, borderRadius: 12,
                  padding: '10px 14px', fontSize: 13, color: C.t,
                  width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'monospace',
                }}
              />
              <Btn
                label="Join"
                onClick={() => { if (pasteCode.trim()) handleJoin(pasteCode.trim()); }}
                color={C.s} full
              />
            </>
          )}

          <Btn label="← Back" onClick={() => { setShowScanner(false); setPasteCode(''); setView('main'); }} outline />
        </div>
      )}

      {/* ────────────────── GOOGLE AUTH ────────────────── */}
      {view === 'google_auth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
            Your encrypted data is stored in <strong>your own</strong> Google Drive. BabyBloom can't read it.
            <br />
            For partner sync, one parent must share the BabyBloom Sync folder one time via Invite Partner.
          </div>
          <Btn label="Sign in with Google" onClick={handleGoogleAuth} color={C.s} full />
          <div style={{ fontSize: 11, color: C.tl, textAlign: 'center' }}>
            You'll be redirected to Google, then back here automatically.
          </div>
          <Btn label="← Back" onClick={() => setView('main')} outline />
        </div>
      )}

    </Shell>
  );
}

// ═══ SHELL ═══

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 500, margin: '0 auto',
        background: C.bg, borderRadius: '20px 20px 0 0',
        padding: '20px 16px 40px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  );
}
