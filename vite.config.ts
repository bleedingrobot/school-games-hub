import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative paths, so the built site works at bleedingrobot.github.io/school-games-hub/
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
