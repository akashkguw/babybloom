import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true  // CI passes even while test suite is being built out
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  experimental: {
    skipSsrTransform: true
  }
});
