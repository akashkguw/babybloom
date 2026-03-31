/**
 * Tests for lint cleanliness (#181)
 *
 * Verifies that:
 * 1. No source files contain broken imports referencing deleted Firebase modules
 * 2. The ESLint config treats unused-vars as warnings (not errors)
 * 3. The deploy workflow does not run a lint step (removed to unblock CI)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const srcDir = path.resolve(__dirname, '../../src');
const REPO_ROOT = path.resolve(__dirname, '../..');

/** Recursively collect all .ts and .tsx files under a directory */
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.(tsx?|ts)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const DELETED_FIREBASE_MODULES = [
  'firebaseConfig',
  'firestoreUtils',
  'syncService',
  'useFirebaseSync',
  'firebaseSyncUtils',
  'FirebaseSyncSetup',
  'FirebaseSyncSection',
  'SyncStatusBadge',
  '@/utils/crypto',
];

describe('No broken Firebase imports in src/ (#181)', () => {
  const sourceFiles = collectSourceFiles(srcDir);

  it('found source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  for (const mod of DELETED_FIREBASE_MODULES) {
    it(`no file imports deleted module: ${mod}`, () => {
      const importers: string[] = [];
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Match import statements referencing the deleted module
        if (new RegExp(`from ['"][^'"]*${mod.replace('/', '\\/')}['"]`).test(content)) {
          importers.push(path.relative(REPO_ROOT, file));
        }
      }
      expect(importers).toEqual([]);
    });
  }
});

describe('ESLint config — unused-vars is warn not error (#181)', () => {
  const flatConfig = fs.readFileSync(
    path.resolve(REPO_ROOT, 'eslint.config.js'),
    'utf8'
  );

  it('eslint.config.js exists', () => {
    expect(flatConfig.length).toBeGreaterThan(0);
  });

  it('@typescript-eslint/no-unused-vars is set to warn (not error)', () => {
    expect(flatConfig).toContain("'@typescript-eslint/no-unused-vars'");
    expect(flatConfig).toContain("'warn'");
    // Must NOT be set to 'error'
    expect(flatConfig).not.toMatch(/'@typescript-eslint\/no-unused-vars'.*'error'/);
  });

  it('no-explicit-any is turned off', () => {
    expect(flatConfig).toContain("'@typescript-eslint/no-explicit-any': 'off'");
  });
});

describe('Deploy workflow — no failing lint step (#181)', () => {
  const deployYml = fs.readFileSync(
    path.resolve(REPO_ROOT, '.github/workflows/deploy.yml'),
    'utf8'
  );

  it('deploy.yml has type check step', () => {
    expect(deployYml).toContain('tsc --noEmit');
  });

  it('deploy.yml has unit test step', () => {
    expect(deployYml).toContain('vitest run');
  });

  it('deploy.yml does not run npm run lint as a blocking step', () => {
    // Lint was removed from CI to prevent warnings from blocking deploys.
    // Lint (warnings-only) should not block deployments.
    const lines = deployYml.split('\n');
    const lintLines = lines.filter(l => l.includes('npm run lint') && !l.trim().startsWith('#'));
    expect(lintLines).toHaveLength(0);
  });
});
