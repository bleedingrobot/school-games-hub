/**
 * A stand-alone copy of Marble Rush, for trying it without signing in (nothing is saved to a server;
 * best times stay in this browser). Build: npm run marble:preview. Or run it: npx vite --config vite.marble-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MuteButton } from '../../src/components/MuteButton';
import { MarblePlay } from '../../src/games/marble/MarblePlay';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <main className="marble-preview">
        <header>
          <h1>Marble Rush <small>(preview)</small></h1>
          <MuteButton />
        </header>
        <MarblePlay />
      </main>
    </SoundProvider>
  </StrictMode>,
);
