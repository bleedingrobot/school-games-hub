/**
 * A stand-alone copy of Dragon Maths for trying it without signing in (and for browser test scripts). It runs the
 * same rules as the school's server (shared/lord/server.ts), against a little save kept in this browser only, and
 * has the test tools. The live game has neither. Build: npm run lord:preview. Or run it: npx vite --config vite.lord-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthContext';
import { LordPlay } from '../../src/games/lord/LordPlay';
import { nzDate } from '../../shared/lord/engine';
import { createTrialBackend } from '../../src/games/lord/trialBackend';
import '../../src/styles.css';

// ?day=N (1 to 35) gives the trial a real season on day N of season 1, to try the season road.
const dayParam = Number(new URLSearchParams(window.location.search).get('day'));
const seasonStart = dayParam >= 1 ? nzDate(new Date(Date.now() - (Math.min(35, dayParam) - 1) * 86400e3)) : null;
const backend = createTrialBackend('preview', seasonStart);

const fakeAuth = {
  status: 'signed-in',
  profile: { id: 'preview', display_name: 'Brave Kiwi', avatar: null, role: 'student' },
  message: '',
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as unknown as React.ContextType<typeof AuthContext>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthContext.Provider value={fakeAuth}>
      <main style={{ padding: 12 }}>
        <LordPlay backend={backend} />
      </main>
    </AuthContext.Provider>
  </StrictMode>,
);
