/**
 * A stand-alone copy of Sky Isles for trying it without signing in (and for browser test scripts). It runs the same
 * rules as the school's server (shared/isles/server.ts), against an island kept in this browser only, with a pretend
 * pupil's maths. Nothing is sent anywhere. The bar at the top can skip to a later day or start again.
 * Run it: npx vite --config vite.isles-preview.config.ts. Build: npm run isles:preview
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/auth/AuthContext';
import { IslesPlay } from '../../src/games/isles/IslesPlay';
import { createTrialBackend, forgetTrial } from '../../src/games/isles/trialBackend';
import '../../src/styles.css';

const DAYS_KEY = 'isles-trial-days';
const readDays = () => {
  try {
    return Number(localStorage.getItem(DAYS_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveDays = (d: number) => {
  try {
    localStorage.setItem(DAYS_KEY, String(d));
  } catch {
    // The skip still works until the page is closed.
  }
};

let days = readDays();
const makeBackend = () => createTrialBackend('preview', { daysAhead: () => days });

const fakeAuth = {
  status: 'signed-in',
  profile: { id: 'preview', display_name: 'Brave Kiwi', avatar: null, role: 'student' },
  message: '',
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as unknown as React.ContextType<typeof AuthContext>;

function Preview() {
  const [round, setRound] = useState(0);
  const [backend, setBackend] = useState(makeBackend);
  const skip = () => {
    days += 1;
    saveDays(days);
    setRound((r) => r + 1);
  };
  const again = () => {
    forgetTrial('preview');
    days = 0;
    saveDays(0);
    setBackend(makeBackend());
    setRound((r) => r + 1);
  };
  return (
    <>
      <div className="si-previewbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', padding: '8px 12px', color: '#fff' }}>
        <span style={{ fontWeight: 700 }}>Sky Isles preview (nothing is sent anywhere){days ? ` · day ${days + 1}` : ''}</span>
        <button type="button" className="button button--light" style={{ width: "auto" }} onClick={skip}>Skip to tomorrow</button>
        <button type="button" className="button button--light-outline" onClick={again}>Start again</button>
      </div>
      <IslesPlay key={round} backend={backend} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthContext.Provider value={fakeAuth}>
      <main style={{ padding: 12 }}>
        <Preview />
      </main>
    </AuthContext.Provider>
  </StrictMode>,
);
