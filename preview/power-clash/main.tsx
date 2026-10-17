/** A stand-alone copy of Power Clash for trying it. No sign-in or saving. Build: npm run power-clash:preview */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PowerClashPlay } from '../../src/games/power-clash/PowerClashPlay';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import '../space/preview.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <header className="preview-bar">
        <span><strong>Preview</strong> · not the live site, nothing is saved</span>
      </header>
      <main id="main">
        <PowerClashPlay />
      </main>
    </SoundProvider>
  </StrictMode>,
);
