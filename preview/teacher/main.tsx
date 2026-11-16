/** Preview only: the real site on made-up data (see fakeSupabase.ts). Pick the scene with ?scene=noclass|student|signedout. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppRoutes } from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthContext';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';

const realFetch = window.fetch.bind(window);
window.fetch = (input, init) =>
  /supabase\.co/.test(String(input instanceof Request ? input.url : input))
    ? Promise.reject(new Error('Test page: nothing is sent to the server.'))
    : realFetch(input, init);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </SoundProvider>
  </StrictMode>,
);
