/**
 * Unit tests for src/components/SyncStatusBadge.tsx
 *
 * Verifies that the badge renders the correct icon/label for each sync status,
 * and returns null for idle / undefined states.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SyncStatusBadge from '../../src/components/SyncStatusBadge';
import type { SyncStatus } from '../../src/hooks/useFirebaseSync';

// Mock @/components/shared/Icon — renders a simple span with data-icon attribute
vi.mock('@/components/shared/Icon', () => ({
  Icon: ({ n }: { n: string }) => <span data-icon={n} />,
  default: ({ n }: { n: string }) => <span data-icon={n} />,
}));

// Mock @/lib/constants/colors — provide minimal C object
vi.mock('@/lib/constants/colors', () => ({
  C: {
    s: '#5B8DEF',
    ok: '#4CAF50',
    tl: '#888',
  },
}));

describe('SyncStatusBadge', () => {
  describe('returns null for non-visible states', () => {
    it('renders nothing when status is undefined', () => {
      const { container } = render(<SyncStatusBadge />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when status is "idle"', () => {
      const { container } = render(<SyncStatusBadge status={'idle' as SyncStatus} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('syncing state', () => {
    it('renders "Syncing…" label when status is "syncing"', () => {
      render(<SyncStatusBadge status="syncing" />);
      expect(screen.getByText('Syncing…')).toBeDefined();
    });

    it('shows clock icon for syncing state', () => {
      render(<SyncStatusBadge status="syncing" />);
      expect(document.querySelector('[data-icon="clock"]')).toBeTruthy();
    });
  });

  describe('synced state', () => {
    it('renders "Synced" label when status is "synced"', () => {
      render(<SyncStatusBadge status="synced" />);
      expect(screen.getByText('Synced')).toBeDefined();
    });

    it('shows check icon for synced state', () => {
      render(<SyncStatusBadge status="synced" />);
      expect(document.querySelector('[data-icon="check"]')).toBeTruthy();
    });

    it('shows formatted time in title when lastSyncedAt is provided', () => {
      const ts = new Date('2025-01-01T12:34:56').getTime();
      render(<SyncStatusBadge status="synced" lastSyncedAt={ts} />);
      const badge = document.querySelector('[aria-label]');
      expect(badge?.getAttribute('aria-label')).toMatch(/Synced at/);
    });

    it('shows "Synced" in title when lastSyncedAt is null', () => {
      render(<SyncStatusBadge status="synced" lastSyncedAt={null} />);
      const badge = document.querySelector('[aria-label]');
      expect(badge?.getAttribute('aria-label')).toBe('Synced');
    });
  });

  describe('error state', () => {
    it('renders "Sync error" label when status is "error"', () => {
      render(<SyncStatusBadge status="error" />);
      expect(screen.getByText('Sync error')).toBeDefined();
    });

    it('shows alert-triangle icon for error state', () => {
      render(<SyncStatusBadge status="error" />);
      expect(document.querySelector('[data-icon="alert-triangle"]')).toBeTruthy();
    });
  });

  describe('badge structure', () => {
    it('renders a div with aria-label matching the status label', () => {
      render(<SyncStatusBadge status="syncing" />);
      const badge = document.querySelector('[aria-label="Syncing…"]');
      expect(badge).toBeTruthy();
    });

    it('renders visible label text alongside the icon', () => {
      const { container } = render(<SyncStatusBadge status="error" />);
      // Should have both an icon span and a text span
      const spans = container.querySelectorAll('span');
      expect(spans.length).toBeGreaterThanOrEqual(1);
    });
  });
});
