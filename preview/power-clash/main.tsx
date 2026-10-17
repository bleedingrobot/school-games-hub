/**
 * A stand-alone copy of Power Clash for trying it. No sign-in, nothing saved.
 * Build: npm run power-clash:preview
 *
 * "Play a classmate" uses a STAND-IN for the server (standIn.ts): the real referee code, but
 * the database is this browser and "live updates" travel between tabs of this page. Open the
 * page in two tabs and pick a different student in each.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, Route, Routes, useNavigate } from 'react-router';
import { AuthContext, type AuthState } from '../../src/auth/AuthContext';
import { askPower, fetchMyOpenPowerGames, fetchPowerLobby, type PowerGame, type PowerLobbyGame } from '../../src/data/powerGames';
import { PowerClashPlay } from '../../src/games/power-clash/PowerClashPlay';
import { PowerGamePage } from '../../src/pages/PowerGamePage';
import { SoundProvider } from '../../src/sound';
import { chooseWhoIAm, controls, PLAYERS, whoAmI } from './standIn';
import '../../src/styles.css';
import '../space/preview.css';
import './standin.css';

const me = whoAmI();
const auth = {
  status: 'signed-in',
  profile: { id: me, display_name: PLAYERS[me], avatar: {}, role: 'student' },
  message: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as unknown as AuthState;

function Bar() {
  const [offline, setOffline] = useState(controls.isOffline());
  return (
    <header className="preview-bar">
      <span>
        <strong>Preview</strong> · not the live site, nothing is saved. <Link to="/">Start</Link>
      </span>
      <span className="standin-bar">
        Classmates use a <strong>stand-in server</strong> (not the real one). You are:{' '}
        {Object.entries(PLAYERS).map(([id, name]) => (
          <button key={id} type="button" className="button button--light" aria-pressed={id === me} disabled={id === me} onClick={() => chooseWhoIAm(id)}>
            {name}
          </button>
        ))}{' '}
        <button
          type="button"
          className="button button--light"
          aria-pressed={offline}
          onClick={() => {
            controls.setOffline(!offline);
            setOffline(!offline);
          }}
        >
          {offline ? 'Wi-Fi is “off” (tap to fix)' : 'Pretend the Wi-Fi drops'}
        </button>{' '}
        <button type="button" className="button button--light" onClick={() => controls.jump(61_000)}>
          Skip 61 seconds
        </button>{' '}
        <button type="button" className="button button--light" onClick={() => controls.reset()}>
          Clear all games
        </button>
      </span>
    </header>
  );
}

function Home() {
  return (
    <section className="friend-wait">
      <div className="friend-wait__card">
        <div className="friend-wait__emoji" aria-hidden="true">⚡</div>
        <h1>Tic-Tac-Toe: Power Clash</h1>
        <p>Pick how to try it.</p>
        <Link to="/play" className="button button--primary">Two players on one screen, or a bot</Link>
        <Link to="/lobby" className="button button--play">Play a classmate (open this page in two tabs)</Link>
      </div>
    </section>
  );
}

function StandInLobby() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState<PowerLobbyGame[]>([]);
  const [mine, setMine] = useState<PowerGame[]>([]);
  useEffect(() => {
    const load = () => {
      void fetchPowerLobby().then(setOpen).catch(() => {});
      void fetchMyOpenPowerGames().then(setMine).catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, []);
  const go = (request: Parameters<typeof askPower>[0]) =>
    askPower(request).then(
      (game) => navigate(`/power-game/${game.id}`),
      (error: unknown) => setMessage(error instanceof Error ? error.message : 'Something went wrong.'),
    );
  return (
    <section className="friend-wait">
      <div className="friend-wait__card">
        <h1>Play a classmate</h1>
        <p>You are <strong>{PLAYERS[me]}</strong>. Open this page in a second tab as another student to play against yourself.</p>
        <button type="button" className="button button--play" onClick={() => void go({ action: 'create', lobby: false })}>Start a game (with a code)</button>
        <button type="button" className="button button--primary" onClick={() => void go({ action: 'create', lobby: true })}>Start a game (in the lobby)</button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void go({ action: 'join', code });
          }}
        >
          <label htmlFor="code">Join with a code </label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" />{' '}
          <button type="submit" className="button button--primary">Join game</button>
        </form>
        {message && <p className="chess-note" role="alert">{message}</p>}
        <h2>Open games</h2>
        {open.length === 0 ? <p>None right now.</p> : (
          <ul>{open.map((g) => (
            <li key={g.id}>{g.creator_name} <button type="button" className="button button--primary" onClick={() => void go({ action: 'join', gameId: g.id })}>Join</button></li>
          ))}</ul>
        )}
        <h2>Your games</h2>
        {mine.length === 0 ? <p>None.</p> : (
          <ul>{mine.map((g) => (
            <li key={g.id}><Link to={`/power-game/${g.id}`}>{g.status === 'playing' ? 'Carry on' : 'Open'} ({g.status})</Link></li>
          ))}</ul>
        )}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <AuthContext.Provider value={auth}>
        <HashRouter>
          <Bar />
          <main id="main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play" element={<PowerClashPlay />} />
              <Route path="/lobby" element={<StandInLobby />} />
              <Route path="/power-game/:id" element={<PowerGamePage />} />
            </Routes>
          </main>
        </HashRouter>
      </AuthContext.Provider>
    </SoundProvider>
  </StrictMode>,
);
