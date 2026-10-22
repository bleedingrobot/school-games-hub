/**
 * A stand-alone copy of Mine Runner, for trying it without signing in. It never talks to the school's server: a fake
 * pupil is signed in, the question doors and pads use trial questions made in this browser, and best times stay on this
 * device. Build: npm run mine:preview. Or run it: npx vite --config vite.mine-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext, type AuthState } from '../../src/auth/AuthContext';
import { MuteButton } from '../../src/components/MuteButton';
import { MinePreview } from '../../src/games/mine/MinePlay';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const nobody = async () => {};
const pupil = {
  status: 'signed-in',
  message: null,
  profile: { id: 'preview-pilot', display_name: 'Preview pilot', role: 'student' },
  signIn: nobody,
  signOut: nobody,
  refreshProfile: nobody,
} as unknown as AuthState;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthContext.Provider value={pupil}>
      <SoundProvider>
        <main className="mine-preview">
          <header>
            <h1>Mine Runner <small>(preview)</small></h1>
            <MuteButton />
          </header>
          <MinePreview />
        </main>
      </SoundProvider>
    </AuthContext.Provider>
  </StrictMode>,
);
