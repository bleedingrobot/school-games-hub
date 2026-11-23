/**
 * Circuit Racer's screens (docs/CIRCUIT-PLAN.md, sections 4 and 5), full window from the first screen: the world map
 * (the five worlds on the painted map, the chosen world's six roads below), the race, the finish (time, medal, stars, 🔥 for
 * hard mode) and "All done for today" once the day's 5 finishes are used. The server (`backend`) hands out every go and
 * saves every finish; the screens only show what it says.
 *
 * Stage 6: a pupil's first go at road 1 is Volt's guided go (and "Replay the guide" on the map plays it again); Volt's
 * once-only tips are saved as seen on the server; new achievements pop on the finish screen.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  achievementsReached, ACHIEVEMENTS, extraRoads, FINISHES_A_DAY, GUIDE_ROAD, hardSeconds, MEDAL_SECONDS, msToNzMidnight, racerById, racerOpen, RACERS, roadById, roadOpen, roadPlace, ROADS, timeText,
  WORLD_OPENS_AT, worldOpen, WORLDS, type CircuitSave, type Medal, type RacerId, type RoadProgress, type TipId,
} from '../../../shared/circuit/game';
import { AchievementPop } from '../../achievements/AchievementPop';
import type { NewAchievement } from '../../data/newAchievements';
import type { World } from '../../../shared/circuit/config';
import type { RunMaths } from '../../../shared/circuit/maths';
import type { RaceState } from '../../../shared/circuit/physics';
import { useSound } from '../../sound';
import mapArt from './art/paint/map/map.webp';
import mapSmall from './art/paint/map/map-800.webp';
import finishCloud from './art/paint/finish/cloud.webp';
import finishCloudSmall from './art/paint/finish/cloud-800.webp';
import finishGpu from './art/paint/finish/gpu.webp';
import finishGpuSmall from './art/paint/finish/gpu-800.webp';
import finishMemory from './art/paint/finish/memory.webp';
import finishMemorySmall from './art/paint/finish/memory-800.webp';
import finishBoard from './art/paint/finish/motherboard.webp';
import finishBoardSmall from './art/paint/finish/motherboard-800.webp';
import finishQuantum from './art/paint/finish/quantum.webp';
import finishQuantumSmall from './art/paint/finish/quantum-800.webp';
import byteArt from './art/paint/racers/byte-small.webp';
import pixelArt from './art/paint/racers/pixel-small.webp';
import quarkArt from './art/paint/racers/quark-small.webp';
import sparkArt from './art/paint/racers/spark-small.webp';
import { circuitSound } from './audio';
import { VoltFace } from './Volt';
import { CircuitError, type CircuitBackend, type FinishReply } from './backend';
import { HubButtons } from './HubButtons';
import { RaceScreen } from './RaceScreen';
import './circuit.css';

type Screen =
  | { kind: 'roads' }
  | { kind: 'race'; road: string; seed: string; stamp: string; go: number; maths: RunMaths | null; hard: boolean; guide: boolean }
  | { kind: 'saving'; road: string }
  | { kind: 'finish'; road: string; reply: FinishReply; was: number | null }
  | { kind: 'done' }
  | { kind: 'off' };

/** Each world's finish painting: [full size, 800 wide]. */
const FINISH_ART: Record<World, [string, string]> = {
  motherboard: [finishBoard, finishBoardSmall], graphics: [finishGpu, finishGpuSmall], memory: [finishMemory, finishMemorySmall],
  cloud: [finishCloud, finishCloudSmall], quantum: [finishQuantum, finishQuantumSmall],
};
const RACER_ART: Record<RacerId, string> = { spark: sparkArt, pixel: pixelArt, byte: byteArt, quark: quarkArt };
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

const MEDAL_RANK_OF: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };
const leftText = (left: number | null) => (left === null ? 'Unlimited today' : `${left} race${left === 1 ? '' : 's'} left today`);
/** "World 2 · 3. Fan Alley" style label parts: road number inside its world. */
const numberOf = (id: string) => (roadPlace(id)?.index ?? -1) + 1;

/**
 * The achievements newly reached by a finish, for the preview's pretend earn moment (`trial`): live, the server decides
 * them and AchievementPop reads them.
 */
function pretendEarned(before: Record<string, RoadProgress>, after: Record<string, RoadProgress>): NewAchievement[] {
  const had = new Set(achievementsReached(before));
  return ACHIEVEMENTS.filter((a) => !had.has(a.id) && achievementsReached(after).includes(a.id)).map((a) => ({
    id: a.id, game: 'circuit', name: a.name, emoji: a.emoji, how: a.how, tier: a.tier, earnedAt: new Date().toISOString(),
  }));
}

/** `trial`: the preview (no school server), so the earn moment shows pretend achievements worked out here. */
export function CircuitGame({ backend, extra, trial = false }: { backend: CircuitBackend; extra?: ReactNode; trial?: boolean }) {
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
  // A finish saved (for the earn moment), and what the preview pretends was earned by it.
  const [saves, setSaves] = useState(0);
  const [pretend, setPretend] = useState<NewAchievement[]>([]);

  /** Saves one of Volt's tips as seen: at once on screen, then on the server (a failure only means it may show again). */
  const markSeen = useCallback((tip: TipId) => {
    setSave((s) => (s && !(s.seen ?? []).includes(tip) ? { ...s, seen: [...(s.seen ?? []), tip] } : s));
    backend.seen([tip]).catch(() => undefined);
  }, [backend]);

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

  const start = useCallback(async (road: string, hard = false, replayGuide = false) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const go = await backend.start(road, save?.maths === 'choose' ? wantMaths : undefined);
      setSave((s) => (s ? { ...s, left: go.left } : s));
      const place = roadPlace(road);
      if (place) setWorld(place.world);
      // Volt guides road 1 until the pupil has finished it once guided (or when asked to replay the guide).
      const guide = road === GUIDE_ROAD && !hard && (replayGuide || !(save?.seen ?? []).includes('guide'));
      setScreen({ kind: 'race', road, seed: go.seed, stamp: go.stamp, go: ++goCount.current, maths: go.maths ?? null, hard, guide });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [backend, busy, fail, save?.maths, save?.seen, wantMaths]);

  const finished = useCallback(async (road: string, seed: string, stamp: string, inputs: string, crashes: number, hard: boolean, guide: boolean, _state: RaceState) => {
    setScreen({ kind: 'saving', road });
    const was = save?.roads[road]?.best ?? null;
    try {
      const reply = await backend.finish({ road, seed, stamp, inputs, crashes, hard, guide });
      if (guide) markSeen('guide');
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
      if (trial && save) {
        const had = save.roads[road];
        const after = { ...save.roads, [road]: { ...(had ?? { best: reply.steps, clean: false, charged: false, hardFinishes: 0 }), finishes: (had?.finishes ?? 0) + 1, medal: had && MEDAL_RANK_OF[had.medal] >= MEDAL_RANK_OF[reply.medal] ? had.medal : reply.medal, clean: (had?.clean ?? false) || reply.clean, hardFinishes: (had?.hardFinishes ?? 0) + (reply.hard && had ? 1 : 0) } };
        setPretend(pretendEarned(save.roads, after));
      }
      setSaves((n) => n + 1);
      setScreen({ kind: 'finish', road, reply, was });
    } catch (e) {
      if (e instanceof CircuitError && (e.code === 'done-today' || e.code === 'off')) fail(e);
      else {
        setScreen({ kind: 'roads' });
        setProblem(e instanceof Error ? `${e.message} That finish wasn’t saved.` : 'That finish wasn’t saved.');
      }
    }
  }, [backend, fail, save, markSeen, trial]);

  // The racer picker (Stage 5): shown at once, saved on the server; put back if the server says no.
  const pickRacer = useCallback(async (racer: RacerId) => {
    const was = save?.racer;
    if (!save || was === racer) return;
    setSave((s) => (s ? { ...s, racer } : s));
    try {
      await backend.racer(racer);
    } catch (e) {
      setSave((s) => (s ? { ...s, racer: was } : s));
      setProblem(e instanceof Error ? e.message : 'Your racer couldn’t be changed.');
    }
  }, [backend, save]);

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
        colour={(racerById(save?.racer) ?? RACERS[0]).colour}
        guide={screen.guide}
        seen={save?.seen ?? []}
        onSeen={markSeen}
        onAnswer={(slot, answer, ms) => backend.answer({ road: screen.road, seed: screen.seed, stamp: screen.stamp, slot, answer, ms })}
        onFinish={(inputs, crashes, state) => finished(screen.road, screen.seed, screen.stamp, inputs, crashes, screen.hard, screen.guide, state)}
        onQuit={() => setScreen({ kind: 'roads' })}
      />
    );
  } else if (screen.kind === 'saving') {
    body = <Centre><h2 className="cr-title" tabIndex={-1}>Plugging in…</h2><p className="cr-sub">Checking your run.</p></Centre>;
  } else if (screen.kind === 'finish' && save) {
    body = <FinishScreen sound={soundOn} save={save} road={screen.road} reply={screen.reply} was={screen.was} onAgain={() => start(screen.road, !!screen.reply.hard)} onNext={(r) => start(r)} onRoads={() => setScreen({ kind: 'roads' })} onDone={() => setScreen({ kind: 'done' })} />;
  } else if (screen.kind === 'done') {
    body = <DoneToday />;
  } else if (screen.kind === 'off') {
    body = <Centre><HubButtons /><h2 className="cr-title" tabIndex={-1}>Circuit Racer is switched off</h2><p className="cr-sub">Your teacher has switched it off for your class for now.</p></Centre>;
  } else {
    body = (
      <WorldMap
        save={save} busy={busy} onPick={start} problem={problem} extra={extra} wantMaths={wantMaths} onWantMaths={setWantMaths} world={world} onWorld={setWorld}
        onRacer={pickRacer} onGuide={() => start(GUIDE_ROAD, false, true)}
      />
    );
  }

  return (
    <div className="cr-window">
      {body}
      <AchievementPop games={['circuit']} watch={saves || null} off={trial} pretend={pretend} />
    </div>
  );
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

function WorldMap({ save, busy, onPick, problem, extra, wantMaths, onWantMaths, world, onWorld, onRacer, onGuide }: {
  save: CircuitSave | null; busy: boolean; onPick: (road: string, hard?: boolean) => void; problem: string | null; extra?: ReactNode;
  wantMaths: boolean; onWantMaths: (on: boolean) => void; world: number | null; onWorld: (w: number) => void; onRacer: (racer: RacerId) => void;
  onGuide: () => void;
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
        {save && (save.seen ?? []).includes('guide') && (
          <button type="button" className="cr-glass cr-guide-again" disabled={busy} onClick={onGuide} title="Volt shows you the keys again on road 1">
            <span aria-hidden="true">🔌</span> Replay the guide
          </button>
        )}
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
      {save && <RacerPicker save={save} onRacer={onRacer} />}
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

/** The racers (Stage 5): Spark from the start, one more with each new world. Volt points at the locked ones. */
function RacerPicker({ save, onRacer }: { save: CircuitSave; onRacer: (racer: RacerId) => void }) {
  const mine = racerById(save.racer)?.id ?? 'spark';
  const [said, setSaid] = useState<string | null>(null);
  const locked = RACERS.filter((r) => !racerOpen(save.roads, r.id));
  const line = said ?? (locked.length ? `${locked[0].name} joins when ${WORLDS[locked[0].world].name} opens!` : 'Every racer is yours. Pick one!');
  return (
    <section className="cr-racers" aria-label="Your racer">
      <div className="cr-racers__volt">
        <VoltFace size={52} />
        <p className="cr-racers__line" role="status">{line}</p>
      </div>
      <ul className="cr-racers__list">
        {RACERS.map((r) => {
          const open = racerOpen(save.roads, r.id);
          const on = r.id === mine;
          const pick = () => {
            if (!open) return setSaid(`Open ${WORLDS[r.world].name} to race as ${r.name}!`);
            onRacer(r.id);
            setSaid(`${r.name} is ready to race!`);
          };
          return (
            <li key={r.id}>
              <button
                type="button" aria-pressed={on} aria-label={open ? `Race as ${r.name}` : `${r.name}: comes with ${WORLDS[r.world].name}`}
                className={`cr-racer${on ? ' cr-racer--on' : ''}${open ? '' : ' cr-racer--locked'}`} style={{ ['--cr-racer' as string]: r.colour }}
                onClick={pick}
              >
                <img src={RACER_ART[r.id]} alt="" width={96} height={96} />
                <span className="cr-racer__name">{open ? r.name : `🔒 ${r.name}`}</span>
                {!open && <span className="cr-racer__point" aria-hidden="true">👈</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts up to `to` over about a second (straight there with reduced motion). */
function useCountUp(to: number): number {
  const [shown, setShown] = useState(() => (reducedMotion() || typeof requestAnimationFrame !== 'function' ? to : 0));
  useEffect(() => {
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') {
      setShown(to);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - began) / 1100));
      setShown(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return shown;
}

const SPARKS = Array.from({ length: 22 }, (_, i) => ({ angle: (i / 22) * 360 + (i % 3) * 7, far: 90 + ((i * 37) % 80), delay: (i % 5) * 40 }));

function FinishScreen({ sound, save, road, reply, was, onAgain, onNext, onRoads, onDone }: {
  sound: boolean; save: CircuitSave; road: string; reply: FinishReply; was: number | null;
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
  // The medal lands with a chime as the time finishes counting.
  useEffect(() => {
    if (!sound) return;
    const t = setTimeout(() => circuitSound('checkpoint'), 650);
    return () => clearTimeout(t);
  }, [sound]);
  const best = reply.result === 'best' && was !== null;
  const newWorld = next && nextOpen && place && roadPlace(next.id)?.world !== place.world;
  const [big, small] = FINISH_ART[def.world] ?? FINISH_ART.motherboard;
  const steps = useCountUp(reply.steps);

  return (
    <div className={`cr-finish cr-finish--${def.world}${reply.hard ? ' cr-finish--hard' : ''}`}>
      <img className="cr-finish__art" src={small} srcSet={`${small} 800w, ${big} 1600w`} sizes="100vw" alt="" />
      <div className="cr-finish__sparks" aria-hidden="true">
        {SPARKS.map((p, k) => (
          <span key={k} style={{ ['--a' as string]: `${p.angle}deg`, ['--d' as string]: `${p.far}px`, animationDelay: `${450 + p.delay}ms` }} />
        ))}
      </div>
      <div className="cr-finish__card">
        <p className="cr-finish__road">{place ? `World ${place.world + 1} · ${place.index + 1}. ` : ''}{def.name}</p>
        <p className="cr-finish__medal" aria-hidden="true">{MEDAL_ICON[reply.medal]}</p>
        <h2 className="cr-finish__title" ref={heading} tabIndex={-1}>
          {MEDAL_WORD[reply.medal]}!{reply.hard && <span className="cr-fire" aria-label=" in hard mode"> 🔥</span>}
        </h2>
        <p className="cr-finish__time" aria-label={timeText(reply.steps)}>{timeText(steps)}{best && <span className="cr-new"> New best!</span>}</p>
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
