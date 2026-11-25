/**
 * Class Live's projector (docs/CLASSLIVE-PLAN.md sections 1, 2 and 5): the full-window night sky the teacher puts on the
 * board. Setup (pick the game), lobby (the fact and who has joined), live (the Star Web sky), over (the finish and
 * shout-outs). It listens to the room's screen row, animates each new event once (never the ones it has seen), and only
 * ever draws good things: there are no wrong answers in the screen data.
 */
import { classLiveTrack, HOT_MS, musicSettings, useMusic } from './music';
import { MusicControl } from './MusicControl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_WORDS, LIVE_GAMES, liveGame, type LiveGame, type LiveGroup } from './gameList';
import { ARMS, ARM_GOAL, ARM_NAMES, SUPERNOVA, armCounts, laggingArm, type Arm, type Star, type StarsGame } from '../../../shared/classlive/stars';
import { GUESS_MS, PICTURES, type MuralGame } from '../../../shared/classlive/mural';
import { BODY, SERPENT_LEVELS, SERPENT_LEVEL_ABOUT, SERPENT_LEVEL_NAMES, stepText, wakeAt, type SerpentGame, type SerpentLevel } from '../../../shared/classlive/serpent';
import { ACTIVITY_NAMES, type Activity, type Event, type ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { ARM_COLOURS, lagHint, useHeldLag } from './arms';
import type { ClassLiveLink, Reply } from './link';
import { NightBackdrop, PLAYER_COLOURS, StarSky } from './StarSky';
import { ShowdownCard } from './ShowdownCard';
import type { ShowdownStart } from '../showdown/Projector';
import { MuralCloth, MuralScene, NO_MURAL_FX, type MuralFx } from './MuralScene';
import { CoiledSerpent, JungleBackdrop, NO_SERPENT_FX, SerpentAmbience, SerpentScene, type SerpentFx } from './SerpentScene';
import './projector.css';
import { painted } from './paintedArt';
import { HowTo } from './HowTo';
import { CornersScene } from './CornersScene';
import { ClashScene } from './ClashScene';
import { ClashCard } from './ClashCard';
import { ClashGuide } from './ClashGuide';
import { MAP_WORDS as CLASH_WORDS, type ClashMap } from '../../../shared/classlive/clash';
import { CornersGuide } from './CornersGuide';
import { LavaCard, LavaLobbyHead, LavaScene } from './LavaScene';
import { ThronesScene } from './ThronesScene';
import { ThronesCard, ThronesLobbyHead } from './ThronesCard';
import { useMusicOn } from './thronesMusic';
import { GhostScene } from './GhostScene';
import { GhostLobbyHead, GhostPickCard } from './GhostCard';
// Shark Bay
import { SharkScene } from './SharkScene';
import { SharkGuide } from './SharkGuide';
import { BAYS, BAY_WORDS, isShark, type BayMap } from '../../../shared/classlive/shark';
import { MAPS, MAP_WORDS, RUN_DEFAULT_S, RUN_MAX_S, RUN_MIN_S, type CornerMap } from '../../../shared/classlive/corners';

const RUN_CHOICES = Array.from({ length: RUN_MAX_S - RUN_MIN_S + 1 }, (_, i) => RUN_MIN_S + i);
import { speak } from '../../speech';
import { next, VOICE_FOLDER } from './voiceLines';

const ROOM_KEY = 'classlive-room';
type Ev = Event & { seq: number };
type LevelPick = 'small' | 'middle' | 'big' | 'pick';
const LEVEL_WORDS: { id: LevelPick; label: string }[] = [
  { id: 'small', label: 'Up to 5s' },
  { id: 'middle', label: 'Up to 10s' },
  { id: 'big', label: 'Up to 12s' },
  { id: 'pick', label: 'Pick the fact' },
];
const TIMERS = [0, 2, 3, 5, 10, 15];

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
  serpent: SerpentFx;
  mural: MuralFx;
}
const NO_FX: Fx = { arriving: new Set(), fresh: {}, pulsing: new Set(), drawing: new Set(), swim: false, nova: 0, serpent: NO_SERPENT_FX, mural: NO_MURAL_FX };

export function Projector({ link, classId, className, sound, onShowdown }: {
  link: ClassLiveLink; classId: string; className?: string; sound: ClassLiveSound;
  /** Class Showdown is on the same picker (James, 24 Nov 2026: one Class Live page); null when it is switched off. */
  onShowdown?: ((s: ShowdownStart) => void) | null;
}) {
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
  /** How to play, shown when the teacher presses Start in the lobby; "Let's play!" starts the game. */
  const [showHow, setShowHow] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const bannerKey = useRef(0);
  const offset = useRef(0);
  const serverClock = useCallback(() => Date.now() + offset.current, []);
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

  /** Bella says a line (after the sound effect), unless the sound is off. */
  const say = useCallback((text: string, delay = 0) => {
    later(() => { if (!sound.muted()) speak(text, VOICE_FOLDER); }, delay);
  }, [later, sound]);

  const animate = useCallback((s: ScreenView, events: Ev[]) => {
    const nameOf = (id: string) => s.people.find((p) => p.id === id)?.name ?? null;
    sound.setKit(s.game.kind);
    for (const e of events) {
      const sx = (change: (f: SerpentFx) => SerpentFx) => setFx((f) => ({ ...f, serpent: change(f.serpent) }));
      const banner = (text: string, ms: number) => {
        const key = ++bannerKey.current;
        sx((f) => ({ ...f, banner: { text, key } }));
        later(() => sx((f) => (f.banner?.key === key ? { ...f, banner: null } : f)), ms);
      };
      const mx = (change: (f: MuralFx) => MuralFx) => setFx((f) => ({ ...f, mural: change(f.mural) }));
      const mbanner = (text: string, ms: number) => {
        const key = ++bannerKey.current;
        mx((f) => ({ ...f, banner: { text, key } }));
        later(() => mx((f) => (f.banner?.key === key ? { ...f, banner: null } : f)), ms);
      };
      if (e.type === 'join') sound.play('join');
      else if (e.type === 'start') {
        sound.play('start');
        // Four Corners' scene says its own start, with the first round.
        if (s.game.kind !== 'corners' && s.game.kind !== 'ghost' && s.game.kind !== 'thrones' && s.game.kind !== 'lava') say(s.game.kind === 'serpent' ? next('startSerpent') : s.game.kind === 'mural' ? next('startMural') : next('startStars'), 900);
      }
      else if (e.type === 'climb') {
        const id = e.pupil;
        sx((f) => ({ ...f, hopping: new Set([...f.hopping, id]) }));
        later(() => sx((f) => { const h = new Set(f.hopping); h.delete(id); return { ...f, hopping: h }; }), 750);
        sound.play('climb');
      } else if (e.type === 'head') {
        const who = nameOf(e.pupil);
        banner(e.place === 1 ? `${who ?? 'Someone'} reached the head!` : `${who ?? 'Someone else'} reached the head too!`, 2600);
        sound.play('head');
        sx((f) => ({ ...f, headPulse: f.headPulse + 1 }));
        if (e.place === 1) say(next('head'), 600);
      } else if (e.type === 'tail') {
        sx((f) => ({ ...f, tailPulse: f.tailPulse + 1 }));
        later(() => sx((f) => ({ ...f, tailPulse: 0 })), 1800);
        sound.play('tail');
      } else if (e.type === 'awake') {
        sx((f) => ({ ...f, shake: true }));
        later(() => sx((f) => ({ ...f, shake: false })), 1500);
        banner('The serpent wakes!', 2600);
        sound.play('awake');
        say(next('awake'), 1600);
      } else if (e.type === 'star') {
        const id = e.star.id;
        flag('arriving', id, 1300);
        sound.play('star');
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
        sound.play('arm');
        say(next('armLit'), 700);
      } else if (e.type === 'creature') {
        setFx((f) => ({ ...f, swim: true }));
        later(() => setFx((f) => ({ ...f, swim: false })), 26000);
        sound.play('creature');
        say(next('creature'), 1200);
      } else if (e.type === 'supernova') {
        setFx((f) => ({ ...f, nova: f.nova + 1 }));
        later(() => setFx((f) => ({ ...f, nova: 0 })), 4200);
        sound.play('supernova');
        say(next('supernova'), 1500);
      } else if (e.type === 'flip') {
        const p = s.people.find((x) => x.id === e.pupil);
        const tile = e.tile;
        mx((f) => ({ ...f, fresh: { ...f.fresh, [tile]: { name: p?.name ?? null, colour: p?.colour ?? 0 } } }));
        later(() => mx((f) => { const n = { ...f.fresh }; delete n[tile]; return { ...f, fresh: n }; }), 3800);
        sound.play('flip');
      } else if (e.type === 'guess_time') {
        mbanner('Time to guess!', 3200);
        sound.play('guess');
        say(next('guessTime'), 600);
      } else if (e.type === 'picked') {
        sound.play('pick');
      } else if (e.type === 'guessed') {
        const who = nameOf(e.pupil);
        mbanner(e.place === 1 ? `${who ?? 'Someone'} got it first!` : `${who ?? 'Someone else'} got it too!`, 2600);
        sound.play('pick');
        if (e.place === 1) say(next('guessed'), 500);
      } else if (e.type === 'reveal') {
        mx((f) => ({ ...f, revealing: true }));
        later(() => mx((f) => ({ ...f, revealing: false })), 9000);
        sound.play('reveal');
        say(next('reveal'), 1200);
      } else if (e.type === 'over') {
        if (s.game.kind === 'mural' && !s.game.revealed) {
          mx((f) => ({ ...f, revealing: true }));
          later(() => mx((f) => ({ ...f, revealing: false })), 9000);
          sound.play('reveal');
        } else sound.play('over');
        if (e.why === 'heads') banner('Everyone reached the head!', 2600);
        say(e.why === 'time' ? next('timeUp') : e.why === 'heads' ? next('allHeads') : e.why === 'guessed' ? next('allGuessed') : next('finished'), 1500);
      }
    }
  }, [flag, later, say, sound]);

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
    setRevealed(false);
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
  // Mystery Mural's guessing time: a clock of its own (in timed and untimed games), and a nudge to the server when it ends.
  const mg = screen?.game.kind === 'mural' ? screen.game : null;
  const guessOn = live && !!mg && mg.phase === 'guess' && !mg.revealed && screen?.startedAt != null;
  useEffect(() => {
    if (!guessOn) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [guessOn]);
  const guessMs = guessOn && screen && mg ? (screen.startedAt as number) + (mg.guessFrom ?? 0) + GUESS_MS - (now + offset.current) : null;
  const guessLeft = guessMs === null ? null : Math.max(0, Math.ceil(guessMs / 1000));
  const sentGuessEnd = useRef(0);
  useEffect(() => {
    if (guessMs === null || guessMs > 0 || !room) return;
    const t = Date.now();
    if (t - sentGuessEnd.current < 3000) return;
    sentGuessEnd.current = t;
    void link.send({ action: 'view', room }).then(take, () => undefined);
  }, [guessMs, room, link, take]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    const r = await link.send(body).catch(() => ({ status: 0, body: { error: 'Could not reach the server.' } }) as Reply);
    take(r);
    return r;
  }, [link, take]);

  const open = async (activity: Activity, body: Record<string, unknown>) => {
    setBusy(true);
    setProblem('');
    const m = musicSettings();
    const r = await act({ action: 'open', classId, activity, ...body, padMusic: m.on && m.pads });
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
  const serpent = game?.kind === 'serpent' ? game : null;
  const mural = game?.kind === 'mural' ? game : null;
  const shark = game && isShark(game) ? game : null; // Shark Bay
  const corners = game?.kind === 'corners' && !shark ? game : null;
  const lava = game?.kind === 'lava' ? game : null;
  const clash = game?.kind === 'clash' ? game : null;
  const ghostG = game?.kind === 'ghost' ? game : null;
  const thrones = game?.kind === 'thrones' ? game : null;
  const thronesMusic = useMusicOn(thrones?.round, screen?.startedAt ?? null, serverClock);
  const hall = !screen && !resuming ? painted('pick', 'hall') : null;
  // Background music for what is on screen (James, 25 Nov 2026 NZ).
  const hotNow = (leftMs !== null && leftMs < HOT_MS) || (serpent ? serpent.awake || serpent.energy >= 0.75 * wakeAt(screen?.players ?? 1) : false)
    || (game?.kind === 'stars' ? game.creature && !game.supernova : false);
    // Musical Thrones: the music cuts out the moment it stops (and stays off until the next round).
  useMusic(thrones && state === 'live' && !thronesMusic ? null : classLiveTrack(state, game?.kind ?? null, { guessing: mural?.phase === 'guess', hot: hotNow, map: shark ? shark.bay : corners?.map ?? ghostG?.map ?? clash?.map ?? thrones?.hall ?? lava?.map, shark: !!shark }), !muted);
  const backPic = hall ?? (clash ? painted('clash', `back-${clash.map}`) ?? painted('corners', 'back-snow') : shark ? painted('shark', `back-${shark.bay}`) : ghostG ? painted('ghost', `back-${ghostG.map}`) : corners ? painted('corners', `back-${corners.map}`) : thrones ? painted('thrones', `back-${thrones.hall}`) : lava ? painted('lava', `back-${lava.map}`) : painted('back', serpent ? 'jungle-temple' : mural ? 'gallery' : 'star-sky'));
  const lobbyOpen = state === 'lobby' && room !== null;
  useEffect(() => {
    if (lobbyOpen) say(next('joinNow'), 400);
  }, [lobbyOpen, room, say]);
  useEffect(() => {
    if (state !== 'over') { setRevealed(false); setHideResults(false); }
    if (state !== 'lobby') setShowHow(false);
  }, [state]);

  return (
    <div className={`cl-p cl-p--${state ?? 'setup'} ${serpent ? 'cl-p--serpent' : ''} ${mural ? 'cl-p--mural' : ''} ${corners ? `cl-p--corners fc-back--${corners.map}` : ''} ${shark ? `cl-p--shark sb-back--${shark.bay}` : ''} ${clash ? 'cl-p--corners cl-p--clash' : ''} ${ghostG ? `cl-p--corners cl-p--ghost gt-back--${ghostG.map}` : ''} ${thrones ? `cl-p--thrones mt-back--${thrones.hall}` : ''} ${lava ? `cl-p--lava lv-back--${lava.map}` : ''} ${backPic ? 'cl-p--painted' : ''}`}>
      {serpent ? <JungleBackdrop /> : <NightBackdrop />}
      {backPic && <div className={`cl-painted ${serpent ? 'cl-painted--serpent' : ''} ${hall ? 'cl-painted--hall' : ''}`} style={{ backgroundImage: `url(${backPic})` }} aria-hidden="true" />}
      {serpent && <SerpentAmbience awake={serpent.awake || state === 'over'} />}
      {screen?.joinCode && state === 'live' && !barOpen && (
        <div className="cl-late" aria-label={`Late? Join with code ${screen.joinCode.split('').join(' ')}`}>Late? Code <b>{screen.joinCode}</b></div>
      )}
      <div className={`cl-bar ${barOpen ? 'cl-bar--open' : ''}`}>
        <button type="button" className="cl-bar__tab" onClick={() => setBarOpen(!barOpen)} aria-expanded={barOpen} aria-label={barOpen ? 'Hide the teacher bar' : 'Show the teacher bar'}>{barOpen ? '▲' : '☰'}</button>
        {barOpen && (
          <div className="cl-bar__row">
            <a className="cl-btn cl-btn--small" href="#/">⌂ Hub</a>
            <button type="button" className="cl-btn cl-btn--small" onClick={toggleSound} aria-pressed={!muted}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            <MusicControl onPads={(on) => { if (room) void act({ action: 'padmusic', room, on }); }} />
            {screen && <span className="cl-bar__name">{ACTIVITY_NAMES[screen.activity]}</span>}
            {leftMs !== null && <span className={`cl-bar__time ${leftMs < 30_000 ? 'cl-bar__time--low' : ''}`} role="timer">{mmss(leftMs)}</span>}
            {screen?.joinCode && state === 'live' && (
              <span className="cl-late cl-late--bar" aria-label={`Late? Join with code ${screen.joinCode.split('').join(' ')}`}>Late? Code <b>{screen.joinCode}</b></span>
            )}
            {screen && screen.state !== 'over' && room && (
              <button type="button" className="cl-btn cl-btn--small cl-btn--danger" onClick={() => void act({ action: 'end', room })}>End</button>
            )}
          </div>
        )}
      </div>

      {!screen && (resuming ? <div className="cl-center"><p className="cl-center__word">Finding your room…</p></div> : <Setup busy={busy} problem={problem} onOpen={open} onShowdown={onShowdown ?? null} />)}

      {screen && game && state === 'lobby' && room && (
        showHow
          ? <HowTo game={game} players={screen.players} muted={sound.muted} onPlay={() => { setShowHow(false); void act({ action: 'start', room }); }} onBack={() => setShowHow(false)} />
          : <Lobby screen={screen} game={game} className={className} onStart={() => setShowHow(true)} />
      )}

      {screen && serpent && (state === 'live' || state === 'over') && (
        <>
          <SerpentScene
            game={serpent}
            people={screen.people}
            players={screen.players}
            wakeAt={wakeAt(screen.players)}
            over={state === 'over'}
            fx={fx.serpent}
            sound={sound}
            onRevealed={() => setRevealed(true)}
          />
          {state === 'over' && revealed && (hideResults
            ? <button type="button" className="cl-btn cl-results-tab" onClick={() => setHideResults(false)}>🐍 Show the results</button>
            : <SerpentFinish screen={screen} game={serpent} onAgain={forget} onSky={() => setHideResults(true)} />)}
        </>
      )}

      {screen && mural && (state === 'live' || state === 'over') && (
        <>
          <MuralScene
            game={mural}
            guessLeft={guessLeft}
            people={screen.people}
            state={state}
            fx={fx.mural}
            showReveal={state === 'live' && !!room}
            onReveal={() => void act({ action: 'reveal', room })}
            onRevealed={() => setRevealed(true)}
          />
          {state === 'over' && revealed && (hideResults
            ? <button type="button" className="cl-btn cl-results-tab" onClick={() => setHideResults(false)}>🎨 Show the results</button>
            : <MuralFinish screen={screen} game={mural} onAgain={forget} onSky={() => setHideResults(true)} />)}
        </>
      )}

      {screen && corners && (state === 'live' || state === 'over') && (
        <CornersScene
          screen={screen}
          game={corners}
          link={link}
          room={room}
          clock={() => Date.now() + offset.current}
          sound={sound}
          say={say}
          over={state === 'over'}
          onTick={() => { if (room) void act({ action: 'view', room }); }}
          onAgain={forget}
        />
      )}

      {screen && lava && (state === 'live' || state === 'over') && (
        <LavaScene
          screen={screen}
          game={lava}
          link={link}
          room={room}
          clock={() => Date.now() + offset.current}
          sound={sound}
          say={say}
          over={state === 'over'}
          onTick={() => { if (room) void act({ action: 'view', room }); }}
          onAgain={forget}
        />
      )}

      {screen && thrones && (state === 'live' || state === 'over') && (
        <ThronesScene
          screen={screen}
          game={thrones}
          link={link}
          room={room}
          clock={serverClock}
          sound={sound}
          say={say}
          over={state === 'over'}
          onTick={() => { if (room) void act({ action: 'view', room }); }}
          onAgain={forget}
        />
      )}

      {screen && clash && (state === 'live' || state === 'over') && (
        <ClashScene
          screen={screen}
          game={clash}
          link={link}
          room={room}
          clock={() => Date.now() + offset.current}
          sound={sound}
          say={say}
          over={state === 'over'}
          onTick={() => { if (room) void act({ action: 'view', room }); }}
          onAgain={forget}
        />
      )}

      {screen && ghostG && (state === 'live' || state === 'over') && (
        <GhostScene
          screen={screen}
          game={ghostG}
          link={link}
          room={room}
          clock={() => Date.now() + offset.current}
          sound={sound}
          say={say}
          over={state === 'over'}
          onTick={() => { if (room) void act({ action: 'view', room }); }}
          onAgain={forget}
        />
      )}

      {/* Shark Bay */}
      {screen && shark && (state === 'live' || state === 'over') && (
        <SharkScene
          screen={screen}
          game={shark}
          link={link}
          room={room}
          clock={() => Date.now() + offset.current}
          sound={sound}
          say={say}
          over={state === 'over'}
          onTick={() => { if (room) void act({ action: 'view', room }); }}
          onAgain={forget}
        />
      )}

      {screen && game?.kind === 'stars' && (state === 'live' || state === 'over') && (
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
          <Hud game={game} />
          {state === 'live' && game.spotlight === null && <LagHint game={game} />}
          {state === 'live' && game.spotlight !== null && room && <Spotlight screen={screen} game={game} onBack={() => void act({ action: 'spotlight', room, id: null })} />}
          {state === 'over' && (hideResults
            ? <button type="button" className="cl-btn cl-results-tab" onClick={() => setHideResults(false)}>★ Show the results</button>
            : <Finish screen={screen} game={game} onAgain={forget} onSky={() => setHideResults(true)} />)}
        </>
      )}
    </div>
  );
}

/* ---------------- setup ---------------- */

export function TimerChips({ length, setLength }: { length: number; setLength: (m: number) => void }) {
  return (
    <div className="cl-opt">
      <span className="cl-opt__label">Timer</span>
      <div className="cl-chips" role="group" aria-label="Timer">
        {TIMERS.map((m) => (
          <button key={m} type="button" className={`cl-choice ${length === m ? 'cl-choice--on' : ''}`} aria-pressed={length === m} onClick={() => setLength(m)}>{m === 0 ? 'No timer' : `${m} min`}</button>
        ))}
      </div>
    </div>
  );
}

/** Glowing motes drifting up the picker page: left %, delay s, duration s, size. */
const MOTES: [number, number, number, number][] = Array.from({ length: 22 }, (_, i) => [(i * 37 + 7) % 100, -((i * 1.7) % 14), 11 + ((i * 5) % 9), 0.6 + ((i * 3) % 5) * 0.2]);

/** The painted picture across the top of a game card (a drawn glow when none is painted). */
export function CardArt({ pic }: { pic: string | null }) {
  return (
    <div className="cl-card__art" aria-hidden="true">
      {pic ? <img src={pic} alt="" loading="eager" /> : null}
    </div>
  );
}

const WHERE_KEY = 'classlive.where';
const HOST_KEY = 'classlive.host';
const readKept = (key: string): string | null => { try { return window.localStorage.getItem(key); } catch { return null; } };
const keep = (key: string, v: string) => { try { window.localStorage.setItem(key, v); } catch { /* private window: not kept */ } };

function Setup({ busy, problem, onOpen: open, onShowdown }: { busy: boolean; problem: string; onOpen: (activity: Activity, body: Record<string, unknown>) => void; onShowdown: ((s: ShowdownStart) => void) | null }) {
  const [level, setLevel] = useState<LevelPick>('middle');
  const [sLevel, setSLevel] = useState<SerpentLevel>('gold');
  const [sLength, setSLength] = useState(0);
  const [mLength, setMLength] = useState(0);
  const [cLength, setCLength] = useState(5);
  const [cMap, setCMap] = useState<CornerMap | 'any'>('any');
  const [cRun, setCRun] = useState(RUN_DEFAULT_S);
  const [cGuide, setCGuide] = useState(false);
  // Shark Bay
  const [bLength, setBLength] = useState(5);
  const [bBay, setBBay] = useState<BayMap | 'any'>('any');
  const [bRun, setBRun] = useState(RUN_DEFAULT_S);
  const [bGuide, setBGuide] = useState(false);
  const [x, setX] = useState('6');
  const [y, setY] = useState('7');
  const [length, setLength] = useState(0);
  const xi = Number(x);
  const yi = Number(y);
  const okPick = Number.isInteger(xi) && Number.isInteger(yi) && xi >= 2 && xi <= 12 && yi >= 2 && yi <= 12 && xi !== yi;
  const own = level === 'pick';
  const games = LIVE_GAMES.filter((g) => g.id !== 'showdown' || onShowdown);
  const [pick, choose] = usePicked(games.map((g) => g.id));
  const chosen = liveGame(pick);
  // Who can join (James, 25 Nov 2026): the class, or any pupil of the school from their home page's "Join now?".
  const [where, setWhere] = useState<'class' | 'lobby'>(() => (readKept(WHERE_KEY) === 'lobby' ? 'lobby' : 'class'));
  const [host, setHost] = useState(() => readKept(HOST_KEY) ?? '');
  const hostOk = where === 'class' || /\p{L}/u.test(host);
  const canOpen = !busy && hostOk && (!own || okPick);
  const onOpen = (activity: Activity, body: Record<string, unknown>) => {
    keep(WHERE_KEY, where);
    if (where === 'lobby') keep(HOST_KEY, host.trim());
    open(activity, where === 'lobby' ? { ...body, where: 'lobby', host: host.trim() } : body);
  };
  return (
    <div className="cl-setup">
      <div className="cl-motes" aria-hidden="true">{MOTES.map((m, i) => <i key={i} style={{ left: `${m[0]}%`, animationDelay: `${m[1]}s`, animationDuration: `${m[2]}s`, ['--s' as string]: m[3] }} />)}</div>
      {!chosen ? (
        <>
          <h1 className="cl-setup__title">Class Live</h1>
          <p className="cl-setup__sub">Pick a game for the big screen</p>
          <GamePicker games={games} onPick={choose} />
        </>
      ) : (
      <>
      <div className="cl-chosen">
        <button type="button" className="cl-btn cl-btn--small cl-chosen__back" onClick={() => choose(null)}>← All games</button>
        <span className="cl-chosen__where">Class Live</span>
      </div>
      {pick !== 'showdown' && <div className="cl-where" role="group" aria-label="Who can join?">
        <span className="cl-opt__label">Who can join?</span>
        <button type="button" className={`cl-choice ${where === 'class' ? 'cl-choice--on' : ''}`} aria-pressed={where === 'class'} onClick={() => setWhere('class')}>🏫 My class</button>
        <button type="button" className={`cl-choice ${where === 'lobby' ? 'cl-choice--on' : ''}`} aria-pressed={where === 'lobby'} onClick={() => setWhere('lobby')}>🌏 Open in the lobby</button>
        {where === 'lobby' && (
          <label className="cl-where__host">
            <span>Pupils see:</span>
            <input className="cl-where__input" value={host} maxLength={30} placeholder="Mr Riley" onChange={(e) => setHost(e.target.value)} aria-label="Your name for pupils" />
            <span>is starting a game. Join now?</span>
          </label>
        )}
        {where === 'lobby' && <p className="cl-where__note">Any pupil in the school can join, from their home page or with the code on the big screen.</p>}
      </div>}
      <div className="cl-cards cl-cards--one">
        {pick === 'stars' && (
        <section className="cl-card cl-card--active" aria-label="Star Web">
          <CardArt pic={painted('pick', 'stars', true) ?? painted('back', 'star-sky', true)} />
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
          <TimerChips length={length} setLength={setLength} />
          {problem && <p className="cl-problem" role="alert">{problem}</p>}
          <button type="button" className="cl-btn cl-btn--go" disabled={!canOpen} onClick={() => onOpen('stars', { level: own ? 'middle' : level, length, ...(own ? { x: xi, y: yi } : {}) })}>{busy ? 'Opening…' : 'Open the room'}</button>
        </section>
        )}
        {pick === 'serpent' && (
        <section className="cl-card cl-card--active cl-card--serpent" aria-label="Serpent Chain">
          <CardArt pic={painted('pick', 'serpent', true) ?? painted('back', 'jungle-temple', true)} />
          <h2 className="cl-card__name">🐍 Serpent Chain</h2>
          <p className="cl-card__blurb">A chain of sums winds up the temple. Wake the serpent!</p>
          <div className="cl-opt">
            <span className="cl-opt__label">Which serpent?</span>
            <div className="cl-levels" role="group" aria-label="Serpent level">
              {SERPENT_LEVELS.map((l, i) => (
                <button key={l} type="button" className={`cl-choice cl-lvl cl-lvl--${l} ${sLevel === l ? 'cl-choice--on' : ''}`} aria-pressed={sLevel === l} title={SERPENT_LEVEL_ABOUT[l]} onClick={() => setSLevel(l)}>
                  <i className="cl-lvl__n">{i + 1}</i>
                  <b>{SERPENT_LEVEL_NAMES[l].replace(' serpent', '')}</b>
                </button>
              ))}
            </div>
            <p className="cl-lvl__about" aria-live="polite"><b className={`cl-lvl--${sLevel}`}>{SERPENT_LEVEL_NAMES[sLevel]}</b> {SERPENT_LEVEL_ABOUT[sLevel]}</p>
          </div>
          <TimerChips length={sLength} setLength={setSLength} />
          <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen('serpent', { level: sLevel, length: sLength })}>{busy ? 'Opening…' : 'Open the room'}</button>
        </section>
        )}
        {pick === 'mural' && (
        <section className="cl-card cl-card--active cl-card--mural" aria-label="Mystery Mural">
          <CardArt pic={painted('pick', 'mural', true) ?? painted('back', 'gallery', true)} />
          <h2 className="cl-card__name">🎨 Mystery Mural</h2>
          <p className="cl-card__blurb">Your maths uncovers a hidden painting. Guess what it is!</p>
          <TimerChips length={mLength} setLength={setMLength} />
          <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen('mural', { length: mLength })}>{busy ? 'Opening…' : 'Open the room'}</button>
        </section>
        )}
        {pick === 'corners' && (
        <section className="cl-card cl-card--active cl-card--corners" aria-label="Four Corners">
          <CardArt pic={painted('pick', 'corners', true) ?? painted('corners', 'map-snow', true)} />
          <h2 className="cl-card__name">🎲 Four Corners</h2>
          <p className="cl-card__blurb">Run your avatar to a corner. The dice decides who goes to jail!</p>
          <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setCGuide(true)}>⚡ Power-ups and hazards</button>
          {cGuide && <CornersGuide map={cMap === 'any' ? MAPS[0] : cMap} onClose={() => setCGuide(false)} />}
          <div className="cl-opt">
            <span className="cl-opt__label">Which map?</span>
            <div className="cl-chips" role="group" aria-label="Map">
              <button type="button" className={`cl-choice ${cMap === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={cMap === 'any'} onClick={() => setCMap('any')}>Surprise me</button>
              {MAPS.map((m) => (
                <button key={m} type="button" className={`cl-choice ${cMap === m ? 'cl-choice--on' : ''}`} aria-pressed={cMap === m} onClick={() => setCMap(m)}>{MAP_WORDS[m].name}</button>
              ))}
            </div>
          </div>
          <div className="cl-opt">
            <span className="cl-opt__label">Time to reach a corner</span>
            <div className="cl-chips" role="group" aria-label="Time to reach a corner">
              {RUN_CHOICES.map((n) => (
                <button key={n} type="button" className={`cl-choice ${cRun === n ? 'cl-choice--on' : ''}`} aria-pressed={cRun === n} onClick={() => setCRun(n)}>{n} s</button>
              ))}
            </div>
          </div>
          <TimerChips length={cLength} setLength={setCLength} />
          <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen('corners', { length: cLength, run: cRun, ...(cMap === 'any' ? {} : { map: cMap }) })}>{busy ? 'Opening…' : 'Open the room'}</button>
        </section>
        )}
        {pick === 'clash' && <ClashCard busy={busy} disabled={!hostOk} onOpen={(body) => onOpen('clash', body)} />}
        {pick === 'ghost' && <GhostPickCard busy={busy} hostOk={hostOk} onOpen={(body) => onOpen('ghost', body)} timer={(l, set) => <TimerChips length={l} setLength={set} />} art={(pic) => <CardArt pic={pic} />} />}
        {pick === 'lava' && <LavaCard busy={busy} disabled={!hostOk} onOpen={(body) => onOpen('lava', body)} />}
        {/* Shark Bay */}
        {pick === 'shark' && (
        <section className="cl-card cl-card--active cl-card--corners cl-card--shark" aria-label="Shark Bay">
          <CardArt pic={painted('pick', 'shark', true)} />
          <h2 className="cl-card__name">🦈 Shark Bay</h2>
          <p className="cl-card__blurb">Swim to a spinning colour or hide under a boat. Simon the shark strikes one quarter!</p>
          <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setBGuide(true)}>⚡ Power-ups and hazards</button>
          {bGuide && <SharkGuide bay={bBay === 'any' ? BAYS[0] : bBay} onClose={() => setBGuide(false)} />}
          <div className="cl-opt">
            <span className="cl-opt__label">Which bay?</span>
            <div className="cl-chips" role="group" aria-label="Bay">
              <button type="button" className={`cl-choice ${bBay === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={bBay === 'any'} onClick={() => setBBay('any')}>Surprise me</button>
              {BAYS.map((m) => (
                <button key={m} type="button" className={`cl-choice ${bBay === m ? 'cl-choice--on' : ''}`} aria-pressed={bBay === m} onClick={() => setBBay(m)}>{BAY_WORDS[m].name}</button>
              ))}
            </div>
          </div>
          <div className="cl-opt">
            <span className="cl-opt__label">Time to find a safe place</span>
            <div className="cl-chips" role="group" aria-label="Time to find a safe place">
              {RUN_CHOICES.map((n) => (
                <button key={n} type="button" className={`cl-choice ${bRun === n ? 'cl-choice--on' : ''}`} aria-pressed={bRun === n} onClick={() => setBRun(n)}>{n} s</button>
              ))}
            </div>
          </div>
          <TimerChips length={bLength} setLength={setBLength} />
          <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen('shark', { length: bLength, run: bRun, ...(bBay === 'any' ? {} : { map: bBay }) })}>{busy ? 'Opening…' : 'Open the room'}</button>
        </section>
        )}
        {pick === 'thrones' && <ThronesCard busy={busy} hostOk={hostOk} onOpen={(body) => onOpen('thrones', body)} Timer={TimerChips} Art={CardArt} />}
        {pick === 'showdown' && onShowdown && <ShowdownCard busy={busy} onOpen={onShowdown} />}
      </div>
      </>
      )}
    </div>
  );
}

const PICK_KEY = 'pick';

/** The game chosen on the picker, kept in the address (?pick=serpent) so a link (the Today page's card) opens on it. */
function usePicked(ids: string[]): [string | null, (id: string | null) => void] {
  const [pick, setPick] = useState<string | null>(() => {
    try {
      const hashQuery = window.location.hash.split('?')[1] ?? '';
      const p = new URLSearchParams(window.location.search).get(PICK_KEY) ?? new URLSearchParams(hashQuery).get(PICK_KEY);
      return p && ids.includes(p) ? p : null;
    } catch { return null; }
  });
  const choose = useCallback((id: string | null) => {
    setPick(id);
    try {
      const url = new URL(window.location.href);
      const [path, q] = url.hash.split('?');
      if (q !== undefined || (url.hash.startsWith('#/') && !url.search)) {
        // A hash address (the previews): the query sits after the #.
        const hq = new URLSearchParams(q ?? '');
        if (id) hq.set(PICK_KEY, id); else hq.delete(PICK_KEY);
        url.hash = `${path}${hq.toString() ? `?${hq}` : ''}`;
      } else if (id) url.searchParams.set(PICK_KEY, id); else url.searchParams.delete(PICK_KEY);
      window.history.replaceState(window.history.state, '', url);
    } catch { /* not kept */ }
    try { document.querySelector('.cl-setup')?.scrollTo({ top: 0 }); } catch { /* old browser */ }
  }, []);
  return [pick, choose];
}

/** The first screen: one painted tile per game, grouped (James, 25 Nov 2026 NZ). */
function GamePicker({ games, onPick }: { games: LiveGame[]; onPick: (id: string) => void }) {
  const groups = (Object.keys(GROUP_WORDS) as LiveGroup[]).map((g) => ({ g, list: games.filter((x) => x.group === g) })).filter((x) => x.list.length > 0);
  let n = 0;
  return (
    <div className="cl-picker">
      {groups.map(({ g, list }) => (
        <section key={g} className="cl-picker__group" aria-label={GROUP_WORDS[g].name}>
          <h2 className="cl-picker__head">{GROUP_WORDS[g].name} <small>{GROUP_WORDS[g].about}</small></h2>
          <div className="cl-picker__tiles">
            {list.map((game) => {
              const pic = game.pic();
              return (
                <button key={game.id} type="button" className={`cl-tile cl-tile--${game.id}`} style={{ ['--tint' as string]: game.tint, animationDelay: `${0.05 * n++}s` }} onClick={() => onPick(game.id)}>
                  <span className="cl-tile__art" aria-hidden="true">{pic ? <img src={pic} alt="" loading="eager" /> : <i className="cl-tile__emoji">{game.emoji}</i>}</span>
                  <b className="cl-tile__name"><span aria-hidden="true">{game.emoji}</span> {game.name}</b>
                  <span className="cl-tile__blurb">{game.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
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

function Lobby({ screen, game, className, onStart }: { screen: ScreenView; game: ScreenView['game']; className?: string; onStart: () => void }) {
  const n = screen.people.length;
  const head = game.kind === 'serpent' ? <SerpentLobbyHead game={game} /> : game.kind === 'stars' ? <StarsLobbyHead game={game} /> : game.kind === 'corners' ? (isShark(game) ? <SharkLobbyHead bay={game.bay} /> : <CornersLobbyHead map={game.map} />) : game.kind === 'clash' ? <ClashLobbyHead map={game.map} teams={game.teams} /> : game.kind === 'ghost' ? <GhostLobbyHead map={game.map} /> : game.kind === 'thrones' ? <ThronesLobbyHead hall={game.hall} /> : game.kind === 'lava' ? <LavaLobbyHead map={game.map} /> : <MuralLobbyHead />;
  return (
    <div className={`cl-lobby ${game.kind === 'serpent' ? 'cl-lobby--serpent' : ''}`}>
      {head}
      {screen.lobby
        ? <div className="cl-lobby__join cl-lobby__join--code">Any class can join! <span className="cl-lobby__class">Tap <b>Join now</b> on your home page, or type the code</span> <b className="cl-lobby__code" aria-label={`Join code ${screen.lobby.code.split('').join(' ')}`}>{screen.lobby.code}</b></div>
        : <div className="cl-lobby__join">Join now!{className ? <span className="cl-lobby__class"> {className}</span> : null}</div>}
      <div className="cl-lobby__count" aria-live="polite">{n === 0 ? (screen.game.kind === 'stars' ? 'Waiting for the first star…' : 'Waiting for the first pupil…') : `${n} ${n === 1 ? 'pupil' : 'pupils'} joined`}</div>
      <div className="cl-crowd" style={{ ['--k' as string]: Math.max(1.9, Math.min(3.6, 4 - n * 0.06)) }}>
        {screen.people.map((pp, i) => <Chip key={pp.id} p={pp} i={i} />)}
      </div>
      <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onStart}>Start</button>
    </div>
  );
}

function StarsLobbyHead({ game }: { game: StarsGame }) {
  const { x, y, p } = game.anchor;
  return (
    <>
      <h1 className="cl-lobby__title">Star Web</h1>
      <div className="cl-lobby__fact">{x} × {y} = {p}</div>
      <div className="cl-array" style={{ ['--rows' as string]: x, ['--cols' as string]: y, gridTemplateColumns: `repeat(${y}, var(--d))` }} aria-label={`${x} rows of ${y} dots`}>
        {Array.from({ length: x * y }, (_, i) => <i key={i} className="cl-array__dot" style={{ animationDelay: `${(i % 12) * 0.12}s` }} />)}
      </div>
      <p className="cl-lobby__ask">What else can we find from this one fact?</p>
    </>
  );
}

function CornersLobbyHead({ map }: { map: CornerMap }) {
  const [guide, setGuide] = useState(false);
  return (
    <>
      {guide && <CornersGuide map={map} onClose={() => setGuide(false)} />}
      <h1 className="cl-lobby__title">Four Corners</h1>
      <div className="cl-lobby__fact">{MAP_WORDS[map].name}</div>
      <div className="fc-lobby-corners" aria-hidden="true"><i /><i /><i /><i /></div>
      <p className="cl-lobby__ask">Run to a corner before the countdown ends. Which corner will the dice pick?</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
    </>
  );
}

function ClashLobbyHead({ map, teams }: { map: ClashMap; teams: number }) {
  const [guide, setGuide] = useState(false);
  return (
    <>
      {guide && <ClashGuide map={map} onClose={() => setGuide(false)} />}
      <h1 className="cl-lobby__title">Colour Clash</h1>
      <div className="cl-lobby__fact">{CLASH_WORDS[map].name} · {teams} teams</div>
      <div className="fc-lobby-corners" aria-hidden="true">{Array.from({ length: teams }, (_, i) => <i key={i} />)}</div>
      <p className="cl-lobby__ask">Paint the floor your team's colour. Answer maths to drop paint bombs!</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
    </>
  );
}

/* Shark Bay */
function SharkLobbyHead({ bay }: { bay: BayMap }) {
  const [guide, setGuide] = useState(false);
  return (
    <>
      {guide && <SharkGuide bay={bay} onClose={() => setGuide(false)} />}
      <h1 className="cl-lobby__title">Shark Bay</h1>
      <div className="cl-lobby__fact">{BAY_WORDS[bay].name}</div>
      <div className="fc-lobby-corners" aria-hidden="true"><i /><i /><i /><i /></div>
      <p className="cl-lobby__ask">Swim to a coloured quarter, or hide under a boat. Which quarter will Simon strike?</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
    </>
  );
}

function MuralLobbyHead() {
  return (
    <>
      <h1 className="cl-lobby__title">Mystery Mural</h1>
      <MuralCloth />
      <p className="cl-lobby__ask">Answer maths to flip tiles. Can you guess the hidden picture?</p>
    </>
  );
}

function SerpentLobbyHead({ game }: { game: SerpentGame }) {
  const first = game.chain.steps.slice(0, 4);
  return (
    <>
      <h1 className="cl-lobby__title cl-lobby__title--serpent">Serpent Chain</h1>
      <CoiledSerpent />
      <div className="cl-lobby__fact cl-lobby__fact--serpent">Start at {game.chain.start}</div>
      <ul className="cl-lobby__ops" aria-label="The first operations">
        {first.map((s, i) => <li key={i} style={{ animationDelay: `${i * 0.15}s` }}>{stepText(s)}</li>)}
        <li className="cl-lobby__more">…</li>
      </ul>
    </>
  );
}

/* ---------------- live: counters, hints, spotlight ---------------- */

/** A gentle hint, above the counter, on how to find facts for an arm lagging well behind the rest. Never the answer. */
function LagHint({ game }: { game: StarsGame }) {
  const shown = useHeldLag(laggingArm(armCounts(game), game.stars.length));
  if (shown === null) return null;
  return (
    <div className="cl-lag" key={shown} role="status" style={{ '--arm': ARM_COLOURS[shown] } as React.CSSProperties}>
      <span className="cl-lag__tag">💡 {ARM_NAMES[shown]}</span>
      <span className="cl-lag__text">{lagHint(shown, game.anchor)}</span>
    </div>
  );
}

function Hud({ game }: { game: StarsGame }) {
  const total = game.stars.length;
  const pct = Math.min(100, (total / SUPERNOVA) * 100);
  return (
    <div className="cl-hud">
      <span className="cl-hud__total"><b>{total}</b> {total === 1 ? 'star' : 'stars'}</span>
      <span className="cl-hud__nova" role="progressbar" aria-valuemin={0} aria-valuemax={SUPERNOVA} aria-valuenow={Math.min(total, SUPERNOVA)} aria-label="Supernova progress">
        <span className="cl-hud__fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
      <span className="cl-hud__goal">{game.supernova ? '💥 Supernova!' : `Supernova at ${SUPERNOVA}`}</span>
    </div>
  );
}

function Spotlight({ screen, game, onBack }: { screen: ScreenView; game: StarsGame; onBack: () => void }) {
  const star = game.stars.find((s) => s.id === game.spotlight);
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
  if (!screen.showNames || screen.game.kind !== 'stars') return [];
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

function Finish({ screen, game, onAgain, onSky }: { screen: ScreenView; game: StarsGame; onAgain: () => void; onSky: () => void }) {
  const g = game;
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
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Back to Class Live</button>
        <button type="button" className="cl-btn" onClick={onSky}>See the sky</button>
      </div>
    </div>
  );
}

/** The mural's shout-outs: only when names are shown, and only for things that are true. */
export function muralShouts(screen: ScreenView, game: MuralGame): string[] {
  if (!screen.showNames) return [];
  const name = (id: string) => screen.people.find((p) => p.id === id)?.name ?? null;
  const out: string[] = [];
  if (game.solvers[0] && name(game.solvers[0])) out.push(`🥇 First to guess it: ${name(game.solvers[0])}`);
  let top: { id: string; v: number } | null = null;
  for (const p of screen.people) {
    const v = game.mine[p.id]?.tiles ?? 0;
    if (v > 0 && p.name && (!top || v > top.v)) top = { id: p.id, v };
  }
  if (top) out.push(`🎨 Most tiles flipped: ${name(top.id)} (${top.v})`);
  if (game.solvers.length > 1) out.push(`🌟 ${game.solvers.length} pupils guessed it`);
  return out;
}

function MuralFinish({ screen, game, onAgain, onSky }: { screen: ScreenView; game: MuralGame; onAgain: () => void; onSky: () => void }) {
  const shouts = useMemo(() => muralShouts(screen, game), [screen, game]);
  const flipped = game.tiles.filter(Boolean).length;
  return (
    <div className="cl-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">It was {PICTURES[game.picture].toLowerCase()}!</h2>
      <p className="cl-finish__count"><b>{flipped}</b> {flipped === 1 ? 'tile' : 'tiles'} flipped</p>
      <p className="cl-finish__sub">{game.solvers.length === 0 ? 'Nobody guessed it this time.' : `${game.solvers.length} ${game.solvers.length === 1 ? 'pupil' : 'pupils'} guessed it`}</p>
      {shouts.length > 0 && (
        <ul className="cl-shouts" aria-label="Shout-outs">
          {shouts.map((s, i) => <li key={i} style={{ animationDelay: `${0.3 + i * 0.25}s` }}>{s}</li>)}
        </ul>
      )}
      <div className="cl-finish__row">
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Back to Class Live</button>
        <button type="button" className="cl-btn" onClick={onSky}>See the mural</button>
      </div>
    </div>
  );
}

/** The serpent's shout-outs: only when names are shown, and only for things that are true. */
export function serpentShouts(screen: ScreenView, game: SerpentGame): string[] {
  if (!screen.showNames) return [];
  const name = (id: string) => screen.people.find((p) => p.id === id)?.name ?? null;
  const out: string[] = [];
  const best = (score: (id: string) => number, skip?: string): { id: string; v: number } | null => {
    let top: { id: string; v: number } | null = null;
    for (const p of screen.people) {
      const v = score(p.id);
      if (v > 0 && p.id !== skip && p.name && (!top || v > top.v)) top = { id: p.id, v };
    }
    return top;
  };
  const first = game.heads[0];
  if (first && name(first)) out.push(`🥇 First to the head: ${name(first)}`);
  const right = best((id) => game.mine[id]?.right ?? 0);
  if (right) out.push(`🎯 Most right answers: ${name(right.id)} (${right.v})`);
  const far = best((id) => game.mine[id]?.at ?? 0);
  if (far) out.push(`🐍 Furthest along: ${name(far.id)} (${far.v >= BODY ? `${far.v - BODY + 1} into the bonus tail` : `box ${far.v + 1} of ${BODY}`})`);
  const steady = best((id) => (game.mine[id]?.shown === 0 && (game.mine[id]?.right ?? 0) >= 3 ? game.mine[id].right : 0), right?.id) ?? best((id) => (game.mine[id]?.shown === 0 && (game.mine[id]?.right ?? 0) >= 3 ? game.mine[id].right : 0));
  if (steady) out.push(`💪 Steady worker: ${name(steady.id)} (${steady.v} boxes, no answers shown)`);
  if (game.heads.length > 1) out.push(`🌟 ${game.heads.length} pupils reached the head`);
  return out;
}

function SerpentFinish({ screen, game, onAgain, onSky }: { screen: ScreenView; game: SerpentGame; onAgain: () => void; onSky: () => void }) {
  const shouts = useMemo(() => serpentShouts(screen, game), [screen, game]);
  const gems = screen.people.length;
  return (
    <div className="cl-finish cl-finish--serpent" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">{game.awake ? 'The serpent is awake!' : 'The serpent stirs…'}</h2>
      <p className="cl-finish__count">The head roars <b>{game.chain.values[BODY]}</b></p>
      <p className="cl-finish__sub">{gems} {gems === 1 ? 'pupil' : 'pupils'} climbed{game.tail > 0 ? `, and the tail grew to ${BODY + game.tail} scales` : ''}</p>
      {shouts.length > 0 && (
        <ul className="cl-shouts" aria-label="Shout-outs">
          {shouts.map((s, i) => <li key={i} style={{ animationDelay: `${0.3 + i * 0.25}s` }}>{s}</li>)}
        </ul>
      )}
      <div className="cl-finish__row">
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Back to Class Live</button>
        <button type="button" className="cl-btn" onClick={onSky}>See the serpent</button>
      </div>
    </div>
  );
}
