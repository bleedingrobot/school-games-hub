import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { SLOW_TESTS } from './vitest.slow';

// TESTS=slow runs only the slow files, TESTS=all runs everything, otherwise the slow ones are skipped.
const which = process.env.TESTS;

export default defineConfig({
  // Relative paths, so the built site works at bleedingrobot.github.io/school-games-hub/
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Screen tests are slow when many run at once; 5 seconds gave false failures on a busy computer.
    testTimeout: 20_000,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.ts'],
    ...(which === 'slow' ? { include: SLOW_TESTS } : which === 'all' ? {} : { exclude: ['**/node_modules/**', ...SLOW_TESTS] }),
  },
});
