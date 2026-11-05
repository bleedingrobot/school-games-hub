import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Tūī’s Ten Tree preview (preview/tui: the whole game on a pretend server in the browser) into
// dist-preview-tui/. Run it: npx vite --config vite.tui-preview.config.ts
// With TUI_INLINE=1 everything goes inside the script, so `npm run tui:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/tui',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-tui', emptyOutDir: true, assetsInlineLimit: process.env.TUI_INLINE ? 100_000_000 : 4096,
    ...(process.env.TUI_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
