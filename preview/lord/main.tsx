/**
 * A stand-alone copy of Dragon Maths for trying it without signing in (and for browser test scripts).
 * The hero is kept in this browser only. Build: npm run lord:preview. Or run it: npx vite --config vite.lord-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthContext';
import { LordPlay } from '../../src/games/lord/LordPlay';
import '../../src/styles.css';

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
        <LordPlay />
      </main>
    </AuthContext.Provider>
  </StrictMode>,
);
