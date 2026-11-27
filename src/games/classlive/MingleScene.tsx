/**
 * Maths Mingle on the big screen (docs/MINGLE-PLAN.md). The class mingles for real while a dance track plays; the music
 * stops, the screen calls "Get into groups of 24 ÷ 6!", a 10 second scramble, then the answer. Anyone left over goes to
 * a station iPad (JailPad) and answers their way back in; their name flashes up here.
 *
 * The rounds (music, calls, countdowns) run only on this screen: nothing in them counts, so nothing goes to the server.
 * Space starts the next step, S stops the music now, M sound, F full screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JailGame } from '../../../shared/classlive/jail';
import { rosterNames } from '../../../shared/classlive/jailServer';
import { danceMs, makeCall, SCRAMBLE_MS, seeded, type MingleCall } from '../../../shared/classlive/mingle';
import type { ScreenView } from '../../../shared/classlive/server';
import { HALLS, type Hall } from '../../../shared/classlive/thrones';
import { speak } from '../../speech';
import { trackUrl, useMusic, type Track } from './music';
import { painted } from './paintedArt';
import { MINGLE_SIZE_LINES, next, VOICE_FOLDER } from './voiceLines';
import './mingle.css';

type Phase = 'ready' | 'dance' | 'call' | 'reveal';

const CONFETTI = ['#f2c230', '#e2533d', '#3f7ee0', '#3ba55c', '#c25fd8'];

export function MingleScene({ screen, game, over, muted, onEnd, onRelease, onAgain }: {
  screen: ScreenView;
  game: JailGame;
  over: boolean;
  muted: boolean;
  onEnd: () => void;
  onRelease: (pupil: string) => void;
  onAgain: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [call, setCall] = useState<MingleCall | null>(null);
  const [left, setLeft] = useState(0);
  const [flash, setFlash] = useState<{ name: string; key: number } | null>(null);
  const [sureEnd, setSureEnd] = useState(false);
  const random = useRef(seeded(Date.now() & 0x7fffffff)).current;
  const timers = useRef<number[]>([]);
  const seen = useRef<number | null>(null);
  const flashKey = useRef(0);
  const host = useRef<HTMLDivElement>(null);

  const names = rosterNames(game);
  const nameOf = (id: string) => (screen.showNames ? names[id] ?? 'Someone' : 'Someone');
  const say = useCallback((text: string) => { if (!muted) speak(text, VOICE_FOLDER); }, [muted]);
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)); };
  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => clear, []);

  const hall: Hall = HALLS[round % HALLS.length];
  const track = `thrones-${hall}` as Track;
  useMusic(!over && phase === 'dance' && trackUrl(track) ? track : null, !muted);

  const players = game.roster.length || screen.players;

  /** The music stops: show the call and run the scramble clock, then the answer. */
  const stopMusic = useCallback(() => {
    clear();
    const c = makeCall(game.level ?? 'senior', round, random, { last: call, twists: game.twists !== false, players });
    setCall(c);
    setPhase('call');
    say(next('mingleStop'));
    const end = Date.now() + SCRAMBLE_MS;
    setLeft(SCRAMBLE_MS);
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms > 0) return later(tick, 200);
      setPhase('reveal');
      say(MINGLE_SIZE_LINES[c.size] ?? '');
      later(() => say(next('mingleLeft')), 2200);
    };
    later(tick, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, call, game.level, game.twists, players, say]);

  /** Music on for a secret length of time. */
  const dance = useCallback(() => {
    clear();
    setRound((r) => r + 1);
    setCall(null);
    setPhase('dance');
    say(next('mingleDance'));
    later(() => stopRef.current(), danceMs(random));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say]);
  const stopRef = useRef(stopMusic);
  stopRef.current = stopMusic;

  const step = useCallback(() => {
    if (over) return;
    if (phase === 'dance') stopRef.current();
    else if (phase === 'ready' || phase === 'reveal') dance();
  }, [phase, over, dance]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); step(); }
      else if (e.key === 's' || e.key === 'S') { if (phase === 'dance') stopRef.current(); }
      else if (e.key === 'f' || e.key === 'F') { void (document.fullscreenElement ? document.exitFullscreen() : host.current?.requestFullscreen?.())?.catch?.(() => undefined); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [step, phase]);

  // "<name> is back in!" once for each new comeback (not the ones from before this screen opened).
  useEffect(() => {
    const evs = screen.events as unknown as { type: string; seq: number; pupil?: string }[];
    if (seen.current === null) { seen.current = screen.seq; return; }
    const fresh = evs.filter((e) => e.seq > (seen.current as number)).sort((a, b) => a.seq - b.seq);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((e) => e.seq));
    for (const e of fresh) {
      if (e.type !== 'jail_back' || !e.pupil) continue;
      const k = ++flashKey.current;
      setFlash({ name: nameOf(e.pupil), key: k });
      say(next('backIn'));
      later(() => setFlash((f) => (f?.key === k ? null : f)), 3200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.seq]);

  useEffect(() => { if (over) { clear(); say(next('mingleEnd')); } }, [over, say]);

  const inJail = Object.entries(game.mine).filter(([, m]) => m.inAt !== null).sort((a, b) => (a[1].inAt as number) - (b[1].inAt as number)).map(([id]) => id);
  const back = painted('thrones', `back-${hall}`);
  const secs = Math.ceil(left / 1000);

  if (over) {
    const n = game.backs.length;
    const who = screen.showNames ? [...new Set(game.backs.map((b) => b.id))].map(nameOf) : [];
    return (
      <div ref={host} className="mg-stage" style={back ? { backgroundImage: `url(${back})` } : undefined}>
        <div className="mg-over">
          <h1>🎉 What a mingle!</h1>
          <p>{round} {round === 1 ? 'round' : 'rounds'} played. {n === 0 ? 'Nobody needed a station. Amazing groups!' : `${n} ${n === 1 ? 'comeback' : 'comebacks'} at the stations. Great maths!`}</p>
          {who.length > 0 && <p className="mg-over__names">{who.join(' · ')}</p>}
          <button type="button" className="mg-btn mg-btn--go" onClick={onAgain}>Play again</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={host} className={`mg-stage mg-stage--${phase}`} style={back ? { backgroundImage: `url(${back})` } : undefined}>
      <header className="mg-top">
        <b>🕺 Maths Mingle</b>
        <span>{round > 0 ? `Round ${round}` : 'Ready'}</span>
        <span className="mg-chip">{game.level === 'junior' ? 'Junior' : 'Senior'}</span>
        {screen.joinCode && <span className="mg-chip">Join code {screen.joinCode}</span>}
        <span className="mg-top__gap" />
        {sureEnd ? (
          <>
            <button type="button" className="mg-btn mg-btn--stop" onClick={onEnd}>Yes, end the game</button>
            <button type="button" className="mg-btn" onClick={() => setSureEnd(false)}>Keep playing</button>
          </>
        ) : <button type="button" className="mg-btn" onClick={() => setSureEnd(true)}>End</button>}
      </header>

      <main className="mg-main">
        {phase === 'ready' && (
          <div className="mg-card">
            <h1>Ready to mingle?</h1>
            <p>Music on: dance and mingle. Music off: get into groups of the answer!</p>
            <button type="button" className="mg-btn mg-btn--go mg-btn--big" onClick={step}>▶ Start the music</button>
            <small>Space starts each step</small>
          </div>
        )}
        {phase === 'dance' && (
          <div className="mg-card mg-card--dance">
            <div className="mg-notes" aria-hidden="true">{['🎵', '🎶', '🕺', '💃', '🎵'].map((x, i) => <i key={i} style={{ animationDelay: `${i * 0.25}s` }}>{x}</i>)}</div>
            <h1>Dance and mingle!</h1>
            <p>Keep moving around the room…</p>
            <button type="button" className="mg-btn mg-btn--stop mg-btn--big" onClick={() => stopRef.current()}>⏹ Stop the music now</button>
          </div>
        )}
        {(phase === 'call' || phase === 'reveal') && call && (
          <div className="mg-card mg-card--call">
            {phase === 'call' && <div className="mg-stop">STOP!</div>}
            <p className="mg-get">Get into groups of</p>
            <div className={`mg-sum ${/[a-z]/.test(call.sum) ? 'mg-sum--words' : ''}`}>{call.sum}</div>
            {call.twist && <p className="mg-twist">…{call.twist}!</p>}
            {phase === 'call' ? (
              <div className="mg-clock" aria-label={`${secs} seconds left`} style={{ ['--k' as string]: String(left / SCRAMBLE_MS) }}><span>{secs}</span></div>
            ) : (
              <>
                <div className="mg-answer">= {call.size}</div>
                <p className="mg-left">Left over? Go to a station, tap your name and get {game.need} right.</p>
                <button type="button" className="mg-btn mg-btn--go mg-btn--big" onClick={step}>▶ Next round</button>
              </>
            )}
          </div>
        )}
      </main>

      <aside className="mg-jail" aria-label="At the stations">
        <h2>📱 At the stations</h2>
        {inJail.length === 0 ? <p className="mg-jail__none">Nobody right now</p> : (
          <ul>
            {inJail.map((id) => (
              <li key={id}><button type="button" title="Let them back in" onClick={() => onRelease(id)}>{nameOf(id)}</button></li>
            ))}
          </ul>
        )}
        <small>Tap a name to let them back in.</small>
      </aside>

      {flash && (
        <div className="mg-flash" key={flash.key} role="status">
          <div className="mg-confetti" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 7) * 0.08}s` }} />)}
          </div>
          <b>{flash.name}</b>
          <span>is back in!</span>
        </div>
      )}
    </div>
  );
}
