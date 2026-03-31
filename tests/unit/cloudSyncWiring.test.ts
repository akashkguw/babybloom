import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * CloudSync wiring tests
 * Verifies that the Google Drive CloudSync component is properly wired
 * into Settings.tsx and App.tsx.
 */

const settingsTsx = fs.readFileSync(
  path.resolve(__dirname, '../../src/features/settings/Settings.tsx'),
  'utf8'
);

const appTsx = fs.readFileSync(
  path.resolve(__dirname, '../../src/App.tsx'),
  'utf8'
);

// ─── Settings.tsx ───

describe('Settings — CloudSync wiring', () => {
  it('Settings props interface includes onCloudSync', () => {
    expect(settingsTsx).toContain('onCloudSync?:');
  });

  it('Settings destructures onCloudSync', () => {
    expect(settingsTsx).toContain('onCloudSync,');
  });

  it('Settings renders a Google Drive Sync button', () => {
    expect(settingsTsx).toContain('Google Drive Sync');
  });

  it('Google Drive Sync button calls onCloudSync on click', () => {
    expect(settingsTsx).toContain('onCloudSync');
    // The button's onClick must reference onCloudSync
    const btnIdx = settingsTsx.indexOf('Google Drive Sync');
    const region = settingsTsx.slice(Math.max(0, btnIdx - 200), btnIdx + 200);
    expect(region).toContain('onCloudSync');
  });

  it('Google Drive Sync button appears before Partner Sync button', () => {
    const driveIdx = settingsTsx.indexOf('Google Drive Sync');
    const partnerIdx = settingsTsx.indexOf('Share Data with Partner');
    expect(driveIdx).toBeGreaterThan(-1);
    expect(partnerIdx).toBeGreaterThan(-1);
    expect(driveIdx).toBeLessThan(partnerIdx);
  });
});

// ─── App.tsx ───

describe('App — CloudSync wiring', () => {
  it('App imports CloudSync component', () => {
    expect(appTsx).toContain("import CloudSync from '@/features/sync/CloudSync'");
  });

  it('App has showCloudSync state', () => {
    expect(appTsx).toContain('showCloudSync');
  });

  it('App passes onCloudSync prop to Settings', () => {
    expect(appTsx).toContain('onCloudSync=');
  });

  it('App renders <CloudSync> when showCloudSync is true', () => {
    expect(appTsx).toContain('<CloudSync');
  });

  it('App passes onClose to CloudSync', () => {
    const cloudSyncIdx = appTsx.indexOf('<CloudSync');
    const region = appTsx.slice(cloudSyncIdx, cloudSyncIdx + 200);
    expect(region).toContain('onClose');
  });

  it('App sets showCloudSync=false when CloudSync closes', () => {
    const cloudSyncIdx = appTsx.indexOf('<CloudSync');
    const region = appTsx.slice(cloudSyncIdx, cloudSyncIdx + 200);
    expect(region).toContain('setShowCloudSync(false)');
  });

  it('App closes Settings when opening CloudSync', () => {
    const onCloudSyncIdx = appTsx.indexOf('onCloudSync=');
    const region = appTsx.slice(onCloudSyncIdx, onCloudSyncIdx + 120);
    expect(region).toContain('setShowSet(false)');
    expect(region).toContain('setShowCloudSync(true)');
  });
});
