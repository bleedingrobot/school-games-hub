import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative paths, so the built site works at bleedingrobot.github.io/school-games-hub/
  base: './',
  plugins: [react()],
  test: {
    // Screen tests are slow when many run at once; 5 seconds gave false failures on a busy computer.
    testTimeout: 20_000,
    projects: [
      {
        // The rules, the maths and the server functions: plain code, so no pretend browser (it costs about a second a file).
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['shared/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        // The website: screens, and the code that talks to the server and keeps things in the browser.
        extends: true,
        test: {
          name: 'screens',
          environment: 'jsdom',
          // Each file still gets its own fresh page, but the pretend browser is set up once per worker instead of once per
          // file: that was a quarter of the time. A worker that grows past the limit is replaced, to keep memory in check.
          pool: 'vmThreads',
          vmMemoryLimit: '400MB',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
