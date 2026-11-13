/**
 * The Glyph Gates preview: the whole game with no sign-in. The rules are the shared ones, run by the trial backend in this
 * page, and the pretend pupil is kept in this browser. Preview tools: open every temple, start again.
 * Run it: npx vite --config vite.glyph-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlyphGame } from '../../src/games/glyph/GlyphGame';
import { trialBackend } from '../../src/games/glyph/trial';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'glyph-preview' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <GlyphGame
      backend={trial.backend}
      extra={(h) => (
        <details className="ggp-tools">
          <summary>Preview tools</summary>
          <p>Only in this preview. Nothing is saved to the school.</p>
          <button type="button" onClick={() => { trial.tools.openAll(); h.reload(); }}>Open every temple</button>
          <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
        </details>
      )}
    />
  </StrictMode>,
);
