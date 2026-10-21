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
import { ARROWS, arrowKind } from '../../../shared/archery/arrows';
import { BOT_NAMES, botSetup, type BotLevel } from '../../../shared/archery/bot';
import { APPLE_HEALTH, MAX_ANGLE, MAX_POWER, START_HEALTH } from '../../../shared/archery/config';
import { roundSeeds, startFight, takeShot, type FightRun } from '../../../shared/archery/fight';
import { bowKind, shieldKind } from '../../../shared/archery/gear';
import { copyLand } from '../../../shared/archery/land';
import type { Archer, ArrowId, FightSetup, PlayerSetup, Shot, ShotRecord, WorldId } from '../../../shared/archery/types';
import { startArcheryBot } from './botThread';
import { loadBests, loadPrefs, saveBest, savePrefs, wantsLessMotion, type ArcheryPrefs } from './prefs';
import type { FightView, ViewInsets } from './renderer';
import { ARROW_SHORT, LEVEL_NAMES, WORLD_HINTS, WORLD_NAMES, windWords } from './text';
import './archery.css';

/** A starter bag when none is given: a few Steel Arrows (Plain never runs out), no shield, the Starter Bow. */
export const STARTER_PACK: PlayerSetup = { quiver: { steel: 4 }, shield: null, bow: 'starter' };

type Phase = 'loading' | 'aim' | 'flying' | 'bot' | 'round-over' | 'fight-over';

interface Aim {
  angle: number;
  power: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A new fight's seed. Only the screen picks it (the server will in Stage 4); the rules never use Math.random. */
const freshSeed = () => (Math.random() * 4294967296) >>> 0;

/** What the server said about a finished fight (the game shows it on the fight-over panel). */
export interface FightSaved {
  /** A new best score in this world. */
  best?: boolean;
  /** The best score in this world now. */
  bestScore?: number;
  /** A line to show, e.g. "Saved: +3 points." or why it couldn't be saved. */
  line?: string;
}

export function FightScreen({ world, level, onExit, seed: fixedSeed, pack = STARTER_PACK, onFinished, onLeave, onPlayAgain, onSpeedRound, best: serverBest }: {
  world: WorldId;
  level: BotLevel;
  onExit: () => void;
  /** The fight is over: send its shots to the server (the hub game). Without it, best scores stay on this device. */
  onFinished?: (shots: Shot[]) => Promise<FightSaved>;
  /** Leaving before the fight is over (with the shots so far). Without it, Leave just calls onExit. */
  onLeave?: (shots: Shot[]) => void;
  /** Play again starts a new fight through the game (a new seed from the server). Without it, a new seed here. */
  onPlayAgain?: () => void;
  /** Between rounds: a speed round for coins (the game shows it over the fight). */
  onSpeedRound?: () => void;
  /** The best score in this world, from the server (otherwise from this device). */
  best?: number;
  /** What the player packed for this fight (arrows, helpers, shield, bow). */
  pack?: PlayerSetup;
  /** A fixed seed (for tests); otherwise each fight gets a new one. */
  seed?: number;
}) {
  const [seed, setSeed] = useState(() => fixedSeed ?? freshSeed());
  const setup = useMemo<FightSetup>(() => ({ world, players: [{ ...pack, quiver: { ...pack.quiver } }, botSetup(level)] }), [world, level, pack]);
  const BOT_NAME = BOT_NAMES[level];
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
  const [eatApple, setEatApple] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Who shot the arrow now flying (the rules move the turn on before the picture shows the shot). */
  const [shooter, setShooter] = useState(0);
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const [newBest, setNewBest] = useState(false);
  const [best, setBest] = useState(() => serverBest ?? loadBests()[world] ?? 0);
  const [saveLine, setSaveLine] = useState('');

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
  /** How many of an arrow or helper the player has left in this fight. */
  const left = (id: ArrowId | 'apple' | 'umbrella') => Math.max(0, (setup.players[0].quiver[id] ?? 0) - (run.used[0][id] ?? 0));
  const packed = ARROWS.filter((a) => !a.unlimited && (setup.players[0].quiver[a.id] ?? 0) > 0);
  const specialsLeft = packed.reduce((n, a) => n + left(a.id), 0);
  const applesLeft = left('apple');
  const arrowLeft = arrow === 'plain' ? Infinity : left(arrow);
  const myBow = bowKind(setup.players[0].bow);
  const nextWind = myBow.id === 'hunter' && run.winner === null ? roundSeeds(seed, round.index + 1, world).wind : null;
  const stabbed = (me.shardsBy ?? -1) >= 0 && !me.popped;
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
        view = m.createFightView(el, { lessMotion, simple: prefs.simple, names: ['You', BOT_NAMES[level]] });
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
    if (phase === 'round-over' || phase === 'fight-over' || settingsOpen || pickerOpen || problem) dialogHeading.current?.focus();
  }, [phase, settingsOpen, pickerOpen, problem]);

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
      if ((run.round.archers[0].shardsBy ?? -1) >= 0) setMessage(`Glass shards! Hit ${BOT_NAME} this turn, or you pop.`);
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
    setShooter(player);
    setPhase('flying');
    setMessage('');
    beep('flick');
    const rec = taken.record;
    const ended = taken.ended ?? run.round;
    const landAfter = copyLand(ended.land);
    await view?.playShot({ player, record: rec, landBefore, landAfter, archersBefore, gooAfter: ended.goo });
    if (gone.current) return;
    if (rec.damage[0] + rec.damage[1] > 0) beep('boom');
    setMessage(describeShot(player, rec));
    if (taken.ended) {
      const w = taken.ended.winner;
      if (w === 0 || w === 1) view?.celebrate(w);
      beep(w === 0 ? 'win' : 'end');
      if (run.winner !== null) {
        const finalScore = run.records.reduce((n, r) => n + (r.player === 0 ? r.damage[1] : 0), 0);
        setPhase('fight-over');
        if (onFinished) {
          setSaveLine('Saving your fight…');
          const thisRun = run;
          void onFinished(shots.current.slice()).then((saved) => {
            if (gone.current || runRef.current !== thisRun) return;
            setNewBest(!!saved.best);
            if (saved.bestScore !== undefined) setBest(saved.bestScore);
            setSaveLine(saved.line ?? '');
          });
        } else {
          const isBest = saveBest(world, finalScore);
          setNewBest(isBest);
          setBest(loadBests()[world] ?? finalScore);
        }
      } else setPhase('round-over');
      bump();
      return;
    }
    startTurn();
  }

  function describeShot(player: number, rec: ShotRecord): string {
    const { damage, after } = rec;
    const name = (i: number) => (i === 0 ? 'You' : BOT_NAME);
    const obj = (i: number) => (i === 0 ? 'you' : BOT_NAME);
    const who = name(player);
    const other = player === 0 ? 1 : 0;
    const parts: string[] = [];
    if (rec.apple > 0) parts.push(`${who} ate an Apple (+${rec.apple}).`);
    // Damage to the other archer from the shot itself (goo is told on its own).
    const hitThem = damage[other] - rec.goo[other];
    if (hitThem > 0) parts.push(`${who} hit ${obj(other)} for ${hitThem}.`);
    else parts.push(rec.hit.kind === 'gone' ? `${who} shot off the edge.` : `${who} missed.`);
    const hurtSelf = damage[player] - rec.goo[player] - rec.sting;
    if (hurtSelf > 0) parts.push(`${who} got hurt too (${hurtSelf}).`);
    for (const i of [0, 1]) if (rec.goo[i] > 0) parts.push(`The goo stung ${obj(i)} (${rec.goo[i]}).`);
    for (const i of [0, 1]) if (rec.umbrella[i]) parts.push(`${i === 0 ? 'Your' : `${BOT_NAME}'s`} Umbrella opened.`);
    if (rec.glass === 'broke') parts.push(`${who} hit back and broke the glass shards${rec.sting ? ` (they stung for ${rec.sting})` : ''}.`);
    if (rec.glass === 'popped') parts.push(`${who} didn't hit back, so the glass shards popped ${player === 0 ? 'you' : BOT_NAME}!`);
    if ((after[other].shardsBy ?? -1) === player && rec.shot.arrow === 'glass') parts.push(`Glass shards stuck in ${obj(other)}! ${other === 0 ? 'Hit back next turn, or you pop.' : `${BOT_NAME} must hit back next turn, or pop.`}`);
    if (after[other].popped && rec.glass !== 'popped') parts.push(`${name(other)} popped!`);
    return parts.join(' ');
  }

  function shoot() {
    if (phaseRef.current !== 'aim' || !viewRef.current) return;
    const a = aimRef.current;
    const use: ArrowId = arrow !== 'plain' && left(arrow) <= 0 ? 'plain' : arrow;
    const apple = eatApple && applesLeft > 0 && me.health < START_HEALTH;
    // A special arrow that's now used up falls back to the Plain Arrow for next time.
    if (use !== 'plain' && left(use) <= 1) setArrow('plain');
    else if (use !== arrow) setArrow('plain');
    setEatApple(false);
    void fire({ angle: a.angle, power: a.power, arrow: use, ...(apple ? { apple: true } : {}) });
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

  function leave() {
    if (onLeave && run.winner === null && shots.current.length > 0) onLeave(shots.current.slice());
    else onExit();
  }

  function playAgain() {
    if (onPlayAgain) {
      onPlayAgain();
      return;
    }
    shots.current = [];
    setNewBest(false);
    setArrow('plain');
    setEatApple(false);
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
      if (e.ctrlKey || e.metaKey || e.altKey || settingsOpen || pickerOpen) return;
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
  const turnWords = phase === 'loading' ? 'Getting ready…' : phase === 'aim' ? 'Your turn' : phase === 'bot' ? `${BOT_NAME}'s turn` : phase === 'flying' ? (shooter === 0 ? 'Your shot' : `${BOT_NAME}'s shot`) : 'Round over';
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
        <div className="ar-card" data-turn={(phase === 'flying' ? shooter : round.turn) === 0 && phase !== 'round-over' && phase !== 'fight-over' ? true : undefined}>
          <span className="ar-card__name">You</span>
          <span className="ar-bar" role="meter" aria-label="Your health" aria-valuemin={0} aria-valuemax={START_HEALTH} aria-valuenow={me.health}>
            <span className="ar-bar__fill" style={{ width: healthPct(me.health) }} data-low={me.health < 35 || undefined} />
          </span>
          <span className="ar-card__num">{me.health}</span>
          {me.guard && <ShieldPips archer={me} who="Your" />}
          <span className="ar-wins" aria-label={`Rounds won: ${run.roundWins[0]}`}>{'★'.repeat(run.roundWins[0])}</span>
        </div>
        <div className="ar-mid">
          <span className="ar-turn" data-bot={(phase === 'flying' ? shooter : round.turn) === 1 || undefined} aria-live="polite">{turnWords}</span>
          <span className="ar-wind" aria-label={windWords(wind)}>
            <span aria-hidden="true">Wind</span>
            <span className="ar-wind__arrow" aria-hidden="true" data-dir={wind > 0 ? 'right' : wind < 0 ? 'left' : 'none'}>{wind > 0 ? '→' : wind < 0 ? '←' : '·'}</span>
            <b aria-hidden="true">{Math.abs(wind)}</b>
          </span>
          {nextWind !== null && (
            <span className="ar-nextwind" title="Hunter's Bow: next round's wind">
              Next: {nextWind > 0 ? '→' : nextWind < 0 ? '←' : '·'} {Math.abs(nextWind)}
              <span className="ar-sr"> ({windWords(nextWind)} next round, from your Hunter's Bow)</span>
            </span>
          )}
          <span className="ar-round">Round {round.index + 1}</span>
        </div>
        <div className="ar-card ar-card--bot" data-turn={(phase === 'flying' ? shooter : round.turn) === 1 && phase !== 'round-over' && phase !== 'fight-over' ? true : undefined}>
          <span className="ar-card__name">{botLabel}</span>
          <span className="ar-bar" role="meter" aria-label={`${BOT_NAME}'s health`} aria-valuemin={0} aria-valuemax={START_HEALTH} aria-valuenow={them.health}>
            <span className="ar-bar__fill" style={{ width: healthPct(them.health) }} data-low={them.health < 35 || undefined} />
          </span>
          <span className="ar-card__num">{them.health}</span>
          {them.guard && <ShieldPips archer={them} who={`${BOT_NAME}'s`} />}
          <span className="ar-wins" aria-label={`Rounds won: ${run.roundWins[1]}`}>{'★'.repeat(run.roundWins[1])}</span>
        </div>
        <div className="ar-topbtns">
          <button type="button" className="button button--light ar-btn ar-iconbtn" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>⚙</button>
          <button type="button" className="button button--light ar-btn" onClick={leave}>Leave</button>
        </div>
      </div>

      <p className="ar-toast" role="status" aria-live="polite">{message}</p>
      {stabbed && myTurn && <p className="ar-warn" role="alert">Glass shards! Hit {BOT_NAME} this turn, or you pop.</p>}
      <p className="ar-rotate">Turn your phone sideways for a bigger view.</p>

      <div ref={bottom} className="ar-bottom">
        <div className="ar-stats" aria-label="Your fight">
          <span className="ar-stat"><span>Arrows</span><b aria-label={`${specialsLeft} special arrows left`}>{specialsLeft}</b></span>
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
        <div className="ar-quiver" role="group" aria-label="Arrow and helpers">
          <button type="button" className="button button--light ar-btn ar-pick" aria-haspopup="dialog" aria-label={`Arrow: ${arrowKind(arrow).name}, ${arrow === 'plain' ? 'never runs out' : `${arrowLeft} left`}. Choose another arrow`} onClick={() => setPickerOpen(true)}>
            <span className="ar-pick__long">{arrowKind(arrow).name}</span><span className="ar-pick__short" aria-hidden="true">{ARROW_SHORT[arrow]}</span> <small>{arrow === 'plain' ? '∞' : arrowLeft}</small> <span aria-hidden="true">▾</span>
          </button>
          {(setup.players[0].quiver.apple ?? 0) > 0 && (
            <button type="button" className="button button--light ar-btn ar-pick" aria-pressed={eatApple} disabled={applesLeft <= 0 || me.health >= START_HEALTH} aria-label={`Eat an Apple with this shot (+${APPLE_HEALTH} health), ${applesLeft} left`} onClick={() => setEatApple((v) => !v)}>
              <span aria-hidden="true">Apple</span> <small aria-hidden="true">{applesLeft}</small>
            </button>
          )}
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
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn" onClick={nextRound}>Next round</button>
              {onSpeedRound && <button type="button" className="button button--light ar-btn" onClick={onSpeedRound}>Speed round for coins</button>}
            </div>
          </div>
        </div>
      )}

      {phase === 'fight-over' && (
        <div className="ar-overlay ar-overlay--soft" role="dialog" aria-modal="true" aria-labelledby="ar-end-title">
          <div className="ar-panel">
            <h2 id="ar-end-title" ref={dialogHeading} tabIndex={-1}>{fightWords}</h2>
            <p className="ar-score">Rounds: You {run.roundWins[0]} – {run.roundWins[1]} {BOT_NAME}</p>
            <p>Your score (damage you did): <strong>{score}</strong>{newBest ? <strong> A new best in the {WORLD_NAMES[world]}!</strong> : <> Best here: {best}</>}</p>
            {saveLine && <p className="ar-help" role="status">{saveLine}</p>}
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn" onClick={playAgain}>Play again</button>
              <button type="button" className="button button--light ar-btn" onClick={onExit}>Choose another fight</button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="ar-overlay" role="dialog" aria-modal="true" aria-labelledby="ar-picker-title" onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}>
          <div className="ar-panel ar-panel--wide">
            <h2 id="ar-picker-title" ref={dialogHeading} tabIndex={-1}>Choose an arrow</h2>
            <div className="ar-arrows">
              {[arrowKind('plain'), ...packed].map((a) => {
                const n = a.unlimited ? Infinity : left(a.id);
                return (
                  <button key={a.id} type="button" className="button button--light ar-btn ar-arrow" aria-pressed={arrow === a.id} disabled={n <= 0} onClick={() => { setArrow(a.id); setPickerOpen(false); heading.current?.focus({ preventScroll: true }); }}>
                    <b>{a.name}</b> <span className="ar-arrow__n">{a.unlimited ? '∞' : `${n} left`}</span>
                    <span className="ar-arrow__does">{a.does}</span>
                  </button>
                );
              })}
            </div>
            {packed.length === 0 && <p className="ar-help">You didn't pack any special arrows for this fight.</p>}
            <button type="button" className="button button--light ar-btn" onClick={() => { setPickerOpen(false); heading.current?.focus({ preventScroll: true }); }}>Back</button>
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

/** A shield's points, next to an archer's health. */
export function ShieldPips({ archer, who }: { archer: Archer; who: string }) {
  const kind = shieldKind(archer.guard!);
  return (
    <span className="ar-shield" data-kind={kind.id} role="meter" aria-label={`${who} ${kind.name}`} aria-valuemin={0} aria-valuemax={kind.soak} aria-valuenow={archer.shield}>
      <span className="ar-shield__fill" style={{ width: `${Math.round((archer.shield / kind.soak) * 100)}%` }} />
    </span>
  );
}
