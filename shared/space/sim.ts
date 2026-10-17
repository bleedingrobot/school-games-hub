/**
 * Plays lots of bot games and counts what happens, to tune the boards and check the rules
 * (game length, fairness, how often each square and item fires, that nothing loops).
 * Run it with `npm run space:sim`; the tests also run small batches.
 */
import type { BotLevel } from '../botGame';
import type { Board } from './board';
import { botAction } from './bot';
import { newGame, play, type Settings, type SpaceAction, type SpaceEvent } from './engine';
import { randomFromSeed, seededDice } from './random';

export interface SimOptions {
  board: Board;
  settings: Settings;
  /** The bot level in each seat (2 to 4 seats). */
  levels: readonly BotLevel[];
  games: number;
  seed: string;
  /**
   * Mission Control maths: how often each seat answers right, in place of its bot's usual rate
   * (to see how much knowing your tables helps). Undefined: the bot's own rate.
   */
  mathsRight?: (number | undefined)[];
  /**
   * Seconds a charge question adds to the clock. 0 (the default): it's answered while others take
   * their turns. 10 is the worst case, as if every one held the game up like a wormhole question.
   */
  chargeSeconds?: number;
}

export interface Spread {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface SimReport {
  games: number;
  turns: Spread;
  rounds: Spread;
  /** A rough guess at real minutes (see secondsFor). */
  minutes: Spread;
  missionClock: number;
  chainCapGames: number;
  winsBySeat: number[];
  /** Last place at halfway and went on to win (compare with 1 ÷ players). */
  comeback: number;
  /** Times per game each kind of event happened (squares, items, choices). */
  perGame: Record<string, number>;
  biggestEventsInOneMove: number;
}

function spread(values: number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted[sorted.length - 1],
  };
}

/**
 * Seconds a classroom turn might take: about 6 for tapping, the dice and the hops, 1.5 more for each
 * square or hinder that acts, 4 for each choice (10 for a maths question) and 2 for each item used.
 * The charge question after a turn costs `chargeSeconds` (default 0: it's answered while others move).
 */
export function secondsFor(events: readonly SpaceEvent[], chargeSeconds = 0): number {
  let seconds = 0;
  for (const e of events) {
    if (e.kind === 'roll') seconds += 6;
    else if (e.kind === 'choice') seconds += e.pending.kind === 'question' ? 10 : 4;
    else if (e.kind === 'charge') seconds += chargeSeconds;
    else if (e.kind === 'item-used') seconds += 2;
    else if (['wormhole', 'black-hole', 'star', 'comet', 'pushed', 'swapped', 'gate', 'mystery', 'force-field', 'cosmic'].includes(e.kind)) seconds += 1.5;
  }
  return seconds;
}

/** The key an event is counted under in `perGame` (e.g. "star:pulsar", "item-used:booster"). */
function countKey(e: SpaceEvent): string | null {
  switch (e.kind) {
    case 'star': return `star:${e.star}`;
    case 'item-used': return `item-used:${e.item}`;
    case 'item-gained': return `item-gained:${e.from}`;
    case 'pushed': return `pushed:${e.by}`;
    case 'gravity': return `gravity:${e.gravity}`;
    case 'cosmic': return `cosmic:${e.event}`;
    case 'choice': return e.pending.kind === 'question' ? `choice:question:${e.pending.moment ?? 'wormhole'}` : `choice:${e.pending.kind}`;
    case 'turn-start': case 'round-start': case 'dice': case 'roll': case 'move': case 'game-over': case 'docked': return null;
    default: return e.kind;
  }
}

export function simulate(options: SimOptions): SimReport {
  const { board, settings, levels, games, seed } = options;
  const turns: number[] = [];
  const rounds: number[] = [];
  const minutes: number[] = [];
  const winsBySeat = levels.map(() => 0);
  const counts: Record<string, number> = {};
  let missionClock = 0;
  let chainCapGames = 0;
  let comebacks = 0;
  let biggest = 0;

  for (let g = 0; g < games; g++) {
    const dice = seededDice(`${seed}:${g}:dice`);
    const random = randomFromSeed(`${seed}:${g}:bots`);
    let { state } = newGame(board, settings, levels.length);
    let seconds = 0;
    let capped = false;
    const positionsByRound: number[][] = [[...state.rockets.map((r) => r.position)]];
    let moveEvents = 0;
    while (state.phase !== 'over') {
      const rate = options.mathsRight?.[state.turn];
      let action: SpaceAction = botAction(state, levels[state.turn], random);
      if (rate !== undefined && action.kind === 'charge') action = { kind: 'charge', right: random() < rate };
      else if (rate !== undefined && state.phase === 'choice' && state.pending?.kind === 'question') {
        action = { kind: 'choose', option: random() < rate ? 1 : 0 };
      }
      const result = play(state, action, dice);
      state = result.state;
      seconds += secondsFor(result.events, options.chargeSeconds);
      for (const e of result.events) {
        if (e.kind === 'move') moveEvents = 0;
        else if (['wormhole', 'black-hole', 'comet', 'star', 'gravity', 'force-field', 'asteroid', 'mystery', 'gate'].includes(e.kind) || (e.kind === 'pushed' && e.by === 'space-mine')) {
          biggest = Math.max(biggest, ++moveEvents);
        }
        if (e.kind === 'chain-cap') capped = true;
        if (e.kind === 'round-start') positionsByRound.push(state.rockets.map((r) => r.position));
        const key = countKey(e);
        if (key) counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    turns.push(state.turnsTaken);
    rounds.push(state.round);
    minutes.push(seconds / 60);
    if (state.ending === 'mission-clock') missionClock++;
    if (capped) chainCapGames++;
    state.places!.forEach((place, seat) => { if (place === 1) winsBySeat[seat]++; });
    const half = positionsByRound[Math.floor(positionsByRound.length / 2)];
    const low = Math.min(...half);
    if (half.filter((p) => p === low).length === 1 && state.places![half.indexOf(low)] === 1) comebacks++;
  }

  const perGame: Record<string, number> = {};
  for (const key of Object.keys(counts).sort()) perGame[key] = counts[key] / games;
  return {
    games,
    turns: spread(turns),
    rounds: spread(rounds),
    minutes: spread(minutes),
    missionClock: missionClock / games,
    chainCapGames: chainCapGames / games,
    winsBySeat: winsBySeat.map((w) => w / games),
    comeback: comebacks / games,
    perGame,
    biggestEventsInOneMove: biggest,
  };
}
