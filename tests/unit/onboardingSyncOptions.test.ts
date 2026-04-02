import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for the onboarding dual-sync UX.
 *
 * Verifies that the welcome/login screen presents both sync methods
 * (Offline Share Code + Google Drive) as distinct, clearly labeled options,
 * and that the Google Drive option is wired through to App.tsx via
 * the onOpenCloudSync prop.
 */

const homeTab = fs.readFileSync(
  path.resolve(__dirname, '../../src/tabs/HomeTab.tsx'),
  'utf8'
);

const appTsx = fs.readFileSync(
  path.resolve(__dirname, '../../src/App.tsx'),
  'utf8'
);

// ─── HomeTab: onboarding shows both sync options ───

describe('Onboarding — dual sync cards', () => {
  it('HomeTabProps includes onOpenCloudSync callback', () => {
    expect(homeTab).toContain('onOpenCloudSync?:');
  });

  it('HomeTab destructures onOpenCloudSync', () => {
    expect(homeTab).toContain('onOpenCloudSync,');
  });

  it('shows "Already have a partner using BabyBloom?" heading', () => {
    expect(homeTab).toContain('Already have a partner using BabyBloom?');
  });

  it('shows "Choose how to connect" subheading', () => {
    expect(homeTab).toContain('Choose how to connect');
  });

  it('renders a Share Code card with clear description', () => {
    expect(homeTab).toContain('Share Code');
    expect(homeTab).toContain('Paste a code from your partner. No account needed.');
  });

  it('renders a Google Drive card with clear description', () => {
    expect(homeTab).toContain('Google Drive');
    expect(homeTab).toContain('Auto-sync with your partner. Encrypted backup.');
  });

  it('Google Drive card calls onOpenCloudSync when tapped', () => {
    // Find the Google Drive Sync card comment and verify onOpenCloudSync is in its region
    const commentIdx = homeTab.indexOf('Google Drive Sync card');
    expect(commentIdx).toBeGreaterThan(-1);
    const cardRegion = homeTab.slice(commentIdx, commentIdx + 600);
    expect(cardRegion).toContain('onOpenCloudSync');
    expect(cardRegion).toContain('Google Drive');
  });

  it('Share Code card appears before Google Drive card', () => {
    const shareIdx = homeTab.indexOf('Share Code</div>');
    const driveIdx = homeTab.indexOf('Google Drive</div>');
    expect(shareIdx).toBeGreaterThan(-1);
    expect(driveIdx).toBeGreaterThan(-1);
    expect(shareIdx).toBeLessThan(driveIdx);
  });

  it('both cards are side by side (flex layout with gap)', () => {
    // The two cards are wrapped in a flex container
    const chooseIdx = homeTab.indexOf('Choose how to connect');
    const joinCodeIdx = homeTab.indexOf('Paste share code', chooseIdx);
    const region = homeTab.slice(chooseIdx, joinCodeIdx);
    expect(region).toContain("display: 'flex'");
    expect(region).toContain('gap: 10');
  });

  it('still has the offline share code paste flow (BB1: code)', () => {
    expect(homeTab).toContain("Paste the BB1:... code here");
    expect(homeTab).toContain('Join with share code');
  });
});

// ─── App.tsx: wiring onOpenCloudSync to HomeTab ───

describe('App — onOpenCloudSync wiring', () => {
  it('App passes onOpenCloudSync prop to HomeTab', () => {
    expect(appTsx).toContain('onOpenCloudSync=');
  });

  it('onOpenCloudSync opens the CloudSync modal', () => {
    const propIdx = appTsx.indexOf('onOpenCloudSync=');
    expect(propIdx).toBeGreaterThan(-1);
    const region = appTsx.slice(propIdx, propIdx + 100);
    expect(region).toContain('setShowCloudSync(true)');
  });
});
