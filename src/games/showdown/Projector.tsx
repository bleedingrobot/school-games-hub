/**
 * Class Showdown's projector screen (docs/SHOWDOWN-PLAN.md sections 1, 3 and 7): the painted, animated big screen the
 * teacher puts on the board. It listens to the room row and the feed, draws every event with its own moment (all in
 * projector.css, transform/opacity only), ticks the server once a second and never shows a question or a wrong answer.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { SHOWDOWN } from '../../../shared/showdown/config';
import type { FeedEvent, RoomView } from '../../../shared/showdown/server';
import type { Mode, Role } from '../../../shared/showdown/types';
import { BossStandIn } from './BossStandIn';
import type { ShowdownLink } from './link';
import { AWARD_WORDS, TEAM_WORDS, initialState, projectorAct, soundFor, type HitBurst, type ProjectorState, type ShowdownSound } from './projectorState';
import './projector.css';

const ART = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const art = (folder: string, file: string): string | undefined => ART[`./art/paint/${folder}/${file}.webp`];

const ROOM_KEY = 'showdown-room';
const ROLE_LETTER: Record<Role, string> = { striker: 'S', guard: 'G', healer: 'H' };
const ROLE_WORD: Record<Role, string> = { striker: 'Strikers', guard: 'Guards', healer: 'Healers' };

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
      {state === 'lobby' && <Lobby ps={ps} className={className} />}
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

function Lobby({ ps, className }: { ps: ProjectorState; className?: string }) {
  const show = ps.view?.showNames ?? false;
  const teamMode = ps.view?.teams.length ? ps.view.teams : null;
  const lobbyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useFit(listRef, lobbyRef, `${ps.order.length}${show}${ps.order.map((id) => ps.roster[id]?.name.length).join()}`, () => Math.max(16, Math.min(window.innerWidth * 0.028, window.innerHeight * 0.05, 38)), 9);
  return (
    <div className="sd-p-lobby" ref={lobbyRef}>
      <div className="sd-p-lobby__join">Join now!</div>
      {className && <div className="sd-p-lobby__class">{className}</div>}
      <p className="sd-p-lobby__hint">Open Class Showdown on your iPad</p>
      <div className="sd-p-lobby__count">{ps.order.length} {ps.order.length === 1 ? 'hero' : 'heroes'} ready</div>
      <ul ref={listRef} className={`sd-p-lobby__names${teamMode ? ' sd-p-lobby__names--teams' : ''}`}>
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

      <div className={`sd-p-bosswrap${over && ps.beaten ? ' sd-p-bosswrap--beaten' : ''}`}>
        <div className={`sd-p-boss${flinch ? ' sd-p-flinch' : ''}${angry ? ' sd-p-boss--angry' : ''}`}>
          {bossImg ? <img className="sd-p-boss__img" src={bossImg} alt="The River Titan" /> : <BossStandIn phase={ps.phase} flinch={false} weak={weak} angry={angry} />}
          {weak && <div className="sd-p-weakglow" aria-hidden="true" />}
          {ps.phase >= 2 && <div className="sd-p-eyes" aria-hidden="true" />}
        </div>
        <div className="sd-p-bursts" aria-hidden="true">{bursts.map((b) => <Burst key={b.id} b={b} showNames={showNames} />)}</div>
        {over && ps.beaten && <Explosion />}
      </div>

      <SidePanel ps={ps} />

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
  if (!sh) return null;
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

function SidePanel({ ps }: { ps: ProjectorState }) {
  const view = ps.view as RoomView;
  const names = view.showNames;
  if (view.mode === 'solo') {
    const top = [...ps.order].map((id) => ps.roster[id]).sort((a, b) => b.score - a.score).slice(0, 10);
    return (
      <aside className="sd-p-side" aria-label="Top ten">
        <h2>Top 10</h2>
        <ol>{top.map((r, i) => <li key={r.id}><b>{i + 1}</b><span>{names ? r.name : 'Hero'}</span><em>{r.score}</em></li>)}</ol>
      </aside>
    );
  }
  if (view.teams.length) {
    const max = Math.max(1, ...view.teams.map((k) => view.teamPoints[k] ?? 0));
    return (
      <aside className="sd-p-side sd-p-side--teams" aria-label="Teams">
        {view.teams.map((k) => (
          <div key={k} className={`sd-p-team-bar sd-p-team--${k}${view.facing === k ? ' sd-p-team-bar--facing' : ''}`}>
            <span>{TEAM_WORDS[k]}</span>
            <div><i style={{ transform: `scaleX(${(view.teamPoints[k] ?? 0) / max})` }} /></div>
            <em>{view.teamPoints[k] ?? 0}</em>
          </div>
        ))}
        {view.mode === 'teams2' && <div className="sd-p-tug" aria-label="Tug of war"><i style={{ transform: `translateX(${view.tug * 50}%)` }} /></div>}
      </aside>
    );
  }
  return null;
}

function Explosion() {
  return <div className="sd-p-explosion" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>;
}

function Confetti() {
  const colours = ['#ff4d4d', '#4da3ff', '#ffd23f', '#4dd97a', '#ff8ad8', '#ffffff'];
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
  return (
    <div className={`sd-p-recap${beaten ? ' sd-p-recap--win' : ' sd-p-recap--close'}`}>
      {scene && <div className="sd-p-recap__scene" style={{ backgroundImage: `url(${scene})` }} aria-hidden="true" />}
      {beaten && <Confetti />}
      {stage === 0 && <div className="sd-p-recap__title" role="status">{beaten ? 'VICTORY!' : 'So close!'}</div>}
      {stage === 1 && rc && (
        <div className="sd-p-recap__cards">
          <h2 className="sd-p-recap__head">{beaten ? 'You beat the River Titan!' : 'So close! Next time!'}</h2>
          {rc.winner && 'team' in rc.winner && <div className={`sd-p-winner sd-p-team--${rc.winner.team}`}>{TEAM_WORDS[rc.winner.team]} wins!</div>}
          {rc.winner && 'pupil' in rc.winner && <div className="sd-p-winner sd-p-team--gold">{who(rc.winner.pupil)} wins!</div>}
          {rc.teams.length > 0 && (
            <div className="sd-p-recap__teams">
              {rc.teams.map((t) => <div key={t.team} className={`sd-p-teamcard sd-p-team--${t.team}`}><b>{TEAM_WORDS[t.team]}</b><span>{t.points} points</span></div>)}
            </div>
          )}
          {rc.top.length > 0 && <ol className="sd-p-recap__top">{rc.top.map((t, i) => <li key={t.pupil}><b>{i + 1}</b>{who(t.pupil)}<em>{t.score}</em></li>)}</ol>}
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

function awardValue(kind: string, v: number): string {
  if (kind === 'top_score') return `${v} points`;
  if (kind === 'longest_streak') return `${v} in a row`;
  if (kind === 'best_comeback') return `climbed ${v} ${v === 1 ? 'place' : 'places'}`;
  return '';
}

