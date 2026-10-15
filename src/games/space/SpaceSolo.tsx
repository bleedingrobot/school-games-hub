/**
 * Wormholes & Black Holes against 1–3 bots, played on this device from a seed.
 *
 * The rules engine decides everything. This screen only shows what happened: each action
 * gives a list of events, and they're played one at a time (dice, hops, wormholes, items…)
 * before the next action. Rocket positions on screen come from the events, and the panels
 * catch up with the engine's state at the end of each list.
 *
 * Saving: with `saving`, each game is played from a stamped seed the server hands out, and
 * at the end the student's actions go back to the server, which replays the game before
 * saving it (shared/space/save.ts). No seed (no Wi-Fi, or the stand-alone preview) means a
 * practice game that isn't saved.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { randomAvatar } from '../../avatar/avatarParts';
import { useSound } from '../../sound';
import type { BotLevel } from '../../../shared/botGame';
import { BOT_NAMES } from '../../../shared/space/bot';
import {
  FUEL_WARNING_ROUNDS,
  itemProblem,
  missionRounds,
  SpaceRuleError,
  usableItems,
  validTargets,
  KEEP_ITEMS,
  type SpaceAction,
  type SpaceEvent,
  type SpaceState,
} from '../../../shared/space/engine';
import { ITEMS, type ItemKind } from '../../../shared/space/items';
import { randomFromSeed } from '../../../shared/space/random';
import { encodeAction, type SpaceGameReport } from '../../../shared/space/save';
import { playSound, type GameSound } from '../sounds';
import { startSpaceBot, type SpaceBot } from './botThread';
import { Dice, DieFace } from './Dice';
import { loadLessMotion, loadPrefs, saveLessMotion, savePrefs, setupFrom, SPEED_SCALE, type SpacePrefs } from './prefs';
import { SeatShapeIcon, SpaceBoard, type RocketFx, type Seat } from './SpaceBoard';
import { SpaceSettings } from './SpaceSettings';
import { botPlay, botQuestion, decideBot, isStudentsTurn, newSeed, startRun, studentPlay, type SoloRun } from './soloRun';
import {
  bannerFor,
  choiceQuestion,
  describe,
  GRAVITY_BADGE,
  ITEM_EMOJI,
  ITEM_HELP,
  ITEM_SHORT,
  itemName,
  ORDINAL,
  SEAT_COLOURS,
  SEAT_SHAPES,
  SHAPE_NAMES,
  squareInfo,
} from './text';
import './space.css';

export interface SpacePlayer {
  name: string;
  avatar: unknown;
}

/** How games get saved. Left out (the preview), every game is a practice game. */
export interface SpaceSaving {
  /** A stamped seed from the server, or null if there isn't one to be had. */
  seed(): Promise<{ seed: string; stamp: string } | null>;
  /** Saves a finished game. Throws an error with a message for the student if it can't. */
  save(report: SpaceGameReport): Promise<{ countsForPoints?: boolean } | void>;
  /** Records a game the student left part-way, even while the page is closing. */
  abandon(report: SpaceGameReport): void;
}

const isOver = (run: SoloRun) => run.state.phase === 'over';

type SaveStatus = 'practice' | 'playing' | 'saving' | 'saved' | 'saved-no-points' | 'error';

const CALLSIGNS = ['Kea', 'Tūī', 'Weka'];
/** Bots think for about a second (Normal speed). */
const BOT_THINK_MS = { min: 800, extra: 400 };
const LOG_LENGTH = 80;

type Phase = 'animating' | 'thinking' | 'student' | 'over';

interface Batch {
  events: SpaceEvent[];
  state: SpaceState;
}

interface RocketView {
  pos: number;
  fx: RocketFx;
  ms: number;
}

interface LogLine {
  id: number;
  text: string;
  mine: boolean;
}

interface Game {
  key: number;
  seats: Seat[];
  studentSeat: number;
  level: BotLevel;
}

type Picking = { item: ItemKind; kind: 'target' | 'navigator' };

function makeSeats(run: SoloRun, player: SpacePlayer, level: BotLevel): Seat[] {
  let bot = 0;
  return run.state.rockets.map((_, i) => {
    const isStudent = i === run.studentSeat;
    const base = { colour: SEAT_COLOURS[i], shape: SEAT_SHAPES[i], isStudent };
    if (isStudent) return { ...base, name: player.name, avatar: player.avatar };
    const callsign = CALLSIGNS[bot++];
    return { ...base, name: `${BOT_NAMES[level]} ${callsign}`, avatar: randomAvatar(randomFromSeed(`${run.setup.seed}:avatar:${i}`)) };
  });
}

/** Squares a rocket hops through, one at a time (bouncing back off the end if it overshot). */
function hopPath(from: number, to: number, size: number, steps: number | null, bounced: boolean): number[] {
  const path: number[] = [];
  if (bounced && steps !== null) {
    for (let n = from + 1; n <= size; n++) path.push(n);
    for (let n = size - 1; n >= to; n--) path.push(n);
    return path;
  }
  const step = to >= from ? 1 : -1;
  for (let n = from + step; step > 0 ? n <= to : n >= to; n += step) path.push(n);
  return path;
}

/** Arrow keys move between the buttons in a group. */
function arrowKeys(event: ReactKeyboardEvent<HTMLElement>) {
  const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  if (!back && !forward) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if (buttons.length === 0) return;
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = i < 0 ? 0 : (i + (forward ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
  event.preventDefault();
}

export function SpaceSolo({
  player,
  level,
  onLevelChange,
  saving,
  timeScale = 1,
}: {
  player: SpacePlayer;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  saving?: SpaceSaving;
  /** Tests set this to 0 so animations don't wait. */
  timeScale?: number;
}) {
  const { soundOn } = useSound();
  const [prefs, setPrefsState] = useState<SpacePrefs>(loadPrefs);
  const [lessMotion, setLessMotionState] = useState(loadLessMotion);
  const [problem, setProblem] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [view, setView] = useState<SpaceState | null>(null);
  const [rockets, setRockets] = useState<RocketView[]>([]);
  const [turnSeat, setTurnSeat] = useState<number | null>(null);
  const [dice, setDice] = useState<{ values: number[]; rolling: boolean; seat: number } | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [toast, setToast] = useState<{ emoji: string; text: string; id: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [phase, setPhaseState] = useState<Phase>('animating');
  const [picking, setPicking] = useState<Picking | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showPodium, setShowPodium] = useState(false);
  const [info, setInfo] = useState<{ n: number; title: string; text: string } | null>(null);
  const [hint, setHint] = useState('');
  const [starting, setStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('practice');
  const [saveMessage, setSaveMessage] = useState('');

  const runRef = useRef<SoloRun | null>(null);
  const gameRef = useRef<Game | null>(null);
  const keyRef = useRef(0);
  const queue = useRef<Batch[]>([]);
  const pumpingFor = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('animating');
  const rocketsRef = useRef<RocketView[]>([]);
  const botRef = useRef<SpaceBot | null>(null);
  const nextId = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const live = useRef({ scale: 1, calm: false, sound: false });
  /** The current game's stamp; null for a practice game. */
  const stampRef = useRef<string | null>(null);
  /** Seeds already sent to the server (finished or left), so nothing is sent twice. */
  const sentRef = useRef(new Set<string>());
  const startingRef = useRef(false);
  live.current = { scale: SPEED_SCALE[prefs.speed] * timeScale, calm: lessMotion, sound: soundOn };

  useEffect(() => {
    botRef.current = startSpaceBot();
    return () => {
      keyRef.current++; // stops any game still animating
      botRef.current?.close();
      botRef.current = null;
    };
  }, []);

  function reportFor(run: SoloRun, ending: SpaceGameReport['ending']): SpaceGameReport | null {
    const stamp = stampRef.current;
    if (!stamp) return null;
    const { seed, board, settings, bots, level: botLevel } = run.setup;
    return { game: 'space', seed, stamp, board, settings, bots, level: botLevel, actions: run.studentActions.map(encodeAction), ending };
  }

  /** Saves the game once the rules engine says it's over (before the animations finish). */
  async function saveFinished(run: SoloRun) {
    const report = reportFor(run, 'finished');
    if (!saving || !report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    const mine = runRef.current === run;
    if (mine) setSaveStatus('saving');
    try {
      const answer = await saving.save(report);
      if (runRef.current === run) setSaveStatus(answer && answer.countsForPoints === false ? 'saved-no-points' : 'saved');
    } catch (error) {
      if (runRef.current !== run) return;
      setSaveMessage(error instanceof Error && error.message ? error.message : 'We couldn’t save this game.');
      setSaveStatus('error');
    }
  }

  /** If the student leaves a game part-way (after doing something), it's recorded as left early. */
  const leftEarly = useRef(() => {});
  leftEarly.current = () => {
    const run = runRef.current;
    if (!saving || !run || run.state.phase === 'over' || run.studentActions.length === 0) return;
    const report = reportFor(run, 'abandoned');
    if (!report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    saving.abandon(report);
  };
  useEffect(() => {
    const onHide = () => leftEarly.current();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, []);

  function setPrefs(next: SpacePrefs) {
    setPrefsState(next);
    savePrefs(next);
  }
  function setLessMotion(on: boolean) {
    setLessMotionState(on);
    saveLessMotion(on);
  }
  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms * live.current.scale));
  const sound = (name: GameSound) => {
    if (live.current.sound) playSound(name);
  };
  function setRocket(seat: number, patch: Partial<RocketView>) {
    rocketsRef.current = rocketsRef.current.map((r, i) => (i === seat ? { ...r, ...patch } : r));
    setRockets(rocketsRef.current);
  }
  function addLog(text: string, mine: boolean) {
    const line = { id: nextId.current++, text, mine };
    setLog((lines) => [...lines.slice(-(LOG_LENGTH - 1)), line]);
  }
  function showToast(emoji: string, text: string) {
    setToast({ emoji, text, id: nextId.current++ });
  }

  // ---------- Playing the events ----------

  /** Slides a rocket straight to a square (wormholes, black holes, pushes, items). */
  async function slide(seat: number, to: number, ms: number) {
    setRocket(seat, { pos: to, ms: ms * live.current.scale, fx: rocketsRef.current[seat].fx ?? 'slide' });
    await wait(ms + 60);
  }

  async function hop(seat: number, from: number, to: number, steps: number | null, bounced: boolean, size: number) {
    if (live.current.calm) {
      await slide(seat, to, 450);
      setRocket(seat, { fx: null });
      return;
    }
    const hopMs = 170;
    setRocket(seat, { fx: 'hop' });
    for (const n of hopPath(from, to, size, steps, bounced)) {
      setRocket(seat, { pos: n, ms: hopMs * 0.8 * live.current.scale });
      await wait(hopMs);
    }
    setRocket(seat, { fx: null });
  }

  async function effect(seat: number, fx: RocketFx, ms: number) {
    setRocket(seat, { fx });
    await wait(ms);
  }

  function patchView(change: (s: SpaceState) => SpaceState) {
    setView((v) => (v ? change(v) : v));
  }

  async function show(event: SpaceEvent, lastSteps: { value: number | null }, size: number) {
    const g = gameRef.current!;
    const names = g.seats.map((s) => s.name);
    const line = describe(event, names);
    const seatOf = 'seat' in event ? event.seat : null;
    if (line) addLog(line, seatOf === g.studentSeat || (event.kind === 'pushed' && event.source === g.studentSeat));

    switch (event.kind) {
      case 'round-start':
        return;
      case 'turn-start':
        setTurnSeat(event.seat);
        return wait(event.seat === g.studentSeat ? 100 : 250);
      case 'dice':
        setDice({ values: event.dice, rolling: true, seat: event.seat });
        sound('move');
        await wait(600);
        setDice({ values: event.dice, rolling: false, seat: event.seat });
        return wait(250);
      case 'roll':
        lastSteps.value = event.steps;
        if (event.changes.length > 0) {
          showToast('🎲', `${event.die} → ${event.steps}`);
          return wait(700);
        }
        return;
      case 'move':
        if (event.cause === 'roll' || event.cause === 'bounce') {
          return hop(event.seat, event.from, event.to, lastSteps.value, !!event.bounced, size);
        }
        await slide(event.seat, event.to, 650);
        return setRocket(event.seat, { fx: null });
      case 'wormhole':
        sound('alert');
        await effect(event.seat, 'swirl', 450);
        await slide(event.seat, event.to, 750);
        return setRocket(event.seat, { fx: null });
      case 'black-hole':
        sound('capture');
        await effect(event.seat, 'spaghetti', 550);
        await slide(event.seat, event.to, 750);
        return setRocket(event.seat, { fx: null });
      case 'force-field':
        showToast('🛡️', 'Force Field!');
        await effect(event.seat, 'shield', 900);
        return setRocket(event.seat, { fx: null });
      case 'star':
        await effect(event.seat, 'sparkle', 450);
        return setRocket(event.seat, { fx: null });
      case 'item-gained':
        if (event.seat === g.studentSeat || event.from !== 'matariki') {
          showToast(ITEM_EMOJI[event.item], `${names[event.seat]} got ${itemName(event.item)}`);
          sound('move');
        }
        return wait(event.from === 'matariki' ? 350 : 900);
      case 'item-used':
        showToast(ITEM_EMOJI[event.item], `${itemName(event.item)}!`);
        return wait(800);
      case 'item-lost':
      case 'pockets-full':
      case 'item-swapped':
      case 'item-declined':
        return wait(500);
      case 'pushed':
        setRocket(event.seat, { fx: 'bump' });
        await slide(event.seat, event.to, 450);
        return setRocket(event.seat, { fx: null });
      case 'swapped':
        setRocket(event.seat, { pos: event.to, ms: 600 * live.current.scale, fx: 'slide' });
        await slide(event.target, event.from, 600);
        setRocket(event.seat, { fx: null });
        return setRocket(event.target, { fx: null });
      case 'gravity':
      case 'anchored':
      case 'repaired':
      case 'binary-ready':
        await effect(event.seat, 'sparkle', 500);
        return setRocket(event.seat, { fx: null });
      case 'gate':
      case 'mystery':
      case 'comet':
        await effect(event.seat, 'swirl', 300);
        await slide(event.seat, event.to, 650);
        return setRocket(event.seat, { fx: null });
      case 'gate-stay':
        return wait(300);
      case 'comet-moved':
        patchView((v) => (v.comet ? { ...v, comet: { ...v.comet, head: event.head } } : v));
        return wait(200);
      case 'mine-placed':
        patchView((v) => ({ ...v, mines: [...v.mines, { square: event.square, owner: event.seat, round: v.round }] }));
        return wait(500);
      case 'mine-fizzled':
        patchView((v) => ({ ...v, mines: v.mines.filter((m) => m.square !== event.square) }));
        return wait(300);
      case 'asteroid':
        await effect(event.seat, 'bump', 500);
        return setRocket(event.seat, { fx: null });
      case 'supernova-spent':
        patchView((v) => ({ ...v, board: { ...v.board, squares: { ...v.board.squares, [event.square]: { kind: 'nebula' } } } }));
        return wait(300);
      case 'chain-cap':
        return wait(500);
      case 'roll-again':
        showToast('🎲', 'Roll again!');
        return wait(700);
      case 'cosmic': {
        const squares = event.squares;
        if (event.event === 'meteor-shower' && squares) patchView((v) => ({ ...v, asteroids: squares }));
        const { wormhole, to } = event;
        if (event.event === 'wormhole-shift' && wormhole !== undefined && to !== undefined) {
          patchView((v) => ({ ...v, board: { ...v.board, squares: { ...v.board.squares, [wormhole]: { kind: 'wormhole', to } } } }));
        }
        sound('alert');
        setBanner(bannerFor(event));
        await wait(1800);
        return setBanner(null);
      }
      case 'fuel-warning':
        sound('alert');
        setBanner(bannerFor(event));
        await wait(1500);
        return setBanner(null);
      case 'docked':
        sound(event.seat === g.studentSeat ? 'win' : 'end');
        await effect(event.seat, 'docked', 1000);
        return;
      case 'game-over':
      case 'choice':
      case 'timeout':
      case 'question':
        return;
    }
  }

  async function animate(batch: Batch, key: number) {
    const lastSteps = { value: null as number | null };
    const size = batch.state.board.size;
    for (const event of batch.events) {
      if (key !== keyRef.current) return;
      await show(event, lastSteps, size);
    }
    if (key !== keyRef.current) return;
    setView(batch.state);
    rocketsRef.current = batch.state.rockets.map((r, i) => ({
      pos: r.position,
      fx: batch.state.phase === 'over' ? rocketsRef.current[i].fx : null,
      ms: 0,
    }));
    setRockets(rocketsRef.current);
    if (batch.state.phase !== 'over') setTurnSeat(batch.state.turn);
    setToast(null);
  }

  /** Plays queued events, then the bots, until it's the student's turn or the game ends. */
  async function pump() {
    const key = keyRef.current;
    if (pumpingFor.current === key) return;
    pumpingFor.current = key;
    try {
      for (;;) {
        if (key !== keyRef.current) return;
        const batch = queue.current.shift();
        if (batch) {
          setPhase('animating');
          await animate(batch, key);
          continue;
        }
        const run = runRef.current!;
        if (run.state.phase === 'over') {
          void saveFinished(run);
          setPhase('over');
          setTurnSeat(null);
          await wait(400);
          if (key === keyRef.current) setShowPodium(true);
          return;
        }
        if (isStudentsTurn(run)) {
          setPhase('student');
          return;
        }
        setPhase('thinking');
        const started = Date.now();
        botRef.current ??= startSpaceBot();
        const question = botQuestion(run);
        const answer = await botRef.current.decide(question);
        const think = (BOT_THINK_MS.min + Math.random() * BOT_THINK_MS.extra) * Math.min(1, live.current.scale);
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, think - (Date.now() - started))));
        if (key !== keyRef.current) return;
        let events: SpaceEvent[];
        try {
          events = botPlay(run, answer);
        } catch {
          // Something went wrong with the worker's answer: think again on the page.
          events = botPlay(run, decideBot(question));
        }
        queue.current.push({ events, state: run.state });
        if (isOver(run)) void saveFinished(run);
      }
    } finally {
      if (pumpingFor.current === key) pumpingFor.current = null;
    }
  }

  // ---------- Starting and acting ----------

  async function start() {
    if (startingRef.current) return;
    const setup = setupFrom(prefs);
    if ('problem' in setup) {
      setProblem(setup.problem);
      return;
    }
    leftEarly.current();
    let stamped: { seed: string; stamp: string } | null = null;
    if (saving) {
      startingRef.current = true;
      setStarting(true);
      keyRef.current++; // stops the old game while the seed comes
      stamped = await saving.seed().catch(() => null);
      startingRef.current = false;
      setStarting(false);
    }
    let started: ReturnType<typeof startRun>;
    try {
      started = startRun({ seed: stamped?.seed ?? newSeed(), board: setup.board, settings: setup.settings, bots: prefs.bots, level });
    } catch {
      setProblem('We couldn’t make that galaxy. Try another code.');
      return;
    }
    stampRef.current = stamped?.stamp ?? null;
    setSaveStatus(stamped ? 'playing' : 'practice');
    setSaveMessage('');
    const { run, events } = started;
    const key = ++keyRef.current;
    const next: Game = { key, seats: makeSeats(run, player, level), studentSeat: run.studentSeat, level };
    runRef.current = run;
    gameRef.current = next;
    queue.current = [{ events, state: run.state }];
    rocketsRef.current = run.state.rockets.map((r) => ({ pos: r.position, fx: null, ms: 0 }));
    setRockets(rocketsRef.current);
    setProblem('');
    setGame(next);
    setView(run.state);
    setTurnSeat(run.state.turn);
    setLog([]);
    setDice(null);
    setToast(null);
    setBanner(null);
    setPicking(null);
    setConfirming(false);
    setShowPodium(false);
    setInfo(null);
    setHint('');
    window.scrollTo({ top: 0 });
    void pump();
  }

  function leave() {
    leftEarly.current();
    keyRef.current++;
    runRef.current = null;
    gameRef.current = null;
    setGame(null);
    setView(null);
  }

  function act(action: SpaceAction) {
    const run = runRef.current;
    if (!run || phaseRef.current !== 'student') return;
    let events: SpaceEvent[];
    try {
      events = studentPlay(run, action);
    } catch (error) {
      if (error instanceof SpaceRuleError) {
        setHint(error.message);
        return;
      }
      throw error;
    }
    setPhase('animating');
    setHint('');
    setPicking(null);
    setInfo(null);
    queue.current.push({ events, state: run.state });
    void pump();
  }

  function chooseItem(item: ItemKind) {
    const run = runRef.current;
    if (!run || phaseRef.current !== 'student') return;
    const problem = itemProblem(run.state, item);
    if (problem) {
      setHint(problem);
      return;
    }
    if (ITEMS[item].targeted) setPicking({ item, kind: 'target' });
    else if (item === 'navigator') setPicking({ item, kind: 'navigator' });
    else act({ kind: 'use-item', item });
  }

  // Keyboard: Space/Enter rolls, 1–3 use items, Escape closes things.
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    if (!game || !view) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) return;
    if (event.key === 'Escape') {
      if (picking) setPicking(null);
      else if (info) setInfo(null);
      else if (confirming) setConfirming(false);
      else if (showPodium) setShowPodium(false);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const myTurn = phaseRef.current === 'student';
    if (event.key === ' ' || event.key === 'Enter') {
      if (target?.closest('button, a, summary')) return;
      if (myTurn && view.phase === 'ready' && !picking) {
        event.preventDefault();
        act({ kind: 'roll' });
      }
      return;
    }
    if (!/^[1-6]$/.test(event.key) || !myTurn) return;
    const n = Number(event.key);
    if (picking?.kind === 'navigator') {
      event.preventDefault();
      act({ kind: 'use-item', item: 'navigator', value: n });
    } else if (view.phase === 'choice' && view.pending) {
      const kind = view.pending.kind;
      if ((kind === 'mystery' && n <= 3) || (kind === 'binary' && n <= 2)) {
        event.preventDefault();
        act({ kind: 'choose', option: n - 1 });
      }
    } else if (view.phase === 'ready' && !picking && n <= 3) {
      const item = view.rockets[gameRef.current!.studentSeat].items[n - 1];
      if (item) {
        event.preventDefault();
        chooseItem(item);
      }
    }
  };
  useEffect(() => {
    if (!game) return;
    const onKey = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  // When a choice or a picker opens, put keyboard focus on its first button.
  const choiceKey = phase === 'student' && view ? `${view.turnsTaken}:${view.phase}:${view.pending?.kind ?? ''}:${picking?.item ?? ''}` : '';
  useEffect(() => {
    if (!choiceKey) return;
    panelRef.current?.querySelector<HTMLButtonElement>('.space-choice button')?.focus({ preventScroll: true });
  }, [choiceKey]);

  // ---------- Settings screen ----------

  if (!game || !view) {
    return (
      <SpaceSettings
        prefs={prefs}
        onChange={setPrefs}
        level={level}
        onLevelChange={onLevelChange}
        lessMotion={lessMotion}
        onLessMotion={setLessMotion}
        problem={problem}
        onStart={() => void start()}
        starting={starting}
        saving={!!saving}
      />
    );
  }

  // ---------- The game ----------

  const { seats, studentSeat } = game;
  const me = view.rockets[studentSeat];
  const myTurn = phase === 'student';
  const pending = myTurn && view.phase === 'choice' ? view.pending : null;
  const canRoll = myTurn && view.phase === 'ready' && !picking;
  const usable = myTurn && view.phase === 'ready' ? usableItems(view, studentSeat) : [];
  const targets = myTurn && picking?.kind === 'target' ? validTargets(view, picking.item, studentSeat) : [];
  const positions = rockets.map((r) => r.pos);
  const cosmic = view.settings.mode === 'cosmic';
  const totalRounds = missionRounds(view);
  const roundsLeft = Math.max(0, totalRounds - view.round + 1);
  const over = view.phase === 'over' && phase === 'over';
  const places = view.places ?? [];

  let status: string;
  if (over) {
    const place = places[studentSeat];
    status = place === 1 ? 'You won! 🏆' : `You came ${ORDINAL[place]}.`;
  } else if (pending) status = choiceQuestion(pending);
  else if (picking?.kind === 'target') status = `Who should the ${itemName(picking.item)} hit? Tap a rocket.`;
  else if (picking?.kind === 'navigator') status = 'Navigator: pick your roll.';
  else if (myTurn && view.turnInfo.rollAgainUsed && !view.turnInfo.rolled) status = 'You rolled a 6: roll again!';
  else if (myTurn && view.turnInfo.itemUsed) status = 'Now roll!';
  else if (myTurn) status = usable.length > 0 ? 'Your turn! Use an item, or roll.' : 'Your turn! Roll the dice.';
  else if (phase === 'thinking' && turnSeat !== null) status = `${seats[turnSeat].name} is thinking…`;
  else if (turnSeat !== null && turnSeat !== studentSeat) status = `${seats[turnSeat].name}’s turn`;
  else status = 'Off you go…';

  const boardLabel = `${view.board.name} board, ${view.board.size} squares. ${seats
    .map((s, i) => `${s.isStudent ? 'You are' : `${s.name} is`} on square ${positions[i]}`)
    .join('. ')}.`;

  return (
    <div
      className={`space-game${lessMotion ? ' is-calm' : ''}`}
      style={{ '--rows': view.board.size / 10 } as CSSProperties}
    >
      <div className="space-game__board">
        <SpaceBoard
          state={view}
          seats={seats}
          positions={positions}
          fx={rockets.map((r) => r.fx)}
          moveMs={rockets.map((r) => r.ms)}
          turn={over ? null : turnSeat}
          targets={targets}
          onTarget={(seat) => picking && act({ kind: 'use-item', item: picking.item, target: seat })}
          onSquare={(n) => setInfo(info?.n === n ? null : { n, ...squareInfo(view, n, seats.map((s) => s.name)) })}
          selected={info?.n ?? null}
          label={boardLabel}
        />
        {banner && (
          <div className="space-banner" aria-hidden="true">
            {banner}
          </div>
        )}
        {toast && (
          <div key={toast.id} className="space-toast" aria-hidden="true">
            <span className="space-toast__emoji">{toast.emoji}</span> {toast.text}
          </div>
        )}
        {info && (
          <div className="space-info" role="note">
            <strong>{info.title}</strong>
            <span>{info.text}</span>
            <button type="button" className="space-info__close" onClick={() => setInfo(null)} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {over && showPodium && (
          <Podium
            seats={seats}
            places={places}
            studentSeat={studentSeat}
            ending={view.ending}
            onAgain={() => void start()}
            saveNote={saveNote(saveStatus, saveMessage, !!saving)}
            onLook={() => setShowPodium(false)}
            onSettings={leave}
          />
        )}
      </div>

      <aside className="space-game__side" aria-label="Game controls">
        <section className="space-panel space-turn" ref={panelRef} aria-label="Your turn">
          <p className={`turn-status${myTurn ? ' is-mine' : ''}`} role="status" aria-live="polite">
            {status}
          </p>
          <div className="space-turn__row">
            <div className="space-turn__dice">
              {dice ? <Dice values={dice.values} rolling={dice.rolling} calm={lessMotion} /> : <DieFace value={6} />}
              {dice && <span className="space-turn__who">{seats[dice.seat].isStudent ? 'You' : seats[dice.seat].name}</span>}
            </div>
            {over ? (
              <button type="button" className="button button--primary space-roll" onClick={() => setShowPodium(true)}>
                🏆 Places
              </button>
            ) : (
              <button
                type="button"
                className="button button--play space-roll"
                disabled={!canRoll}
                onClick={() => act({ kind: 'roll' })}
                aria-keyshortcuts="Space"
              >
                🎲 {view.turnInfo.rollAgainUsed && myTurn && !view.turnInfo.rolled ? 'Roll again' : 'Roll'}
              </button>
            )}
          </div>
          {hint && (
            <p className="chess-note" role="alert">
              {hint}
            </p>
          )}

          {pending && <Choice pending={pending} items={me.items} onChoose={(option) => act({ kind: 'choose', option })} />}

          {picking?.kind === 'target' && (
            <div className="space-choice" role="group" aria-label="Pick a rocket to aim at" onKeyDown={arrowKeys}>
              {targets.map((seat) => (
                <button
                  key={seat}
                  type="button"
                  className="button button--light space-choice__button"
                  onClick={() => act({ kind: 'use-item', item: picking.item, target: seat })}
                >
                  <SeatShapeIcon shape={seats[seat].shape} colour={seats[seat].colour} />
                  {seats[seat].name} (square {positions[seat]})
                </button>
              ))}
              <button type="button" className="link-button" onClick={() => setPicking(null)}>
                Cancel
              </button>
            </div>
          )}

          {picking?.kind === 'navigator' && (
            <div className="space-choice space-choice--numbers" role="group" aria-label="Pick your roll" onKeyDown={arrowKeys}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="space-die-button"
                  onClick={() => act({ kind: 'use-item', item: 'navigator', value: n })}
                  aria-label={`Roll ${n}`}
                >
                  <DieFace value={n} size={48} />
                </button>
              ))}
              <button type="button" className="link-button" onClick={() => setPicking(null)}>
                Cancel
              </button>
            </div>
          )}

          {cosmic && (
            <div className="space-items" role="group" aria-label={`Your items, ${me.items.length} of 3`}>
              {me.items.length === 0 ? (
                <p className="space-panel__empty">No items yet. Land on a star to get one!</p>
              ) : (
                <ul className="space-items__list" onKeyDown={arrowKeys}>
                  {me.items.map((item, i) => (
                    <li key={`${item}-${i}`}>
                      <button
                        type="button"
                        className={`space-item${ITEMS[item].kind === 'hinder' ? ' is-hinder' : ''}${ITEMS[item].rare ? ' is-rare' : ''}`}
                        disabled={!(usable.includes(item) && !picking)}
                        onClick={() => chooseItem(item)}
                        aria-keyshortcuts={String(i + 1)}
                        aria-label={`${itemName(item)}: ${ITEM_HELP[item]}`}
                        title={ITEM_HELP[item]}
                      >
                        <span className="space-item__top" aria-hidden="true">
                          <span className="space-item__key">{i + 1}</span>
                          <span className="space-item__emoji">{ITEM_EMOJI[item]}</span>
                        </span>
                        <strong aria-hidden="true">{itemName(item)}</strong>
                        <small aria-hidden="true">{ITEM_SHORT[item]}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="space-panel space-players" aria-labelledby="space-players-title">
          <h2 id="space-players-title" className="space-panel__title">
            Rockets
            <span className={`space-fuel${roundsLeft <= FUEL_WARNING_ROUNDS ? ' is-low' : ''}`}>
              Round {view.round} · ⛽ {roundsLeft} left
              <span className="space-fuel__bar" aria-hidden="true">
                <span style={{ width: `${(roundsLeft / totalRounds) * 100}%` }} />
              </span>
            </span>
          </h2>
          <ol className="space-players__list">
            {seats.map((seat, i) => {
              const r = view.rockets[i];
              return (
                <li key={i} className={turnSeat === i && !over ? 'is-turn' : undefined}>
                  <SeatShapeIcon shape={seat.shape} colour={seat.colour} size={20} />
                  <AvatarImage avatar={seat.avatar} size={28} />
                  <span className="space-players__name">
                    {seat.name}
                    {seat.isStudent && ' (you)'}
                    <span className="sr-only">, {SHAPE_NAMES[seat.shape]} rocket</span>
                  </span>
                  <span className="space-players__badges">
                    {r.gravity && <span title={`${r.gravity.kind} gravity`}>{GRAVITY_BADGE[r.gravity.kind]}</span>}
                    {r.anchored && <span title="Next roll halved">⚓</span>}
                    {r.shielded && <span title="Shielded until their next turn">✨</span>}
                    {r.binary && <span title="Two dice next turn">🎲</span>}
                    {cosmic && !seat.isStudent && r.items.map((item, k) => (
                      <span key={k} title={itemName(item)}>
                        {ITEM_EMOJI[item]}
                      </span>
                    ))}
                  </span>
                  <span className="space-players__square">
                    <span className="sr-only">square </span>
                    {positions[i]}
                    {over && <span className="space-players__place"> {ORDINAL[places[i]]}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-panel space-log" aria-labelledby="space-log-title">
          <h2 id="space-log-title" className="space-panel__title">
            Mission log <span>{LOG_SAVE_NOTE[saveStatus]}</span>
          </h2>
          <MissionLog lines={log} />
        </section>

        {confirming ? (
          <div className="chess-confirm" role="group" aria-label="Are you sure?">
            <p>Start again? This game will end.</p>
            <div className="chess-actions">
              <button type="button" className="button button--danger" onClick={() => void start()} disabled={starting}>
                Yes, start again
              </button>
              <button type="button" className="button button--light" onClick={() => setConfirming(false)} autoFocus>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <div className="space-actions">
            {over ? (
              <button type="button" className="space-action is-main" onClick={() => void start()} disabled={starting}>
                {starting ? 'Getting ready…' : 'Play again'}
              </button>
            ) : (
              <button type="button" className="space-action" onClick={() => setConfirming(true)}>
                New game
              </button>
            )}
            <button type="button" className="space-action" onClick={() => setLessMotion(!lessMotion)} aria-pressed={lessMotion}>
              {lessMotion ? '✓ Less motion' : 'Less motion'}
            </button>
            <button type="button" className="space-action" onClick={leave}>
              Settings
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Choice({ pending, items, onChoose }: { pending: NonNullable<SpaceState['pending']>; items: ItemKind[]; onChoose: (option: number) => void }) {
  const buttons: { option: number; label: ReactNode; aria?: string; className?: string }[] = [];
  switch (pending.kind) {
    case 'gate':
      buttons.push({ option: 1, label: `🌀 Jump to ${pending.twin}` }, { option: 0, label: `Stay on ${pending.square}` });
      break;
    case 'mystery':
      for (const option of [0, 1, 2]) buttons.push({ option, label: <span className="space-card">?</span>, aria: `Card ${option + 1}`, className: 'space-card-button' });
      break;
    case 'inventory':
      items.forEach((item, option) => buttons.push({ option, label: `Drop ${ITEM_EMOJI[item]} ${itemName(item)}` }));
      buttons.push({ option: KEEP_ITEMS, label: 'Keep my items' });
      break;
    case 'binary':
      pending.dice.forEach((value, option) => buttons.push({ option, label: <DieFace value={value} size={56} />, aria: `Use the ${value}`, className: 'space-die-button' }));
      break;
    case 'question':
      buttons.push({ option: 1, label: 'Answer' });
      break;
  }
  return (
    <div className={`space-choice space-choice--${pending.kind}`} role="group" aria-label={choiceQuestion(pending)} onKeyDown={arrowKeys}>
      {pending.kind === 'inventory' && (
        <p className="space-choice__new">
          New: {ITEM_EMOJI[pending.item]} <strong>{itemName(pending.item)}</strong>. {ITEM_HELP[pending.item]}
        </p>
      )}
      {buttons.map((b) => (
        <button
          key={b.option}
          type="button"
          className={b.className ?? 'button button--light space-choice__button'}
          onClick={() => onChoose(b.option)}
          aria-label={b.aria}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

/** The mission log: newest at the bottom, kept scrolled down, read out by screen readers. */
function MissionLog({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = ref.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines]);
  return (
    <ol className="space-log__list" ref={ref} role="log" aria-live="polite" aria-relevant="additions">
      {lines.map((line) => (
        <li key={line.id} className={line.mine ? 'is-mine' : line.text.startsWith('—') ? 'is-round' : undefined}>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

const MEDALS = ['', '🥇', '🥈', '🥉', '🚀'];

const LOG_SAVE_NOTE: Record<SaveStatus, string> = {
  practice: 'Practice game: not saved',
  playing: 'Saved when you finish',
  saving: 'Saving…',
  saved: 'Saved ✓',
  'saved-no-points': 'Saved ✓',
  error: 'Not saved',
};

/** The line on the podium about saving. */
function saveNote(status: SaveStatus, message: string, canSave: boolean): string | null {
  switch (status) {
    case 'practice':
      return canSave ? 'Practice game: we couldn’t reach the server at the start, so this one isn’t saved.' : null;
    case 'playing':
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved! You earned points for taking part.';
    case 'saved-no-points':
      return 'Saved. That game was too short to earn points.';
    case 'error':
      return message;
  }
}

function Podium({
  seats,
  places,
  studentSeat,
  ending,
  onAgain,
  saveNote,
  onLook,
  onSettings,
}: {
  seats: Seat[];
  places: number[];
  studentSeat: number;
  ending: SpaceState['ending'];
  onAgain: () => void;
  saveNote: string | null;
  onLook: () => void;
  onSettings: () => void;
}) {
  const mine = places[studentSeat];
  const title = mine === 1 ? (ending === 'docked' ? 'You docked first!' : 'You got the furthest!') : `You came ${ORDINAL[mine]}!`;
  const about =
    ending === 'mission-clock'
      ? 'The fuel ran out, so places go by how far everyone got.'
      : mine === 1
        ? 'First to the space station. Brilliant flying!'
        : 'Dice are luck. Have another go!';
  const steps = [2, 1, 3].filter((p) => places.includes(p));
  const fourth = seats.map((_, i) => i).filter((i) => places[i] >= 4);
  return (
    <div className="chess-result space-podium" role="dialog" aria-modal="true" aria-labelledby="space-result-title">
      <div className={`chess-result__card chess-result__card--${mine === 1 ? 'won' : 'drawn'}`}>
        <div className="chess-result__emoji" aria-hidden="true">
          {mine === 1 ? '🏆' : MEDALS[mine]}
        </div>
        <h2 id="space-result-title">{title}</h2>
        <p>{about}</p>
        <ol className="space-podium__steps">
          {steps.map((place) => (
            <li key={place} className={`space-podium__step is-${place}`}>
              <span className="space-podium__rockets">
                {seats.map((seat, i) =>
                  places[i] === place ? (
                    <span key={i} className="space-podium__who">
                      <AvatarImage avatar={seat.avatar} size={44} />
                      <SeatShapeIcon shape={seat.shape} colour={seat.colour} />
                      <span>{seat.isStudent ? 'You' : seat.name}</span>
                    </span>
                  ) : null,
                )}
              </span>
              <span className="space-podium__block">
                <span aria-hidden="true">{MEDALS[place]}</span> {ORDINAL[place]}
              </span>
            </li>
          ))}
        </ol>
        {fourth.length > 0 && (
          <p className="space-podium__fourth">
            {fourth.map((i) => `${ORDINAL[places[i]]}: ${seats[i].isStudent ? 'You' : seats[i].name}`).join(' · ')}
          </p>
        )}
        {saveNote && (
          <p className="space-podium__save" role="status">
            {saveNote}
          </p>
        )}
        <div className="chess-result__buttons">
          <button type="button" className="button button--primary" onClick={onAgain} autoFocus>
            Play again
          </button>
          <button type="button" className="button button--light" onClick={onLook}>
            Look at the board
          </button>
          <button type="button" className="link-button" onClick={onSettings}>
            Change settings
          </button>
        </div>
      </div>
    </div>
  );
}
