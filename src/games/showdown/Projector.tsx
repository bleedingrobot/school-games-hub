/**
 * Class Showdown's projector screen (docs/SHOWDOWN-PLAN.md sections 1, 3 and 7): the painted, animated big screen the
 * teacher puts on the board. It listens to the room row and the feed, draws every event with its own moment (all in
 * projector.css, transform/opacity only), ticks the server once a second and never shows a question or a wrong answer.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { SHOWDOWN } from '../../../shared/showdown/config';
import { BOSSES, bossInfo, pickBoss, type BossId, type RosterRow } from '../../../shared/showdown/bosses';
import type { FeedEvent, RoomView } from '../../../shared/showdown/server';
import type { Arena, Mode, Role, TeamId } from '../../../shared/showdown/types';
import { ARENA_CHOICES, arenaWords } from './arenaWords';
import { BossStandIn } from './BossStandIn';
import type { ShowdownLink } from './link';
import { AWARD_WORDS, TEAM_WORDS, bestComeback, initialState, isGoldRush, ordinal, projectorAct, soundFor, type DrySeam, type HitBurst, type ProjectorState, type ShowdownSound } from './projectorState';
import './projector.css';

const ART = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const art = (folder: string, file: string): string | undefined => ART[`./art/paint/${folder}/${file}.webp`];

const ROOM_KEY = 'showdown-room';
const SEAM_WORD = { gold: 'Gold seam', gem: 'Gem seam', rich: 'Rich vein' } as const;
const ROLE_LETTER: Record<Role, string> = { striker: 'S', guard: 'G', healer: 'H' };
const ROLE_WORD: Record<Role, string> = { striker: 'Strikers', guard: 'Guards', healer: 'Healers' };
const TEAM_HEX: Record<TeamId, string> = { red: '#ff4d5e', blue: '#4da3ff', gold: '#ffd23f', green: '#4dd97a' };
const TEAM_SHORT: Record<TeamId, string> = { red: 'RED', blue: 'BLUE', gold: 'GOLD', green: 'GREEN' };
/** Which side of the screen each team's corner is on, and whether it is the lower one (4 teams). */
const SLOT: Record<TeamId, { side: -1 | 1; low: boolean }> = { red: { side: -1, low: false }, blue: { side: 1, low: false }, green: { side: -1, low: true }, gold: { side: 1, low: true } };
const isTeamMode = (v: RoomView) => v.teams.length > 0 && (v.mode === 'teams2' || v.mode === 'teams4');

function roomFromUrl(): number | null {
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('room');
    const hash = window.location.hash;
    const fromHash = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?'))).get('room') : null;
    const n = Number(fromSearch ?? fromHash ?? window.sessionStorage.getItem(ROOM_KEY));
    return Number.isInteger(n) && n > 0 ? n : null;
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
/**
 * Sizes a list of chips by how many there are: starts at `max` px and shrinks the font (the chips are all in em) until the
 * last chip sits inside the list's height, never below `min`. Uses layout positions, so the fly-in animation does not matter.
 */
function useFit(ref: RefObject<HTMLElement | null>, watch: RefObject<HTMLElement | null> | null, key: string, max: () => number, min: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let f = max();
      el.style.fontSize = `${f}px`;
      while (f > min) {
        let bottom = 0;
        let right = 0;
        for (const k of Array.from(el.children) as HTMLElement[]) {
          bottom = Math.max(bottom, k.offsetTop + k.offsetHeight);
          right = Math.max(right, k.offsetLeft + k.offsetWidth);
        }
        if (bottom <= el.clientHeight + 1 && right <= el.clientWidth + 1) break;
        f = Math.max(min, Math.floor(f * 0.94 * 10) / 10);
        el.style.fontSize = `${f}px`;
      }
    };
    fit();
    const target = watch?.current;
    const ro = typeof ResizeObserver !== 'undefined' && target ? new ResizeObserver(fit) : null;
    if (ro && target) ro.observe(target);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Projector({ link, classId, className, sound, onMute }: { link: ShowdownLink; classId: string; className?: string; sound?: ShowdownSound; onMute?: (muted: boolean) => void }) {
  const [room, setRoom] = useState<number | null>(roomFromUrl);
  const [mode, setMode] = useState<Mode>('class');
  const [length, setLength] = useState<number>(SHOWDOWN.defaultLength);
  const [ps, dispatch] = useReducer(projectorAct, undefined, () => initialState());
  const [problem, setProblem] = useState<string | null>(null);
  const [barOpen, setBarOpen] = useState(true);
  const [muted, setMutedState] = useState(sound?.muted ?? false);
  const [armEnd, setArmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [flinch, setFlinch] = useState(false);
  const [recapStage, setRecapStage] = useState<0 | 1>(0);
  const [rosterRows, setRosterRows] = useState<RosterRow[] | null>(null);
  const [pick, setPick] = useState<BossId | ''>('');
  const [arena, setArena] = useState<Arena>('boss');
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const lastHitSound = useRef(0);
  const arenaRef = useRef<Arena>('boss');
  const seenStart = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const view = ps.view;
  arenaRef.current = view?.arena ?? 'boss';
  const roundNow = view && view.startedAt !== null ? Math.max(0, (view.pausedAt ?? now + offset) - view.startedAt) : 0;

  useEffect(() => {
    void link.clockOffset().then(setOffset).catch(() => undefined);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [link]);

  // The teacher bar sits over the top of the screen: tell the layout how tall it is so nothing starts underneath it.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const stage = stageRef.current;
    if (!bar || !stage) return;
    const set = () => stage.style.setProperty('--bar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(bar);
    window.addEventListener('resize', set);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', set);
    };
  }, []);

  // Pick up a room (after a load or refresh too): the live room row, the feed, a tick a second and a full `view`.
  useEffect(() => {
    if (!room) return;
    const stopRoom = link.watchRoom(room, (v) => dispatch({ kind: 'view', view: v }));
    const stopFeed = link.watchFeed(room, (e: FeedEvent) => {
      dispatch({ kind: 'feed', event: e });
      const sfx = soundFor(e, arenaRef.current);
      const snd = soundRef.current;
      if (!snd) return;
      if (sfx.play === 'hit' || sfx.play === 'bighit') {
        const at = Date.now();
        if (at - lastHitSound.current < 140) return;
        lastHitSound.current = at;
      }
      if (sfx.play) snd.play(sfx.play);
      if (sfx.say) snd.say(sfx.say);
    });
    void link.send({ action: 'view', room }).then((out) => {
      if (out.status === 200 && out.body.view) {
        dispatch({ kind: 'reset', reply: out.body as never });
        if (Array.isArray(out.body.roster)) setRosterRows(out.body.roster as RosterRow[]);
        seenStart.current = 0;
      } else if (out.status === 403 || out.status === 400) {
        keepRoom(null);
        setRoom(null);
      }
    });
    const tick = setInterval(() => void link.send({ action: 'tick', room }), 1000);
    return () => {
      stopRoom();
      stopFeed();
      clearInterval(tick);
    };
  }, [link, room]);

  // 3-2-1 on each start.
  useEffect(() => {
    if (ps.startSeq === 0 || ps.startSeq === seenStart.current) return;
    seenStart.current = ps.startSeq;
    setBarOpen(false);
    setCount(3);
    const a = setTimeout(() => setCount(2), 900);
    const b = setTimeout(() => setCount(1), 1800);
    const c = setTimeout(() => setCount(0), 2700);
    const d = setTimeout(() => setCount(null), 3600);
    return () => [a, b, c, d].forEach(clearTimeout);
  }, [ps.startSeq]);

  // Flinch on every hit, shake on the big ones.
  useEffect(() => {
    if (ps.hitSeq === 0) return;
    setFlinch(true);
    const t = setTimeout(() => setFlinch(false), 220);
    return () => clearTimeout(t);
  }, [ps.hitSeq]);
  useEffect(() => {
    if (ps.bigHitSeq === 0) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 420);
    return () => clearTimeout(t);
  }, [ps.bigHitSeq]);

  // The recap: the scene first, then the award cards.
  const over = view?.state === 'over';
  useEffect(() => {
    if (!over || !ps.recap) {
      setRecapStage(0);
      return;
    }
    const t = setTimeout(() => setRecapStage(1), 4200);
    return () => clearTimeout(t);
  }, [over, ps.recap]);

  // When a round ends the class's roster changes (a boss beaten): ask for it again.
  const overNow = ps.view?.state === 'over';
  useEffect(() => {
    if (!room || !overNow) return;
    const t = setTimeout(() => void link.send({ action: 'view', room }).then((out) => { if (out.status === 200 && Array.isArray(out.body.roster)) setRosterRows(out.body.roster as RosterRow[]); }), 1200);
    return () => clearTimeout(t);
  }, [link, room, overNow]);

  const send = async (body: Record<string, unknown>) => {
    const out = await link.send(body);
    if (out.status !== 200) setProblem(String(out.body.error ?? 'That didn’t work.'));
    else setProblem(null);
    return out;
  };
  const open = async () => {
    const out = await send({ action: 'open', classId, mode, length, arena, ...(arena === 'boss' && pick ? { boss: pick } : {}) });
    if (out.status === 200 && typeof out.body.room === 'number') {
      dispatch({ kind: 'reset', reply: { view: out.body.view as RoomView } });
      if (Array.isArray(out.body.roster)) setRosterRows(out.body.roster as RosterRow[]);
      setPick('');
      seenStart.current = 0;
      keepRoom(out.body.room);
      setRoom(out.body.room);
      soundRef.current?.say(arenaWords(arena).lines.joinNow);
    }
  };
  const again = async () => {
    const out = await send({ action: 'again', room, ...(pick ? { boss: pick } : {}) });
    if (out.status === 200 && out.body.view) {
      dispatch({ kind: 'reset', reply: out.body as never });
      if (Array.isArray(out.body.roster)) setRosterRows(out.body.roster as RosterRow[]);
      seenStart.current = 0;
      setPick('');
      setRecapStage(0);
      setCount(null);
      setBarOpen(true);
      const nv = out.body.view as RoomView;
      soundRef.current?.play('roar');
      soundRef.current?.say(arenaWords(nv.arena).lines.start ?? bossInfo(nv.bossId).roar);
    }
  };
  const newRound = () => {
    keepRoom(null);
    setRoom(null);
    dispatch({ kind: 'reset', reply: undefined as never });
    setPick('');
    setRecapStage(0);
    setBarOpen(true);
  };
  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    sound?.setMuted(next);
    onMute?.(next);
  };

  const state = view?.state;
  const arenaNow: Arena = room && view ? view.arena : arena;
  const W = arenaWords(arenaNow);
  const gr = arenaNow === 'goldrush';
  const sky = arenaNow === 'skyclimb';
  const isle = arenaNow === 'island';
  const winding = !!ps.shield && ps.shield.state === null && roundNow < ps.shield.endsAt && view?.state === 'live';
  const caving = gr && winding;
  const paused = !!view?.pausedAt;
  const live = state === 'live';
  const final = ps.final && live;
  const stageClass = ['sd-p', `sd-p--p${ps.phase}`, gr ? 'sd-p--gr' : '', caving ? 'sd-p--cavein' : '', gr && ps.weakUntil > roundNow && live ? 'sd-p--lode' : '', sky ? 'sd-p--sky' : '', sky && winding ? 'sd-p--storm' : '', sky && ps.weakUntil > roundNow && live ? 'sd-p--updraft' : '', isle ? 'sd-p--isle' : '', isle && winding ? 'sd-p--bigwave' : '', shaking ? 'sd-p--shake' : '', final ? 'sd-p--final' : '', roundNow - ps.phaseAt < 3200 && ps.phaseAt > 0 && live ? 'sd-p--transform' : ''].filter(Boolean).join(' ');

  return (
    <div ref={stageRef} className={stageClass} data-state={state ?? 'idle'}>
      <h1 className="sd-p__sr">Class Showdown{state ? ` ${state}` : ''}</h1>
      <Backdrop state={state} boss={view?.bossId} arena={arenaNow} />
      {state === 'live' || state === 'over' ? <Battle ps={ps} roundNow={roundNow} flinch={flinch} /> : null}
      {state === 'lobby' && <Lobby ps={ps} className={className} roster={arenaNow === 'boss' ? rosterRows : null} onMove={(pupil, team) => void send({ action: 'teams', room, pupil, team })} />}
      {!state && <div className="sd-p-idle"><h2>Class Showdown</h2><p>Pick how long, then press Open to bring in the class.</p></div>}

      {live && ps.banner && roundNow < ps.banner.until && <div key={`${ps.banner.text}${ps.banner.until}`} className={`sd-p-banner sd-p-banner--${ps.banner.kind}`} role="status">{ps.banner.text}</div>}
      {live && ps.goldenSeq > 0 && <div key={`g${ps.goldenSeq}`} className="sd-p-goldflash" aria-hidden="true" />}
      {ps.phaseAt > 0 && live && roundNow - ps.phaseAt < 3200 && <div key={`ph${ps.phaseAt}`} className="sd-p-phaseflash" aria-hidden="true" />}
      {final && <div className="sd-p-drum" aria-hidden="true" />}
      {paused && live && <div className="sd-p-paused">Paused</div>}
      {count !== null && <div key={count} className="sd-p-count" aria-live="assertive">{count === 0 ? 'FIGHT!' : count}</div>}
      {over && <Recap ps={ps} stage={recapStage} onAgain={() => void again()} />}

      <div ref={barRef} className={`sd-p-bar${barOpen ? ' sd-p-bar--open' : ''}`}>
        <button type="button" className="sd-p-bar__tab" aria-expanded={barOpen} onClick={() => setBarOpen((o) => !o)}>{barOpen ? 'Hide controls' : 'Teacher controls'}</button>
        {barOpen && (
          <div className="sd-p-bar__row">
            <a className="sd-p-btn sd-p-btn--hub" href="#/">⌂ Back to hub</a>
            <label>Mode <select value={mode} disabled={!!room} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="class">Whole class</option><option value="teams2">2 teams</option><option value="teams4">4 teams</option><option value="solo">Everyone for themselves</option>
            </select></label>
            <label>Minutes <select value={length} disabled={!!room} onChange={(e) => setLength(Number(e.target.value))}>
              {SHOWDOWN.lengths.map((l) => <option key={l} value={l}>{l}</option>)}
            </select></label>
            <label>Arena <select value={arenaNow} disabled={!!room} onChange={(e) => setArena(ARENA_CHOICES.find((a) => a.id === e.target.value)?.id ?? 'boss')}>
              {ARENA_CHOICES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></label>
            {(!room || state === 'over') && arenaNow === 'boss' && rosterRows && <BossPicker rows={rosterRows} value={pick} onChange={setPick} />}
            {!room && <button type="button" className="sd-p-btn sd-p-btn--go" onClick={() => void open()}>Open</button>}
            {room && state === 'lobby' && <button type="button" className="sd-p-btn" onClick={() => void send({ action: 'teams', room, reshuffle: true })}>Reshuffle</button>}
            {room && state === 'lobby' && <button type="button" className="sd-p-btn sd-p-btn--go" onClick={() => void send({ action: 'start', room })}>Start</button>}
            {room && live && <button type="button" className="sd-p-btn" onClick={() => void send({ action: 'enrage', room })}>{W.enrageButton}</button>}
            {room && live && <button type="button" className="sd-p-btn" onClick={() => void send({ action: 'pause', room, resume: paused })}>{paused ? 'Resume' : 'Pause'}</button>}
            <button type="button" className="sd-p-btn" aria-pressed={muted} onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            {room && state !== 'over' && (
              <button type="button" className="sd-p-btn sd-p-btn--danger" onClick={() => { if (armEnd) { setArmEnd(false); void send({ action: 'end', room }); } else { setArmEnd(true); setTimeout(() => setArmEnd(false), 3000); } }}>{armEnd ? 'Sure? End now' : 'End'}</button>
            )}
            {room && state === 'over' && <button type="button" className="sd-p-btn sd-p-btn--go" onClick={() => void again()}>Again?</button>}
            {room && state === 'over' && <button type="button" className="sd-p-btn" onClick={newRound}>New class or mode</button>}
          </div>
        )}
        {problem && <p className="sd-p-bar__problem" role="alert">{problem}</p>}
      </div>
    </div>
  );
}

function Backdrop({ state, boss, arena }: { state: string | undefined; boss: BossId | undefined; arena: Arena }) {
  const gold = arena === 'goldrush';
  const img = gold ? art('back', 'gold-rush') : arena === 'skyclimb' ? art('back', 'sky-climb') : arena === 'island' ? art('back', 'shrinking-island') : state === 'lobby' || !state ? art('back', 'lobby') : art('back', bossInfo(boss).backdrop) ?? art('back', 'river-valley');
  return <div className={`sd-p-back${gold ? ' sd-p-back--gold' : ''}${arena === 'skyclimb' ? ' sd-p-back--sky' : ''}${arena === 'island' ? ' sd-p-back--isle' : ''}${img ? '' : ' sd-p-back--plain'}`} style={img ? ({ backgroundImage: `url(${img})` } as CSSProperties) : undefined} aria-hidden="true" />;
}

/** Boss choice before opening (and for "Again?"): only the bosses the class has open. "" = the next one in order. */
function BossPicker({ rows, value, onChange }: { rows: RosterRow[]; value: BossId | ''; onChange: (b: BossId | '') => void }) {
  const beaten = Object.fromEntries(rows.filter((r) => r.beaten).map((r) => [r.boss, r.bestMs ?? 0]));
  const next = bossInfo(pickBoss(beaten));
  return (
    <label>Boss <select value={value} onChange={(e) => onChange(e.target.value as BossId | '')}>
      <option value="">Next: {next.name}</option>
      {rows.filter((r) => r.open && r.boss !== next.id).map((r) => <option key={r.boss} value={r.boss}>{bossInfo(r.boss).name}{r.beaten ? ' (beaten)' : ''}</option>)}
    </select></label>
  );
}

const bestTime = (ms: number | null) => (ms === null ? '' : mmss(ms));

/** The four bosses: beaten ones with a gold tick and the class's best time, this round's glowing, the rest dark with a padlock. */
function RosterStrip({ rows, current }: { rows: RosterRow[]; current: BossId }) {
  return (
    <ol className="sd-p-roster" aria-label="Bosses">
      {BOSSES.map((b) => {
        const row = rows.find((r) => r.boss === b.id);
        const locked = !!row && !row.open;
        const now = b.id === current;
        const img = art('bosses', `${b.id}-1`);
        return (
          <li key={b.id} className={`sd-p-rost${row?.beaten ? ' sd-p-rost--beaten' : ''}${now ? ' sd-p-rost--now' : ''}${locked ? ' sd-p-rost--locked' : ''}`}>
            <span className="sd-p-rost__pic" aria-hidden="true">
              {img ? <img src={img} alt="" /> : <i className="sd-p-rost__blob" />}
              {row?.beaten && <b className="sd-p-rost__tick">✓</b>}
              {locked && <b className="sd-p-rost__lock">🔒</b>}
            </span>
            <span className="sd-p-rost__name">{locked ? '???' : b.name}</span>
            {row?.beaten && row.bestMs !== null && <small>Best {bestTime(row.bestMs)}</small>}
            {now && <small>Today’s boss</small>}
            {locked && <small>Locked</small>}
          </li>
        );
      })}
    </ol>
  );
}

/** Gold Rush lobby: the three kinds of seam rise out of the dark, glittering, with the rallying cry. */
function GoldEntrance({ seq }: { seq: number }) {
  const kinds = ['gem', 'rich', 'gold'] as const;
  return (
    <>
      <div key={`ge${seq}`} className="sd-p-gr-entrance" aria-hidden="true">
        {kinds.map((k, i) => {
          const img = art('goldrush', `seam-${k}`);
          return (
            <span key={k} className={`sd-p-gr-entrance__seam sd-p-gr-entrance__seam--${k}`} style={{ '--i': i } as CSSProperties}>
              {img ? <img src={img} alt="" /> : <b>💎</b>}
              <Sparkles />
            </span>
          );
        })}
      </div>
      <div key={`gr${seq}`} className="sd-p-roar sd-p-roar--gold" role="status">Dig, dig, dig!</div>
    </>
  );
}

/** Glitter: little stars that twinkle at different times around whatever they sit in. */
function Sparkles({ n = 6 }: { n?: number }) {
  return <span className="sd-p-sparkles" aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} style={{ '--i': i, '--x': `${8 + ((i * 47) % 84)}%`, '--y': `${6 + ((i * 29) % 80)}%` } as CSSProperties} />)}</span>;
}

/** The boss's entrance in the lobby: the painting rises out of the dark with its roar. */
function Entrance({ boss, seq }: { boss: BossId; seq: number }) {
  const info = bossInfo(boss);
  const img = art('bosses', `${boss}-1`);
  return (
    <>
      <div key={`e${boss}${seq}`} className="sd-p-entrance" aria-hidden="true">
        {img ? <img src={img} alt="" /> : <BossStandIn phase={1} flinch={false} weak={false} angry={false} look={0} />}
      </div>
      <div key={`r${boss}${seq}`} className="sd-p-roar" role="status">{info.roar}</div>
    </>
  );
}

function Lobby({ ps, className, roster, onMove }: { ps: ProjectorState; className?: string; roster: RosterRow[] | null; onMove: (pupil: string, team: TeamId) => void }) {
  const show = ps.view?.showNames ?? false;
  const teamMode = ps.view && isTeamMode(ps.view) ? ps.view.teams : null;
  const [sel, setSel] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TeamId | null>(null);
  const lobbyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useFit(listRef, lobbyRef, `${ps.order.length}${show}${ps.order.map((id) => ps.roster[id]?.name.length).join()}`, () => Math.max(16, Math.min(window.innerWidth * 0.028, window.innerHeight * 0.05, 38)), 9);
  const label = (id: string) => (show ? ps.roster[id].name : `Hero ${ps.order.indexOf(id) + 1}`);
  const moveTo = (team: TeamId, pupil: string | null) => {
    setSel(null);
    setDragOver(null);
    if (pupil && ps.roster[pupil] && ps.roster[pupil].team !== team) onMove(pupil, team);
  };
  return (
    <div className="sd-p-lobby" ref={lobbyRef}>
      {ps.view && (isGoldRush(ps.view) ? <GoldEntrance seq={ps.againSeq} /> : ps.view.arena === 'skyclimb' ? <SkyEntrance seq={ps.againSeq} /> : ps.view.arena === 'island' ? <IsleEntrance seq={ps.againSeq} /> : <Entrance boss={ps.view.bossId} seq={ps.againSeq} />)}
      <div className="sd-p-lobby__join">Join now!</div>
      {className && <div className="sd-p-lobby__class">{className}</div>}
      <p className="sd-p-lobby__hint">{teamMode ? 'Tap a name, then tap a team (or drag it) to move it' : arenaWords(ps.view?.arena).lobbyHint ?? 'Open Class Showdown on your iPad'}</p>
      <div className="sd-p-lobby__count">{ps.order.length} {ps.order.length === 1 ? 'hero' : 'heroes'} ready</div>
      {teamMode ? (
        <div className={`sd-p-picker sd-p-picker--${teamMode.length}`} aria-label="Team picker">
          {teamMode.map((k) => {
            const members = ps.order.filter((id) => ps.roster[id].team === k);
            return (
              <TeamColumn key={k} team={k} count={members.length} over={dragOver === k} armed={sel !== null && ps.roster[sel]?.team !== k}
                onTap={() => moveTo(k, sel)} onOver={(on) => setDragOver((d) => (on ? k : d === k ? null : d))} onDrop={(id) => moveTo(k, id)}>
                {members.map((id) => (
                  <li key={id}>
                    <button type="button" draggable className={`sd-p-pick sd-p-fly${sel === id ? ' sd-p-pick--sel' : ''}`} aria-pressed={sel === id}
                      style={{ '--fx': `${(hash(id) % 200) - 100}vw`, '--fy': `${(hash(id + 'y') % 60) - 30}vh` } as CSSProperties}
                      onClick={(e) => { e.stopPropagation(); setSel((c) => (c === id ? null : id)); }}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setSel(id); }}
                      onDragEnd={() => setDragOver(null)}>
                      {label(id)}
                    </button>
                  </li>
                ))}
              </TeamColumn>
            );
          })}
        </div>
      ) : (
        <ul ref={listRef} className="sd-p-lobby__names">
          {ps.order.map((id) => {
            const r = ps.roster[id];
            const fx = (hash(id) % 200) - 100;
            return (
              <li key={id} className={`sd-p-fly${r.team ? ` sd-p-team--${r.team}` : ''}`} style={{ '--fx': `${fx}vw`, '--fy': `${(hash(id + 'y') % 60) - 30}vh` } as CSSProperties}>
                {show ? r.name : 'Hero'}
              </li>
            );
          })}
        </ul>
      )}
      {roster && ps.view && <RosterStrip rows={roster} current={ps.view.bossId} />}
    </div>
  );
}

function TeamColumn({ team, count, over, armed, onTap, onOver, onDrop, children }: { team: TeamId; count: number; over: boolean; armed: boolean; onTap: () => void; onOver: (on: boolean) => void; onDrop: (id: string | null) => void; children: React.ReactNode }) {
  const colRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const kids = Array.isArray(children) ? children.length : 0;
  useFit(listRef, colRef, `${kids}${count}`, () => Math.max(14, Math.min(window.innerWidth * 0.022, window.innerHeight * 0.04, 30)), 8);
  return (
    <div ref={colRef} className={`sd-p-col sd-p-team--${team}${over ? ' sd-p-col--over' : ''}${armed ? ' sd-p-col--armed' : ''}`} onClick={onTap}
      onDragOver={(e) => { e.preventDefault(); onOver(true); }} onDragLeave={() => onOver(false)}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain') || null); }}>
      <Cloth team={team} className="sd-p-col__head"><b>{TEAM_SHORT[team]}</b><strong>{count}</strong></Cloth>
      <ul ref={listRef} className="sd-p-col__list">{children}</ul>
    </div>
  );
}

/** A waving team banner: the painted one (art/paint/banners/<team>.webp) when it exists, else a cloth drawn in CSS. */
function Cloth({ team, className = '', children }: { team: TeamId; className?: string; children: React.ReactNode }) {
  const img = art('banners', team);
  return (
    <div className={`sd-p-cloth sd-p-team--${team}${img ? ' sd-p-cloth--painted' : ''} ${className}`} style={img ? ({ '--cloth': `url(${img})` } as CSSProperties) : undefined}>
      <span className="sd-p-cloth__slices" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--n': i } as CSSProperties} />)}</span>
      <div className="sd-p-cloth__text">{children}</div>
    </div>
  );
}

function Battle({ ps, roundNow, flinch }: { ps: ProjectorState; roundNow: number; flinch: boolean }) {
  const view = ps.view as RoomView;
  const { boss } = view;
  const gr = isGoldRush(view);
  const sky = view.arena === 'skyclimb';
  const bossArena = (view.arena ?? 'boss') === 'boss';
  const W = arenaWords(view.arena);
  const healthPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.max)) * 100));
  const pct = W.fills ? 100 - healthPct : healthPct;
  const left = Math.max(0, view.lengthMin * 60000 - roundNow);
  const weak = ps.weakUntil > roundNow;
  const angry = ps.enrageUntil > roundNow || ps.phase >= 2;
  const bossImg = art('bosses', `${view.bossId}-${ps.phase}`);
  const bossName = bossInfo(view.bossId).name;
  const over = view.state === 'over';
  const roster = ps.order.map((id) => ps.roster[id]);
  const counts: Record<Role, number> = { striker: 0, guard: 0, healer: 0 };
  for (const r of roster) counts[r.role]++;
  const needGuards = !over && roster.length >= 4 && counts.guard * 5 < roster.length;
  const showNames = view.showNames;
  const teamMode = isTeamMode(view);
  const t2 = view.mode === 'teams2';
  const facing = view.mode === 'teams4' && bossArena ? (view.facing ?? ps.turn?.team ?? null) : null;
  const slot = facing ? SLOT[facing] : null;
  const roaring = !!ps.turn && view.mode === 'teams4' && roundNow - ps.turn.at < 1600 && roundNow >= ps.turn.at;
  const turnT = slot ? `perspective(900px) rotateY(${slot.side * 32}deg) rotate(${slot.side * 3}deg) translate(${slot.side * 8}%, ${slot.low ? 3 : -1}%)` : undefined;
  const healing = ps.healAt > 0 && roundNow - ps.healAt < 1500;
  const bursts = ps.bursts.filter((b) => roundNow - b.t < 2500 && roundNow >= b.t - 500);
  const heals = ps.heals.filter((h) => roundNow - h.t < 2800);
  const crewRef = useRef<HTMLUListElement>(null);
  const dug = new Set(gr || sky || view.arena === 'island' ? ps.bursts.filter((b) => roundNow - b.t < 1300 && roundNow >= b.t).map((b) => b.pupil) : []);
  useFit(crewRef, null, `${roster.length}${showNames}${roster.map((r) => r.name.length).join()}`, () => Math.max(12, Math.min(window.innerWidth * 0.016, window.innerHeight * 0.03, 22)), 8);

  return (
    <>
      <header className="sd-p-hud">
        <div className={`sd-p-health${gr ? ' sd-p-health--gold' : ''}${sky ? ' sd-p-health--sky' : ''}${weak ? ' sd-p-health--weak' : ''}${healing ? ' sd-p-health--heal' : ''}`} role="progressbar" aria-label={W.goal ?? 'Boss health'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="sd-p-health__ghost" style={{ transform: `scaleX(${pct / 100})` }} />
          <div className="sd-p-health__fill" style={{ transform: `scaleX(${pct / 100})` }} />
          <span className="sd-p-health__tick" style={{ left: '66%' }} /><span className="sd-p-health__tick" style={{ left: '33%' }} />
          <span className="sd-p-health__label">{W.goal ?? bossName}{sky ? ` · ${Math.floor(pct)}%` : ''}</span>
          {(gr || sky) && <Sparkles n={10} />}
        </div>
        <div className={`sd-p-clock${left <= 30000 && !over ? ' sd-p-clock--low' : ''}`}>{mmss(left)}</div>
      </header>

      {t2 && bossArena && <Bridge shakeKey={ps.tugSeq} />}
      {teamMode && <TeamFlags ps={ps} facing={facing} />}
      {t2 && bossArena && Math.abs(view.tug) > 0.04 && !over && <div key={view.tug > 0 ? 'r' : 'b'} className={`sd-p-pushing sd-p-team--${view.tug > 0 ? 'red' : 'blue'}`} role="status">{view.tug > 0 ? 'RED' : 'BLUE'} is pushing!</div>}

      {gr && <Mine ps={ps} roundNow={roundNow} weak={weak} over={over} />}
      {sky && <Climb ps={ps} roundNow={roundNow} pct={pct} weak={weak} over={over} />}
      {view.arena === 'island' && <Isle ps={ps} roundNow={roundNow} pct={pct} weak={weak} over={over} />}
      {bossArena && <div className={`sd-p-bosswrap${teamMode ? ' sd-p-bosswrap--teams' : ''}${over && ps.beaten ? ' sd-p-bosswrap--beaten' : ''}`} style={t2 ? ({ left: `calc(50% + ${Math.max(-1, Math.min(1, view.tug)) * 16}vw)` } as CSSProperties) : undefined}>
        {facing && <div key={`gz${ps.turnSeq}`} className={`sd-p-gaze sd-p-team--${facing}`} aria-hidden="true" />}
        {roaring && ps.turn && <div key={`rw${ps.turnSeq}`} className={`sd-p-roarwave sd-p-team--${ps.turn.team}`} aria-hidden="true"><i /><i /><i /></div>}
        <div className={`sd-p-bossroar${roaring ? ' sd-p-bossroar--go' : ''}`}>
          <div className="sd-p-bossturn" style={turnT ? { transform: turnT } : undefined}>
            <div className={`sd-p-boss${flinch ? ' sd-p-flinch' : ''}${angry ? ' sd-p-boss--angry' : ''}`}>
              {bossImg ? <img className="sd-p-boss__img" src={bossImg} alt={`The ${bossName}`} /> : <BossStandIn phase={ps.phase} flinch={false} weak={weak} angry={angry} look={slot ? slot.side : 0} />}
              {weak && <div className="sd-p-weakglow" aria-hidden="true" />}
              {ps.phase >= 2 && <div className="sd-p-eyes" aria-hidden="true" />}
            </div>
          </div>
        </div>
        <div className="sd-p-bursts" aria-hidden="true">{bursts.map((b) => <Burst key={b.id} b={b} showNames={showNames} />)}</div>
        {over && ps.beaten && <Explosion />}
      </div>}

      <SidePanel ps={ps} roundNow={roundNow} />

      <div className="sd-p-crewzone">
        {needGuards && !ps.shield && <div className="sd-p-need">{W.needGuards}</div>}
        <Dome ps={ps} roundNow={roundNow} />
        <div className="sd-p-heals" aria-hidden="true">{heals.map((h) => <div key={h.id} className="sd-p-heal">{showNames ? h.text : 'A Healer woke a friend!'}<i /><i /><i /><i /><i /></div>)}</div>
        <ul ref={crewRef} className="sd-p-crew">
          {roster.map((r) => {
            const dazed = (ps.dazed[r.id] ?? 0) > roundNow;
            const portrait = art('roles', r.role);
            return (
              <li key={r.id} data-pid={r.id} className={`sd-p-chip${r.team ? ` sd-p-team--${r.team}` : ''}${dazed ? ' sd-p-chip--dazed' : ''}${dug.has(r.id) ? ' sd-p-chip--got' : ''}`}>
                <span className={`sd-p-chip__role sd-p-role--${r.role}`} title={ROLE_WORD[r.role]}>{portrait ? <img src={portrait} alt="" /> : ROLE_LETTER[r.role]}</span>
                {showNames && <span className="sd-p-chip__name">{r.name}</span>}
                {dazed && <span className="sd-p-daze" aria-hidden="true"><b>★</b><b>★</b><b>★</b></span>}
              </li>
            );
          })}
        </ul>
        <div className="sd-p-mix" aria-label="Roles">{(['striker', 'guard', 'healer'] as Role[]).map((k) => <span key={k} className={`sd-p-role--${k}`}>{ROLE_LETTER[k]} {counts[k]}</span>)}</div>
      </div>
    </>
  );
}

function Burst({ b, showNames }: { b: HitBurst; showNames: boolean }) {
  const tier = b.times >= 4 ? 4 : b.times >= 3 ? 3 : b.times >= 2 ? 2 : 1;
  const x = 50 + ((b.id * 37) % 41) - 20;
  const y = 22 + ((b.id * 53) % 36);
  const dx = ((b.id * 29) % 31) - 15;
  return (
    <div className={`sd-p-burst sd-p-burst--t${tier}${b.golden ? ' sd-p-burst--golden' : ''}${b.weakSpot ? ' sd-p-burst--crit' : ''}${b.team ? ` sd-p-team--${b.team}` : ''}`} style={{ left: `${x}%`, top: `${y}%`, '--dx': `${dx}vw` } as CSSProperties}>
      <span className="sd-p-burst__num">+{b.points}</span>
      {b.weakSpot && <span className="sd-p-burst__tag">WEAK SPOT</span>}
      {b.golden && <span className="sd-p-burst__tag">GOLDEN</span>}
      {showNames && <span className="sd-p-burst__who">{b.name}</span>}
      {b.golden && <span className="sd-p-burst__flash" />}
    </div>
  );
}

function Dome({ ps, roundNow }: { ps: ProjectorState; roundNow: number }) {
  const sh = ps.shield;
  const view = ps.view as RoomView;
  const W = arenaWords(view.arena);
  if (!sh) return null;
  if (isTeamMode(view)) {
    const winding = roundNow < sh.endsAt;
    const items = view.teams.filter((k) => sh.groups[k]).map((k) => {
      const g = sh.groups[k];
      const state = g.state ?? null;
      const live = state === null && winding;
      const resolved = state !== null && roundNow - (g.resolvedAt ?? 0) < 3200;
      return { k, g, state, live, resolved };
    }).filter((d) => d.live || d.resolved);
    if (!items.length) return null;
    const secs = Math.max(0, Math.ceil((sh.endsAt - roundNow) / 1000));
    return (
      <div className="sd-p-domes" aria-hidden="true">
        {view.teams.map((k) => {
          const d = items.find((i) => i.k === k);
          if (!d) return <div key={k} className="sd-p-domes__gap" />;
          const fill = Math.max(0, Math.min(1, d.g.needed ? d.g.got / d.g.needed : 0));
          return (
            <div key={k} className={`sd-p-dome sd-p-dome--team sd-p-team--${k}${d.live ? ' sd-p-dome--winding' : ''}${d.state ? ` sd-p-dome--${d.state}` : ''}`}>
              <div className="sd-p-dome__shell">
                <div className="sd-p-dome__fill" style={{ transform: `scaleY(${fill})` }} />
                {d.state === 'broke' && <svg className="sd-p-dome__crack" viewBox="0 0 100 60"><path d="M50 0 L44 14 L56 24 L40 38 L52 60 M44 14 L24 22 M56 24 L78 30 M40 38 L18 48" /></svg>}
              </div>
              {d.live && <div className="sd-p-dome__count">{secs}</div>}
              <div className="sd-p-dome__label sd-p-dome__label--team">{TEAM_SHORT[k]} {W.shieldTeam}</div>
              {d.state === 'held' && <div className="sd-p-dome__clang">{W.held}</div>}
              {d.state === 'broke' && <div className="sd-p-dome__clang sd-p-dome__clang--broke">{W.broke}</div>}
              {d.state === 'broke' && <div className="sd-p-dome__shards">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}
            </div>
          );
        })}
      </div>
    );
  }
  const winding = sh.state === null && roundNow < sh.endsAt;
  const resolved = sh.state !== null && roundNow - sh.resolvedAt < 3200;
  if (!winding && !resolved) return null;
  const fill = Math.max(0, Math.min(1, sh.needed ? sh.got / sh.needed : 0));
  const secs = Math.max(0, Math.ceil((sh.endsAt - roundNow) / 1000));
  return (
    <div className={`sd-p-dome${winding ? ' sd-p-dome--winding' : ''}${sh.state ? ` sd-p-dome--${sh.state}` : ''}`} aria-hidden="true">
      <div className="sd-p-dome__shell">
        <div className="sd-p-dome__fill" style={{ transform: `scaleY(${fill})` }} />
        {sh.state === 'broke' && <svg className="sd-p-dome__crack" viewBox="0 0 100 60"><path d="M50 0 L44 14 L56 24 L40 38 L52 60 M44 14 L24 22 M56 24 L78 30 M40 38 L18 48" /></svg>}
      </div>
      {winding && <div className="sd-p-dome__count">{secs}</div>}
      {winding && <div className="sd-p-dome__label">{W.shieldUp}</div>}
      {sh.state === 'held' && <div className="sd-p-dome__clang">{W.held}</div>}
      {sh.state === 'broke' && <div className="sd-p-dome__clang sd-p-dome__clang--broke">{W.broke}</div>}
      {sh.state === 'broke' && <div className="sd-p-dome__shards">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}
    </div>
  );
}

/** 2 teams: the bridge the boss stands on. It shakes (remounts its animation) on every tug event. */
function Bridge({ shakeKey }: { shakeKey: number }) {
  return (
    <div className="sd-p-bridgewrap" aria-hidden="true">
      <div key={shakeKey} className={`sd-p-bridge${shakeKey > 0 ? ' sd-p-bridge--shake' : ''}`}>
        <span className="sd-p-bridge__rail sd-p-bridge__rail--back" /><span className="sd-p-bridge__deck" /><span className="sd-p-bridge__rail" />
        <span className="sd-p-bridge__post sd-p-bridge__post--l" /><span className="sd-p-bridge__post sd-p-bridge__post--m" /><span className="sd-p-bridge__post sd-p-bridge__post--r" />
        <span className="sd-p-bridge__end sd-p-bridge__end--red" /><span className="sd-p-bridge__end sd-p-bridge__end--blue" />
      </div>
    </div>
  );
}

/** Big waving team banners in the corners with the team's bar (points in 4 teams, damage in 2). */
function TeamFlags({ ps, facing }: { ps: ProjectorState; facing: TeamId | null }) {
  const view = ps.view as RoomView;
  const t2 = view.mode === 'teams2';
  const gr = isGoldRush(view);
  const unit = arenaWords(view.arena).teamUnit;
  const val = (k: TeamId) => Math.round((t2 || unit ? view.teamDamage[k] : view.teamPoints[k]) ?? 0);
  const max = Math.max(1, ...view.teams.map(val));
  return (
    <div className="sd-p-flags" aria-label="Teams">
      {view.teams.map((k, i) => {
        const sl = SLOT[k];
        const leading = t2 ? (view.tug > 0.04 ? 'red' : view.tug < -0.04 ? 'blue' : null) === k : false;
        return (
          <div key={k} data-flag={k} className={`sd-p-flag sd-p-flag--${sl.side < 0 ? 'l' : 'r'}${sl.low && !t2 ? ' sd-p-flag--low' : ''} sd-p-team--${k}${facing === k ? ' sd-p-flag--facing' : ''}${leading ? ' sd-p-flag--lead' : ''}`} style={{ '--k': i, '--n': view.teams.length } as CSSProperties}>
            <span className="sd-p-flag__pole" />
            <Cloth team={k} className="sd-p-flag__cloth">
              <b>{TEAM_SHORT[k]}</b>
              <strong>{unit === 'metres' ? val(k) * 10 : val(k)}</strong>
              <small>{unit ?? (t2 ? 'damage' : 'points')}</small>
            </Cloth>
            {gr ? <GoldPile share={val(k) / max} amount={val(k)} team={k} /> : <div className="sd-p-flag__bar"><i style={{ transform: `scaleX(${val(k) / max})` }} /></div>}
            {facing === k && <div className="sd-p-flag__faces">BOSS FACES YOU</div>}
          </div>
        );
      })}
    </div>
  );
}

function SidePanel({ ps, roundNow }: { ps: ProjectorState; roundNow: number }) {
  const view = ps.view as RoomView;
  if (view.mode !== 'solo') return null;
  return (
    <>
      <Leaderboard ps={ps} roundNow={roundNow} />
      <Bounties ps={ps} />
    </>
  );
}

function Leaderboard({ ps, roundNow }: { ps: ProjectorState; roundNow: number }) {
  const view = ps.view as RoomView;
  const names = view.showNames;
  const top = ps.order.map((id) => ps.roster[id]).sort((a, b) => b.score - a.score).slice(0, 10);
  const listRef = useRef<HTMLOListElement>(null);
  const prev = useRef(new Map<string, { top: number; rank: number }>());
  // FLIP: remember where each row was, and when a place changes slide it from the old spot to the new one.
  useLayoutEffect(() => {
    const ol = listRef.current;
    if (!ol) return;
    const next = new Map<string, { top: number; rank: number }>();
    (Array.from(ol.children) as HTMLElement[]).forEach((el, i) => {
      const id = el.dataset.id ?? '';
      const t = el.offsetTop;
      const old = prev.current.get(id);
      next.set(id, { top: t, rank: i + 1 });
      if (old && old.top !== t) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${old.top - t}px)`;
        void el.offsetWidth;
        el.style.transition = 'transform 0.75s cubic-bezier(.2,.9,.3,1.1)';
        el.style.transform = '';
        if (old.rank > i + 1) {
          el.classList.remove('sd-p-lb__up');
          void el.offsetWidth;
          el.classList.add('sd-p-lb__up');
        }
      }
    });
    prev.current = next;
  });
  const moves = ps.moves.filter((m) => roundNow - m.t < 3800 && roundNow >= m.t).slice(-2);
  return (
    <aside className="sd-p-side sd-p-lb" aria-label="Top ten">
      <h2>Top 10</h2>
      <ol ref={listRef}>
        {top.map((r, i) => <li key={r.id} data-id={r.id} className={`sd-p-lb__row sd-p-lb__row--${i + 1}`}><b>{i + 1}</b><span>{names ? r.name : 'Hero'}</span><em>{r.score}</em></li>)}
      </ol>
      <div className="sd-p-moves" aria-live="polite">
        {moves.map((m) => <div key={m.id} className="sd-p-bigmove"><strong>{names ? m.name : 'A hero'} jumps to {ordinal(m.to)}!</strong><small>up {m.from - m.to} places</small></div>)}
      </div>
    </aside>
  );
}

function Bounties({ ps }: { ps: ProjectorState }) {
  const names = ps.view?.showNames ?? false;
  const who = (id: string) => (names ? ps.names[id] ?? ps.roster[id]?.name ?? 'A hero' : 'A hero');
  const topDmg = Object.entries(ps.damage).sort((a, b) => b[1] - a[1])[0];
  const rows: { kind: string; label: string; who: string; val: string }[] = [];
  if (topDmg) rows.push({ kind: 'dmg', label: arenaWords(ps.view?.arena).mostDamage, who: who(topDmg[0]), val: `${Math.round(topDmg[1] * 10)}` });
  if (ps.lastHitter) rows.push({ kind: 'last', label: 'Last hit', who: who(ps.lastHitter), val: '' });
  if (ps.bestStreak && ps.bestStreak.streak >= 2) rows.push({ kind: 'streak', label: 'Longest streak', who: who(ps.bestStreak.pupil), val: `${ps.bestStreak.streak} in a row` });
  const comeback = bestComeback(ps);
  if (comeback) rows.push({ kind: 'comeback', label: 'Best comeback', who: who(comeback.pupil), val: `up ${comeback.places} places` });
  if (!rows.length) return null;
  return (
    <aside className="sd-p-bounty" aria-label="Bounties">
      <h2>Bounties</h2>
      {rows.map((r) => (
        <div key={r.kind} className={`sd-p-bounty__row sd-p-bounty__row--${r.kind}`}>
          <small>{r.label}</small>
          <strong key={r.who} className="sd-p-bounty__who">{r.who}</strong>
          {r.val && <em>{r.val}</em>}
        </div>
      ))}
    </aside>
  );
}

/** Gold Rush: the painted map with every open seam on it, the gold flying out of them, the cave-in and the mother lode. */
function Mine({ ps, roundNow, weak, over }: { ps: ProjectorState; roundNow: number; weak: boolean; over: boolean }) {
  const view = ps.view as RoomView;
  const teamMode = isTeamMode(view);
  const sh = ps.shield;
  const caving = !!sh && sh.state === null && roundNow < sh.endsAt && !over;
  const caved = !!sh && sh.state === 'broke' && roundNow - sh.resolvedAt < 2600;
  const dry = ps.dry.filter((d) => roundNow - d.t < 1900 && roundNow >= d.t);
  const flights = ps.bursts.filter((b) => b.seam !== undefined && roundNow - b.t < 1300 && roundNow >= b.t - 300);
  const toTeam = teamMode;
  return (
    <>
      <div className={`sd-p-map${teamMode ? ' sd-p-map--teams' : ''}${view.mode === 'solo' ? ' sd-p-map--solo' : ''}`}>
        {weak && !over && <div className="sd-p-lode" aria-hidden="true"><i /><b /></div>}
        {!over && view.seams.map((x) => <Seam key={x.id} s={x} lode={weak} />)}
        {dry.map((d) => <DrySeamView key={`d${d.id}`} d={d} />)}
      </div>
      <div className="sd-p-nuggets" aria-hidden="true">{flights.map((b) => <NuggetFlight key={b.id} b={b} toTeam={toTeam} showNames={view.showNames} />)}</div>
      {(caving || caved) && <CaveIn heavy={caved} />}
    </>
  );
}

function Seam({ s, lode }: { s: RoomView['seams'][number]; lode: boolean }) {
  const pct = Math.max(0, Math.min(1, s.left / Math.max(1, s.size)));
  const img = art('goldrush', `seam-${s.kind}`);
  return (
    <div className={`sd-p-seam sd-p-seam--${s.kind}${lode ? ' sd-p-seam--lode' : ''}${pct < 0.25 ? ' sd-p-seam--low' : ''}`} data-seam={s.id} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}>
      <div className="sd-p-seam__pop">
        <span className="sd-p-seam__glow" />
        {img ? <img className="sd-p-seam__img" src={img} alt={SEAM_WORD[s.kind]} /> : <span className="sd-p-seam__img sd-p-seam__img--blob" />}
        <Sparkles n={s.kind === 'rich' ? 8 : 5} />
        <span className="sd-p-seam__diggers" aria-label={`${s.diggers} digging`}>⛏ {s.diggers}</span>
        {(s.kind !== 'gold' || lode) && <span className="sd-p-seam__tag">{lode ? 'DOUBLE!' : s.kind === 'rich' ? 'RICH' : 'GEMS'}</span>}
      </div>
      <div className="sd-p-seam__gauge" role="progressbar" aria-label="Gold left in this seam" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}><i style={{ transform: `scaleX(${pct})` }} /></div>
    </div>
  );
}

/** A seam that ran dry: it cracks, shakes, and crumbles away in a puff of dust. */
function DrySeamView({ d }: { d: DrySeam }) {
  const img = art('goldrush', `seam-${d.kind}`);
  return (
    <div className={`sd-p-seam sd-p-seam--${d.kind} sd-p-seam--dry`} style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}>
      <div className="sd-p-seam__pop">
        {img ? <img className="sd-p-seam__img" src={img} alt="" /> : <span className="sd-p-seam__img sd-p-seam__img--blob" />}
        <svg className="sd-p-seam__crack" viewBox="0 0 100 100"><path d="M52 0 L44 22 L58 38 L40 58 L54 78 L46 100 M44 22 L24 30 M58 38 L80 44 M40 58 L18 70 M54 78 L74 88" /></svg>
        <span className="sd-p-seam__dust">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>
        <span className="sd-p-seam__dry">DRY!</span>
      </div>
    </div>
  );
}

/** Gold nuggets arcing from the seam that was dug to the pupil's name (or their team's banner), with the +N at the seam. */
function NuggetFlight({ b, toTeam, showNames }: { b: HitBurst; toTeam: boolean; showNames: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [g, setG] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const centre = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - hr.left, y: r.top + r.height / 2 - hr.top };
    };
    const from = centre(`[data-seam="${b.seam}"] .sd-p-seam__img`) ?? { x: hr.width / 2, y: hr.height * 0.4 };
    let to = (toTeam && b.team ? centre(`[data-flag="${b.team}"] .sd-p-pile, [data-flag="${b.team}"] .sd-p-cloth`) : null) ?? centre(`[data-pid="${b.pupil}"]`) ?? { x: hr.width / 2, y: hr.height * 0.92 };
    to = { x: Math.max(0, Math.min(hr.width, to.x)), y: Math.max(0, Math.min(hr.height, to.y)) };
    setG({ x0: from.x, y0: from.y, x1: to.x, y1: to.y });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tier = b.times >= 3 ? 3 : b.times >= 2 ? 2 : 1;
  return (
    <div ref={ref} className={`sd-p-flight${b.team ? ` sd-p-team--${b.team}` : ''}`}>
      {g && (
        <>
          <span className={`sd-p-pop sd-p-pop--t${tier}${b.weakSpot ? ' sd-p-pop--lode' : ''}${b.golden ? ' sd-p-pop--golden' : ''}`} style={{ left: g.x0, top: g.y0 }}>
            +{b.points}{showNames && <small>{b.name}</small>}
          </span>
          {Array.from({ length: tier + 3 }, (_, i) => (
            <span key={i} className="sd-p-nug" style={{ left: g.x0, top: g.y0, '--x': `${g.x1 - g.x0}px`, '--y': `${g.y1 - g.y0}px`, '--d': `${0.12 + i * 0.07}s`, '--up': `${-9 - (i % 3) * 4}vh`, '--sx': `${(i - 2) * 1.2}vw` } as CSSProperties}><i /></span>
          ))}
          <span className="sd-p-catch" style={{ left: g.x1, top: g.y1 }} />
        </>
      )}
    </div>
  );
}

/** The cave-in: dust and stones tumbling down the screen while the class props up the roof, and a heavy slump if it fails. */
function CaveIn({ heavy }: { heavy: boolean }) {
  const dust = art('goldrush', 'cave-in');
  return (
    <div className={`sd-p-cave${heavy ? ' sd-p-cave--heavy' : ''}`} aria-hidden="true">
      <div className="sd-p-cave__dark" />
      {Array.from({ length: heavy ? 5 : 4 }, (_, i) => (
        <span key={i} className="sd-p-cave__dust" style={{ left: `${6 + i * (heavy ? 20 : 24)}%`, '--i': i } as CSSProperties}>{dust ? <img src={dust} alt="" /> : <b />}</span>
      ))}
      {Array.from({ length: 14 }, (_, i) => <i key={i} className="sd-p-cave__rock" style={{ left: `${(i * 37) % 96}%`, '--i': i } as CSSProperties} />)}
    </div>
  );
}

/** Sky Climb lobby: the peak rises out of the clouds, the summit flag unfurls, and the rallying cry. */
function SkyEntrance({ seq }: { seq: number }) {
  const peak = art('skyclimb', 'summit');
  const flag = art('skyclimb', 'summit-flag');
  return (
    <>
      <div key={`se${seq}`} className="sd-p-sky-entrance" aria-hidden="true">
        <span className="sd-p-sky-entrance__peak">{peak ? <img src={peak} alt="" /> : <i />}</span>
        <span className="sd-p-sky-entrance__flag">{flag ? <img src={flag} alt="" /> : '🚩'}</span>
        <Clouds n={5} />
      </div>
      <div key={`sr${seq}`} className="sd-p-roar sd-p-roar--sky" role="status">Climb to the summit!</div>
    </>
  );
}

/** Drifting clouds at different heights and speeds. */
function Clouds({ n = 6, low = false }: { n?: number; low?: boolean }) {
  const cloud = art('skyclimb', 'cloud');
  return (
    <span className={`sd-p-clouds${low ? ' sd-p-clouds--low' : ''}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ '--i': i, '--y': `${6 + ((i * 37) % 70)}%`, '--s': 0.6 + ((i * 7) % 5) / 6, '--d': `${38 + ((i * 13) % 30)}s` } as CSSProperties}>{cloud ? <img src={cloud} alt="" /> : null}</i>
      ))}
    </span>
  );
}

/**
 * Sky Climb: the cliff with the summit at the top and every pupil's climber on it, side by side (grouped by team). The
 * class's progress is how high the leader is; everyone else is lower by how much less they've climbed. A right answer
 * steps a climber up, a 3rd in a row leaps (JUMP!), a storm darkens the sky with rain and lightning, and anyone it blows
 * back slides down in a spin. An updraft sends white streams up the cliff.
 */
function Climb({ ps, roundNow, pct, weak, over }: { ps: ProjectorState; roundNow: number; pct: number; weak: boolean; over: boolean }) {
  const view = ps.view as RoomView;
  const names = view.showNames;
  const order = [...ps.order].sort((a, b) => (view.teams.indexOf(ps.roster[a]?.team as TeamId) - view.teams.indexOf(ps.roster[b]?.team as TeamId)) || ps.order.indexOf(a) - ps.order.indexOf(b));
  const top = Math.max(1, ...order.map((id) => ps.damage[id] ?? 0));
  const reach = over && ps.beaten ? 100 : pct;
  // Height on the cliff grows with the square root of the climb, so the first steps of a long round still show.
  const up = (share: number) => Math.sqrt(Math.max(0, Math.min(1, share)));
  const sh = ps.shield;
  const storm = !!sh && sh.state === null && roundNow < sh.endsAt && !over;
  const blownNow = ps.blown && roundNow - ps.blown.t < 2200 && roundNow >= ps.blown.t ? new Set(ps.blown.pupils) : null;
  const stepped = new Map(ps.bursts.filter((b) => roundNow - b.t < 1300 && roundNow >= b.t).map((b) => [b.pupil, b]));
  const jumped = new Set(ps.jumps.filter((j) => roundNow - j.t < 1300 && roundNow >= j.t).map((j) => j.pupil));
  const climber = art('skyclimb', 'climber');
  const flag = art('skyclimb', 'summit-flag');
  const n = order.length;
  const size = Math.max(2.4, Math.min(6, 80 / Math.max(1, n)));
  return (
    <>
      <div className="sd-p-sky" style={{ '--climb': reach / 100 } as CSSProperties} aria-hidden="true">
        <Clouds n={7} />
        <div className="sd-p-sky__summit">
          <span className="sd-p-sky__flag">{flag ? <img src={flag} alt="" /> : '🚩'}</span>
          <b>SUMMIT</b>
        </div>
        <div className="sd-p-sky__scale">{[10, 25, 50, 75].map((m) => <span key={m} style={{ bottom: `${up(m / 100) * 100}%` }}>{m * 10} m</span>)}<i style={{ transform: `scaleY(${up(reach / 100)})` }} /></div>
        {weak && !over && <div className="sd-p-sky__updraft">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--i': i, left: `${6 + i * 11}%` } as CSSProperties} />)}</div>}
        <div className="sd-p-sky__wall" style={{ '--size': `${size}vw` } as CSSProperties}>
          {order.map((id, i) => {
            const r = ps.roster[id];
            const mine = (ps.damage[id] ?? 0) / top;
            const h = over && ps.beaten ? 1 : up((reach / 100) * (0.5 + 0.5 * mine));
            const dazed = (ps.dazed[id] ?? 0) > roundNow;
            const b = stepped.get(id);
            const x = n === 1 ? 50 : 7 + (i * 86) / (n - 1);
            const cls = `sd-p-climber${r?.team ? ` sd-p-team--${r.team}` : ''}${b ? ' sd-p-climber--step' : ''}${jumped.has(id) ? ' sd-p-climber--jump' : ''}${blownNow?.has(id) ? ' sd-p-climber--blown' : ''}${storm ? ' sd-p-climber--storm' : ''}${dazed ? ' sd-p-climber--dazed' : ''}`;
            return (
              <div key={id} className={cls} style={{ left: `${x}%`, bottom: `${h * 100}%`, '--i': i } as CSSProperties}>
                <span className="sd-p-climber__rope" />
                <span key={b ? `s${b.id}` : 'idle'} className="sd-p-climber__body">{climber ? <img src={climber} alt="" /> : <b>🧗</b>}</span>
                {names && <span className="sd-p-climber__name">{r?.name}</span>}
                {b && <span key={`p${b.id}`} className={`sd-p-climber__pop${b.weakSpot ? ' sd-p-climber__pop--up' : ''}${b.golden ? ' sd-p-climber__pop--golden' : ''}`}>+{b.points}</span>}
                {jumped.has(id) && <span className="sd-p-climber__jump">JUMP!<i /><i /><i /></span>}
                {blownNow?.has(id) && <span className="sd-p-climber__whoosh">💨</span>}
                {dazed && <span className="sd-p-daze"><b>★</b><b>★</b><b>★</b></span>}
              </div>
            );
          })}
        </div>
      </div>
      {storm && <Storm heavy={!!sh?.enraged} />}
    </>
  );
}

/** The storm: the sky goes dark, rain slants down, wind streaks across and lightning flashes. */
function Storm({ heavy }: { heavy: boolean }) {
  return (
    <div className={`sd-p-storm${heavy ? ' sd-p-storm--heavy' : ''}`} aria-hidden="true">
      <div className="sd-p-storm__dark" />
      <div className="sd-p-storm__bolt" />
      {Array.from({ length: 36 }, (_, i) => <i key={i} className="sd-p-storm__rain" style={{ left: `${(i * 29) % 100}%`, '--i': i } as CSSProperties} />)}
      {Array.from({ length: 6 }, (_, i) => <b key={i} className="sd-p-storm__gust" style={{ top: `${14 + i * 13}%`, '--i': i } as CSSProperties} />)}
    </div>
  );
}

/** The Sky Climb recap scene: the flag planted on the peak (or flapping just out of reach). */
function SummitFlag({ planted, pct }: { planted: boolean; pct: number }) {
  const flag = art('skyclimb', 'summit-flag');
  const peak = art('skyclimb', 'summit');
  return (
    <div className={`sd-p-summitflag${planted ? ' sd-p-summitflag--planted' : ''}`} aria-hidden="true">
      <span className="sd-p-summitflag__peak">{peak ? <img src={peak} alt="" /> : <i />}</span>
      <span className="sd-p-summitflag__flag">{flag ? <img src={flag} alt="" /> : '🚩'}</span>
      {!planted && <b className="sd-p-summitflag__pct">{pct}% of the way!</b>}
    </div>
  );
}

/** Shrinking Island lobby: the island rises out of the sea with its palms, the raft frame on the beach, and the cry. */
function IsleEntrance({ seq }: { seq: number }) {
  return (
    <>
      <div key={`ie${seq}`} className="sd-p-isle-entrance" aria-hidden="true">
        <span className="sd-p-isle-entrance__land"><Palms /></span>
        <span className="sd-p-isle-entrance__raft">🛶</span>
      </div>
      <div key={`ir${seq}`} className="sd-p-roar sd-p-roar--isle" role="status">Build the raft!</div>
    </>
  );
}

function Palms() {
  const palm = art('island', 'palm');
  return (
    <span className="sd-p-palms" aria-hidden="true">
      {[[30, 34, 1], [62, 28, 1.2], [46, 58, 0.9], [72, 60, 0.8]].map(([x, y, s], i) => (
        <i key={i} style={{ left: `${x}%`, top: `${y}%`, '--s': s, '--i': i } as CSSProperties}>{palm ? <img src={palm} alt="" /> : '🌴'}</i>
      ))}
    </span>
  );
}

/**
 * Shrinking Island: the sea, the island shrinking with the clock, every pupil standing on it (team colours, role
 * portraits), the rocks out in the water for anyone the tide reached, planks flying to the raft on the beach, the crate
 * washing ashore (double planks), and the big wave: a wall of water rising, then sweeping the beach when it breaks.
 */
function Isle({ ps, roundNow, pct, weak, over }: { ps: ProjectorState; roundNow: number; pct: number; weak: boolean; over: boolean }) {
  const view = ps.view as RoomView;
  const island = view.island ?? { shore: 1, spots: {} };
  const names = view.showNames;
  const sh = ps.shield;
  const waving = !!sh && sh.state === null && roundNow < sh.endsAt && !over;
  const swept = ps.waveAt > 0 && roundNow - ps.waveAt < 2200 && roundNow >= ps.waveAt;
  const stepped = new Map(ps.bursts.filter((b) => roundNow - b.t < 1300 && roundNow >= b.t).map((b) => [b.pupil, b]));
  const splashed = new Set(ps.splashes.filter((x) => roundNow - x.t < 1800 && roundNow >= x.t).map((x) => x.pupil));
  const swam = new Set(ps.swims.filter((x) => roundNow - x.t < 1800 && roundNow >= x.t).map((x) => x.pupil));
  const n = ps.order.length;
  const size = Math.max(2.2, Math.min(4.6, 70 / Math.max(1, n)));
  const place = (s: [number, number, number]) => {
    const rad = (s[0] * Math.PI) / 180;
    const d = s[2] > 0 ? Math.max(s[1], island.shore + 0.1) : s[1];
    return { x: 50 + Math.cos(rad) * d * 44, y: 50 + Math.sin(rad) * d * 42 };
  };
  return (
    <>
      <div className="sd-p-isle" style={{ '--size': `${size}vw` } as CSSProperties} aria-hidden="true">
        <span className="sd-p-isle__swell" />
        <div className="sd-p-isle__land" style={{ width: `${island.shore * 88}%`, height: `${island.shore * 84}%` }}>
          <span className="sd-p-isle__foam" />
          <Palms />
        </div>
        <Raft pct={pct} sailing={over && ps.beaten} />
        {weak && !over && <div className="sd-p-isle__crate"><b>📦</b><span>DOUBLE PLANKS!</span></div>}
        {ps.order.map((id) => {
          const s = island.spots[id];
          if (!s) return null;
          const at = place(s);
          const r = ps.roster[id];
          const b = stepped.get(id);
          const rock = s[2] > 0;
          const portrait = art('roles', r?.role ?? 'striker');
          const dazed = (ps.dazed[id] ?? 0) > roundNow;
          return (
            <div key={id} className={`sd-p-castaway${r?.team ? ` sd-p-team--${r.team}` : ''}${rock ? ' sd-p-castaway--rock' : ''}${b ? ' sd-p-castaway--step' : ''}${dazed ? ' sd-p-castaway--dazed' : ''}${waving ? ' sd-p-castaway--brace' : ''}`} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
              {rock && <span className="sd-p-castaway__rock">{art('island', 'rock') ? <img src={art('island', 'rock')} alt="" /> : <i />}</span>}
              <span key={b ? `s${b.id}` : 'idle'} className="sd-p-castaway__body">{portrait ? <img src={portrait} alt="" /> : <b>🙂</b>}</span>
              {names && <span className="sd-p-castaway__name">{r?.name}</span>}
              {rock && <span className="sd-p-castaway__swim">{'🏊'.repeat(1)} {s[2] - 1}/2</span>}
              {b && <span key={`p${b.id}`} className="sd-p-castaway__plank" style={{ '--dx': `${(88 - at.x) * 0.9}vw`, '--dy': `${(86 - at.y) * 0.6}vh` } as CSSProperties}><i>🪵</i><em>+{b.points}</em></span>}
              {splashed.has(id) && <span className="sd-p-castaway__splash"><b>SPLASH!</b>{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>}
              {swam.has(id) && <span className="sd-p-castaway__home">Swam back!</span>}
              {dazed && <span className="sd-p-daze"><b>★</b><b>★</b><b>★</b></span>}
            </div>
          );
        })}
        {swept && <div key={`sw${ps.waveAt}`} className="sd-p-isle__sweep" />}
      </div>
      {waving && <BigWave heavy={!!sh?.enraged} />}
    </>
  );
}

/** The raft on the beach: planks laid one by one as the class builds it, the mast and sail going up near the end. */
function Raft({ pct, sailing }: { pct: number; sailing: boolean }) {
  const planks = 10;
  const laid = Math.floor((pct / 100) * planks + 0.0001);
  return (
    <div className={`sd-p-raft${sailing ? ' sd-p-raft--sail' : ''}`}>
      <span className="sd-p-raft__planks">{Array.from({ length: planks }, (_, i) => <i key={i} className={i < laid ? 'on' : ''} style={{ '--i': i } as CSSProperties} />)}</span>
      {pct >= 60 && <span className="sd-p-raft__mast"><i style={{ transform: `scaleY(${Math.min(1, (pct - 60) / 40)})` }} /></span>}
      <b className="sd-p-raft__pct">{Math.floor(pct)}%</b>
    </div>
  );
}

/** The big wave: a wall of water rising at the bottom of the screen, foam on its crest, spray flying. */
function BigWave({ heavy }: { heavy: boolean }) {
  return (
    <div className={`sd-p-bigwave${heavy ? ' sd-p-bigwave--heavy' : ''}`} aria-hidden="true">
      <span className="sd-p-bigwave__wall" />
      <span className="sd-p-bigwave__crest" />
      {Array.from({ length: 14 }, (_, i) => <i key={i} className="sd-p-bigwave__spray" style={{ left: `${(i * 23) % 100}%`, '--i': i } as CSSProperties} />)}
    </div>
  );
}

/** The Shrinking Island recap scene: the finished raft sailing off over the waves (or nearly built on the beach). */
function RaftSail({ sailed, pct }: { sailed: boolean; pct: number }) {
  return (
    <div className={`sd-p-raftsail${sailed ? ' sd-p-raftsail--go' : ''}`} aria-hidden="true">
      <span className="sd-p-raftsail__sea" />
      <span className="sd-p-raftsail__boat"><b>⛵</b></span>
      {!sailed && <b className="sd-p-raftsail__pct">The raft is {pct}% built!</b>}
    </div>
  );
}

/** A heap of gold that grows with the team's share: a team's banner grows one, and the recap shows big ones. */
function GoldPile({ share, amount, team, big = false }: { share: number; amount: number; team?: TeamId; big?: boolean }) {
  const s = 0.4 + 0.6 * Math.max(0, Math.min(1, share));
  return (
    <div className={`sd-p-pile${big ? ' sd-p-pile--big' : ''}${team ? ` sd-p-team--${team}` : ''}`} style={{ '--s': s } as CSSProperties} aria-label={`${amount} gold`}>
      <span className="sd-p-pile__ring" />
      <svg key={amount} className="sd-p-pile__heap" viewBox="0 0 120 76" aria-hidden="true">
        <defs><linearGradient id={`pg${team ?? 'x'}${big ? 'b' : 's'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3a0" /><stop offset="0.5" stopColor="#ffc933" /><stop offset="1" stopColor="#b8730a" /></linearGradient></defs>
        <path d="M4 72 Q10 58 26 54 Q34 36 54 32 Q60 8 78 24 Q96 26 100 46 Q114 52 116 72 Z" fill={`url(#pg${team ?? 'x'}${big ? 'b' : 's'})`} stroke="#6b3f00" strokeWidth="3" strokeLinejoin="round" />
        {[[30, 62], [52, 52], [74, 58], [92, 64], [62, 36], [42, 66], [82, 44]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5 + (i % 3)} fill="#ffe27a" stroke="#a86a00" strokeWidth="2" />)}
      </svg>
      <Sparkles n={big ? 9 : 4} />
      <b className="sd-p-pile__n">{amount}</b>
    </div>
  );
}

function Explosion() {
  return <div className="sd-p-explosion" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>;
}

function Confetti({ team, gold = false }: { team?: TeamId | null; gold?: boolean }) {
  const colours = gold && !team ? ['#ffd23f', '#ffe27a', '#ffb300', '#fff3b0', '#ffc933', '#ffffff'] : team ? [TEAM_HEX[team], TEAM_HEX[team], '#ffffff', TEAM_HEX[team], '#ffffffcc'] : ['#ff4d4d', '#4da3ff', '#ffd23f', '#4dd97a', '#ff8ad8', '#ffffff'];
  return (
    <div className="sd-p-confetti" aria-hidden="true">
      {Array.from({ length: 56 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colours[i % colours.length], animationDelay: `${(i % 14) * 0.18}s`, animationDuration: `${3 + (i % 5) * 0.6}s`, '--sway': `${((i * 13) % 21) - 10}vw` } as CSSProperties} />
      ))}
    </div>
  );
}

function Recap({ ps, stage, onAgain }: { ps: ProjectorState; stage: 0 | 1; onAgain: () => void }) {
  const rc = ps.recap;
  const beaten = ps.beaten || rc?.result === 'beaten';
  const names = ps.view?.showNames ?? false;
  const gr = isGoldRush(ps.view);
  const sky = ps.view?.arena === 'skyclimb';
  const isle = ps.view?.arena === 'island';
  const W = arenaWords(ps.view?.arena);
  const scene = gr ? art('back', 'gold-rush') : sky ? art('back', 'sky-climb') : isle ? art('back', 'shrinking-island') : art('back', beaten ? 'victory' : 'so-close');
  const words = { ...AWARD_WORDS, ...W.awards };
  const mountain = ps.view?.boss;
  const dugPct = mountain ? Math.round(Math.max(0, Math.min(1, 1 - mountain.hp / Math.max(1, mountain.max))) * 100) : 0;
  const bestTeam = Math.max(1, ...(rc?.teams ?? []).map((t) => t.damage));
  const who = (id: string) => (names ? ps.names[id] ?? ps.roster[id]?.name ?? 'A hero' : 'A hero');
  const awards = rc?.awards ?? [];
  const winTeam = rc?.winner && 'team' in rc.winner ? rc.winner.team : null;
  const t2 = ps.view?.mode === 'teams2';
  const solo = rc?.winner && 'pupil' in rc.winner;
  return (
    <div className={`sd-p-recap${beaten ? ' sd-p-recap--win' : ' sd-p-recap--close'}${gr ? ' sd-p-recap--gold' : ''}${sky ? ' sd-p-recap--sky' : ''}${isle ? ' sd-p-recap--isle' : ''}`}>
      {scene && <div className="sd-p-recap__scene" style={{ backgroundImage: `url(${scene})` }} aria-hidden="true" />}
      {(beaten || winTeam) && <Confetti team={winTeam} gold={gr} />}
      {stage === 0 && <div className="sd-p-recap__title" role="status">{W.recapTitle(beaten)}</div>}
      {stage === 0 && gr && mountain && <div className="sd-p-recap__heap"><GoldPile big share={dugPct / 100} amount={Math.round(mountain.max - mountain.hp)} /></div>}
      {stage === 0 && sky && <SummitFlag planted={beaten} pct={dugPct} />}
      {stage === 0 && isle && <RaftSail sailed={beaten} pct={dugPct} />}
      {stage === 1 && rc && (
        <div className="sd-p-recap__cards">
          <h2 className="sd-p-recap__head">{W.recapHead(beaten, dugPct, bossInfo(ps.view?.bossId).name)}</h2>
          {gr && !rc.teams.length && mountain && <div className="sd-p-recap__heap sd-p-recap__heap--cards"><GoldPile big share={dugPct / 100} amount={Math.round(mountain.max - mountain.hp)} /></div>}
          {winTeam && (
            <div className={`sd-p-bigflag sd-p-team--${winTeam}`}>
              <Cloth team={winTeam} className="sd-p-bigflag__cloth"><b>{TEAM_SHORT[winTeam]}</b><strong>WINS!</strong></Cloth>
              <span className="sd-p-bigflag__pole" aria-hidden="true" />
            </div>
          )}
          {rc.teams.length > 0 && (
            <div className="sd-p-recap__teams">
              {rc.teams.map((t, i) => (
                <div key={t.team} className={`sd-p-teamcard sd-p-team--${t.team}${i === 0 ? ' sd-p-teamcard--first' : ''}${gr ? ' sd-p-teamcard--gold' : ''}`}>
                  {gr && <GoldPile big team={t.team} share={t.damage / bestTeam} amount={t.damage} />}
                  <b>{TEAM_WORDS[t.team]}</b><span>{gr ? `${t.damage} gold` : sky ? `${t.damage * 10} m climbed` : isle ? `${t.damage} planks` : t2 ? `${t.damage} damage` : `${t.points} points`}</span>{(t2 || gr || sky || isle) && <small>{t.points} points</small>}
                </div>
              ))}
            </div>
          )}
          {solo && rc.top.length > 0 && <Podium top={rc.top.slice(0, 3)} who={who} />}
          {solo && rc.top.length > 3 && <ol className="sd-p-recap__top" start={4}>{rc.top.slice(3).map((t, i) => <li key={t.pupil}><b>{i + 4}</b>{who(t.pupil)}<em>{t.score}</em></li>)}</ol>}
          <ul className="sd-p-awards">
            {awards.map((a, i) => (
              <li key={`${a.kind}${a.pupil}`} className="sd-p-award" style={{ '--i': i } as CSSProperties}>
                <span className="sd-p-award__badge" aria-hidden="true">{art('badges', a.kind.replace(/_/g, '-')) ? <img src={art('badges', a.kind.replace(/_/g, '-'))} alt="" /> : '★'}</span>
                <span className="sd-p-award__kind">{words[a.kind] ?? a.kind}</span>
                <span className="sd-p-award__who">{who(a.pupil)}</span>
                <span className="sd-p-award__val">{awardValue(a.kind, a.value)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="sd-p-again" onClick={onAgain}>Again?</button>
        </div>
      )}
    </div>
  );
}

/** Solo recap: top three on a podium (2nd, 1st, 3rd), each block rising in turn. */
function Podium({ top, who }: { top: { pupil: string; score: number }[]; who: (id: string) => string }) {
  const order = [1, 0, 2].filter((i) => top[i]);
  return (
    <ol className="sd-p-podium" aria-label="Podium">
      {order.map((i) => (
        <li key={top[i].pupil} className={`sd-p-podium__col sd-p-podium__col--${i + 1}`} style={{ '--d': `${(2 - i) * 0.7}s` } as CSSProperties}>
          <span className="sd-p-podium__who">{who(top[i].pupil)}</span>
          <span className="sd-p-podium__score">{top[i].score}</span>
          <span className="sd-p-podium__block"><b>{i + 1}</b></span>
        </li>
      ))}
    </ol>
  );
}

function awardValue(kind: string, v: number): string {
  if (kind === 'top_score') return `${v} points`;
  if (kind === 'longest_streak') return `${v} in a row`;
  if (kind === 'best_comeback') return `climbed ${v} ${v === 1 ? 'place' : 'places'}`;
  return '';
}

