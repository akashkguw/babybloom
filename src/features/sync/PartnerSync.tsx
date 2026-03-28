/**
 * Partner Sync
 * Privacy-first sync between two devices using QR codes.
 *
 * Flow:
 * 1. Device A: "Share" → generates a compressed JSON blob → encodes as QR code
 * 2. Device B: "Receive" → scans QR / pastes share code → merges data
 *
 * No server, no accounts, no network. Just data encoded directly in the QR.
 * For large datasets, we chunk into today's data only (last 24h) to keep
 * the QR scannable. Full sync uses copy/paste of the compressed string.
 */
import { useState, useRef, useCallback } from 'react';
import { C } from '@/lib/constants/colors';
import { Card as Cd, Button as Btn, Icon as Ic } from '@/components/shared';
import { toast } from '@/lib/utils/toast';
import { today } from '@/lib/utils/date';
import QRCode from '@/features/sync/QRCode';
import QRScanner from '@/features/sync/QRScanner';

interface LogEntry {
  id: number;
  date: string;
  time: string;
  type: string;
  mins?: number;
  oz?: number;
  amount?: string;
  notes?: string;
}

interface Logs {
  feed?: LogEntry[];
  diaper?: LogEntry[];
  sleep?: LogEntry[];
  growth?: LogEntry[];
  temp?: LogEntry[];
  bath?: LogEntry[];
  massage?: LogEntry[];
  meds?: LogEntry[];
  allergy?: LogEntry[];
  [key: string]: LogEntry[] | undefined;
}

interface PartnerSyncProps {
  logs: Logs;
  setLogs: (logs: Logs) => void;
  babyName: string;
  birth: string | null;
  onClose: () => void;
}

interface SyncPayload {
  v: 1;
  ts: number;
  name: string;
  birth: string | null;
  mode: 'today' | 'full';
  logs: Logs;
}

/**
 * Simple compression: base64 encode the JSON.
 * For a real app you'd use lz-string or similar,
 * but this keeps it dependency-free.
 */
function encode(payload: SyncPayload): string {
  const json = JSON.stringify(payload);
  try {
    // Use TextEncoder for proper UTF-8 handling
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return 'BB1:' + btoa(binary);
  } catch {
    return 'BB1:' + btoa(unescape(encodeURIComponent(json)));
  }
}

function decode(str: string): SyncPayload | null {
  try {
    // Clean up pasted input: strip whitespace, quotes, invisible chars
    let cleaned = str.trim().replace(/^["'""''`]+|["'""''`]+$/g, '');
    // Normalize unicode that messaging apps inject:
    // full-width colon ： → :, smart quotes, zero-width chars, etc.
    cleaned = cleaned.replace(/\u{FF1A}/gu, ':');  // full-width colon
    cleaned = cleaned.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, ''); // zero-width chars

    // If the pasted text contains BB1: somewhere (e.g. "Sync code: BB1:abc..."), extract it
    // Case-insensitive match handles "bb1:", "Bb1:", etc.
    const bb1Match = cleaned.match(/bb1\s*[:：]\s*/i);
    if (bb1Match) {
      cleaned = cleaned.slice(bb1Match.index! + bb1Match[0].length).trim();
    }
    // Strip ALL non-base64 characters (handles remaining invisible unicode,
    // newlines from word-wrap, RTL marks, soft hyphens, BOM, etc.)
    cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
    const raw = cleaned;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json);
    if (payload.v !== 1) return null;
    return payload as SyncPayload;
  } catch {
    return null;
  }
}

function filterToday(logs: Logs): Logs {
  const td = today();
  const filtered: Logs = {};
  for (const [cat, entries] of Object.entries(logs)) {
    if (Array.isArray(entries)) {
      filtered[cat] = entries.filter((e) => e.date === td);
    }
  }
  return filtered;
}

function mergeLogs(existing: Logs, incoming: Logs): Logs {
  const merged: Logs = { ...existing };
  for (const [cat, entries] of Object.entries(incoming)) {
    if (!Array.isArray(entries)) continue;
    const current = (merged[cat] || []) as LogEntry[];
    const currentIds = new Set(current.map((e) => e.id));
    // Deduplicate by ID, then by date+time+type
    const currentKeys = new Set(current.map((e) => e.date + '|' + e.time + '|' + e.type));
    const newEntries = entries.filter(
      (e) => !currentIds.has(e.id) && !currentKeys.has(e.date + '|' + e.time + '|' + e.type)
    );
    if (newEntries.length > 0) {
      merged[cat] = [...newEntries, ...current].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });
    }
  }
  return merged;
}

export default function PartnerSync({ logs, setLogs, babyName, birth, onClose }: PartnerSyncProps) {
  const [mode, setMode] = useState<'menu' | 'share' | 'receive'>('menu');
  const [shareCode, setShareCode] = useState<string>('');
  const [receiveCode, setReceiveCode] = useState<string>('');
  const [shareMode, setShareMode] = useState<'today' | 'full'>('today');
  const [mergePreview, setMergePreview] = useState<{ incoming: SyncPayload; newCount: number } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showTextCode, setShowTextCode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generateCode = useCallback(() => {
    const payload: SyncPayload = {
      v: 1,
      ts: Date.now(),
      name: babyName,
      birth,
      mode: shareMode,
      logs: shareMode === 'today' ? filterToday(logs) : logs,
    };
    const code = encode(payload);
    setShareCode(code);
  }, [logs, babyName, birth, shareMode]);

  const copyToClipboard = useCallback(() => {
    if (!shareCode) return;
    navigator.clipboard.writeText(shareCode).then(() => {
      toast('Sync code copied!');
    }).catch(() => {
      // Fallback: select the textarea
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        toast('Sync code copied!');
      }
    });
  }, [shareCode]);

  const handleReceive = useCallback(() => {
    const payload = decode(receiveCode.trim());
    if (!payload) {
      toast('Invalid sync code');
      return;
    }
    // Count new entries that would be added
    let newCount = 0;
    for (const [cat, entries] of Object.entries(payload.logs)) {
      if (!Array.isArray(entries)) continue;
      const current = (logs[cat] || []) as LogEntry[];
      const currentIds = new Set(current.map((e) => e.id));
      const currentKeys = new Set(current.map((e) => e.date + '|' + e.time + '|' + e.type));
      newCount += entries.filter(
        (e) => !currentIds.has(e.id) && !currentKeys.has(e.date + '|' + e.time + '|' + e.type)
      ).length;
    }
    setMergePreview({ incoming: payload, newCount });
  }, [receiveCode, logs]);

  const confirmMerge = useCallback(() => {
    if (!mergePreview) return;
    const merged = mergeLogs(logs, mergePreview.incoming.logs);
    setLogs(merged);
    toast(mergePreview.newCount + ' entries synced!');
    setMergePreview(null);
    setReceiveCode('');
    setMode('menu');
  }, [mergePreview, logs, setLogs]);

  const todayEntryCount = Object.values(filterToday(logs)).reduce(
    (sum, arr) => sum + (arr?.length || 0), 0
  );
  const totalEntryCount = Object.values(logs).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          margin: '0 auto',
          background: C.bg,
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 40px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t, margin: 0 }}>
              Partner Sync
            </h3>
            <div style={{ fontSize: 12, color: C.tl }}>
              No accounts needed · Data stays on your devices
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Ic n="x" s={22} c={C.tl} />
          </button>
        </div>

        {mode === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Cd
              onClick={() => { setMode('share'); generateCode(); }}
              style={{ padding: 16, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>📤</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>Share data</div>
                  <div style={{ fontSize: 12, color: C.tl }}>
                    Show a QR code for your partner to scan
                  </div>
                </div>
              </div>
            </Cd>

            <Cd
              onClick={() => setMode('receive')}
              style={{ padding: 16, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>📥</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>Receive data</div>
                  <div style={{ fontSize: 12, color: C.tl }}>
                    Scan a QR code or paste a code from your partner
                  </div>
                </div>
              </div>
            </Cd>

            <div style={{ padding: '12px 0', fontSize: 11, color: C.tl, textAlign: 'center', lineHeight: 1.5 }}>
              How it works: One device shows a QR code, the other scans it.
              Entries are merged without duplicates. No internet required.
            </div>
          </div>
        )}

        {mode === 'share' && (
          <div>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {([
                { key: 'today' as const, label: 'Today only', count: todayEntryCount },
                { key: 'full' as const, label: 'All data', count: totalEntryCount },
              ]).map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => { setShareMode(opt.key); }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: shareMode === opt.key ? C.sl : C.cd,
                    border: '1px solid ' + (shareMode === opt.key ? C.s : C.b),
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: shareMode === opt.key ? C.s : C.t }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 10, color: C.tl }}>{opt.count} entries</div>
                </div>
              ))}
            </div>

            <Btn label="Generate QR code" onClick={generateCode} color={C.s} full />

            {shareCode && (
              <div style={{ marginTop: 12 }}>
                {/* QR Code display */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: '#fff', borderRadius: 16, padding: 20, marginBottom: 10,
                }}>
                  <QRCode data={shareCode} size={220} />
                  <div style={{ fontSize: 11, color: '#888', marginTop: 10, textAlign: 'center' }}>
                    Your partner scans this QR code to sync
                  </div>
                </div>

                {/* Text fallback (collapsed by default) */}
                {!showTextCode ? (
                  <div
                    onClick={() => setShowTextCode(true)}
                    style={{ textAlign: 'center', cursor: 'pointer', padding: '6px 0' }}
                  >
                    <span style={{ fontSize: 12, color: C.tl }}>
                      Can't scan? Tap to show text code
                    </span>
                  </div>
                ) : (
                  <div>
                    <textarea
                      ref={textareaRef}
                      readOnly
                      value={shareCode}
                      style={{
                        width: '100%',
                        height: 80,
                        background: C.cd,
                        border: '1px solid ' + C.b,
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: C.t,
                        resize: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <Btn label="Copy code" onClick={copyToClipboard} color={C.a} full />
                    </div>
                    <div style={{ fontSize: 11, color: C.tl, marginTop: 6, textAlign: 'center' }}>
                      Send this code to your partner via any messaging app.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Btn label="← Back" onClick={() => { setMode('menu'); setShareCode(''); setShowTextCode(false); }} outline />
            </div>
          </div>
        )}

        {mode === 'receive' && (
          <div>
            {/* QR Scanner (primary) */}
            {showScanner ? (
              <div style={{ marginBottom: 12 }}>
                <QRScanner
                  onScan={(data) => {
                    setShowScanner(false);
                    setReceiveCode(data);
                    // Auto-trigger preview
                    const payload = decode(data.trim());
                    if (!payload) {
                      toast('Invalid QR code — try scanning again or paste the code');
                      return;
                    }
                    let newCount = 0;
                    for (const [cat, entries] of Object.entries(payload.logs)) {
                      if (!Array.isArray(entries)) continue;
                      const current = (logs[cat] || []) as LogEntry[];
                      const currentIds = new Set(current.map((e) => e.id));
                      const currentKeys = new Set(current.map((e) => e.date + '|' + e.time + '|' + e.type));
                      newCount += entries.filter(
                        (e) => !currentIds.has(e.id) && !currentKeys.has(e.date + '|' + e.time + '|' + e.type)
                      ).length;
                    }
                    setMergePreview({ incoming: payload, newCount });
                  }}
                  onClose={() => setShowScanner(false)}
                />
              </div>
            ) : !mergePreview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <Btn
                  label="Scan QR code"
                  onClick={() => setShowScanner(true)}
                  color={C.s}
                  full
                />
                <div style={{ textAlign: 'center', fontSize: 12, color: C.tl }}>or</div>

                {/* Text paste fallback */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t, marginBottom: 6 }}>
                    Paste code from your partner
                  </div>
                  <textarea
                    value={receiveCode}
                    onChange={(e) => setReceiveCode(e.target.value)}
                    placeholder="Paste the BB1:... code here"
                    style={{
                      width: '100%',
                      height: 70,
                      background: C.cd,
                      border: '1px solid ' + C.b,
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: C.t,
                      resize: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Btn
                      label="Preview sync"
                      onClick={handleReceive}
                      color={C.a}
                      full
                    />
                  </div>
                </div>
              </div>
            )}

            {mergePreview && (
              <Cd style={{ marginTop: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 8 }}>
                  Sync preview
                </div>
                <div style={{ fontSize: 12, color: C.tl, lineHeight: 1.6 }}>
                  From: {mergePreview.incoming.name || 'Partner'}<br />
                  Mode: {mergePreview.incoming.mode === 'today' ? 'Today\'s data' : 'Full history'}<br />
                  New entries to add: <span style={{ fontWeight: 700, color: C.ok }}>{mergePreview.newCount}</span>
                  {mergePreview.newCount === 0 && (
                    <span style={{ color: C.tl }}> (already in sync!)</span>
                  )}
                </div>
                {mergePreview.newCount > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <Btn label="Merge data" onClick={confirmMerge} color={C.ok} full />
                  </div>
                )}
              </Cd>
            )}

            <div style={{ marginTop: 16 }}>
              <Btn label="← Back" onClick={() => { setMode('menu'); setReceiveCode(''); setMergePreview(null); setShowScanner(false); }} outline />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
