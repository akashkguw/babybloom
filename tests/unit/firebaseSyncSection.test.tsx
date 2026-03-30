/**
 * Unit tests for src/features/settings/FirebaseSyncSection.tsx
 *
 * Tests rendering of sync status labels and error message display.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FirebaseSyncSection from '@/features/settings/FirebaseSyncSection';

vi.mock('@/lib/constants/colors', () => ({
  C: {
    ok: '#22c55e',
    s: '#f59e0b',
    w: '#ef4444',
    tl: '#9ca3af',
    t: '#111827',
    b: '#e5e7eb',
    cd: '#f9fafb',
    bg: '#ffffff',
    a: '#6366f1',
    sl: '#ede9fe',
  },
}));

vi.mock('@/components/shared/Icon', () => ({
  default: ({ n }: { n: string }) => <span data-testid="icon">{n}</span>,
}));

describe('FirebaseSyncSection', () => {
  describe('status labels', () => {
    it('shows "Synced" when status is synced', () => {
      render(<FirebaseSyncSection syncStatus="synced" />);
      expect(screen.getByTestId('sync-status-label').textContent).toContain('Synced');
    });

    it('shows timestamp when status is synced with lastSyncedAt', () => {
      const ts = new Date('2026-03-30T10:30:00').getTime();
      render(<FirebaseSyncSection syncStatus="synced" lastSyncedAt={ts} />);
      const label = screen.getByTestId('sync-status-label').textContent ?? '';
      expect(label).toContain('Synced at');
    });

    it('shows "Syncing…" when status is syncing', () => {
      render(<FirebaseSyncSection syncStatus="syncing" />);
      expect(screen.getByTestId('sync-status-label').textContent).toBe('Syncing…');
    });

    it('shows "Sync error — check connection" when status is error', () => {
      render(<FirebaseSyncSection syncStatus="error" />);
      expect(screen.getByTestId('sync-status-label').textContent).toBe('Sync error — check connection');
    });

    it('shows "Sync enabled" when status is idle', () => {
      render(<FirebaseSyncSection syncStatus="idle" />);
      expect(screen.getByTestId('sync-status-label').textContent).toBe('Sync enabled');
    });

    it('shows "Sync enabled" when no status provided', () => {
      render(<FirebaseSyncSection />);
      expect(screen.getByTestId('sync-status-label').textContent).toBe('Sync enabled');
    });
  });

  describe('error detail display', () => {
    it('shows syncError detail when status is error and syncError is set', () => {
      render(
        <FirebaseSyncSection
          syncStatus="error"
          syncError="Firestore permission denied"
        />
      );
      expect(screen.getByTestId('sync-error-detail').textContent).toBe(
        'Firestore permission denied'
      );
    });

    it('does not show sync-error-detail when status is error but syncError is null', () => {
      render(<FirebaseSyncSection syncStatus="error" syncError={null} />);
      expect(screen.queryByTestId('sync-error-detail')).toBeNull();
    });

    it('does not show sync-error-detail when status is synced even if syncError is set', () => {
      render(<FirebaseSyncSection syncStatus="synced" syncError="stale error" />);
      expect(screen.queryByTestId('sync-error-detail')).toBeNull();
    });

    it('does not show sync-error-detail when syncError is undefined', () => {
      render(<FirebaseSyncSection syncStatus="error" />);
      expect(screen.queryByTestId('sync-error-detail')).toBeNull();
    });
  });
});
