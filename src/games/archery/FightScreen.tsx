/**
 * The fight screen against a bot (docs/ARCHERY-PLAN.md, sections 1 and 10): the canvas picture with the
 * HUD around it, aiming by buttons, sliders, keys and touch, the bot's turns, rounds and the fight's end.
 *
 * The rules run in `shared/archery` one shot at a time (`startFight` / `takeShot`), exactly as a replay
 * would, and the bot's shots go into the same shot list. The canvas drawing is in `renderer.ts`.
 *
 * James (21 Oct 2026): no aiming help of any kind. Angle and power are plain numbers that stay where the
 * player left them between turns. Touch aiming changes only the numbers and the archer's pose.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { arrowKind } from '../../../shared/archery/arrows';
import { BOT_KITS, type BotLevel } from '../../../shared/archery/bot';
import { MAX_ANGLE, MAX_POWER, START_HEALTH } from '../../../shared/archery/config';
import { startFight, takeShot, type FightRun } from '../../../shared/archery/fight';
import { copyLand } from '../../../shared/archery/land';
import type { ArrowId, FightSetup, Shot, WorldId } from '../../../shared/archery/types';
import { startArcheryBot } from './botThread';
import { loadBests, loadPrefs, saveBest, savePrefs, wantsLessMotion, type ArcheryPrefs } from './prefs';
import type { FightView, ViewInsets } from './renderer';
import { BOT_NAME, LEVEL_NAMES, WORLD_HINTS, WORLD_NAMES, windWords } from './text';
import './archery.css';

/** The preview's starter bag: a few Steel Arrows (Plain never runs out). */
export const STARTER_QUIVER: Partial<Record<ArrowId, number>> = { steel: 4 };

type Phase = 'loading' | 'aim' | 'flying' | 'bot' | 'round-over' | 'fight-over';

interface Aim {
  angle: number;
  power: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A new fight's seed. Only the screen picks it (the server will in Stage 4); the rules never use Math.random. */
const freshSeed = () => (Math.random() * 4294967296) >>> 0;

export function FightScreen({ world, level, onExit, seed: fixedSeed }: {
  world: WorldId;
  level: BotLevel;
  onExit: () => void;
  /** A fixed seed (for tests); otherwise each fight gets a new one. */
  seed?: number;
}) {
  const [seed, setSeed] = useState(() => fixedSeed ?? freshSeed());
  const setup = useMemo<FightSetup>(() => ({ world, players: [{ quiver: { ...STARTER_QUIVER }, shield: 0 }, { quiver: { ...BOT_KITS[level] }, shield: 0 }] }), [world, level]);
  const run = useMemo<FightRun>(() => startFight(seed, setup), [seed, setup]);
  const runRef = useRef(run);
  runRef.current = run;
  const shots = useRef<Shot[]>([]);
  // Re-draw the HUD after the rules move on (the run itself is changed in place).
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [prefs, setPrefs] = useState<ArcheryPrefs>(() => loadPrefs());
  const lessMotion = wantsLessMotion(prefs);
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const beep = useCallback((s: Parameters<typeof playSound>[0]) => {
    if (soundRef.current) playSound(s);
  }, []);

  const [phase, setPhase] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  const [aim, setAim] = useState<Aim>({ angle: 55, power: 60 });
  const aimRef = useRef(aim);
  aimRef.current = aim;
  const [arrow, setArrow] = useState<ArrowId>('plain');
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const [newBest, setNewBest] = useState(false);
  const [best, setBest] = useState(() => loadBests()[world] ?? 0);

  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FightView | null>(null);
  const botRef = useRef<ReturnType<typeof startArcheryBot> | null>(null);
  const gone = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogHeading = useRef<HTMLHeadingElement>(null);

  const round = run.round;
  const me = round.archers[0];
  const them = round.archers[1];
  const steelLeft = (STARTER_QUIVER.steel ?? 0) - (run.used[0].steel ?? 0);
  const score = run.records.reduce((n, r) => n + (r.player === 0 ? r.damage[1] : 0), 0);
  const botLabel = `${BOT_NAME} (${LEVEL_NAMES[level]})`;
  const lastRound = run.rounds[run.rounds.length - 1];

  // The bot thinks in a Web Worker for as long as the screen is open.
  useEffect(() => {
    gone.current = false;
    botRef.current = startArcheryBot();
    return () => {
      gone.current = true;
      botRef.current?.close();
      botRef.current = null;
    };
  }, []);

  // The picture: made once, and told about each new round.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let view: FightView | null = null;
    let dead = false;
    void import('./renderer')
      .then((m) => {
        if (dead) return;
        view = m.createFightView(el, { lessMotion, simple: prefs.simple, names: ['You', BOT_NAME] });
        viewRef.current = view;
        if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __archeryStats?: () => unknown }).__archeryStats = () => view?.stats();
        resize();
        view.setRound(run.round);
        void landed().then(startTurn);
      })
      .catch(() => {
        if (!dead) setProblem('Your device could not draw the battlefield. Try another browser, or ask your teacher.');
      });
    return () => {
      dead = true;
      view?.dispose();
      viewRef.current = null;
    };
    // A new fight (Play again) makes a new run; prefs are passed on through setOptions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    viewRef.current?.setOptions({ lessMotion, simple: prefs.simple });
  }, [lessMotion, prefs.simple]);

  /** Tells the picture how big it is and which parts the HUD covers. */
  const resize = useCallback(() => {
    const el = stage.current;
    const view = viewRef.current;
    if (!el || !view) return;
    const r = el.getBoundingClientRect();
    const t = top.current?.getBoundingClientRect();
    const b = bottom.current?.getBoundingClientRect();
    const insets: ViewInsets = { top: t ? Math.max(0, t.bottom - r.top) : 0, bottom: b ? Math.max(0, r.bottom - b.top) : 0, left: 0, right: 0 };
    view.resize(r.width, r.height, insets);
  }, []);

  useEffect(() => {
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize());
    for (const el of [stage.current, top.current, bottom.current]) if (el) observer?.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [resize]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  // Each new dialog's heading takes the focus.
  useEffect(() => {
    if (phase === 'round-over' || phase === 'fight-over' || settingsOpen || problem) dialogHeading.current?.focus();
  }, [phase, settingsOpen, problem]);

  // The player's archer shows their numbers.
  useEffect(() => {
    if (phase === 'aim') viewRef.current?.setAim(0, aim.angle, 0.15);
  }, [aim.angle, phase]);

  /** Whoever's turn it is now: the player aims, or the bot thinks. */
  function startTurn() {
    if (gone.current || run.winner !== null) return;
    const turn = run.round.turn;
    viewRef.current?.setTurn(turn);
    bump();
    if (turn === 0) {
      setPhase('aim');
      viewRef.current?.setAim(0, aimRef.current.angle, 0.15);
    } else {
      setPhase('bot');
      void botTurn();
    }
  }

  async function botTurn() {
    const bot = botRef.current;
    if (!bot) return;
    setMessage(`${BOT_NAME} is thinking…`);
    const thisRun = run;
    const [shot] = await Promise.all([bot.decide({ seed, setup, shots: shots.current.slice(), level }), wait(lessMotion ? 300 : 700)]);
    if (gone.current || runRef.current !== thisRun || run.winner !== null) return;
    await viewRef.current?.aimTo(1, shot.angle, shot.power / MAX_POWER, lessMotion ? 0 : 650);
    if (gone.current || runRef.current !== thisRun) return;
    await fire(shot);
  }

  /** Plays one shot (the player's or the bot's) and moves the fight on. */
  async function fire(shot: Shot) {
    const view = viewRef.current;
    const player = run.round.turn;
    const landBefore = copyLand(run.round.land);
    const archersBefore: [typeof me, typeof me] = [{ ...run.round.archers[0] }, { ...run.round.archers[1] }];
    const taken = takeShot(run, shot, true);
    if (taken.problem || !taken.record) {
      setMessage(`That shot can't be played: ${taken.problem}.`);
      if (player === 0) setPhase('aim');
      return;
    }
    shots.current.push(shot);
    setPhase('flying');
    setMessage('');
    beep('flick');
    const rec = taken.record;
    const landAfter = copyLand(taken.ended ? taken.ended.land : run.round.land);
    await view?.playShot({ player, record: rec, landBefore, landAfter, archersBefore });
    if (gone.current) return;
    if (rec.damage[0] + rec.damage[1] > 0) beep('boom');
    setMessage(describeShot(player, rec.damage, rec.hit.kind, rec.after));
    if (taken.ended) {
      const w = taken.ended.winner;
      if (w === 0 || w === 1) view?.celebrate(w);
      beep(w === 0 ? 'win' : 'end');
      if (run.winner !== null) {
        const finalScore = run.records.reduce((n, r) => n + (r.player === 0 ? r.damage[1] : 0), 0);
        const isBest = saveBest(world, finalScore);
        setNewBest(isBest);
        setBest(loadBests()[world] ?? finalScore);
        setPhase('fight-over');
      } else setPhase('round-over');
      bump();
      return;
    }
    startTurn();
  }

  function describeShot(player: number, damage: [number, number], kind: string, after: [typeof me, typeof me]): string {
    const who = player === 0 ? 'You' : BOT_NAME;
    const other = player === 0 ? 1 : 0;
    const parts: string[] = [];
    if (damage[other] > 0) parts.push(`${who} hit ${other === 0 ? 'you' : BOT_NAME} for ${damage[other]}.`);
    else parts.push(kind === 'gone' ? `${who} shot off the edge.` : `${who} missed.`);
    if (damage[player] > 0) parts.push(`${player === 0 ? 'You' : BOT_NAME} got hurt too (${damage[player]}).`);
    if (after[other].popped) parts.push(`${other === 0 ? 'You' : BOT_NAME} popped!`);
    return parts.join(' ');
  }

  function shoot() {
    if (phaseRef.current !== 'aim' || !viewRef.current) return;
    const a = aimRef.current;
    const use: ArrowId = arrow === 'steel' && steelLeft <= 0 ? 'plain' : arrow;
    if (use !== arrow) setArrow('plain');
    void fire({ angle: a.angle, power: a.power, arrow: use });
  }

  function nudge(which: keyof Aim, by: number) {
    if (phaseRef.current !== 'aim') return;
    setAim((a) => ({ ...a, [which]: clamp(a[which] + by, 0, which === 'angle' ? MAX_ANGLE : MAX_POWER) }));
  }

  function nextRound() {
    viewRef.current?.setRound(run.round);
    setPhase('loading');
    setMessage(`Round ${run.round.index + 1}. ${windWords(run.round.wind)}.`);
    heading.current?.focus({ preventScroll: true });
    void landed().then(startTurn);
  }

  /** Waits while the archers drop onto the new land (about a second; a moment with less motion). */
  function landed(): Promise<void> {
    return wait(lessMotion ? 150 : 1100);
  }

  function playAgain() {
    shots.current = [];
    setNewBest(false);
    setArrow('plain');
    setPhase('loading');
    setMessage('');
    setSeed(freshSeed());
    heading.current?.focus({ preventScroll: true });
  }

  function changePrefs(next: ArcheryPrefs) {
    setPrefs(next);
    savePrefs(next);
  }

  // Keys: ← → angle (the bow turns that way), ↑ ↓ power, Shift for steps of 5, space to shoot.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || settingsOpen) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowLeft') nudge('angle', step);
      else if (e.key === 'ArrowRight') nudge('angle', -step);
      else if (e.key === 'ArrowUp') nudge('power', step);
      else if (e.key === 'ArrowDown') nudge('power', -step);
      else if (e.key === ' ' && !(t instanceof HTMLButtonElement)) shoot();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Touch (and mouse) aiming: drag back from your archer like pulling a bowstring. It changes only the
  // numbers and the archer's pose. Nothing is drawn: no line, no dotted path, no landing guess.
  const drag = useRef<{ id: number } | null>(null);
  function pullFrom(e: React.PointerEvent): Aim | null {
    const view = viewRef.current;
    const el = stage.current;
    const hands = view?.archerOnScreen(0);
    if (!view || !el || !hands) return null;
    const r = el.getBoundingClientRect();
    const dx = hands.x - (e.clientX - r.left);
    const dy = hands.y - (e.clientY - r.top);
    let angle = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
    if (angle < 0) angle = angle < -90 ? 180 : 0;
    const reach = Math.max(90, Math.min(r.width, r.height) * 0.4);
    const power = Math.round(clamp(Math.sqrt(dx * dx + dy * dy) / reach, 0, 1) * MAX_POWER);
    return { angle: clamp(angle, 0, MAX_ANGLE), power };
  }
  function pointerDown(e: React.PointerEvent) {
    if (phaseRef.current !== 'aim') return;
    const view = viewRef.current;
    const el = stage.current;
    const hands = view?.archerOnScreen(0);
    if (!view || !el || !hands) return;
    const r = el.getBoundingClientRect();
    const near = Math.hypot(e.clientX - r.left - hands.x, e.clientY - r.top - hands.y) < Math.max(70, r.height * 0.14);
    if (!near) return;
    drag.current = { id: e.pointerId };
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function pointerMove(e: React.PointerEvent) {
    if (!drag.current || drag.current.id !== e.pointerId || phaseRef.current !== 'aim') return;
    const next = pullFrom(e);
    if (!next) return;
    setAim(next);
    viewRef.current?.setAim(0, next.angle, next.power / MAX_POWER);
  }
  function pointerUp(e: React.PointerEvent) {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    viewRef.current?.setAim(0, aimRef.current.angle, 0.15);
  }

  const myTurn = phase === 'aim';
  const turnWords = phase === 'loading' ? 'Getting ready…' : phase === 'aim' ? 'Your turn' : phase === 'bot' ? `${BOT_NAME}'s turn` : phase === 'flying' ? (round.turn === 0 ? 'Your shot' : `${BOT_NAME}'s shot`) : 'Round over';
  const healthPct = (h: number) => `${clamp((h / START_HEALTH) * 100, 0, 100)}%`;
  const wind = round.wind;
  const roundWinWords = lastRound?.winner === 0 ? `You win round ${lastRound.index + 1}!` : lastRound?.winner === 1 ? `${BOT_NAME} wins round ${lastRound.index + 1}` : `Round ${(lastRound?.index ?? 0) + 1} is a draw`;
  const fightWords = run.winner === 0 ? 'You won the fight!' : run.winner === 1 ? `${BOT_NAME} won the fight` : 'The fight is a draw';
  const pictureWords = `${WORLD_NAMES[world]} battlefield, round ${round.index + 1}. Your archer on the left has ${me.popped ? 'popped' : `${me.health} health`}; ${BOT_NAME} on the right has ${them.popped ? 'popped' : `${them.health} health`}. ${windWords(wind)}.`;

  return (
    <section className="ar-fight" aria-labelledby="ar-fight-title" data-less-motion={lessMotion || undefined}>
      <h2 id="ar-fight-title" ref={heading} tabIndex={-1} className="ar-sr">Archery Challenge: {WORLD_NAMES[world]}, against {botLabel}</h2>
      <div
        ref={stage}
        className="ar-stage"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvas} className="ar-canvas" role="img" aria-label={pictureWords} />
      </div>

      <div ref={top} className="ar-top">
        <div className="ar-card" data-turn={round.turn === 0 && phase !== 'round-over' && phase !== 'fight-over' ? true : undefined}>
          <span className="ar-card__name">You</span>
          <span className="ar-bar" role="meter" aria-label="Your health" aria-valuemin={0} aria-valuemax={START_HEALTH} aria-valuenow={me.health}>
            <span className="ar-bar__fill" style={{ width: healthPct(me.health) }} data-low={me.health < 35 || undefined} />
          </span>
          <span className="ar-card__num">{me.health}</span>
          <span className="ar-wins" aria-label={`Rounds won: ${run.roundWins[0]}`}>{'★'.repeat(run.roundWins[0])}</span>
        </div>
        <div className="ar-mid">
          <span className="ar-turn" data-bot={round.turn === 1 || undefined} aria-live="polite">{turnWords}</span>
          <span className="ar-wind" aria-label={windWords(wind)}>
            <span aria-hidden="true">Wind</span>
            <span className="ar-wind__arrow" aria-hidden="true" data-dir={wind > 0 ? 'right' : wind < 0 ? 'left' : 'none'}>{wind > 0 ? '→' : wind < 0 ? '←' : '·'}</span>
            <b aria-hidden="true">{Math.abs(wind)}</b>
          </span>
          <span className="ar-round">Round {round.index + 1}</span>
        </div>
        <div className="ar-card ar-card--bot" data-turn={round.turn === 1 && phase !== 'round-over' && phase !== 'fight-over' ? true : undefined}>
          <span className="ar-card__name">{botLabel}</span>
          <span className="ar-bar" role="meter" aria-label={`${BOT_NAME}'s health`} aria-valuemin={0} aria-valuemax={START_HEALTH} aria-valuenow={them.health}>
            <span className="ar-bar__fill" style={{ width: healthPct(them.health) }} data-low={them.health < 35 || undefined} />
          </span>
          <span className="ar-card__num">{them.health}</span>
          <span className="ar-wins" aria-label={`Rounds won: ${run.roundWins[1]}`}>{'★'.repeat(run.roundWins[1])}</span>
        </div>
        <div className="ar-topbtns">
          <button type="button" className="button button--light ar-btn ar-iconbtn" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>⚙</button>
          <button type="button" className="button button--light ar-btn" onClick={onExit}>Leave</button>
        </div>
      </div>

      <p className="ar-toast" role="status" aria-live="polite">{message}</p>
      <p className="ar-rotate">Turn your phone sideways for a bigger view.</p>

      <div ref={bottom} className="ar-bottom">
        <div className="ar-stats" aria-label="Your fight">
          <span className="ar-stat"><span>Arrows</span><b aria-label={`${steelLeft} Steel Arrows left`}>{steelLeft}</b></span>
          <span className="ar-stat"><span>Score</span><b>{score}</b></span>
          <span className="ar-stat"><span>Best</span><b>{Math.max(best, phase === 'fight-over' ? score : 0)}</b></span>
        </div>
        <div className="ar-dial">
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Angle down" disabled={!myTurn} onClick={() => nudge('angle', -1)}>−</button>
          <label className="ar-dial__label">
            <span>Angle <output>{aim.angle}°</output></span>
            <input type="range" className="ar-range" min={0} max={MAX_ANGLE} step={1} value={aim.angle} disabled={!myTurn} onChange={(e) => setAim((a) => ({ ...a, angle: Number(e.target.value) }))} />
          </label>
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Angle up" disabled={!myTurn} onClick={() => nudge('angle', 1)}>+</button>
        </div>
        <div className="ar-dial">
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Power down" disabled={!myTurn} onClick={() => nudge('power', -1)}>−</button>
          <label className="ar-dial__label">
            <span>Power <output>{aim.power}</output></span>
            <input type="range" className="ar-range" min={0} max={MAX_POWER} step={1} value={aim.power} disabled={!myTurn} onChange={(e) => setAim((a) => ({ ...a, power: Number(e.target.value) }))} />
          </label>
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Power up" disabled={!myTurn} onClick={() => nudge('power', 1)}>+</button>
        </div>
        <div className="ar-quiver" role="group" aria-label="Arrow">
          <button type="button" className="button button--light ar-btn ar-pick" aria-pressed={arrow === 'plain'} aria-label={`${arrowKind('plain').name}, never runs out`} onClick={() => setArrow('plain')}>
            <span className="ar-pick__long">{arrowKind('plain').name}</span><span className="ar-pick__short" aria-hidden="true">Plain</span> <small>∞</small>
          </button>
          <button type="button" className="button button--light ar-btn ar-pick" aria-pressed={arrow === 'steel'} aria-label={`${arrowKind('steel').name}, ${steelLeft} left`} disabled={steelLeft <= 0} onClick={() => setArrow('steel')}>
            <span className="ar-pick__long">{arrowKind('steel').name}</span><span className="ar-pick__short" aria-hidden="true">Steel</span> <small>{steelLeft}</small>
          </button>
        </div>
        <button type="button" className="button button--play ar-btn ar-shoot" disabled={!myTurn} onClick={shoot}>Shoot</button>
      </div>

      {phase === 'loading' && !problem && <p className="ar-loading" role="status">{WORLD_HINTS[world]}</p>}

      {problem && (
        <div className="ar-overlay" role="alertdialog" aria-labelledby="ar-problem-title">
          <div className="ar-panel">
            <h2 id="ar-problem-title" ref={dialogHeading} tabIndex={-1}>The battlefield won't start</h2>
            <p>{problem}</p>
            <button type="button" className="button button--play ar-btn" onClick={onExit}>Back</button>
          </div>
        </div>
      )}

      {phase === 'round-over' && (
        <div className="ar-overlay ar-overlay--soft" role="dialog" aria-modal="true" aria-labelledby="ar-round-title">
          <div className="ar-panel">
            <h2 id="ar-round-title" ref={dialogHeading} tabIndex={-1}>{roundWinWords}</h2>
            <p className="ar-score">Rounds: You {run.roundWins[0]} – {run.roundWins[1]} {BOT_NAME}</p>
            <p>First to win 2 rounds wins the fight. The next round has new land and new wind.</p>
            <button type="button" className="button button--play ar-btn" onClick={nextRound}>Next round</button>
          </div>
        </div>
      )}

      {phase === 'fight-over' && (
        <div className="ar-overlay ar-overlay--soft" role="dialog" aria-modal="true" aria-labelledby="ar-end-title">
          <div className="ar-panel">
            <h2 id="ar-end-title" ref={dialogHeading} tabIndex={-1}>{fightWords}</h2>
            <p className="ar-score">Rounds: You {run.roundWins[0]} – {run.roundWins[1]} {BOT_NAME}</p>
            <p>Your score (damage you did): <strong>{score}</strong>{newBest ? <strong> A new best in the {WORLD_NAMES[world]}!</strong> : <> Best here: {best}</>}</p>
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn" onClick={playAgain}>Play again</button>
              <button type="button" className="button button--light ar-btn" onClick={onExit}>Choose another fight</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="ar-overlay" role="dialog" aria-modal="true" aria-labelledby="ar-settings-title" onKeyDown={(e) => e.key === 'Escape' && setSettingsOpen(false)}>
          <div className="ar-panel">
            <h2 id="ar-settings-title" ref={dialogHeading} tabIndex={-1}>Settings</h2>
            <label className="ar-check">
              <input type="checkbox" checked={prefs.simple} onChange={(e) => changePrefs({ ...prefs, simple: e.target.checked })} />
              Simpler graphics (smoother on a slow device)
            </label>
            <label className="ar-check">
              <input type="checkbox" checked={lessMotion} onChange={(e) => changePrefs({ ...prefs, lessMotion: e.target.checked })} />
              Less motion (no shaking or swooping)
            </label>
            <p className="ar-help">Keys: ← → angle, ↑ ↓ power (hold Shift for 5 at a time), space to shoot. On a touch screen, drag back from your archer like pulling a bowstring, then press Shoot.</p>
            <button type="button" className="button button--play ar-btn" onClick={() => { setSettingsOpen(false); heading.current?.focus({ preventScroll: true }); }}>Done</button>
          </div>
        </div>
      )}
    </section>
  );
}
