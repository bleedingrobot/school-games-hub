/**
 * Preview only: the new home page and the three themes (D.2–D.4b), built from the real site with made-up data. Nothing is sent
 * anywhere. The bar at the bottom switches the theme; the profile page's own picker works too.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppRoutes } from '../../src/App';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { THEMES } from '../../src/avatar/avatarParts';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import { previewTheme, setPreviewTheme } from './fakeSupabase';
import './preview.css';

// Nothing in this page may reach the live server: a game's own requests (sign-in tokens, saves) are refused here.
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) =>
  /supabase\.co/.test(String(input instanceof Request ? input.url : input))
    ? Promise.reject(new Error('Test page: nothing is sent to the server.'))
    : realFetch(input, init);

function ThemeBar() {
  const { refreshProfile, profile } = useAuth();
  const [, redraw] = useState(0);
  if (!profile) return null;
  const now = previewTheme();
  return (
    <div className="preview-bar" role="group" aria-label="Preview: theme">
      <strong>Test page · theme:</strong>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={now === t.id}
          onClick={() => {
            setPreviewTheme(t.id);
            void refreshProfile().then(() => redraw((n) => n + 1));
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
          <ThemeBar />
        </HashRouter>
      </AuthProvider>
    </SoundProvider>
  </StrictMode>,
);
