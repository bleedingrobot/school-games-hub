/**
 * Class Showdown's projector screen (docs/SHOWDOWN-PLAN.md sections 1, 3 and 7): the painted, animated big screen the
 * teacher puts on the board. It listens to the room row and the feed, draws every event with its own moment (all in
 * projector.css, transform/opacity only), ticks the server once a second and never shows a question or a wrong answer.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { SHOWDOWN } from '../../../shared/showdown/config';
import type { FeedEvent, RoomView } from '../../../shared/showdown/server';
import type { Mode, Role, TeamId } from '../../../shared/showdown/types';
import { BossStandIn } from './BossStandIn';
import type { ShowdownLink } from './link';
import { AWARD_WORDS, TEAM_WORDS, initialState, ordinal, projectorAct, soundFor, type HitBurst, type ProjectorState, type ShowdownSound } from './projectorState';
import './projector.css';

const ART = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const art = (folder: string, file: string): string | undefined => ART[`./art/paint/${folder}/${file}.webp`];

const ROOM_KEY = 'showdown-room';
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
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const lastHitSound = useRef(0);
  const seenStart = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const view = ps.view;
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
      const sfx = soundFor(e);
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

  const send = async (body: Record<string, unknown>) => {
    const out = await link.send(body);
    if (out.status !== 200) setProblem(String(out.body.error ?? 'That didn’t work.'));
    else setProblem(null);
    return out;
  };
  const open = async () => {
    const out = await send({ action: 'open', classId, mode, length });
    if (out.status === 200 && typeof out.body.room === 'number') {
      dispatch({ kind: 'reset', reply: { view: out.body.view as RoomView } });
      seenStart.current = 0;
      keepRoom(out.body.room);
      setRoom(out.body.room);
      soundRef.current?.say('Join now!');
    }
  };
  const newRound = () => {
    keepRoom(null);
    setRoom(null);
    dispatch({ kind: 'reset', reply: undefined as never });
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
  const paused = !!view?.pausedAt;
  const live = state === 'live';
  const final = ps.final && live;
  const stageClass = ['sd-p', `sd-p--p${ps.phase}`, shaking ? 'sd-p--shake' : '', final ? 'sd-p--final' : '', roundNow - ps.phaseAt < 3200 && ps.phaseAt > 0 && live ? 'sd-p--transform' : ''].filter(Boolean).join(' ');

  return (
    <div ref={stageRef} className={stageClass} data-state={state ?? 'idle'}>
      <h1 className="sd-p__sr">Class Showdown{state ? ` ${state}` : ''}</h1>
      <Backdrop state={state} />
      {state === 'live' || state === 'over' ? <Battle ps={ps} roundNow={roundNow} flinch={flinch} /> : null}
      {state === 'lobby' && <Lobby ps={ps} className={className} onMove={(pupil, team) => void send({ action: 'teams', room, pupil, team })} />}
      {!state && <div className="sd-p-idle"><h2>Class Showdown</h2><p>Pick how long, then press Open to bring in the class.</p></div>}

      {live && ps.banner && roundNow < ps.banner.until && <div key={`${ps.banner.text}${ps.banner.until}`} className={`sd-p-banner sd-p-banner--${ps.banner.kind}`} role="status">{ps.banner.text}</div>}
      {live && ps.goldenSeq > 0 && <div key={`g${ps.goldenSeq}`} className="sd-p-goldflash" aria-hidden="true" />}
      {ps.phaseAt > 0 && live && roundNow - ps.phaseAt < 3200 && <div key={`ph${ps.phaseAt}`} className="sd-p-phaseflash" aria-hidden="true" />}
      {final && <div className="sd-p-drum" aria-hidden="true" />}
      {paused && live && <div className="sd-p-paused">Paused</div>}
      {count !== null && <div key={count} className="sd-p-count" aria-live="assertive">{count === 0 ? 'FIGHT!' : count}</div>}
      {over && <Recap ps={ps} stage={recapStage} />}

      <div ref={barRef} className={`sd-p-bar${barOpen ? ' sd-p-bar--open' : ''}`}>
        <button type="button" className="sd-p-bar__tab" aria-expanded={barOpen} onClick={() => setBarOpen((o) => !o)}>{barOpen ? 'Hide controls' : 'Teacher controls'}</button>
        {barOpen && (
          <div className="sd-p-bar__row">
            <label>Mode <select value={mode} disabled={!!room} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="class">Whole class</option><option value="teams2">2 teams</option><option value="teams4">4 teams</option><option value="solo">Everyone for themselves</option>
            </select></label>
            <label>Minutes <select value={length} disabled={!!room} onChange={(e) => setLength(Number(e.target.value))}>
              {SHOWDOWN.lengths.map((l) => <option key={l} value={l}>{l}</option>)}
            </select></label>
            {!room && <button type="button" className="sd-p-btn sd-p-btn--go" onClick={() => void open()}>Open</button>}
            {room && state === 'lobby' && <button type="button" className="sd-p-btn" onClick={() => void send({ action: 'teams', room, reshuffle: true })}>Reshuffle</button>}
            {room && state === 'lobby' && <button type="button" className="sd-p-btn sd-p-btn--go" onClick={() => void send({ action: 'start', room })}>Start</button>}
            {room && live && <button type="button" className="sd-p-btn" onClick={() => void send({ action: 'enrage', room })}>Enrage</button>}
            {room && live && <button type="button" className="sd-p-btn" onClick={() => void send({ action: 'pause', room, resume: paused })}>{paused ? 'Resume' : 'Pause'}</button>}
            <button type="button" className="sd-p-btn" aria-pressed={muted} onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            {room && state !== 'over' && (
              <button type="button" className="sd-p-btn sd-p-btn--danger" onClick={() => { if (armEnd) { setArmEnd(false); void send({ action: 'end', room }); } else { setArmEnd(true); setTimeout(() => setArmEnd(false), 3000); } }}>{armEnd ? 'Sure? End now' : 'End'}</button>
            )}
            {room && state === 'over' && <button type="button" className="sd-p-btn sd-p-btn--go" onClick={newRound}>New round</button>}
          </div>
        )}
        {problem && <p className="sd-p-bar__problem" role="alert">{problem}</p>}
      </div>
    </div>
  );
}

function Backdrop({ state }: { state: string | undefined }) {
  const img = state === 'lobby' || !state ? art('back', 'lobby') : art('back', 'river-valley');
  return <div className="sd-p-back" style={img ? ({ backgroundImage: `url(${img})` } as CSSProperties) : undefined} aria-hidden="true" />;
}

function Lobby({ ps, className, onMove }: { ps: ProjectorState; className?: string; onMove: (pupil: string, team: TeamId) => void }) {
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
      <div className="sd-p-lobby__join">Join now!</div>
      {className && <div className="sd-p-lobby__class">{className}</div>}
      <p className="sd-p-lobby__hint">{teamMode ? 'Tap a name, then tap a team (or drag it) to move it' : 'Open Class Showdown on your iPad'}</p>
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
  const pct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.max)) * 100));
  const left = Math.max(0, view.lengthMin * 60000 - roundNow);
  const weak = ps.weakUntil > roundNow;
  const angry = ps.enrageUntil > roundNow || ps.phase >= 2;
  const bossImg = art('bosses', `river-titan-${ps.phase}`);
  const over = view.state === 'over';
  const roster = ps.order.map((id) => ps.roster[id]);
  const counts: Record<Role, number> = { striker: 0, guard: 0, healer: 0 };
  for (const r of roster) counts[r.role]++;
  const needGuards = !over && roster.length >= 4 && counts.guard * 5 < roster.length;
  const showNames = view.showNames;
  const teamMode = isTeamMode(view);
  const t2 = view.mode === 'teams2';
  const facing = view.mode === 'teams4' ? (view.facing ?? ps.turn?.team ?? null) : null;
  const slot = facing ? SLOT[facing] : null;
  const roaring = !!ps.turn && view.mode === 'teams4' && roundNow - ps.turn.at < 1600 && roundNow >= ps.turn.at;
  const turnT = slot ? `perspective(900px) rotateY(${slot.side * 32}deg) rotate(${slot.side * 3}deg) translate(${slot.side * 8}%, ${slot.low ? 3 : -1}%)` : undefined;
  const healing = ps.healAt > 0 && roundNow - ps.healAt < 1500;
  const bursts = ps.bursts.filter((b) => roundNow - b.t < 2500 && roundNow >= b.t - 500);
  const heals = ps.heals.filter((h) => roundNow - h.t < 2800);
  const crewRef = useRef<HTMLUListElement>(null);
  useFit(crewRef, null, `${roster.length}${showNames}${roster.map((r) => r.name.length).join()}`, () => Math.max(12, Math.min(window.innerWidth * 0.016, window.innerHeight * 0.03, 22)), 8);

  return (
    <>
      <header className="sd-p-hud">
        <div className={`sd-p-health${weak ? ' sd-p-health--weak' : ''}${healing ? ' sd-p-health--heal' : ''}`} role="progressbar" aria-label="Boss health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="sd-p-health__ghost" style={{ transform: `scaleX(${pct / 100})` }} />
          <div className="sd-p-health__fill" style={{ transform: `scaleX(${pct / 100})` }} />
          <span className="sd-p-health__tick" style={{ left: '66%' }} /><span className="sd-p-health__tick" style={{ left: '33%' }} />
          <span className="sd-p-health__label">River Titan</span>
        </div>
        <div className={`sd-p-clock${left <= 30000 && !over ? ' sd-p-clock--low' : ''}`}>{mmss(left)}</div>
      </header>

      {t2 && <Bridge shakeKey={ps.tugSeq} />}
      {teamMode && <TeamFlags ps={ps} facing={facing} />}
      {t2 && Math.abs(view.tug) > 0.04 && !over && <div key={view.tug > 0 ? 'r' : 'b'} className={`sd-p-pushing sd-p-team--${view.tug > 0 ? 'red' : 'blue'}`} role="status">{view.tug > 0 ? 'RED' : 'BLUE'} is pushing!</div>}

      <div className={`sd-p-bosswrap${teamMode ? ' sd-p-bosswrap--teams' : ''}${over && ps.beaten ? ' sd-p-bosswrap--beaten' : ''}`} style={t2 ? ({ left: `calc(50% + ${Math.max(-1, Math.min(1, view.tug)) * 16}vw)` } as CSSProperties) : undefined}>
        {facing && <div key={`gz${ps.turnSeq}`} className={`sd-p-gaze sd-p-team--${facing}`} aria-hidden="true" />}
        {roaring && ps.turn && <div key={`rw${ps.turnSeq}`} className={`sd-p-roarwave sd-p-team--${ps.turn.team}`} aria-hidden="true"><i /><i /><i /></div>}
        <div className={`sd-p-bossroar${roaring ? ' sd-p-bossroar--go' : ''}`}>
          <div className="sd-p-bossturn" style={turnT ? { transform: turnT } : undefined}>
            <div className={`sd-p-boss${flinch ? ' sd-p-flinch' : ''}${angry ? ' sd-p-boss--angry' : ''}`}>
              {bossImg ? <img className="sd-p-boss__img" src={bossImg} alt="The River Titan" /> : <BossStandIn phase={ps.phase} flinch={false} weak={weak} angry={angry} look={slot ? slot.side : 0} />}
              {weak && <div className="sd-p-weakglow" aria-hidden="true" />}
              {ps.phase >= 2 && <div className="sd-p-eyes" aria-hidden="true" />}
            </div>
          </div>
        </div>
        <div className="sd-p-bursts" aria-hidden="true">{bursts.map((b) => <Burst key={b.id} b={b} showNames={showNames} />)}</div>
        {over && ps.beaten && <Explosion />}
      </div>

      <SidePanel ps={ps} roundNow={roundNow} />

      <div className="sd-p-crewzone">
        {needGuards && !ps.shield && <div className="sd-p-need">Need more Guards!</div>}
        <Dome ps={ps} roundNow={roundNow} />
        <div className="sd-p-heals" aria-hidden="true">{heals.map((h) => <div key={h.id} className="sd-p-heal">{showNames ? h.text : 'A Healer woke a friend!'}<i /><i /><i /><i /><i /></div>)}</div>
        <ul ref={crewRef} className="sd-p-crew">
          {roster.map((r) => {
            const dazed = (ps.dazed[r.id] ?? 0) > roundNow;
            const portrait = art('roles', r.role);
            return (
              <li key={r.id} className={`sd-p-chip${r.team ? ` sd-p-team--${r.team}` : ''}${dazed ? ' sd-p-chip--dazed' : ''}`}>
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
              <div className="sd-p-dome__label sd-p-dome__label--team">{TEAM_SHORT[k]} SHIELD</div>
              {d.state === 'held' && <div className="sd-p-dome__clang">CLANG!</div>}
              {d.state === 'broke' && <div className="sd-p-dome__clang sd-p-dome__clang--broke">CRACK!</div>}
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
      {winding && <div className="sd-p-dome__label">SHIELD UP!</div>}
      {sh.state === 'held' && <div className="sd-p-dome__clang">CLANG!</div>}
      {sh.state === 'broke' && <div className="sd-p-dome__clang sd-p-dome__clang--broke">CRACK!</div>}
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
  const val = (k: TeamId) => Math.round((t2 ? view.teamDamage[k] : view.teamPoints[k]) ?? 0);
  const max = Math.max(1, ...view.teams.map(val));
  return (
    <div className="sd-p-flags" aria-label="Teams">
      {view.teams.map((k, i) => {
        const sl = SLOT[k];
        const leading = t2 ? (view.tug > 0.04 ? 'red' : view.tug < -0.04 ? 'blue' : null) === k : false;
        return (
          <div key={k} className={`sd-p-flag sd-p-flag--${sl.side < 0 ? 'l' : 'r'}${sl.low && !t2 ? ' sd-p-flag--low' : ''} sd-p-team--${k}${facing === k ? ' sd-p-flag--facing' : ''}${leading ? ' sd-p-flag--lead' : ''}`} style={{ '--k': i, '--n': view.teams.length } as CSSProperties}>
            <span className="sd-p-flag__pole" />
            <Cloth team={k} className="sd-p-flag__cloth">
              <b>{TEAM_SHORT[k]}</b>
              <strong>{val(k)}</strong>
              <small>{t2 ? 'damage' : 'points'}</small>
            </Cloth>
            <div className="sd-p-flag__bar"><i style={{ transform: `scaleX(${val(k) / max})` }} /></div>
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
  if (topDmg) rows.push({ kind: 'dmg', label: 'Most damage', who: who(topDmg[0]), val: `${Math.round(topDmg[1] * 10)}` });
  if (ps.lastHitter) rows.push({ kind: 'last', label: 'Last hit', who: who(ps.lastHitter), val: '' });
  if (ps.bestStreak && ps.bestStreak.streak >= 2) rows.push({ kind: 'streak', label: 'Longest streak', who: who(ps.bestStreak.pupil), val: `${ps.bestStreak.streak} in a row` });
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

function Explosion() {
  return <div className="sd-p-explosion" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>;
}

function Confetti({ team }: { team?: TeamId | null }) {
  const colours = team ? [TEAM_HEX[team], TEAM_HEX[team], '#ffffff', TEAM_HEX[team], '#ffffffcc'] : ['#ff4d4d', '#4da3ff', '#ffd23f', '#4dd97a', '#ff8ad8', '#ffffff'];
  return (
    <div className="sd-p-confetti" aria-hidden="true">
      {Array.from({ length: 56 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colours[i % colours.length], animationDelay: `${(i % 14) * 0.18}s`, animationDuration: `${3 + (i % 5) * 0.6}s`, '--sway': `${((i * 13) % 21) - 10}vw` } as CSSProperties} />
      ))}
    </div>
  );
}

function Recap({ ps, stage }: { ps: ProjectorState; stage: 0 | 1 }) {
  const rc = ps.recap;
  const beaten = ps.beaten || rc?.result === 'beaten';
  const names = ps.view?.showNames ?? false;
  const scene = art('back', beaten ? 'victory' : 'so-close');
  const who = (id: string) => (names ? ps.names[id] ?? ps.roster[id]?.name ?? 'A hero' : 'A hero');
  const awards = rc?.awards ?? [];
  const winTeam = rc?.winner && 'team' in rc.winner ? rc.winner.team : null;
  const t2 = ps.view?.mode === 'teams2';
  const solo = rc?.winner && 'pupil' in rc.winner;
  return (
    <div className={`sd-p-recap${beaten ? ' sd-p-recap--win' : ' sd-p-recap--close'}`}>
      {scene && <div className="sd-p-recap__scene" style={{ backgroundImage: `url(${scene})` }} aria-hidden="true" />}
      {(beaten || winTeam) && <Confetti team={winTeam} />}
      {stage === 0 && <div className="sd-p-recap__title" role="status">{beaten ? 'VICTORY!' : 'So close!'}</div>}
      {stage === 1 && rc && (
        <div className="sd-p-recap__cards">
          <h2 className="sd-p-recap__head">{beaten ? 'You beat the River Titan!' : 'So close! Next time!'}</h2>
          {winTeam && (
            <div className={`sd-p-bigflag sd-p-team--${winTeam}`}>
              <Cloth team={winTeam} className="sd-p-bigflag__cloth"><b>{TEAM_SHORT[winTeam]}</b><strong>WINS!</strong></Cloth>
              <span className="sd-p-bigflag__pole" aria-hidden="true" />
            </div>
          )}
          {rc.teams.length > 0 && (
            <div className="sd-p-recap__teams">
              {rc.teams.map((t, i) => <div key={t.team} className={`sd-p-teamcard sd-p-team--${t.team}${i === 0 ? ' sd-p-teamcard--first' : ''}`}><b>{TEAM_WORDS[t.team]}</b><span>{t2 ? `${t.damage} damage` : `${t.points} points`}</span>{t2 && <small>{t.points} points</small>}</div>)}
            </div>
          )}
          {solo && rc.top.length > 0 && <Podium top={rc.top.slice(0, 3)} who={who} />}
          {solo && rc.top.length > 3 && <ol className="sd-p-recap__top" start={4}>{rc.top.slice(3).map((t, i) => <li key={t.pupil}><b>{i + 4}</b>{who(t.pupil)}<em>{t.score}</em></li>)}</ol>}
          <ul className="sd-p-awards">
            {awards.map((a, i) => (
              <li key={`${a.kind}${a.pupil}`} className="sd-p-award" style={{ '--i': i } as CSSProperties}>
                <span className="sd-p-award__badge" aria-hidden="true">{art('badges', a.kind.replace(/_/g, '-')) ? <img src={art('badges', a.kind.replace(/_/g, '-'))} alt="" /> : '★'}</span>
                <span className="sd-p-award__kind">{AWARD_WORDS[a.kind] ?? a.kind}</span>
                <span className="sd-p-award__who">{who(a.pupil)}</span>
                <span className="sd-p-award__val">{awardValue(a.kind, a.value)}</span>
              </li>
            ))}
          </ul>
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

