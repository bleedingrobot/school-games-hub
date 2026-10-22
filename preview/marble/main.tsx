/**
 * A stand-alone copy of Marble Rush, for trying it without signing in (nothing is saved to a server;
 * best times stay in this browser). Build: npm run marble:preview. Or run it: npx vite --config vite.marble-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthContext';
import { MuteButton } from '../../src/components/MuteButton';
import { MarblePreview } from '../../src/games/marble/MarblePlay';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

// No one is signed in here, so nothing goes to a server (best times stay in this browser). The maths questions are made and marked in this browser.
const noAuth = { profile: null, status: 'signed-out' } as unknown as React.ContextType<typeof AuthContext>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthContext.Provider value={noAuth}>
    <SoundProvider>
      <main className="marble-preview">
        <header>
          <h1>Marble Rush <small>(preview)</small></h1>
          <MuteButton />
        </header>
        <MarblePreview />
      </main>
    </SoundProvider>
    </AuthContext.Provider>
  </StrictMode>,
);
