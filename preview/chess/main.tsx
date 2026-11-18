/**
 * A stand-alone copy of chess against the bots, for trying the look and animations. No sign-in, nothing saved.
 * Run: npx vite --config vite.chess-preview.config.ts. Add #show to watch a short game with a capture, check,
 * castling, a promotion and checkmate, one move at a time.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AuthContext, type AuthState } from '../../src/auth/AuthContext';
import { replay } from '../../shared/chess/rules';
import { Board } from '../../src/games/chess/Board';
import { ChessPlay } from '../../src/games/chess/ChessPlay';
import { ChessWindow } from '../../src/games/chess/ChessWindow';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';

const auth = {
  status: 'signed-in',
  profile: { id: 'preview', display_name: 'Captain Kiwi', avatar: {}, role: 'student' },
  message: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as unknown as AuthState;

// Two short shows: captures, checks, castling and a promotion (with check), then a quick checkmate.
const SHOWS = [
  'd2d4 d7d5 c2c4 e7e5 d4e5 d5d4 e2e3 f8b4 c1d2 d4e3 d2b4 e3f2 e1e2 f2g1n e2e1 d8h4 e1d2 b8c6 b4c3 c8g4 g2g3 e8c8'.split(' '),
  'f2f3 e7e5 g2g4 d8h4'.split(' '),
];

function Show() {
  const [which, setWhich] = useState(0);
  const [shown, setShown] = useState(0);
  const SHOW = SHOWS[which];
  const result = replay(SHOW.slice(0, shown));
  const chess = result.ok ? result.chess : null;
  if (!chess) return <p>That show game has a wrong move at {shown}.</p>;
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  return (
    <ChessWindow>
      <div className="chess-game">
        <div className="chess-game__board">
          <Board chess={chess} orientation="white" canMove={false} lastMove={last ? { from: last.from, to: last.to } : null} onMove={() => {}} />
        </div>
        <aside className="chess-game__side">
          <p className="turn-status">Move {shown} of {SHOW.length}</p>
          <div className="chess-actions">
            <button type="button" className="button button--primary" onClick={() => setShown((n) => Math.min(n + 1, SHOW.length))}>
              Next move
            </button>
            <button
              type="button"
              className="button button--light"
              onClick={() => {
                setWhich((w) => (w + 1) % SHOWS.length);
                setShown(0);
              }}
            >
              Next show
            </button>
          </div>
        </aside>
      </div>
    </ChessWindow>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/chess?bot=very-easy']}>
          {location.hash === '#show' ? <Show /> : <ChessPlay level="very-easy" />}
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>
  </StrictMode>,
);
