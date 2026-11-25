/**
 * Star Web, the pupil's screen (docs/CLASSLIVE-PLAN.md section 2): the known fact, a keypad (or the real keyboard) to
 * build a fact, a feedback card after each send, and the pupil's own stars. Never shows anyone else's results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import { ARM_NAMES, laggingArm, type StarsReply } from '../../../shared/classlive/stars';
import { ARM_COLOURS, ARM_HINTS, lagHint, useHeldLag } from './arms';
import { MuralPad } from './MuralPad';
import { PadGuard } from './PadGuard';
import { classLiveTrack, useMusic } from './music';
import { SerpentPad } from './SerpentPad';
import { CornersPad } from './CornersPad';
import { ThronesPad } from './ThronesPad';
import { useMusicOn } from './thronesMusic';
import { painted } from './paintedArt';
import type { ClassLiveLink } from './link';
import './controller.css';

const MAX_LEN = 30;
/** How often a device asks for the room (ms). */
export const LOOK_MS = 2000;
type Phase = 'joining' | 'none' | 'error' | 'playing';
type StarsRoom = RoomView & { game: Extract<RoomView['game'], { kind: 'stars' }> };
type Anchor = StarsRoom['game']['anchor'];
type StarsMe = Extract<PlayerView['game'], { kind: 'stars' }>;
type Feedback = { n: number; reply: StarsReply } | { n: number; gentle: string };

const KEYS: { k: string; label: string; aria: string; cls?: string }[] = [
  { k: '7', label: '7', aria: '7' }, { k: '8', label: '8', aria: '8' }, { k: '9', label: '9', aria: '9' }, { k: '÷', label: '÷', aria: 'divided by', cls: 'op' },
  { k: '4', label: '4', aria: '4' }, { k: '5', label: '5', aria: '5' }, { k: '6', label: '6', aria: '6' }, { k: '×', label: '×', aria: 'times', cls: 'op' },
  { k: '1', label: '1', aria: '1' }, { k: '2', label: '2', aria: '2' }, { k: '3', label: '3', aria: '3' }, { k: '−', label: '−', aria: 'minus', cls: 'op' },
  { k: '0', label: '0', aria: '0' }, { k: '.', label: '.', aria: 'point' }, { k: '=', label: '=', aria: 'equals', cls: 'op' }, { k: '+', label: '+', aria: 'plus', cls: 'op' },
];

function Dots({ x, y, small }: { x: number; y: number; small?: boolean }) {
  return (
    <div className={`cl-c-dots${small ? ' cl-c-dots--small' : ''}`} style={{ gridTemplateColumns: `repeat(${y}, 1fr)` }} role="img" aria-label={`${x} rows of ${y} dots`}>
      {Array.from({ length: x * y }, (_, i) => <i key={i} />)}
    </div>
  );
}

const sym = (s: string) => s.replace(/\s+/g, '');

export function Sky({ children, tint, back }: { children: React.ReactNode; tint?: 'serpent' | 'mural' | 'corners' | 'thrones'; back?: string | null }) {
  return (
    <div className={`cl-c${tint ? ` cl-c--${tint}` : ''}`}>
      {back && <div className="cl-c-back" style={{ backgroundImage: `url(${back})` }} aria-hidden="true" />}
      <div className="cl-c-twinkle" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, animationDelay: `${(i % 5) * 0.7}s` }} />)}
      </div>
      <a className="cl-c-hub" href="#/" aria-label="Back to the hub">⌂ Hub</a>
      <div className="cl-c-body">{children}</div>
    </div>
  );
}

function Mine({ me }: { me: PlayerView | null }) {
  if (!me || me.game.kind !== 'stars') return null;
  const { found, glows, mine }: StarsMe = me.game;
  return (
    <section className="cl-c-mine" aria-label="My stars">
      <p className="cl-c-mine__count"><b>⭐ {found}</b> new {found === 1 ? 'star' : 'stars'}{glows > 0 && <> · <b>✨ {glows}</b> {glows === 1 ? 'glow' : 'glows'}</>}</p>
      {mine.length > 0 && <ul className="cl-c-mine__list">{mine.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}</ul>}
    </section>
  );
}

export function Controller({ link, me, room: roomProp, code: codeProp, lookElsewhere, avatar }: {
  link: ClassLiveLink; me: string; room?: number;
  /** A 4-digit code typed in the hub Lobby (a lobby game, or joining their class's game late). */
  code?: string;
  /** The pupil's own hub avatar (Four Corners). */
  avatar?: unknown;
  /** While nothing is on here, looks for another class game (Class Showdown) every few seconds and goes to it. */
  lookElsewhere?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('joining');
  const [error, setError] = useState('');
  const [room, setRoom] = useState<number | null>(roomProp ?? null);
  const [view, setView] = useState<RoomView | null>(null);
  const [mine, setMine] = useState<PlayerView | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A lobby game's code, typed by the pupil (James, 25 Nov 2026: games open to any class).
  const [code, setCode] = useState<string | null>(codeProp ?? null);
  const [typed, setTyped] = useState('');
  const [codeProblem, setCodeProblem] = useState('');
  /** The server's clock minus this device's (from every reply's `now`). */
  const offset = useRef(0);
  const clock = useCallback(() => Date.now() + offset.current, []);

  // Join (and retry while nothing is on, or the network drops).
  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = async () => {
      let r;
      try {
        r = await link.send({ action: 'join', ...(code ? { code } : roomProp ? { room: roomProp } : {}) });
      } catch {
        if (!dead) timer = setTimeout(go, 3000);
        return;
      }
      if (dead) return;
      const b = r.body as { room?: number; view?: RoomView; me?: PlayerView; error?: string; reason?: string; now?: number };
      if (typeof b.now === 'number') offset.current = b.now - Date.now();
      if (r.status === 200 && b.view && b.me && typeof b.room === 'number') {
        setRoom(b.room); setView(b.view); setMine(b.me); setPhase('playing');
      } else if (r.status === 404 && b.reason === 'bad-code') {
        setCodeProblem(b.error ?? "That code didn't work."); setCode(null); setPhase('none');
      } else if (r.status === 404 && b.reason === 'none') {
        setPhase('none'); timer = setTimeout(go, 5000);
      } else if (r.status === 409 && b.reason === 'over') {
        setPhase('none'); timer = setTimeout(go, 5000);
      } else if (r.status === 503) {
        timer = setTimeout(go, 3000);
      } else {
        setError(b.error ?? 'Something went wrong.'); setPhase('error');
      }
    };
    setPhase((p) => (p === 'error' ? 'joining' : p));
    void go();
    return () => { dead = true; if (timer) clearTimeout(timer); };
  }, [link, roomProp, attempt, code]);

  // Live updates. The room comes from every reply and a look every 2 seconds (every 6 once it's over): each device
  // listening to every change of the room row went over Realtime's messages-per-second limit with a class of devices,
  // and changes were dropped (Class Showdown hung in a real class, 24 Nov 2026). The pupil's own row is still live (one
  // message per change, to one device).
  const over = view?.state === 'over';
  useEffect(() => {
    if (phase !== 'playing' || room === null) return;
    const b = link.watchMe(room, me, setMine);
    let stop = false;
    const look = () =>
      link.send({ action: 'look', room }).then(
        (out) => {
          if (stop || out.status !== 200) return;
          if (typeof out.body.now === 'number') offset.current = out.body.now - Date.now();
          if (out.body.view) setView(out.body.view as RoomView);
          if (out.body.me) setMine(out.body.me as PlayerView);
        },
        () => undefined,
      );
    const timer = window.setInterval(() => void look(), over ? 6000 : LOOK_MS);
    return () => { stop = true; window.clearInterval(timer); b(); };
  }, [link, me, room, phase, over]);

  // Class Showdown is on the same Class Live page (James, 24 Nov 2026): a pupil waiting here is taken to it.
  useEffect(() => {
    if (phase !== 'none' || !lookElsewhere) return;
    lookElsewhere();
    const id = window.setInterval(lookElsewhere, 5000);
    return () => window.clearInterval(id);
  }, [phase, lookElsewhere]);

  // The big screen's music on this device too, when the teacher switched that on (James, 25 Nov 2026 NZ).
  const muralGame = view?.game.kind === 'mural' ? view.game : null;
  const padThrones = view?.game.kind === 'thrones' ? view.game : null;
  const padThronesMusic = useMusicOn(padThrones?.round, view?.startedAt ?? null, clock);
  useMusic(phase === 'playing' && view?.padMusic && !(padThrones && view.state === 'live' && !padThronesMusic) ? classLiveTrack(view.state, view.game.kind, { guessing: muralGame?.phase === 'guess', hot: view.game.kind === 'serpent' ? view.game.awake : view.game.kind === 'stars' ? view.game.creature && !view.game.supernova : false, map: view.game.kind === 'corners' ? view.game.map : view.game.kind === 'thrones' ? view.game.hall : undefined }) : null, true);

  if (phase === 'joining') return <Sky><div className="cl-c-center"><p className="cl-c-say">Joining…</p></div></Sky>;
  if (phase === 'none') {
    return (
      <Sky>
        <div className="cl-c-center">
          <div className="cl-c-bigstar" aria-hidden="true">🌙</div>
          <h1 className="cl-c-title">Nothing is on in your class right now.</h1>
          <p className="cl-c-say">Your teacher will start it.</p>
          <form className="cl-c-code" onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(typed)) { setCodeProblem(''); setPhase('joining'); setCode(typed); } }}>
            <label htmlFor="cl-code">Got a code from the big screen?</label>
            <span className="cl-c-code__row">
              <input id="cl-code" className="cl-c-code__input" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="1234" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              <button type="submit" className="cl-c-send" disabled={!/^\d{4}$/.test(typed)}>Join</button>
            </span>
            {codeProblem && <p className="cl-c-code__problem" role="alert">{codeProblem}</p>}
          </form>
        </div>
      </Sky>
    );
  }
  if (phase === 'error' || !view) {
    return (
      <Sky>
        <div className="cl-c-center">
          <p className="cl-c-say" role="alert">{error}</p>
          <button type="button" className="cl-c-send" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      </Sky>
    );
  }

  if (view.game.kind === 'serpent') {
    return (
      <Sky tint="serpent">
        <SerpentPad link={link} room={room} view={view} me={mine} setMe={setMine} setView={setView} />
      </Sky>
    );
  }
  if (view.game.kind === 'thrones') {
    return (
      <Sky tint="thrones" back={painted('thrones', `back-${view.game.hall}`)}>
        <PadGuard><ThronesPad link={link} room={room} view={view} me={mine} setMe={setMine} setView={setView} clock={clock} avatar={avatar} /></PadGuard>
      </Sky>
    );
  }
  if (view.game.kind === 'corners') {
    return (
      <Sky tint="corners" back={painted('corners', `back-${view.game.map}`)}>
        <PadGuard><CornersPad link={link} room={room} view={view} me={mine} setMe={setMine} setView={setView} clock={clock} avatar={avatar} /></PadGuard>
      </Sky>
    );
  }
  if (view.game.kind === 'mural') {
    return (
      <Sky tint="mural">
        <PadGuard><MuralPad link={link} room={room} view={view} me={mine} setMe={setMine} setView={setView} /></PadGuard>
      </Sky>
    );
  }
  return <StarsPlay link={link} room={room} view={view as StarsRoom} mine={mine} setMine={setMine} setView={setView} />;
}

function StarsPlay({ link, room, view, mine, setMine, setView }: { link: ClassLiveLink; room: number | null; view: StarsRoom; mine: PlayerView | null; setMine: (m: PlayerView) => void; setView: React.Dispatch<React.SetStateAction<RoomView | null>> }) {
  const [text, setText] = useState('');
  const [fb, setFb] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const busyRef = useRef(false);
  const fbN = useRef(0);
  const roomRef = useRef<number | null>(null);
  roomRef.current = room;

  const add = useCallback((k: string) => setText((t) => (t.length >= MAX_LEN ? t : t + k)), []);
  const back = useCallback(() => setText((t) => t.slice(0, -1)), []);
  const clear = useCallback(() => setText(''), []);

  const send = useCallback(async () => {
    const t = sym(textRef.current);
    const r0 = roomRef.current;
    if (!t || busyRef.current || r0 === null) return;
    busyRef.current = true; setBusy(true);
    try {
      const r = await link.send({ action: 'play', room: r0, fact: t });
      const b = r.body as { reply?: StarsReply; me?: PlayerView; view?: RoomView; reason?: string };
      if (r.status === 200 && b.reply) {
        const reply = b.reply;
        if (b.me) setMine(b.me);
        if (b.view) setView(b.view);
        setFb({ n: ++fbN.current, reply });
        if (reply.result === 'new' || reply.result === 'again') setText('');
      } else if (r.status === 404 || (r.status === 409 && b.reason === 'over')) {
        setView((v) => (v ? { ...v, state: 'over' } : v));
      } else if (r.status === 409 && b.reason === 'too_soon') {
        setFb({ n: ++fbN.current, gentle: 'One at a time!' });
      } else if (r.status === 409 && b.reason === 'lobby') {
        setFb({ n: ++fbN.current, gentle: 'Wait for the start!' });
      } else if (r.status === 503) {
        setFb({ n: ++fbN.current, gentle: 'The class is busy. Try again!' });
      } else {
        setFb({ n: ++fbN.current, gentle: "That didn't send. Try again!" });
      }
    } catch {
      setFb({ n: ++fbN.current, gentle: "That didn't send. Try again!" });
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [link]);

  // A real keyboard works too.
  const live = view.state === 'live';
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      let handled = true;
      if (/^[0-9.+=×÷−]$/.test(k)) add(k);
      else if (k === '-') add('−');
      else if (k === '*' || k === 'x' || k === 'X') add('×');
      else if (k === '/') add('÷');
      else if (k === 'Backspace') back();
      else if (k === 'Escape') clear();
      else if (k === 'Enter') void send();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, add, back, clear, send]);

  const anchor: Anchor = view.game.anchor;
  const known = `${anchor.x} × ${anchor.y} = ${anchor.p}`;

  // A gentle hint when one arm of the class's web lags well behind (the same rule as the big screen).
  const lag = useHeldLag(view.state === 'live' ? laggingArm(view.game.arms, view.game.total) : null);
  if (view.state === 'over') {
    const mg = mine?.game.kind === 'stars' ? mine.game : null;
    const found = mg?.found ?? 0;
    const glows = mg?.glows ?? 0;
    return (
      <Sky>
        <div className="cl-c-center">
          <div className="cl-c-bigstar" aria-hidden="true">🌟</div>
          <h1 className="cl-c-title">Finished! You found {found} new {found === 1 ? 'star' : 'stars'}</h1>
          {glows > 0 && <p className="cl-c-say">and made {glows} {glows === 1 ? 'star' : 'stars'} glow brighter ✨</p>}
          <Mine me={mine} />
          <p className="cl-c-look">Look at the big screen!</p>
        </div>
      </Sky>
    );
  }

  if (view.state === 'lobby') {
    return (
      <Sky>
        <div className="cl-c-center">
          <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
          <p className="cl-c-known" aria-label={`${anchor.x} times ${anchor.y} equals ${anchor.p}`}>{known}</p>
          <Dots x={anchor.x} y={anchor.y} />
          <p className="cl-c-say">Get ready to find facts we can work out from it.</p>
        </div>
      </Sky>
    );
  }

  const reply = fb && 'reply' in fb ? fb.reply : null;
  const nudge = reply?.nudge ?? null;
  const col = reply && (reply.result === 'new' || reply.result === 'again') ? ARM_COLOURS[reply.star.arm] : undefined;

  return (
    <Sky>
      <header className="cl-c-top">
        <div className="cl-c-top__fact">
          <p className="cl-c-known cl-c-known--small" aria-label={`We know ${anchor.x} times ${anchor.y} equals ${anchor.p}`}>{known}</p>
          <p className="cl-c-q">What else do we know?</p>
        </div>
        <Dots x={anchor.x} y={anchor.y} small />
      </header>
      {lag && lag !== nudge && (
        <p className="cl-c-lag" key={lag} style={{ '--arm': ARM_COLOURS[lag] } as React.CSSProperties}>
          <b>💡 {ARM_NAMES[lag]} needs help.</b> {lagHint(lag, anchor)}
        </p>
      )}

      <div className="cl-c-display" role="status" aria-label="Your fact">
        {text ? <span>{text}</span> : <span className="cl-c-display__hint">12 × 7 = 84</span>}
        <i className="cl-c-caret" aria-hidden="true" />
      </div>

      <div className="cl-c-fb" aria-live="polite">
        {fb && (
          <div key={fb.n} className={`cl-c-card${reply?.result === 'new' ? ' cl-c-card--new' : ''}`} style={col ? ({ '--arm': col } as React.CSSProperties) : undefined}>
            {'gentle' in fb ? <p className="cl-c-card__text">{fb.gentle}</p> : <FeedbackBody reply={fb.reply} anchor={anchor} />}
            {nudge && <p className="cl-c-nudge">Nobody has lit {ARM_NAMES[nudge]} yet. {ARM_HINTS[nudge]}</p>}
            {reply?.result === 'new' && (
              <span className="cl-c-burst" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="cl-c-keys" role="group" aria-label="Keypad">
        {KEYS.map((k) => (
          <button key={k.k} type="button" className={`cl-c-key${k.cls ? ` cl-c-key--${k.cls}` : ''}`} aria-label={k.aria} onClick={() => add(k.k)}>{k.label}</button>
        ))}
        <button type="button" className="cl-c-key cl-c-key--fn" aria-label="Backspace" onClick={back}>⌫</button>
        <button type="button" className="cl-c-key cl-c-key--fn cl-c-key--clear" aria-label="Clear" onClick={clear}>Clear</button>
        <button type="button" className="cl-c-send" disabled={busy || !text} onClick={() => void send()}>Send ⭐</button>
      </div>

      <Mine me={mine} />
    </Sky>
  );
}

function FeedbackBody({ reply, anchor }: { reply: StarsReply; anchor: Anchor }) {
  switch (reply.result) {
    case 'new':
      return (
        <>
          <p className="cl-c-card__head" style={{ color: ARM_COLOURS[reply.star.arm] }}>⭐ New star!</p>
          <p className="cl-c-card__arm" style={{ color: ARM_COLOURS[reply.star.arm] }}>{ARM_NAMES[reply.star.arm]}</p>
          <p className="cl-c-card__text">{reply.star.how}</p>
        </>
      );
    case 'again':
      return <p className="cl-c-card__text">Someone found that one too — it shines brighter! Can you find a new one?</p>;
    case 'same':
      return <p className="cl-c-card__text">That's the fact we already know! Find a new one.</p>;
    case 'unlinked':
      return <p className="cl-c-card__text">True! But how does it link to {anchor.x} × {anchor.y}?</p>;
    case 'wrong':
      return <p className="cl-c-card__text">Not quite. Check it again.</p>;
    case 'unreadable':
      return <p className="cl-c-card__text">Write it like 12 × 7 = 84.</p>;
    case 'full':
      return <p className="cl-c-card__text">The sky is full! Look at the big screen.</p>;
  }
}
