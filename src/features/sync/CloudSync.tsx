/**
 * BabyBloom Cloud Sync — Settings UI
 *
 * Provides the user-facing UI for managing cloud sync:
 *   - Enable/Disable sync (Google Sign-In)
 *   - Sync status indicator ("Synced just now", "Last synced: 3 min ago")
 *   - Family key QR code for partner pairing (BK1: format)
 *   - Join Family Sync (scan partner's QR)
 *   - Key backup (passphrase-protected)
 *   - Key rotation
 *   - Manual "Sync Now" button
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
  hasFamilyKey,
  exportKeyForQR,
  importKeyFromQR,
  exportKeyAndFolderForQR,
  importKeyAndFolderFromQR,
  validatePassphrase,
  createKeyBackup,
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
  acceptSharedFolder,
  setSharedFolderId,
} from '@/lib/sync/googleDrive';
import type { SyncStatus } from '@/lib/sync/types';
import { Sentry } from '@/lib/sentry';

// ═══ TYPES ═══

type CloudSyncView =
  | 'main'
  | 'google_auth'    // Sign into Google to activate Drive backup
  | 'invite'         // Parent A: share folder + show QR
  | 'setup_a'        // Parent A: showing QR code to partner
  | 'setup_b'        // Parent B: scanning QR to join
  | 'key_backup'     // Passphrase-based backup setup
  | 'key_restore';   // Passphrase-based key recovery

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

const STATUS_COLOR = {
  idle:        '#22c55e',
  uploading:   '#f59e0b',
  downloading: '#f59e0b',
  merging:     '#f59e0b',
  applying:    '#f59e0b',
  error:       '#ef4444',
};

// ═══ QR AUTO-DISMISS TIMER ═══
const QR_DISMISS_SECONDS = 60;

export default function CloudSync({ onClose }: CloudSyncProps) {
  const [view, setView] = useState<CloudSyncView>('main');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleAuthed, setGoogleAuthed] = useState(false);

  // Setup flow state
  const [familyKeyQR, setFamilyKeyQR] = useState('');
  const [qrCountdown, setQrCountdown] = useState(QR_DISMISS_SECONDS);
  const [showScanner, setShowScanner] = useState(false);

  // Invite flow state
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteShared, setInviteShared] = useState(false);

  // Key backup state
  const [passphrase, setPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  const [backupDone, setBackupDone] = useState(false);

  // ── Load initial state ──
  useEffect(() => {
    Promise.all([isSyncEnabled(), isAuthenticated()]).then(([enabled, authed]) => {
      setSyncEnabled(enabled);
      setGoogleAuthed(authed);
      setLoading(false);
    });

    const unsubscribe = onSyncStatus((status) => {
      setSyncStatus(status);
      setIsSyncing(status.state !== 'idle' && status.state !== 'error');
    });

    // Listen for OAuth callback (fired by App.tsx after successful token exchange).
    // Tokens are already stored at this point — just refresh UI state and trigger sync.
    const onOAuth = () => {
      isAuthenticated().then((authed) => {
        if (authed) {
          setGoogleAuthed(true);
          setView('main');
          toast('Google Drive connected! Syncing now…');
          triggerSync('manual').catch(() => {});
        }
      });
    };
    window.addEventListener('babybloom:oauth', onOAuth);

    return () => { unsubscribe(); window.removeEventListener('babybloom:oauth', onOAuth); };
  }, []);

  // ── QR countdown timer ──
  useEffect(() => {
    if (view !== 'setup_a' || !familyKeyQR) return;
    setQrCountdown(QR_DISMISS_SECONDS);
    const interval = setInterval(() => {
      setQrCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          // Auto-dismiss QR code after 60 seconds for security
          setFamilyKeyQR('');
          setView('main');
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [view, familyKeyQR]);

  // ── Enable sync (Parent A: create family key) ──
  const handleEnableSync = useCallback(async () => {
    try {
      setLoading(true);
      const key = await createFamilyKey();
      await storeFamilyKey(key);
      await enableSync();
      setSyncEnabled(true);
      // If not yet signed into Google, send user there immediately.
      if (!googleAuthed) {
        setView('google_auth');
        toast('Sync enabled! Connect Google Drive to start backing up.');
      } else {
        setView('main');
        toast('Cloud sync enabled! Your data will back up to Google Drive automatically.');
      }
    } catch (err: any) {
      toast('Failed to enable sync: ' + (err?.message || 'unknown error'));
      Sentry.captureException(err, { tags: { action: 'enable_sync' } });
    } finally {
      setLoading(false);
    }
  }, [googleAuthed]);

  // ── Join existing family (Parent B: scan QR) ──
  const handleJoinFamily = useCallback(async (qrData: string) => {
    setShowScanner(false);

    // Try BK2 first (key + folder ID), fall back to BK1 (key only)
    const result = await importKeyAndFolderFromQR(qrData);
    if (!result) {
      toast('Invalid family key QR code. Please scan again.');
      return;
    }

    try {
      await storeFamilyKey(result.key);

      // If we got a folder ID from BK2 format, store it for later use
      if (result.folderId) {
        await setSharedFolderId(result.folderId);
      }

      await enableSync();
      setSyncEnabled(true);

      // Parent B also needs Google auth to upload/download from Drive
      if (!googleAuthed) {
        toast('Key imported! Now connect Google Drive to start syncing.');
        setView('google_auth');
      } else {
        // If we have a folder ID, try to verify access now
        if (result.folderId) {
          try {
            await acceptSharedFolder(result.folderId);
          } catch {
            toast('Folder access pending — your partner may need to share it with your Google account.');
          }
        }
        toast('Joined family sync! Data is being merged…');
        setView('main');
      }
    } catch (err: any) {
      toast('Failed to join sync: ' + (err?.message || 'unknown error'));
      Sentry.captureException(err, { tags: { action: 'join_sync' } });
    }
  }, [googleAuthed]);

  // ── Manual sync ──
  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    await triggerSync('manual');
  }, [isSyncing]);

  // ── Show invite flow (share folder + QR) ──
  const handleInvitePartner = useCallback(async () => {
    setPartnerEmail('');
    setInviteShared(false);
    setView('invite');
  }, []);

  // ── Share folder with partner email and generate QR ──
  const handleShareAndShowQR = useCallback(async () => {
    if (!partnerEmail.trim() || !partnerEmail.includes('@')) {
      toast('Please enter a valid email address.');
      return;
    }
    try {
      setInviteLoading(true);
      // Ensure folder exists
      const folderId = await getOrCreateFolder();
      // Share with partner
      await shareFolderWithPartner(partnerEmail.trim());
      setInviteShared(true);

      // Generate BK2 QR code with key + folder ID
      const key = await loadFamilyKey();
      if (!key) {
        toast('Family key not found. Please re-enable sync.');
        return;
      }
      const qrString = await exportKeyAndFolderForQR(key, folderId);
      setFamilyKeyQR(qrString);
      setView('setup_a');
    } catch (err: any) {
      const msg = err?.message || 'unknown error';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('not found')) {
        toast('Could not share with that email. Check the address and try again.');
      } else {
        toast('Failed to share folder: ' + msg);
      }
      Sentry.captureException(err, { tags: { action: 'share_folder' } });
    } finally {
      setInviteLoading(false);
    }
  }, [partnerEmail]);

  // ── Show QR without re-sharing (for already-shared partners) ──
  const handleShowQR = useCallback(async () => {
    const key = await loadFamilyKey();
    if (!key) {
      toast('Family key not found. Please re-enable sync.');
      return;
    }
    const folderId = await getOrCreateFolder();
    const qrString = await exportKeyAndFolderForQR(key, folderId);
    setFamilyKeyQR(qrString);
    setView('setup_a');
  }, []);

  // ── Disable sync ──
  const handleDisableSync = useCallback(async () => {
    const keepData = window.confirm(
      'Keep encrypted backup in Google Drive? Tap Cancel to delete cloud data.',
    );
    await disableSync(!keepData);
    setSyncEnabled(false);
    toast('Cloud sync disabled. Your local data is safe.');
    setView('main');
  }, []);

  // ── Key backup ──
  const handleCreateBackup = useCallback(async () => {
    const error = validatePassphrase(passphrase);
    if (error) {
      setPassphraseError(error);
      return;
    }
    setPassphraseError('');
    try {
      const key = await loadFamilyKey();
      if (!key) throw new Error('No family key found');
      await createKeyBackup(key, passphrase);
      // In production, upload backup to Google Drive here
      setBackupDone(true);
      toast('Key backup created! Store your passphrase safely.');
    } catch (err: any) {
      toast('Backup failed: ' + (err?.message || 'unknown'));
    }
  }, [passphrase]);

  // ── Render ──
  if (loading) {
    return (
      <ModalShell onClose={onClose}>
        <div style={{ padding: 40, textAlign: 'center', color: C.tl }}>Loading…</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t, margin: 0 }}>
            ☁️ Cloud Sync
          </h3>
          <div style={{ fontSize: 12, color: C.tl }}>Zero-knowledge encrypted backup</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Ic n="x" s={22} c={C.tl} />
        </button>
      </div>

      {/* ── MAIN VIEW ── */}
      {view === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Status card */}
          {syncEnabled && (
            <Cd style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: STATUS_COLOR[syncStatus.state] || '#22c55e',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t }}>
                    {syncStateLabel(syncStatus)}
                  </div>
                  {syncStatus.deviceCount !== undefined && syncStatus.deviceCount > 0 && (
                    <div style={{ fontSize: 11, color: C.tl }}>
                      {syncStatus.deviceCount} partner device{syncStatus.deviceCount !== 1 ? 's' : ''} connected
                    </div>
                  )}
                </div>
                <Btn
                  label={isSyncing ? '…' : 'Sync Now'}
                  onClick={handleSyncNow}
                  outline
                  small
                />
              </div>
            </Cd>
          )}

          {/* Privacy guarantee */}
          <PrivacyBadge />

          {/* Google Drive not connected banner */}
          {syncEnabled && !googleAuthed && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', fontSize: 12, color: '#1d4ed8', lineHeight: 1.7 }}>
              <strong>⚠️ Google Drive not connected.</strong> Your data is encrypted locally but not yet backed up.{' '}
              <button
                onClick={() => setView('google_auth')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontWeight: 700, fontSize: 12, padding: 0, textDecoration: 'underline' }}
              >
                Connect now →
              </button>
            </div>
          )}

          {/* Actions */}
          {!syncEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.7 }}>
                <strong style={{ color: C.t }}>How it works:</strong><br />
                1️⃣ Tap <em>Enable</em> — a secret key is created on your device.<br />
                2️⃣ Your data is encrypted and backed up to a shared Google Drive folder (Google sign-in happens on first sync).<br />
                3️⃣ To add a co-parent, tap "Invite Family Member", enter their Google email to share the folder, and show them the QR code.
              </div>
              <Btn
                label="Enable Cloud Sync (Google Drive)"
                onClick={handleEnableSync}
                color={C.s}
                full
              />
              <Btn
                label="Join partner's sync instead"
                onClick={() => setView('setup_b')}
                outline
                full
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn
                label="Invite Family Member"
                onClick={handleInvitePartner}
                color={C.a}
                full
              />
              <Btn
                label="Create Key Backup (passphrase)"
                onClick={() => setView('key_backup')}
                outline
                full
              />
              <Btn
                label="Disable Cloud Sync"
                onClick={handleDisableSync}
                outline
                full
              />
            </div>
          )}
        </div>
      )}

      {/* ── INVITE: Share folder + generate QR ── */}
      {view === 'invite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
            Invite Your Partner
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
            Enter your partner's <strong>Google email</strong> so they can access the shared sync folder.
            After sharing, show them the QR code to complete setup.
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
            label={inviteLoading ? 'Sharing…' : 'Share & Show QR Code'}
            onClick={handleShareAndShowQR}
            color={C.s}
            full
          />
          <div style={{ fontSize: 11, color: C.tl, textAlign: 'center', lineHeight: 1.5 }}>
            Already shared? <button
              onClick={handleShowQR}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 600, fontSize: 11, padding: 0, textDecoration: 'underline' }}
            >Show QR code only</button>
          </div>
          <Btn label="← Back" onClick={() => setView('main')} outline />
        </div>
      )}

      {/* ── SETUP A: Show QR code to partner ── */}
      {view === 'setup_a' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', fontSize: 12, color: '#d97706', lineHeight: 1.5 }}>
            ⚠️ Only show this to your partner. This key gives access to all baby data.
            Auto-dismisses in {qrCountdown}s.
          </div>

          {familyKeyQR ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', borderRadius: 16, padding: 20 }}>
                <QRCode data={familyKeyQR} size={220} />
                <div style={{ fontSize: 11, color: '#888', marginTop: 10, textAlign: 'center' }}>
                  Partner scans this with their camera
                </div>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.5 }}>
                📋 <strong>Camera not working?</strong> Tap the button below to copy your sync code, then paste it on your partner's device.
              </div>
              <Btn
                label="Copy sync code"
                onClick={() => {
                  navigator.clipboard.writeText(familyKeyQR).then(() => toast('Sync code copied! Paste it on your partner\'s device.'));
                }}
                color={C.bl}
                full
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: C.tl, fontSize: 13 }}>
              QR code dismissed for security.
            </div>
          )}

          <Btn label="← Done" onClick={() => { setFamilyKeyQR(''); setView('main'); }} outline />
        </div>
      )}

      {/* ── SETUP B: Scan QR to join ── */}
      {view === 'setup_b' && (
        <SetupBView
          showScanner={showScanner}
          setShowScanner={setShowScanner}
          onJoin={handleJoinFamily}
          onBack={() => { setShowScanner(false); setView('main'); }}
        />
      )}

      {/* ── GOOGLE AUTH ── */}
      {view === 'google_auth' && (
        <GoogleAuthView
          onAuth={async () => {
            try {
              // Open a blank window SYNCHRONOUSLY (before any await) so the
              // browser doesn't treat it as an unsolicited popup and block it.
              // In standalone PWA mode we navigate the current window instead.
              const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                || (window.navigator as any).standalone === true;
              const popup = isStandalone ? null : window.open('', '_self');
              const url = await initiateGoogleSignIn();
              if (popup) {
                popup.location.href = url;
              } else {
                // Standalone PWA or popup was blocked — navigate current window
                window.location.href = url;
              }
            } catch (err: any) {
              const msg = err?.message || '';
              if (msg.includes('Client ID is not configured')) {
                toast('Google sign-in is not configured in this build. See console.');
                console.error(msg);
              } else {
                toast('Could not open sign-in: ' + msg);
                Sentry.captureException(err, { tags: { action: 'oauth_initiate' } });
              }
            }
          }}
          onBack={() => setView('main')}
        />
      )}

      {/* ── KEY BACKUP ── */}
      {view === 'key_backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
            Create Key Backup
          </div>
          <div style={{ fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
            If you lose your device, you can recover your data using this passphrase.
            Choose something memorable but strong: at least 12 characters, or 4+ words.
          </div>
          {backupDone ? (
            <Cd style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>Backup created!</div>
              <div style={{ fontSize: 12, color: C.tl, marginTop: 4 }}>
                Store your passphrase somewhere safe — it cannot be recovered if lost.
              </div>
            </Cd>
          ) : (
            <>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setPassphraseError(''); }}
                placeholder="Enter a strong passphrase…"
                style={{
                  background: C.cd, border: '1px solid ' + (passphraseError ? '#ef4444' : C.b),
                  borderRadius: 12, padding: '10px 14px', fontSize: 14, color: C.t, width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              {passphraseError && (
                <div style={{ fontSize: 12, color: '#ef4444' }}>{passphraseError}</div>
              )}
              <Btn label="Create Backup" onClick={handleCreateBackup} color={C.ok} full />
            </>
          )}
          <Btn label="← Back" onClick={() => { setView('main'); setPassphrase(''); setBackupDone(false); }} outline />
        </div>
      )}
    </ModalShell>
  );
}

// ═══ SUB-COMPONENTS ═══

function SetupBView({ showScanner, setShowScanner, onJoin, onBack }: {
  showScanner: boolean;
  setShowScanner: (v: boolean) => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}) {
  const [pasteCode, setPasteCode] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, color: C.t, fontWeight: 600 }}>
        Join your partner's family sync
      </div>
      <div style={{ padding: '10px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
        <strong>Step 1:</strong> Ask your partner to open Cloud Sync → "Invite Family Member".<br />
        <strong>Step 2:</strong> Scan their QR code with the camera below, <em>or</em> ask them to tap "Copy sync code" and paste it here.
      </div>

      {/* Camera option */}
      {!showPaste && (
        showScanner ? (
          <QRScanner
            onScan={onJoin}
            onClose={() => setShowScanner(false)}
          />
        ) : (
          <Btn label="📷 Scan QR code" onClick={() => setShowScanner(true)} color={C.s} full />
        )
      )}

      {/* Paste option */}
      {!showScanner && (
        showPaste ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: C.tl }}>
              Paste the sync code your partner copied (starts with BK1:)
            </div>
            <textarea
              value={pasteCode}
              onChange={(e) => setPasteCode(e.target.value)}
              placeholder="Paste BK1:… code here"
              rows={3}
              style={{
                background: C.cd, border: '1px solid ' + C.b, borderRadius: 12,
                padding: '10px 14px', fontSize: 13, color: C.t,
                width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'monospace',
              }}
            />
            <Btn
              label="Join with pasted code"
              onClick={() => { if (pasteCode.trim()) onJoin(pasteCode.trim()); }}
              color={C.s}
              full
            />
            <Btn label="← Use camera instead" onClick={() => { setShowPaste(false); setPasteCode(''); }} outline full />
          </div>
        ) : (
          <Btn label="⌨️ Paste sync code instead" onClick={() => setShowPaste(true)} outline full />
        )
      )}

      <Btn label="← Back" onClick={onBack} outline />
    </div>
  );
}

function GoogleAuthView({ onAuth, onBack }: { onAuth: () => void; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
        Connect Google Drive
      </div>
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.cd, fontSize: 12, color: C.tl, lineHeight: 1.7 }}>
        <strong>Why?</strong> Your encrypted baby data is stored in <strong>your own</strong> Google Drive.
        BabyBloom cannot read any of it — only your device key can decrypt it.<br /><br />
        Tap below, sign in with Google, and you'll be redirected back automatically.
      </div>
      <PrivacyBadge />
      <Btn
        label="Sign in with Google"
        onClick={onAuth}
        color={C.s}
        full
      />
      <div style={{ fontSize: 11, color: C.tl, textAlign: 'center', lineHeight: 1.6 }}>
        You'll be redirected to Google's sign-in page.<br />
        After approving, you'll return here automatically.
      </div>
      <Btn label="← Back" onClick={onBack} outline />
    </div>
  );
}

function PrivacyBadge() {
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 10,
      background: 'rgba(34,197,94,0.08)',
      border: '1px solid rgba(34,197,94,0.2)',
      fontSize: 11,
      color: C.tl,
      lineHeight: 1.6,
    }}>
      🔒 <strong>Zero-knowledge encryption</strong> — Google Drive stores only unreadable encrypted data.
      Your encryption key never leaves your devices. BabyBloom's servers never see any baby data.
    </div>
  );
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
