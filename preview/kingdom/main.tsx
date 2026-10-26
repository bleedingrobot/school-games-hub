/**
 * A stand-alone copy of Kingdom Keeper for trying it without signing in (and for browser test scripts). It runs the
 * same rules as the school's server (shared/kingdom/server.ts), against reigns kept in this browser only, with a
 * pretend pupil's times-table questions. Nothing is sent anywhere.
 * Run it: npx vite --config vite.kingdom-preview.config.ts. Build: npx vite build --config vite.kingdom-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthContext';
import { KingdomPlay } from '../../src/games/kingdom/KingdomPlay';
import { createTrialBackend } from '../../src/games/kingdom/trialBackend';
import '../../src/styles.css';

const backend = createTrialBackend('preview');

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
        <KingdomPlay backend={backend} />
      </main>
    </AuthContext.Provider>
  </StrictMode>,
);
