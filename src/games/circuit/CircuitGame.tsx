/**
 * Circuit Racer's screens (docs/CIRCUIT-PLAN.md, sections 4 and 5), full window from the first screen: the world map
 * (the five worlds on the painted map, the chosen world's six roads below), the race, the finish (time, medal, stars, 🔥 for
 * hard mode) and "All done for today" once the day's 5 finishes are used. The server (`backend`) hands out every go and
 * saves every finish; the screens only show what it says.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  extraRoads, FINISHES_A_DAY, hardSeconds, MEDAL_SECONDS, msToNzMidnight, roadById, roadOpen, roadPlace, ROADS, timeText, WORLD_OPENS_AT, worldOpen, WORLDS,
  type CircuitSave, type Medal,
} from '../../../shared/circuit/game';
import type { RunMaths } from '../../../shared/circuit/maths';
import type { RaceState } from '../../../shared/circuit/physics';
import { useSound } from '../../sound';
import mapArt from './art/paint/map/map.webp';
import mapSmall from './art/paint/map/map-800.webp';
import { CircuitError, type CircuitBackend, type FinishReply } from './backend';
import { HubButtons } from './HubButtons';
import { RaceScreen } from './RaceScreen';
import './circuit.css';

type Screen =
  | { kind: 'roads' }
  | { kind: 'race'; road: string; seed: string; stamp: string; go: number; maths: RunMaths | null; hard: boolean }
  | { kind: 'saving'; road: string }
  | { kind: 'finish'; road: string; reply: FinishReply; was: number | null }
  | { kind: 'done' }
  | { kind: 'off' };

const MEDAL_ICON: Record<Medal, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' };
const MEDAL_WORD: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
/** Where each world sits on the painted map (percent across and down), and its glow. */
const PINS = [
  { x: 25, y: 74, colour: '#4ade80' },
  { x: 19, y: 41, colour: '#fb923c' },
  { x: 46, y: 42, colour: '#7dd3fc' },
  { x: 52, y: 18, colour: '#e0f2fe' },
  { x: 82, y: 25, colour: '#c084fc' },
] as const;

const leftText = (left: number | null) => (left === null ? 'Unlimited today' : `${left} race${left === 1 ? '' : 's'} left today`);
/** "World 2 · 3. Fan Alley" style label parts: road number inside its world. */
const numberOf = (id: string) => (roadPlace(id)?.index ?? -1) + 1;

export function CircuitGame({ backend, extra }: { backend: CircuitBackend; extra?: ReactNode }) {
  const { soundOn } = useSound();
  const [save, setSave] = useState<CircuitSave | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'roads' });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "Pupils choose" maths: this pupil's pick (on to start).
  const [wantMaths, setWantMaths] = useState(true);
  // The world shown on the map (null: the furthest open world, worked out when the save arrives).
  const [world, setWorld] = useState<number | null>(null);
  const goCount = useRef(0);

  const fail = useCallback((e: unknown) => {
    if (e instanceof CircuitError && e.code === 'done-today') setScreen({ kind: 'done' });
    else if (e instanceof CircuitError && e.code === 'off') setScreen({ kind: 'off' });
    else setProblem(e instanceof Error ? e.message : 'Something went wrong. Try again.');
  }, []);

  useEffect(() => {
    backend.load().then((s) => {
      setSave(s);
      if (s.left === 0) setScreen({ kind: 'done' });
    }, fail);
  }, [backend, fail]);

  const start = useCallback(async (road: string, hard = false) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const go = await backend.start(road, save?.maths === 'choose' ? wantMaths : undefined);
      setSave((s) => (s ? { ...s, left: go.left } : s));
      const place = roadPlace(road);
      if (place) setWorld(place.world);
      setScreen({ kind: 'race', road, seed: go.seed, stamp: go.stamp, go: ++goCount.current, maths: go.maths ?? null, hard });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [backend, busy, fail, save?.maths, wantMaths]);

  const finished = useCallback(async (road: string, seed: string, stamp: string, inputs: string, crashes: number, hard: boolean, _state: RaceState) => {
    setScreen({ kind: 'saving', road });
    const was = save?.roads[road]?.best ?? null;
    try {
      const reply = await backend.finish({ road, seed, stamp, inputs, crashes, hard });
      setSave((s) => {
        if (!s) return s;
        const had = s.roads[road];
        const rank = { bronze: 1, silver: 2, gold: 3 };
        const hardNow = !!reply.hard && !!had;
        return {
          ...s,
          today: s.today + 1,
          left: reply.left,
          roads: {
            ...s.roads,
            [road]: {
              best: had ? Math.min(had.best, reply.steps) : reply.steps,
              medal: had && rank[had.medal] >= rank[reply.medal] ? had.medal : reply.medal,
              clean: (had?.clean ?? false) || reply.clean,
              charged: (had?.charged ?? false) || reply.charged,
              finishes: (had?.finishes ?? 0) + 1,
              hardFinishes: (had?.hardFinishes ?? 0) + (hardNow ? 1 : 0),
              hardBest: hardNow ? Math.min(had?.hardBest ?? reply.steps, reply.steps) : (had?.hardBest ?? null),
            },
          },
        };
      });
      setScreen({ kind: 'finish', road, reply, was });
    } catch (e) {
      if (e instanceof CircuitError && (e.code === 'done-today' || e.code === 'off')) fail(e);
      else {
        setScreen({ kind: 'roads' });
        setProblem(e instanceof Error ? `${e.message} That finish wasn’t saved.` : 'That finish wasn’t saved.');
      }
    }
  }, [backend, fail, save]);

  let body: ReactNode;
  if (screen.kind === 'race') {
    const road = roadById(screen.road)!;
    body = (
      <RaceScreen
        key={screen.go}
        road={road}
        number={numberOf(screen.road)}
        sound={soundOn}
        maths={screen.maths}
        hard={screen.hard}
        onAnswer={(slot, answer, ms) => backend.answer({ road: screen.road, seed: screen.seed, stamp: screen.stamp, slot, answer, ms })}
        onFinish={(inputs, crashes, state) => finished(screen.road, screen.seed, screen.stamp, inputs, crashes, screen.hard, state)}
        onQuit={() => setScreen({ kind: 'roads' })}
      />
    );
  } else if (screen.kind === 'saving') {
    body = <Centre><h2 className="cr-title" tabIndex={-1}>Plugging in…</h2><p className="cr-sub">Checking your run.</p></Centre>;
  } else if (screen.kind === 'finish' && save) {
    body = <FinishScreen save={save} road={screen.road} reply={screen.reply} was={screen.was} onAgain={() => start(screen.road, !!screen.reply.hard)} onNext={(r) => start(r)} onRoads={() => setScreen({ kind: 'roads' })} onDone={() => setScreen({ kind: 'done' })} />;
  } else if (screen.kind === 'done') {
    body = <DoneToday />;
  } else if (screen.kind === 'off') {
    body = <Centre><HubButtons /><h2 className="cr-title" tabIndex={-1}>Circuit Racer is switched off</h2><p className="cr-sub">Your teacher has switched it off for your class for now.</p></Centre>;
  } else {
    body = <WorldMap save={save} busy={busy} onPick={start} problem={problem} extra={extra} wantMaths={wantMaths} onWantMaths={setWantMaths} world={world} onWorld={setWorld} />;
  }

  return <div className="cr-window">{body}</div>;
}

function Centre({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('h2')?.focus();
  }, []);
  return <div className="cr-centre" ref={ref}>{children}</div>;
}

function Stars({ clean, charged }: { clean: boolean; charged: boolean }) {
  return (
    <span className="cr-stars" aria-label={`${Number(clean) + Number(charged)} of 2 stars`}>
      <span className={clean ? 'cr-star cr-star--on' : 'cr-star'} title="No crash">★</span>
      <span className={charged ? 'cr-star cr-star--on' : 'cr-star'} title="Battery over half">★</span>
    </span>
  );
}

/** The furthest open world (where a pupil most likely wants to race). */
function furthestOpen(save: CircuitSave): number {
  let w = 0;
  for (let i = 0; i < WORLDS.length; i++) if (worldOpen(save.roads, i)) w = i;
  return w;
}

/** What opens next, in a child's words: "Finish 2 more Motherboard roads to open the Graphics Card". */
function nextStep(save: CircuitSave): string | null {
  for (let w = 1; w < WORLDS.length; w++) {
    if (worldOpen(save.roads, w)) continue;
    const done = WORLDS[w - 1].roads.filter((r) => (save.roads[r.id]?.finishes ?? 0) > 0).length;
    const more = WORLD_OPENS_AT - done;
    return `Finish ${more} more ${WORLDS[w - 1].name.replace(/^The /, '')} road${more === 1 ? '' : 's'} to open ${WORLDS[w].name.startsWith('The') ? WORLDS[w].name : `the ${WORLDS[w].name}`}!`;
  }
  return null;
}

function WorldMap({ save, busy, onPick, problem, extra, wantMaths, onWantMaths, world, onWorld }: {
  save: CircuitSave | null; busy: boolean; onPick: (road: string, hard?: boolean) => void; problem: string | null; extra?: ReactNode;
  wantMaths: boolean; onWantMaths: (on: boolean) => void; world: number | null; onWorld: (w: number) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const shown = world ?? (save ? furthestOpen(save) : 0);
  const roads = WORLDS[shown].roads;
  const open = save ? worldOpen(save.roads, shown) : shown === 0;
  // 1 to 6 pick a road in the shown world; arrows and [ ] change world.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.key === '[') onWorld(Math.max(0, shown - 1));
      else if (e.code === 'ArrowRight' || e.key === ']') onWorld(Math.min(WORLDS.length - 1, shown + 1));
      else {
        const road = roads[Number(e.key) - 1];
        if (save && road && roadOpen(save.roads, road.id)) onPick(road.id);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [save, onPick, onWorld, shown, roads]);
  const next = save ? nextStep(save) : null;

  return (
    <div className="cr-picker cr-picker--map" style={{ ['--cr-map' as string]: `url(${mapSmall})` }}>
      <div className="cr-picker__bar">
        <HubButtons />
        {save && <span className="cr-chip">{leftText(save.left)}</span>}
      </div>
      <h1 className="cr-picker__title" ref={heading} tabIndex={-1}>Circuit Racer</h1>
      <div className="cr-map">
        <img className="cr-map__art" src={mapArt} srcSet={`${mapSmall} 800w, ${mapArt} 1536w`} sizes="(max-width: 820px) 100vw, 1100px" alt="" />
        <ol className="cr-map__pins" aria-label="Worlds">
          {WORLDS.map((w, i) => {
            const isOpen = save ? worldOpen(save.roads, i) : i === 0;
            const done = save ? w.roads.filter((r) => (save.roads[r.id]?.finishes ?? 0) > 0).length : 0;
            return (
              <li key={w.id} className="cr-pin-spot" style={{ left: `${PINS[i].x}%`, top: `${PINS[i].y}%`, ['--cr-pin' as string]: PINS[i].colour }}>
                <button
                  type="button" className={`cr-pin${i === shown ? ' cr-pin--on' : ''}${isOpen ? '' : ' cr-pin--locked'}`}
                  aria-pressed={i === shown} onClick={() => onWorld(i)}
                >
                  <span className="cr-pin__num">{isOpen ? i + 1 : '🔒'}</span>
                  <span className="cr-pin__name">{w.name}</span>
                  <span className="cr-pin__dots" aria-label={`${done} of 6 roads finished`}>
                    {w.roads.map((r) => <span key={r.id} className={(save?.roads[r.id]?.finishes ?? 0) > 0 ? 'cr-dot cr-dot--on' : 'cr-dot'} />)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="cr-picker__world">World {shown + 1} · {WORLDS[shown].name}</p>
      {problem && <p className="cr-problem" role="alert">{problem}</p>}
      {next && <p className="cr-next">{next}</p>}
      {!save ? (
        !problem && <p className="cr-sub">Powering up…</p>
      ) : (
        <ol className={`cr-roads cr-roads--${WORLDS[shown].id}`}>
          {roads.map((r, i) => {
            const p = save.roads[r.id];
            const isOpen = roadOpen(save.roads, r.id);
            return (
              <li key={r.id} className="cr-road-spot">
                <button type="button" className={`cr-road${isOpen ? '' : ' cr-road--locked'}${p ? ' cr-road--done' : ''}`} disabled={!isOpen || busy} onClick={() => onPick(r.id)}>
                  <span className="cr-road__num">{i + 1}</span>
                  <span className="cr-road__name">{r.name}</span>
                  {p ? (
                    <span className="cr-road__best">
                      <span aria-hidden="true">{MEDAL_ICON[p.medal]}</span> {MEDAL_WORD[p.medal]} · {timeText(p.best)} <Stars clean={p.clean} charged={p.charged} />
                      {(p.hardFinishes ?? 0) > 0 && <span className="cr-fire" title="Finished in hard mode"> 🔥</span>}
                    </span>
                  ) : (
                    <span className="cr-road__best">{isOpen ? `Gold under ${MEDAL_SECONDS[r.id]?.gold ?? '?'}s` : open ? '🔒 Finish the road before' : '🔒 World locked'}</span>
                  )}
                </button>
                {p && (
                  <button type="button" className="cr-hard" disabled={busy} onClick={() => onPick(r.id, true)} title={`Hard mode: no Auto-Pilot, beat the clock (${hardSeconds(r.id)}s). Nothing lost if you don’t make it.`}>
                    🔥 Hard
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {save && extraRoads().length > 0 && (
        <div className="cr-testroads">
          {extraRoads().map((r) => (
            <button key={r.id} type="button" className="cr-btn" disabled={busy} onClick={() => onPick(r.id)}>{r.name}</button>
          ))}
        </div>
      )}
      {save?.maths === 'choose' && (
        <label className="cr-mathspick">
          <input type="checkbox" checked={wantMaths} onChange={(e) => onWantMaths(e.target.checked)} />
          Maths at recharge ports and data gates
        </label>
      )}
      <p className="cr-keys">Arrows or W A S D: steer and speed · Space: jump · 1 to 6: pick a road · ← →: worlds · Esc: back</p>
      {extra}
    </div>
  );
}

function FinishScreen({ save, road, reply, was, onAgain, onNext, onRoads, onDone }: {
  save: CircuitSave; road: string; reply: FinishReply; was: number | null;
  onAgain: () => void; onNext: (road: string) => void; onRoads: () => void; onDone: () => void;
}) {
  const i = ROADS.findIndex((r) => r.id === road);
  const def = roadById(road)!.def;
  const place = roadPlace(road);
  const next = ROADS[i + 1];
  const nextOpen = next && roadOpen(save.roads, next.id);
  const out = reply.left === 0;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const main = out ? onDone : nextOpen ? () => onNext(next.id) : onAgain;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); main(); }
      else if (e.code === 'KeyR' && !out) onAgain();
      else if (e.code === 'Escape') onRoads();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [main, out, onAgain, onRoads]);
  const best = reply.result === 'best' && was !== null;
  const newWorld = next && nextOpen && place && roadPlace(next.id)?.world !== place.world;

  return (
    <div className={`cr-finish cr-finish--${def.world}`}>
      <div className="cr-finish__card">
        <p className="cr-finish__road">{place ? `World ${place.world + 1} · ${place.index + 1}. ` : ''}{def.name}</p>
        <h2 className="cr-finish__title" ref={heading} tabIndex={-1}>
          <span aria-hidden="true">{MEDAL_ICON[reply.medal]}</span> {MEDAL_WORD[reply.medal]}!{reply.hard && <span className="cr-fire" aria-label=" in hard mode"> 🔥</span>}
        </h2>
        <p className="cr-finish__time">{timeText(reply.steps)}{best && <span className="cr-new"> New best!</span>}</p>
        {reply.hard && <p className="cr-hardwin">Hard mode beaten: no Auto-Pilot, inside the clock!</p>}
        <ul className="cr-finish__stars">
          <li className={reply.clean ? 'cr-on' : ''}><span aria-hidden="true">★</span> No crash{reply.clean ? '' : ' (not this time)'}</li>
          <li className={reply.charged ? 'cr-on' : ''}><span aria-hidden="true">★</span> Battery over half ({Math.round(reply.battery)}%)</li>
        </ul>
        {reply.medal !== 'gold' && MEDAL_SECONDS[road] && (
          <p className="cr-sub">{reply.medal === 'bronze' ? `Silver under ${MEDAL_SECONDS[road].silver}s` : `Gold under ${MEDAL_SECONDS[road].gold}s`}</p>
        )}
        {newWorld && <p className="cr-next">New world open: {WORLDS[roadPlace(next.id)!.world].name}!</p>}
        <p className="cr-chip">{out ? `That’s your ${FINISHES_A_DAY} races for today!` : leftText(reply.left)}</p>
        <div className="cr-finish__buttons">
          {out ? (
            <button type="button" className="cr-btn cr-btn--go" onClick={onDone}>All done (Enter)</button>
          ) : (
            <>
              {nextOpen && <button type="button" className="cr-btn cr-btn--go" onClick={() => onNext(next.id)}>Next road (Enter)</button>}
              <button type="button" className={nextOpen ? 'cr-btn' : 'cr-btn cr-btn--go'} onClick={onAgain}>Race again ({nextOpen ? 'R' : 'Enter'})</button>
            </>
          )}
          <button type="button" className="cr-btn cr-btn--ghost" onClick={onRoads}>Roads (Esc)</button>
        </div>
      </div>
    </div>
  );
}

function DoneToday() {
  const [ms, setMs] = useState(() => msToNzMidnight(Date.now()));
  useEffect(() => {
    const t = setInterval(() => setMs(msToNzMidnight(Date.now())), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <Centre>
      <HubButtons />
      <h2 className="cr-title" tabIndex={-1}>All done for today. See you tomorrow!</h2>
      <p className="cr-sub">You’ve finished your {FINISHES_A_DAY} roads for today.</p>
      <p className="cr-countdown" aria-label="Time until new races">
        New races in {h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
      </p>
    </Centre>
  );
}
