/**
 * A stand-alone Royal Decree for trying it without signing in. It runs the same rules as the school's server
 * (shared/decree/server.ts) against reigns kept in this browser, with a pretend pupil's questions. Nothing is sent anywhere.
 * Run it: npx vite --config vite.decree-preview.config.ts. Build: npx vite build --config vite.decree-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthContext';
import { DecreePlay } from '../../src/games/decree/DecreePlay';
import { createTrialBackend } from '../../src/games/decree/trialBackend';
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
        <DecreePlay backend={backend} />
      </main>
    </AuthContext.Provider>
  </StrictMode>,
);
