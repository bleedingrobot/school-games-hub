/**
 * Star Web, the pupil's screen (docs/CLASSLIVE-PLAN.md section 2): the known fact, a keypad (or the real keyboard) to
 * build a fact, a feedback card after each send, and the pupil's own stars. Never shows anyone else's results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import { ARM_NAMES, type StarsReply } from '../../../shared/classlive/stars';
import { ARM_COLOURS, ARM_HINTS } from './arms';
import type { ClassLiveLink } from './link';
import './controller.css';

const MAX_LEN = 30;
type Phase = 'joining' | 'none' | 'error' | 'playing';
type Anchor = Extract<RoomView['game'], { kind: 'stars' }>['anchor'];
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

function Sky({ children }: { children: React.ReactNode }) {
  return (
    <div className="cl-c">
      <div className="cl-c-twinkle" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, animationDelay: `${(i % 5) * 0.7}s` }} />)}
      </div>
      <a className="cl-c-hub" href="#/" aria-label="Back to the hub">⌂ Hub</a>
      <div className="cl-c-body">{children}</div>
    </div>
  );
}

function Mine({ me }: { me: PlayerView | null }) {
  if (!me) return null;
  const { found, glows, mine } = me.game;
  return (
    <section className="cl-c-mine" aria-label="My stars">
      <p className="cl-c-mine__count"><b>⭐ {found}</b> new {found === 1 ? 'star' : 'stars'}{glows > 0 && <> · <b>✨ {glows}</b> {glows === 1 ? 'glow' : 'glows'}</>}</p>
      {mine.length > 0 && <ul className="cl-c-mine__list">{mine.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}</ul>}
    </section>
  );
}

export function Controller({ link, me, room: roomProp }: { link: ClassLiveLink; me: string; room?: number }) {
  const [phase, setPhase] = useState<Phase>('joining');
  const [error, setError] = useState('');
  const [room, setRoom] = useState<number | null>(roomProp ?? null);
  const [view, setView] = useState<RoomView | null>(null);
  const [mine, setMine] = useState<PlayerView | null>(null);
  const [text, setText] = useState('');
  const [fb, setFb] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const textRef = useRef(text);
  textRef.current = text;
  const busyRef = useRef(false);
  const fbN = useRef(0);
  const roomRef = useRef<number | null>(null);
  roomRef.current = room;

  // Join (and retry while nothing is on, or the network drops).
  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = async () => {
      let r;
      try {
        r = await link.send({ action: 'join', ...(roomProp ? { room: roomProp } : {}) });
      } catch {
        if (!dead) timer = setTimeout(go, 3000);
        return;
      }
      if (dead) return;
      const b = r.body as { room?: number; view?: RoomView; me?: PlayerView; error?: string; reason?: string };
      if (r.status === 200 && b.view && b.me && typeof b.room === 'number') {
        setRoom(b.room); setView(b.view); setMine(b.me); setPhase('playing');
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
  }, [link, roomProp, attempt]);

  // Live updates.
  useEffect(() => {
    if (phase !== 'playing' || room === null) return;
    const a = link.watchRoom(room, setView);
    const b = link.watchMe(room, me, setMine);
    return () => { a(); b(); };
  }, [link, me, room, phase]);

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
  const live = phase === 'playing' && view?.state === 'live';
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

  if (phase === 'joining') return <Sky><div className="cl-c-center"><p className="cl-c-say">Joining…</p></div></Sky>;
  if (phase === 'none') {
    return (
      <Sky>
        <div className="cl-c-center">
          <div className="cl-c-bigstar" aria-hidden="true">🌙</div>
          <h1 className="cl-c-title">Nothing is on in your class right now.</h1>
          <p className="cl-c-say">Your teacher will start it.</p>
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

  const anchor: Anchor = view.game.anchor;
  const known = `${anchor.x} × ${anchor.y} = ${anchor.p}`;

  if (view.state === 'over') {
    const found = mine?.game.found ?? 0;
    const glows = mine?.game.glows ?? 0;
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
