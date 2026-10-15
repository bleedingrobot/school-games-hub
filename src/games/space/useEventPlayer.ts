/**
 * Plays the rules engine's events on screen, one at a time: dice, hops, wormholes, items…
 * Used by both the bot game (SpaceSolo) and the classmates game (SpaceLive). Rocket
 * positions on screen come from the events, and the board catches up with the engine's
 * state at the end of each batch. The screen never works out results itself.
 */
import { useRef, useState } from 'react';
import type { SpaceEvent, SpaceState } from '../../../shared/space/engine';
import { playSound, type GameSound } from '../sounds';
import type { RocketFx } from './SpaceBoard';
import type { FactId } from '../../../shared/space/facts';
import { discover, factFor } from './starChart';
import { bannerFor, describe, ITEM_EMOJI, itemName, type Banner } from './text';

export interface Batch {
  events: SpaceEvent[];
  state: SpaceState;
}

export interface RocketView {
  pos: number;
  fx: RocketFx;
  ms: number;
}

export interface LogLine {
  id: number;
  text: string;
  mine: boolean;
}

/** Who's who while the events play: every seat's name, and which one is "you" (if any). */
export interface Cast {
  names: readonly string[];
  me: number | null;
}

/** How the events play: speed (1 is Normal), less motion, and sound. Read live, so changes apply straight away. */
export interface PlayerSettings {
  scale: number;
  calm: boolean;
  sound: boolean;
}

/** A space fact on screen: `isNew` if it has just gone on the Star chart. */
export interface FactShown {
  id: FactId;
  isNew: boolean;
  key: number;
}

export const LOG_LENGTH = 80;

/** Squares a rocket hops through, one at a time (bouncing back off the end if it overshot). */
export function hopPath(from: number, to: number, size: number, steps: number | null, bounced: boolean): number[] {
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

export function useEventPlayer(settings: { current: PlayerSettings }) {
  const [view, setView] = useState<SpaceState | null>(null);
  const [rockets, setRockets] = useState<RocketView[]>([]);
  const [turnSeat, setTurnSeat] = useState<number | null>(null);
  const [dice, setDice] = useState<{ values: number[]; rolling: boolean; seat: number } | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [toast, setToast] = useState<{ emoji: string; text: string; id: number } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [fact, setFact] = useState<FactShown | null>(null);
  const rocketsRef = useRef<RocketView[]>([]);
  const nextId = useRef(0);

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms * settings.current.scale));
  const sound = (name: GameSound) => {
    if (settings.current.sound) playSound(name);
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

  /** Slides a rocket straight to a square (wormholes, black holes, pushes, items). */
  async function slide(seat: number, to: number, ms: number) {
    setRocket(seat, { pos: to, ms: ms * settings.current.scale, fx: rocketsRef.current[seat].fx ?? 'slide' });
    await wait(ms + 60);
  }

  async function hop(seat: number, from: number, to: number, steps: number | null, bounced: boolean, size: number) {
    if (settings.current.calm) {
      await slide(seat, to, 450);
      setRocket(seat, { fx: null });
      return;
    }
    const hopMs = 170;
    setRocket(seat, { fx: 'hop' });
    for (const n of hopPath(from, to, size, steps, bounced)) {
      setRocket(seat, { pos: n, ms: hopMs * 0.8 * settings.current.scale });
      sound('hop');
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

  /** The mission log line for an event (if it has one), marked if it's about "you". */
  function logEvent(event: SpaceEvent, cast: Cast) {
    const line = describe(event, cast.names);
    const seatOf = 'seat' in event ? event.seat : null;
    if (line) addLog(line, cast.me !== null && (seatOf === cast.me || (event.kind === 'pushed' && event.source === cast.me)));
  }

  async function show(event: SpaceEvent, cast: Cast, lastSteps: { value: number | null }, size: number) {
    const names = cast.names;
    logEvent(event, cast);
    const factId = factFor(event, cast.me);
    if (factId) setFact({ id: factId, isNew: discover(factId), key: nextId.current++ });

    switch (event.kind) {
      case 'round-start':
        return;
      case 'turn-start':
        setTurnSeat(event.seat);
        return wait(event.seat === cast.me ? 100 : 250);
      case 'dice':
        setDice({ values: event.dice, rolling: true, seat: event.seat });
        sound('dice');
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
        sound('wormhole');
        await effect(event.seat, 'swirl', 450);
        await slide(event.seat, event.to, 750);
        return setRocket(event.seat, { fx: null });
      case 'black-hole':
        sound('black-hole');
        await effect(event.seat, 'spaghetti', 550);
        await slide(event.seat, event.to, 750);
        return setRocket(event.seat, { fx: null });
      case 'force-field':
        showToast('🛡️', 'Force Field!');
        sound('shield');
        await effect(event.seat, 'shield', 900);
        return setRocket(event.seat, { fx: null });
      case 'star':
        await effect(event.seat, 'sparkle', 450);
        return setRocket(event.seat, { fx: null });
      case 'item-gained':
        if (event.seat === cast.me || event.from !== 'matariki') {
          showToast(ITEM_EMOJI[event.item], `${names[event.seat]} got ${itemName(event.item)}`);
          sound('item');
        }
        return wait(event.from === 'matariki' ? 350 : 900);
      case 'item-used':
        showToast(ITEM_EMOJI[event.item], `${itemName(event.item)}!`);
        if (event.target !== undefined) sound('zap');
        return wait(800);
      case 'item-lost':
      case 'pockets-full':
      case 'item-swapped':
      case 'item-declined':
        return wait(500);
      case 'pushed':
        sound('zap');
        setRocket(event.seat, { fx: 'bump' });
        await slide(event.seat, event.to, 450);
        return setRocket(event.seat, { fx: null });
      case 'swapped':
        setRocket(event.seat, { pos: event.to, ms: 600 * settings.current.scale, fx: 'slide' });
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
        sound('wormhole');
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
        sound('capture');
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
        sound('cosmic');
        setBanner(bannerFor(event));
        await wait(2400);
        return setBanner(null);
      }
      case 'fuel-warning':
        sound('alert');
        setBanner(bannerFor(event));
        await wait(2000);
        return setBanner(null);
      case 'docked':
        sound(event.seat === cast.me ? 'win' : 'end');
        await effect(event.seat, 'docked', 1000);
        return;
      case 'game-over':
      case 'choice':
      case 'timeout':
      case 'question':
        return;
    }
  }

  /** Puts the board straight to a state, with no animation. */
  function jumpTo(state: SpaceState) {
    setView(state);
    rocketsRef.current = state.rockets.map((r, i) => ({
      pos: r.position,
      fx: state.phase === 'over' ? (rocketsRef.current[i]?.fx ?? null) : null,
      ms: 0,
    }));
    setRockets(rocketsRef.current);
    if (state.phase !== 'over') setTurnSeat(state.turn);
    setToast(null);
  }

  /**
   * Plays a batch of events, then catches up with the state they lead to. `current` says
   * whether this game is still the one on screen (stop if not).
   */
  async function animate(batch: Batch, cast: Cast, current: () => boolean) {
    const lastSteps = { value: null as number | null };
    const size = batch.state.board.size;
    for (const event of batch.events) {
      if (!current()) return;
      await show(event, cast, lastSteps, size);
    }
    if (!current()) return;
    jumpTo(batch.state);
  }

  /** A fresh board: everyone where the state says, nothing in the log. */
  function reset(state: SpaceState) {
    discover('earth'); // every rocket starts on Earth
    rocketsRef.current = state.rockets.map((r) => ({ pos: r.position, fx: null, ms: 0 }));
    setRockets(rocketsRef.current);
    setView(state);
    setTurnSeat(state.turn);
    setLog([]);
    setDice(null);
    setToast(null);
    setBanner(null);
    setFact(null);
  }

  return {
    view,
    setView,
    rockets,
    turnSeat,
    setTurnSeat,
    dice,
    log,
    toast,
    setToast,
    banner,
    fact,
    setFact,
    animate,
    jumpTo,
    reset,
    addLog,
    logEvent,
    showToast,
  };
}
