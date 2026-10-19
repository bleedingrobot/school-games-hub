import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { SLOW_TESTS } from './vitest.slow';

// TESTS=slow runs only the slow files, TESTS=all runs everything, otherwise the slow ones are skipped.
const which = process.env.TESTS;
const DEFAULT_EXCLUDE = ['**/node_modules/**'];
// A renamed or deleted slow file would otherwise drop out of `npm run test:slow` without a word.
for (const file of SLOW_TESTS) if (!existsSync(new URL(file, import.meta.url))) throw new Error(`vitest.slow.ts lists ${file}, which does not exist`);

/** The files a group runs: its own patterns, less (or only) the slow files that live in its folders. */
function files(include: string[], folders: string[]) {
  const slow = SLOW_TESTS.filter((file) => folders.some((folder) => file.startsWith(folder)));
  if (which === 'slow') return { include: slow.length ? slow : ['no-slow-tests-here'], exclude: DEFAULT_EXCLUDE };
  if (which === 'all') return { include, exclude: DEFAULT_EXCLUDE };
  return { include, exclude: [...DEFAULT_EXCLUDE, ...slow] };
}

export default defineConfig({
  // Relative paths, so the built site works at bleedingrobot.github.io/school-games-hub/
  base: './',
  plugins: [react()],
  test: {
    // Screen tests are slow when many run at once; 5 seconds gave false failures on a busy computer.
    testTimeout: 20_000,
    passWithNoTests: which === 'slow',
    projects: [
      {
        // The rules, the maths and the server functions: plain code, so no pretend browser (it costs about a second a file).
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          ...files(['shared/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.ts'], ['shared/', 'supabase/', 'scripts/']),
        },
      },
      {
        // The website: screens, and the code that talks to the server and keeps things in the browser.
        extends: true,
        test: {
          name: 'screens',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          ...files(['src/**/*.test.{ts,tsx}'], ['src/']),
        },
      },
    ],
  },
});
