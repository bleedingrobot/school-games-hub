/**
 * Class Live's projector (docs/CLASSLIVE-PLAN.md sections 1, 2 and 5): the full-window night sky the teacher puts on the
 * board. Setup (pick the game), lobby (the fact and who has joined), live (the Star Web sky), over (the finish and
 * shout-outs). It listens to the room's screen row, animates each new event once (never the ones it has seen), and only
 * ever draws good things: there are no wrong answers in the screen data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARMS, ARM_GOAL, ARM_NAMES, SUPERNOVA, type Arm, type Star } from '../../../shared/classlive/stars';
import type { Event, ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { ARM_COLOURS } from './arms';
import type { ClassLiveLink, Reply } from './link';
import { NightBackdrop, PLAYER_COLOURS, StarSky } from './StarSky';
import './projector.css';

const ROOM_KEY = 'classlive-room';
type Ev = Event & { seq: number };
type LevelPick = 'small' | 'middle' | 'big' | 'pick';
const LEVEL_WORDS: { id: LevelPick; label: string }[] = [
  { id: 'small', label: 'Up to 5s' },
  { id: 'middle', label: 'Up to 10s' },
  { id: 'big', label: 'Up to 12s' },
  { id: 'pick', label: 'Pick the fact' },
];
const TIMERS = [0, 5, 10, 15];

function roomFromUrl(): number | null {
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('room');
    const hash = window.location.hash;
    const fromHash = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?'))).get('room') : null;
    const n = Number(fromSearch ?? fromHash ?? window.sessionStorage.getItem(ROOM_KEY));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
function keepRoom(room: number | null) {
  try {
    if (room) window.sessionStorage.setItem(ROOM_KEY, String(room));
    else window.sessionStorage.removeItem(ROOM_KEY);
  } catch { /* storage can be blocked */ }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Fx {
  arriving: Set<number>;
  fresh: Record<number, string>;
  pulsing: Set<number>;
  drawing: Set<Arm>;
  swim: boolean;
  nova: number;
}
const NO_FX: Fx = { arriving: new Set(), fresh: {}, pulsing: new Set(), drawing: new Set(), swim: false, nova: 0 };

export function Projector({ link, classId, className, sound }: { link: ClassLiveLink; classId: string; className?: string; sound: ClassLiveSound }) {
  const [room, setRoom] = useState<number | null>(null);
  const [screen, setScreenState] = useState<ScreenView | null>(null);
  const [resuming, setResuming] = useState<boolean>(() => roomFromUrl() !== null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [muted, setMuted] = useState(() => sound.muted());
  const [fx, setFx] = useState<Fx>(NO_FX);
  const [now, setNow] = useState(() => Date.now());
  const [hideResults, setHideResults] = useState(false);
  const offset = useRef(0);
  const screenRef = useRef<ScreenView | null>(null);
  const seen = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const sentTimeUp = useRef(false);
  const roomRef = useRef<number | null>(null);
  roomRef.current = room;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const flag = useCallback(<K extends 'arriving' | 'pulsing' | 'drawing'>(key: K, value: Fx[K] extends Set<infer T> ? T : never, ms: number) => {
    setFx((f) => ({ ...f, [key]: new Set([...(f[key] as Set<unknown>), value]) }));
    later(() => setFx((f) => { const s = new Set(f[key] as Set<unknown>); s.delete(value); return { ...f, [key]: s }; }), ms);
  }, [later]);

  const animate = useCallback((s: ScreenView, events: Ev[]) => {
    const nameOf = (id: string) => s.people.find((p) => p.id === id)?.name ?? null;
    for (const e of events) {
      if (e.type === 'join') sound.play('twinkle');
      else if (e.type === 'start') sound.play('drum');
      else if (e.type === 'star') {
        const id = e.star.id;
        flag('arriving', id, 1300);
        sound.play('whoosh');
        later(() => sound.play('twinkle'), 800);
        const who = nameOf(e.pupil);
        if (who) {
          setFx((f) => ({ ...f, fresh: { ...f.fresh, [id]: who } }));
          later(() => setFx((f) => { const n = { ...f.fresh }; delete n[id]; return { ...f, fresh: n }; }), 5200);
        }
      } else if (e.type === 'glow') {
        flag('pulsing', e.id, 1700);
        sound.play('glow');
      } else if (e.type === 'arm_lit') {
        flag('drawing', e.arm, 2600);
        sound.play('chime');
      } else if (e.type === 'creature') {
        setFx((f) => ({ ...f, swim: true }));
        later(() => setFx((f) => ({ ...f, swim: false })), 26000);
        sound.play('swell');
      } else if (e.type === 'supernova') {
        setFx((f) => ({ ...f, nova: f.nova + 1 }));
        later(() => setFx((f) => ({ ...f, nova: 0 })), 4200);
        sound.play('fanfare');
      } else if (e.type === 'over') sound.play('swell');
    }
  }, [flag, later, sound]);

  const applyScreen = useCallback((next: ScreenView) => {
    const cur = screenRef.current;
    if (cur && next.seq < cur.seq) return;
    screenRef.current = next;
    setScreenState(next);
    const events = (next.events as Ev[]).slice().sort((a, b) => a.seq - b.seq);
    if (seen.current === null) {
      seen.current = events.length ? events[events.length - 1].seq : next.seq;
      return;
    }
    const fresh = events.filter((e) => e.seq > (seen.current as number));
    if (fresh.length) {
      seen.current = fresh[fresh.length - 1].seq;
      animate(next, fresh);
    }
  }, [animate]);

  const take = useCallback((r: Reply) => {
    if (typeof r.body.now === 'number') offset.current = r.body.now - Date.now();
    if (r.status === 200 && r.body.screen) applyScreen(r.body.screen as ScreenView);
  }, [applyScreen]);

  const forget = useCallback(() => {
    keepRoom(null);
    screenRef.current = null;
    seen.current = null;
    sentTimeUp.current = false;
    setRoom(null);
    setScreenState(null);
    setFx(NO_FX);
    setHideResults(false);
  }, []);

  // Pick a kept room back up.
  useEffect(() => {
    const kept = roomFromUrl();
    if (!kept) return;
    let live = true;
    void link.send({ action: 'view', room: kept }).then((r) => {
      if (!live) return;
      setResuming(false);
      if (r.status === 200) {
        take(r);
        keepRoom(kept);
        setRoom(kept);
      } else {
        if (r.status === 403 || r.status === 404) forget();
        else setProblem(String(r.body.error ?? 'Could not pick the room back up.'));
      }
    }, () => { if (live) { setResuming(false); setProblem('Could not reach the server.'); } });
    return () => { live = false; };
  }, [link, take, forget]);

  // Listen to the screen.
  useEffect(() => {
    if (!room) return;
    return link.watchScreen(room, applyScreen);
  }, [room, link, applyScreen]);

  // The clock.
  const live = screen?.state === 'live';
  const timed = !!screen && screen.lengthMin > 0 && screen.startedAt !== null;
  useEffect(() => {
    if (!live || !timed) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live, timed]);
  const leftMs = live && timed && screen ? (screen.startedAt as number) + screen.lengthMin * 60_000 - (now + offset.current) : null;
  useEffect(() => {
    if (leftMs !== null && leftMs <= 0 && room && !sentTimeUp.current) {
      sentTimeUp.current = true;
      void link.send({ action: 'view', room }).then(take, () => undefined);
    }
  }, [leftMs, room, link, take]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    const r = await link.send(body).catch(() => ({ status: 0, body: { error: 'Could not reach the server.' } }) as Reply);
    take(r);
    return r;
  }, [link, take]);

  const open = async (body: Record<string, unknown>) => {
    setBusy(true);
    setProblem('');
    const r = await act({ action: 'open', classId, activity: 'stars', ...body });
    setBusy(false);
    if (r.status === 200 && typeof r.body.room === 'number') {
      keepRoom(r.body.room);
      setRoom(r.body.room);
    } else setProblem(String(r.body.error ?? 'Could not open the room.'));
  };

  const toggleSound = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  const state = screen?.state ?? null;
  const game = screen?.game ?? null;

  return (
    <div className={`cl-p cl-p--${state ?? 'setup'}`}>
      <NightBackdrop />
      <div className={`cl-bar ${barOpen ? 'cl-bar--open' : ''}`}>
        <button type="button" className="cl-bar__tab" onClick={() => setBarOpen(!barOpen)} aria-expanded={barOpen} aria-label={barOpen ? 'Hide the teacher bar' : 'Show the teacher bar'}>{barOpen ? '▲' : '☰'}</button>
        {barOpen && (
          <div className="cl-bar__row">
            <a className="cl-btn cl-btn--small" href="#/">⌂ Hub</a>
            <button type="button" className="cl-btn cl-btn--small" onClick={toggleSound} aria-pressed={!muted}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            {screen && <span className="cl-bar__name">Star Web</span>}
            {leftMs !== null && <span className={`cl-bar__time ${leftMs < 30_000 ? 'cl-bar__time--low' : ''}`} role="timer">{mmss(leftMs)}</span>}
            {screen && screen.state !== 'over' && room && (
              <button type="button" className="cl-btn cl-btn--small cl-btn--danger" onClick={() => void act({ action: 'end', room })}>End</button>
            )}
          </div>
        )}
      </div>

      {!screen && (resuming ? <div className="cl-center"><p className="cl-center__word">Finding your room…</p></div> : <Setup busy={busy} problem={problem} onOpen={open} />)}

      {screen && game && state === 'lobby' && room && (
        <Lobby screen={screen} className={className} onStart={() => void act({ action: 'start', room })} />
      )}

      {screen && game && (state === 'live' || state === 'over') && (
        <>
          <StarSky
            game={game}
            fresh={fx.fresh}
            arriving={fx.arriving}
            pulsing={fx.pulsing}
            drawing={fx.drawing}
            swim={fx.swim}
            over={state === 'over'}
            nova={fx.nova}
            onPick={state === 'live' && room ? (id) => void act({ action: 'spotlight', room, id }) : undefined}
          />
          <Hud screen={screen} />
          {state === 'live' && game.spotlight !== null && room && <Spotlight screen={screen} onBack={() => void act({ action: 'spotlight', room, id: null })} />}
          {state === 'over' && (hideResults
            ? <button type="button" className="cl-btn cl-results-tab" onClick={() => setHideResults(false)}>★ Show the results</button>
            : <Finish screen={screen} onAgain={forget} onSky={() => setHideResults(true)} />)}
        </>
      )}
    </div>
  );
}

/* ---------------- setup ---------------- */

function Setup({ busy, problem, onOpen }: { busy: boolean; problem: string; onOpen: (body: Record<string, unknown>) => void }) {
  const [level, setLevel] = useState<LevelPick>('middle');
  const [x, setX] = useState('6');
  const [y, setY] = useState('7');
  const [length, setLength] = useState(0);
  const xi = Number(x);
  const yi = Number(y);
  const okPick = Number.isInteger(xi) && Number.isInteger(yi) && xi >= 2 && xi <= 12 && yi >= 2 && yi <= 12 && xi !== yi;
  const own = level === 'pick';
  const canOpen = !busy && (!own || okPick);
  return (
    <div className="cl-setup">
      <h1 className="cl-setup__title">Class Live</h1>
      <p className="cl-setup__sub">Pick a game for the big screen</p>
      <div className="cl-cards">
        <section className="cl-card cl-card--active" aria-label="Star Web">
          <h2 className="cl-card__name">★ Star Web</h2>
          <p className="cl-card__blurb">One fact glows in the sky. What else can we work out from it?</p>
          <div className="cl-opt">
            <span className="cl-opt__label">Which facts?</span>
            <div className="cl-chips" role="group" aria-label="Level">
              {LEVEL_WORDS.map((l) => (
                <button key={l.id} type="button" className={`cl-choice ${level === l.id ? 'cl-choice--on' : ''}`} aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.label}</button>
              ))}
            </div>
            {own && (
              <div className="cl-pick">
                <input className="cl-num" type="number" inputMode="numeric" min={2} max={12} value={x} onChange={(e) => setX(e.target.value)} aria-label="First number, 2 to 12" />
                <span className="cl-pick__times">×</span>
                <input className="cl-num" type="number" inputMode="numeric" min={2} max={12} value={y} onChange={(e) => setY(e.target.value)} aria-label="Second number, 2 to 12" />
                {!okPick && <span className="cl-pick__hint">Two different numbers, 2 to 12</span>}
              </div>
            )}
          </div>
          <div className="cl-opt">
            <span className="cl-opt__label">Timer</span>
            <div className="cl-chips" role="group" aria-label="Timer">
              {TIMERS.map((m) => (
                <button key={m} type="button" className={`cl-choice ${length === m ? 'cl-choice--on' : ''}`} aria-pressed={length === m} onClick={() => setLength(m)}>{m === 0 ? 'No timer' : `${m} min`}</button>
              ))}
            </div>
          </div>
          {problem && <p className="cl-problem" role="alert">{problem}</p>}
          <button type="button" className="cl-btn cl-btn--go" disabled={!canOpen} onClick={() => onOpen({ level: own ? 'middle' : level, length, ...(own ? { x: xi, y: yi } : {}) })}>{busy ? 'Opening…' : 'Open the room'}</button>
        </section>
        <section className="cl-card cl-card--soon" aria-label="Serpent Chain, coming soon" aria-disabled="true">
          <h2 className="cl-card__name">🐍 Serpent Chain</h2>
          <p className="cl-card__blurb">A chain of sums winds up the temple.</p>
          <span className="cl-soon">Coming soon</span>
        </section>
        <section className="cl-card cl-card--soon" aria-label="Mystery Mural, coming soon" aria-disabled="true">
          <h2 className="cl-card__name">🎨 Mystery Mural</h2>
          <p className="cl-card__blurb">Your maths uncovers a hidden painting.</p>
          <span className="cl-soon">Coming soon</span>
        </section>
      </div>
    </div>
  );
}

/* ---------------- lobby ---------------- */

function Chip({ p, i }: { p: ScreenView['people'][number]; i: number }) {
  const colour = PLAYER_COLOURS[p.colour % 12];
  return (
    <span className="cl-who" style={{ ['--fx' as string]: `${((i * 53) % 80) - 40}vw`, ['--fy' as string]: `${((i * 29) % 40) + 20}vh`, ['--c' as string]: colour }}>
      <i className="cl-who__dot" />
      {p.name && <span className="cl-who__name">{p.name}</span>}
    </span>
  );
}

function Lobby({ screen, className, onStart }: { screen: ScreenView; className?: string; onStart: () => void }) {
  const { x, y, p } = screen.game.anchor;
  const n = screen.people.length;
  return (
    <div className="cl-lobby">
      <h1 className="cl-lobby__title">Star Web</h1>
      <div className="cl-lobby__fact">{x} × {y} = {p}</div>
      <div className="cl-array" style={{ ['--rows' as string]: x, ['--cols' as string]: y, gridTemplateColumns: `repeat(${y}, var(--d))` }} aria-label={`${x} rows of ${y} dots`}>
        {Array.from({ length: x * y }, (_, i) => <i key={i} className="cl-array__dot" style={{ animationDelay: `${(i % 12) * 0.12}s` }} />)}
      </div>
      <p className="cl-lobby__ask">What else can we find from this one fact?</p>
      <div className="cl-lobby__join">Join now!{className ? <span className="cl-lobby__class"> {className}</span> : null}</div>
      <div className="cl-lobby__count" aria-live="polite">{n === 0 ? 'Waiting for the first star…' : `${n} ${n === 1 ? 'pupil' : 'pupils'} joined`}</div>
      <div className="cl-crowd" style={{ ['--k' as string]: Math.max(1.9, Math.min(3.6, 4 - n * 0.06)) }}>
        {screen.people.map((pp, i) => <Chip key={pp.id} p={pp} i={i} />)}
      </div>
      <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onStart}>Start</button>
    </div>
  );
}

/* ---------------- live: counters, spotlight ---------------- */

function Hud({ screen }: { screen: ScreenView }) {
  const total = screen.game.stars.length;
  const pct = Math.min(100, (total / SUPERNOVA) * 100);
  return (
    <div className="cl-hud">
      <span className="cl-hud__total"><b>{total}</b> {total === 1 ? 'star' : 'stars'}</span>
      <span className="cl-hud__nova" role="progressbar" aria-valuemin={0} aria-valuemax={SUPERNOVA} aria-valuenow={Math.min(total, SUPERNOVA)} aria-label="Supernova progress">
        <span className="cl-hud__fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
      <span className="cl-hud__goal">{screen.game.supernova ? '💥 Supernova!' : `Supernova at ${SUPERNOVA}`}</span>
    </div>
  );
}

function Spotlight({ screen, onBack }: { screen: ScreenView; onBack: () => void }) {
  const star = screen.game.stars.find((s) => s.id === screen.game.spotlight);
  if (!star) return null;
  const by = screen.people.find((p) => p.id === star.by)?.name ?? null;
  const colour = ARM_COLOURS[star.arm];
  return (
    <div className="cl-spot" role="dialog" aria-label="Star in the spotlight" style={{ ['--arm' as string]: colour }}>
      <div className="cl-spot__arm">{ARM_NAMES[star.arm]}</div>
      <div className="cl-spot__text">{star.text}</div>
      <div className="cl-spot__how">{star.how}</div>
      {by && <div className="cl-spot__by">Found by {by}</div>}
      <button type="button" className="cl-btn cl-btn--go" onClick={onBack}>Back to the sky</button>
    </div>
  );
}

/* ---------------- over ---------------- */

export function shoutOuts(screen: ScreenView): string[] {
  if (!screen.showNames) return [];
  const { stars, mine } = screen.game;
  const name = (id: string) => screen.people.find((p) => p.id === id)?.name ?? null;
  const out: string[] = [];
  const ordered = stars.slice().sort((a, b) => a.at - b.at || a.id - b.id);
  const best = (score: (id: string) => number): { id: string; v: number } | null => {
    let top: { id: string; v: number } | null = null;
    for (const p of screen.people) {
      const v = score(p.id);
      if (v > 0 && (!top || v > top.v)) top = { id: p.id, v };
    }
    return top;
  };
  const first = ordered[0];
  if (first && name(first.by)) out.push(`⭐ First star: ${name(first.by)} found ${first.text}`);
  const most = best((id) => mine[id]?.found ?? 0);
  if (most && name(most.id)) out.push(`🌟 Most new stars: ${name(most.id)} (${most.v})`);
  const kinds = best((id) => new Set(stars.filter((s) => s.by === id).map((s) => s.arm)).size);
  if (kinds && name(kinds.id)) out.push(`🌈 Most kinds of link: ${name(kinds.id)} (${kinds.v} of ${ARMS.length})`);
  const glows = best((id) => mine[id]?.glows ?? 0);
  if (glows && name(glows.id)) out.push(`✨ Found it again most: ${name(glows.id)} (${glows.v})`);
  const counts = ARMS.map((a) => ({ a, n: stars.filter((s) => s.arm === a).length })).filter((c) => c.n > 0);
  const fewest = counts.sort((a, b) => a.n - b.n)[0];
  const rare = fewest && ordered.find((s) => s.arm === fewest.a && name(s.by));
  if (rare) out.push(`💎 A rare ${ARM_NAMES[rare.arm].toLowerCase()} fact from ${name(rare.by)}: ${rare.text}`);
  const last: Star | undefined = ordered[ordered.length - 1];
  if (last && last !== first && name(last.by)) out.push(`🏁 Last star: ${name(last.by)} found ${last.text}`);
  return out.slice(0, 6);
}

function Finish({ screen, onAgain, onSky }: { screen: ScreenView; onAgain: () => void; onSky: () => void }) {
  const g = screen.game;
  const lit = ARMS.filter((a) => g.stars.filter((s) => s.arm === a).length >= ARM_GOAL[a]);
  const shouts = useMemo(() => shoutOuts(screen), [screen]);
  return (
    <div className="cl-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">{g.creature ? 'What a sky!' : 'Look what we found!'}</h2>
      <p className="cl-finish__count"><b>{g.stars.length}</b> {g.stars.length === 1 ? 'star' : 'stars'} in the sky{g.supernova ? ' and a supernova!' : ''}</p>
      <ul className="cl-finish__arms" aria-label="Which kinds of fact we lit">
        {ARMS.map((a) => (
          <li key={a} className={lit.includes(a) ? 'cl-lit' : 'cl-dim'} style={{ ['--arm' as string]: ARM_COLOURS[a] }}>{ARM_NAMES[a]}</li>
        ))}
      </ul>
      {shouts.length > 0 && (
        <ul className="cl-shouts" aria-label="Shout-outs">
          {shouts.map((s, i) => <li key={i} style={{ animationDelay: `${0.3 + i * 0.25}s` }}>{s}</li>)}
        </ul>
      )}
      <div className="cl-finish__row">
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Again?</button>
        <button type="button" className="cl-btn" onClick={onSky}>See the sky</button>
      </div>
    </div>
  );
}
