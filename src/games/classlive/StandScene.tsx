/**
 * Stand Up If on the big screen (docs/STAND-PLAN.md). Thinking: the round's sign, huge ("your answer > your number"),
 * Chomp the crocodile's tip, a time bar and how many are ready. Then "3, 2, 1, stand up or sit down!" and everyone
 * shows it for real. Then how many got it right and the room's longest streak (no names: nobody is ranked by maths).
 *
 * The rounds run on the server's clock; this screen nudges the server (`onTick`) when a step is due, as other games do.
 * Space: Go (start the countdown now, or the next round). M sound, F full screen are the page's.
 */
import { useEffect, useRef, useState } from 'react';
import { SIGN_WORDS, STAND_MS, standDeadline, standPhase, type StandGame } from '../../../shared/classlive/stand';
import { readyCount } from '../../../shared/classlive/stand';
import type { ScreenView } from '../../../shared/classlive/server';
import { speak } from '../../speech';
import { painted } from './paintedArt';
import { next, STAND_SIGN_LINES, VOICE_FOLDER } from './voiceLines';
import './stand.css';

const CONFETTI = ['#f2c230', '#e2533d', '#3f7ee0', '#3ba55c', '#c25fd8'];

export function StandScene({ screen, game, over, muted, clock, onTick, onGo, onEnd, onAgain }: {
  screen: ScreenView;
  game: StandGame;
  over: boolean;
  muted: boolean;
  clock: () => number;
  onTick: () => void;
  onGo: () => void;
  onEnd: () => void;
  onAgain: () => void;
}) {
  const [now, setNow] = useState(() => clock());
  const [sureEnd, setSureEnd] = useState(false);
  const ticked = useRef(0);
  const said = useRef<string>('');
  const say = (text: string) => { if (!muted) speak(text, VOICE_FOLDER); };

  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 250);
    return () => window.clearInterval(id);
  }, [clock]);

  const t = screen.startedAt === null ? 0 : Math.max(0, now - screen.startedAt);
  const r = game.round;
  const phase = r ? standPhase(r, t) : null;

  // Nudge the server when the next step is due (the first round, the reveal, the next round).
  const due = over ? null : standDeadline(game, screen.startedAt);
  useEffect(() => {
    if (due === null || t < due + 300) return;
    if (Date.now() - ticked.current < 1500) return;
    ticked.current = Date.now();
    onTick();
  }, [due, t, onTick]);

  // Bella: the call as a round starts, the countdown, the reveal.
  const sayKey = r ? `${r.n}:${phase}` : '';
  useEffect(() => {
    if (!r || over || said.current === sayKey) return;
    said.current = sayKey;
    if (phase === 'think') say(STAND_SIGN_LINES[r.sign]);
    if (phase === 'stand') say(next('standCount'));
    if (phase === 'reveal' && r.revealed) say(next('standReveal'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sayKey, r?.revealed, over]);
  // Everyone tapped before the time was up: say so (the countdown starts a moment later).
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const evs = screen.events as unknown as { type: string; seq: number; all?: boolean }[];
    if (seen.current === null) { seen.current = screen.seq; return; }
    const fresh = evs.filter((e) => e.seq > (seen.current as number));
    seen.current = screen.seq;
    if (fresh.some((e) => e.type === 'stand_go' && e.all)) say(next('standAllIn'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.seq]);
  useEffect(() => { if (over) say(next('standEnd')); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  // Space: Go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || over || (e.target as HTMLElement | null)?.closest('input, textarea, button')) return;
      e.preventDefault();
      onGo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onGo, over]);

  const back = painted('stand', 'back') ?? painted('back', 'star-sky');
  const style = back ? { backgroundImage: `url(${back})` } : undefined;
  const players = screen.people.length;
  const best = Math.max(0, ...Object.values(game.mine).map((m) => m.best));

  if (over) {
    const rounds = r?.revealed ? r.n : Math.max(0, (r?.n ?? 1) - 1);
    const spots = Object.values(game.mine).reduce((n, m) => n + m.spots, 0);
    return (
      <div className="su-stage" style={style}>
        <div className="su-over">
          <div className="su-croc su-croc--big" aria-hidden="true">🐊</div>
          <h1>What a game!</h1>
          <p>{rounds} {rounds === 1 ? 'round' : 'rounds'} · {spots} right stands and sits</p>
          {best >= 2 && <p className="su-over__best">🔥 Longest streak in the room: {best} in a row</p>}
          <button type="button" className="su-btn su-btn--go" onClick={onAgain}>Play again</button>
        </div>
      </div>
    );
  }

  const top = (
    <header className="su-top">
      <b>🧍 Stand Up If</b>
      {r && <span className="su-chip">Round {r.n}</span>}
      <span className="su-chip">{game.level === 'junior' ? 'Junior: > <' : 'Senior: > < ≥ ≤'}</span>
      {screen.joinCode && <span className="su-chip">Join code {screen.joinCode}</span>}
      <span className="su-top__gap" />
      {r && phase !== 'stand' && (
        <button type="button" className="su-btn su-btn--go" onClick={onGo} title="Space">{phase === 'think' ? 'Go now' : 'Next round'}</button>
      )}
      {sureEnd ? (
        <>
          <button type="button" className="su-btn su-btn--stop" onClick={onEnd}>Yes, end the game</button>
          <button type="button" className="su-btn" onClick={() => setSureEnd(false)}>Keep playing</button>
        </>
      ) : <button type="button" className="su-btn" onClick={() => setSureEnd(true)}>End</button>}
    </header>
  );

  if (!r) {
    return (
      <div className="su-stage" style={style}>
        {top}
        <main className="su-main"><div className="su-croc su-croc--big" aria-hidden="true">🐊</div><h1 className="su-get">Get ready!</h1></main>
      </div>
    );
  }

  const words = SIGN_WORDS[r.sign];
  const ready = readyCount(game);
  const call = (
    <div className="su-call" aria-label={`Stand up if your answer is ${words.words} your number`}>
      <p className="su-call__lead">Stand up if</p>
      <div className="su-sum">
        <span className="su-box">your answer</span>
        <span className="su-sign">{r.sign}</span>
        <span className="su-box">your number</span>
      </div>
      <p className="su-call__words">your answer is <b>{words.words}</b> your number</p>
    </div>
  );

  if (phase === 'think') {
    const left = Math.max(0, r.standAt - t);
    const k = Math.min(1, left / (game.think * 1000));
    return (
      <div className="su-stage" style={style}>
        {top}
        <main className="su-main">
          {call}
          <p className="su-tip"><span aria-hidden="true">🐊</span> {words.tip}</p>
          <div className="su-time" aria-hidden="true"><i style={{ width: `${k * 100}%` }} /></div>
          <p className="su-ready" role="status">{ready} of {players} ready · {Math.ceil(left / 1000)} s</p>
          <div className="su-dots" aria-hidden="true">
            {Array.from({ length: players }, (_, i) => <i key={i} className={i < ready ? 'on' : ''} />)}
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'stand') {
    const n = Math.ceil((r.standAt + STAND_MS - 1000 - t) / 1000);
    return (
      <div className="su-stage su-stage--count" style={style}>
        {top}
        <main className="su-main">
          {n > 0 ? <div className="su-count" key={n}>{n}</div> : <div className="su-count su-count--go">Stand up or sit down!</div>}
          <p className="su-call__words su-call__words--small">Stand up if your answer is <b>{words.words}</b> your number</p>
        </main>
      </div>
    );
  }

  // Results.
  const took = r.revealed ? r.took : ready;
  return (
    <div className="su-stage" style={style}>
      {top}
      <main className="su-main">
        <div className="su-result" role="status">
          <div className="su-result__big">✅ {r.spot} of {took} right!</div>
          <p>Check your iPad to see if you were right, and your streak!</p>
          {best >= 2 && <p className="su-result__best">🔥 Longest streak in the room: {best} in a row</p>}
        </div>
        {r.spot > 0 && r.spot === took && (
          <div className="su-confetti" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 7) * 0.12}s` }} />)}
          </div>
        )}
        <p className="su-next">Next round in {Math.max(0, Math.ceil((r.endAt - t) / 1000))} s</p>
      </main>
    </div>
  );
}
