/**
 * The 101 rules engine, shared by the website, the bots and the server (docs/101-RULES.md).
 *
 * `play(game, actor, action, dice)` is a pure function: it never changes the game it's
 * given, never reads the clock and never makes up random numbers. Shuffles come from
 * `dice`. So the same game, action and dice always give the same result, which is how
 * the server can replay a bot game and check it.
 *
 * The `Game` here is the WHOLE game, with every card in it. It must never be sent to a
 * browser in a classmates game: `viewFor` (view.ts) makes the part each player may see.
 *
 * A round: deal → peek (each player looks at their bottom two cards once) → turns →
 * someone knocks → everyone else gets one last turn → scoring → next round, until a
 * total reaches the target (101, or 50 in a Quick game).
 */
import { PACK, PEEK_SLOTS, isSlot, type Card, type Slot } from './cards';
import { shuffled, type Dice } from './random';
import { scoreHand, type HandScore } from './score';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const TARGETS = [101, 50] as const;
export type Target = (typeof TARGETS)[number];
/** In a classmates game, this many skipped turns in a row puts a player out. */
export const SKIPS_TO_OUT = 3;

export interface Settings {
  /** The game ends when a total reaches this: 101, or 50 for a Quick game. */
  target: Target;
}
export const DEFAULT_SETTINGS: Settings = { target: 101 };

export type Phase = 'peek' | 'play' | 'round-over' | 'over';

export interface Holding {
  card: Card;
  from: 'stack' | 'discard';
}

export interface RoundResult {
  round: number;
  /** Everyone's four cards, turned face up ([] for players who are out). */
  hands: Card[][];
  /** Each hand's score with its working (null for players who are out). */
  scores: (HandScore | null)[];
  /** Who had the lowest hand (ties: all of them). */
  winners: number[];
  knocker: number | null;
  /** Totals after this round was added. */
  totals: number[];
}

export interface Game {
  settings: Settings;
  players: number;
  /** Running totals. */
  totals: number[];
  /** Out of the game (left, or skipped too many times). */
  out: boolean[];
  round: number;
  /** Who started this round. */
  starter: number;
  phase: Phase;
  /** Each player's four cards, by slot (0 top left, 1 top right, 2 bottom left, 3 bottom right). */
  hands: Card[][];
  /** The face-down stack. The LAST card is the top. */
  stack: Card[];
  /** The face-up discard pile. The LAST card is the top. */
  discard: Card[];
  turn: number;
  holding: Holding | null;
  /** Turns each player has had this round (you can't knock until everyone has had one). */
  turnsThisRound: number[];
  knocker: number | null;
  /** After a knock: who still gets a last turn. */
  owesLastTurn: boolean[];
  /** This round's peek is over for this player. */
  peeked: boolean[];
  /** Skipped turns in a row (classmates games). */
  skips: number[];
  results: RoundResult[];
  /** Set when the game is over: who won (ties share it). */
  winners: number[] | null;
}

export type Action =
  | { type: 'peek-done' }
  | { type: 'end-peek' }
  | { type: 'draw'; from: 'stack' | 'discard' }
  | { type: 'swap'; slot: Slot }
  | { type: 'throw' }
  | { type: 'knock' }
  | { type: 'skip' }
  | { type: 'leave' }
  | { type: 'next-round' };

/** Who's doing it: a seat, or "system" for things the referee does (timers, dealing the next round). */
export type Actor = number | 'system';

/**
 * What happened, for the screen to animate and the log to put in words. A `card` on a
 * stack draw is private: `eventsFor` (view.ts) strips it for everyone but the drawer.
 */
export type GameEvent =
  | { kind: 'deal'; round: number; starter: number; discardTop: Card }
  | { kind: 'peek-done'; seat: number }
  | { kind: 'play-starts'; turn: number }
  | { kind: 'draw'; seat: number; from: 'stack'; card?: Card }
  | { kind: 'draw'; seat: number; from: 'discard'; card: Card }
  | { kind: 'swap'; seat: number; slot: Slot; discarded: Card }
  | { kind: 'throw'; seat: number; card: Card }
  | { kind: 'knock'; seat: number }
  | { kind: 'skip'; seat: number; discarded: Card | null }
  | { kind: 'reshuffle'; cards: number }
  | { kind: 'out'; seat: number; reason: 'left' | 'skipped' }
  | { kind: 'turn'; seat: number; lastTurn: boolean }
  | { kind: 'round-end'; result: RoundResult }
  | { kind: 'game-over'; winners: number[]; totals: number[] };

export class RuleError extends Error {}

const fail = (message: string): never => {
  throw new RuleError(message);
};

export const activeSeats = (game: Game) => game.totals.map((_, seat) => seat).filter((seat) => !game.out[seat]);

/** Starts a game. The first round is dealt straight away; `dice` shuffles and picks who starts. */
export function newGame(players: number, settings: Settings, dice: Dice): { game: Game; events: GameEvent[] } {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) fail('2 to 4 players');
  if (!TARGETS.includes(settings.target)) fail('Unknown target');
  const game: Game = {
    settings: { target: settings.target },
    players,
    totals: Array(players).fill(0),
    out: Array(players).fill(false),
    round: 0,
    starter: dice(players) - 1,
    phase: 'round-over',
    hands: Array.from({ length: players }, () => []),
    stack: [],
    discard: [],
    turn: 0,
    holding: null,
    turnsThisRound: Array(players).fill(0),
    knocker: null,
    owesLastTurn: Array(players).fill(false),
    peeked: Array(players).fill(false),
    skips: Array(players).fill(0),
    results: [],
    winners: null,
  };
  const events: GameEvent[] = [];
  deal(game, dice, events, false);
  return { game, events };
}

/** Plays one action. Throws RuleError (and changes nothing) if it isn't allowed. */
export function play(game: Game, actor: Actor, action: Action, dice: Dice): { game: Game; events: GameEvent[] } {
  const g = structuredClone(game);
  const events: GameEvent[] = [];
  apply(g, actor, action, dice, events);
  return { game: g, events };
}

function apply(g: Game, actor: Actor, action: Action, dice: Dice, events: GameEvent[]): void {
  if (g.phase === 'over') fail('The game is over');
  const seat = actor === 'system' ? null : actor;
  if (seat !== null && (!Number.isInteger(seat) || seat < 0 || seat >= g.players)) fail('No such player');
  if (seat !== null && g.out[seat]) fail("You're out of this game");

  switch (action.type) {
    case 'peek-done': {
      if (seat === null) fail('Only a player can finish their peek');
      if (g.phase !== 'peek') fail("It isn't peek time");
      if (g.peeked[seat!]) fail('Your peek is already over');
      g.peeked[seat!] = true;
      events.push({ kind: 'peek-done', seat: seat! });
      startPlayIfPeeksDone(g, events);
      return;
    }
    case 'end-peek': {
      if (seat !== null) fail('Only the referee can end the peek');
      if (g.phase !== 'peek') fail("It isn't peek time");
      for (const s of activeSeats(g)) g.peeked[s] = true;
      startPlayIfPeeksDone(g, events);
      return;
    }
    case 'next-round': {
      if (seat !== null) fail('Only the referee deals');
      if (g.phase !== 'round-over') fail("The round isn't over");
      deal(g, dice, events, true);
      return;
    }
    case 'leave': {
      if (seat === null) fail('Only a player can leave');
      putOut(g, seat!, 'left', events);
      return;
    }
    case 'skip': {
      if (seat !== null) fail('Only the referee can skip a turn');
      if (g.phase !== 'play') fail("Nobody's turn to skip");
      const skipped = g.turn;
      const discarded = g.holding ? g.holding.card : null;
      if (g.holding) g.discard.push(g.holding.card);
      g.holding = null;
      events.push({ kind: 'skip', seat: skipped, discarded });
      g.skips[skipped] += 1;
      if (g.skips[skipped] >= SKIPS_TO_OUT) {
        putOut(g, skipped, 'skipped', events);
        return;
      }
      endTurn(g, events);
      return;
    }
    default:
      break;
  }

  // Everything else is the player whose turn it is.
  if (g.phase !== 'play') fail("It isn't time to play");
  if (seat === null) fail('Only a player can do that');
  if (seat !== g.turn) fail("It isn't your turn");
  g.skips[seat!] = 0;

  switch (action.type) {
    case 'draw': {
      if (g.holding) fail("You're already holding a card");
      if (action.from === 'discard') {
        const card = g.discard.pop() ?? fail('The discard pile is empty');
        g.holding = { card: card!, from: 'discard' };
        events.push({ kind: 'draw', seat: seat!, from: 'discard', card: card! });
      } else if (action.from === 'stack') {
        if (g.stack.length === 0) reshuffle(g, dice, events);
        const card = g.stack.pop() ?? fail('There are no cards left to draw');
        g.holding = { card: card!, from: 'stack' };
        events.push({ kind: 'draw', seat: seat!, from: 'stack', card: card! });
      } else {
        fail('Draw from the stack or the discard pile');
      }
      return;
    }
    case 'swap': {
      if (!g.holding) fail('Take a card first');
      if (!isSlot(action.slot)) fail('Pick one of your four cards');
      const discarded = g.hands[seat!][action.slot];
      g.hands[seat!][action.slot] = g.holding!.card;
      g.discard.push(discarded);
      g.holding = null;
      events.push({ kind: 'swap', seat: seat!, slot: action.slot, discarded });
      endTurn(g, events);
      return;
    }
    case 'throw': {
      if (!g.holding) fail('Take a card first');
      const card = g.holding!.card;
      g.discard.push(card);
      g.holding = null;
      events.push({ kind: 'throw', seat: seat!, card });
      endTurn(g, events);
      return;
    }
    case 'knock': {
      if (!canKnock(g, seat!)) fail(g.knocker !== null ? 'Someone has already knocked' : 'You can knock once everyone has had a turn');
      g.knocker = seat!;
      for (const s of activeSeats(g)) g.owesLastTurn[s] = s !== seat;
      events.push({ kind: 'knock', seat: seat! });
      endTurn(g, events);
      return;
    }
    default:
      fail('Unknown move');
  }
}

/** Whether this player could knock right now. */
export function canKnock(g: Game, seat: number): boolean {
  return (
    g.phase === 'play' &&
    g.turn === seat &&
    !g.holding &&
    g.knocker === null &&
    activeSeats(g).every((s) => g.turnsThisRound[s] >= 1)
  );
}

function startPlayIfPeeksDone(g: Game, events: GameEvent[]): void {
  if (activeSeats(g).some((s) => !g.peeked[s])) return;
  g.phase = 'play';
  // The starter may have left during the peek.
  g.turn = g.out[g.starter] ? nextActive(g, g.starter) : g.starter;
  events.push({ kind: 'play-starts', turn: g.turn });
}

/** Shuffles a fresh pack and deals a round. `moveStarter`: the start moves one player along. */
function deal(g: Game, dice: Dice, events: GameEvent[], moveStarter: boolean): void {
  g.round += 1;
  if (moveStarter) g.starter = nextActive(g, g.starter);
  const pack = shuffled(dice, PACK);
  g.hands = g.totals.map((_, seat) => (g.out[seat] ? [] : pack.splice(0, 4)));
  g.discard = [pack.pop()!];
  g.stack = pack;
  g.holding = null;
  g.turn = g.starter;
  g.turnsThisRound = Array(g.players).fill(0);
  g.knocker = null;
  g.owesLastTurn = Array(g.players).fill(false);
  g.peeked = g.out.map((out) => out);
  g.phase = 'peek';
  events.push({ kind: 'deal', round: g.round, starter: g.starter, discardTop: g.discard[g.discard.length - 1] });
}

/** The stack is empty: shuffle the discard pile, except its top card, into a new stack. */
function reshuffle(g: Game, dice: Dice, events: GameEvent[]): void {
  const top = g.discard.pop();
  if (top === undefined || g.discard.length === 0) {
    if (top !== undefined) g.discard.push(top);
    fail('There are no cards left to draw');
  }
  g.stack = shuffled(dice, g.discard);
  g.discard = [top!];
  events.push({ kind: 'reshuffle', cards: g.stack.length });
}

function nextActive(g: Game, from: number): number {
  for (let step = 1; step <= g.players; step++) {
    const seat = (from + step) % g.players;
    if (!g.out[seat]) return seat;
  }
  return from;
}

/** The current player's turn is over: pass it on, or score the round after the last turns. */
function endTurn(g: Game, events: GameEvent[]): void {
  const finished = g.turn;
  g.turnsThisRound[finished] += 1;
  if (g.knocker !== null) g.owesLastTurn[finished] = false;
  passTurn(g, finished, events);
}

function passTurn(g: Game, from: number, events: GameEvent[]): void {
  if (g.knocker !== null) {
    // After a knock, only players who still owe a last turn play, in order round the table.
    for (let step = 1; step <= g.players; step++) {
      const seat = (from + step) % g.players;
      if (!g.out[seat] && g.owesLastTurn[seat]) {
        g.turn = seat;
        events.push({ kind: 'turn', seat, lastTurn: true });
        return;
      }
    }
    scoreRound(g, events);
    return;
  }
  g.turn = nextActive(g, from);
  events.push({ kind: 'turn', seat: g.turn, lastTurn: false });
}

function scoreRound(g: Game, events: GameEvent[]): void {
  const scores = g.hands.map((hand, seat) => (g.out[seat] ? null : scoreHand(hand)));
  const live = activeSeats(g);
  const lowest = Math.min(...live.map((s) => scores[s]!.total));
  for (const s of live) g.totals[s] += scores[s]!.total;
  const result: RoundResult = {
    round: g.round,
    hands: g.hands.map((hand, seat) => (g.out[seat] ? [] : [...hand])),
    scores,
    winners: live.filter((s) => scores[s]!.total === lowest),
    knocker: g.knocker,
    totals: [...g.totals],
  };
  g.results.push(result);
  g.phase = 'round-over';
  g.holding = null;
  events.push({ kind: 'round-end', result });
  if (live.some((s) => g.totals[s] >= g.settings.target)) finishGame(g, events);
}

function finishGame(g: Game, events: GameEvent[]): void {
  const live = activeSeats(g);
  const best = Math.min(...live.map((s) => g.totals[s]));
  g.winners = live.filter((s) => g.totals[s] === best);
  g.phase = 'over';
  events.push({ kind: 'game-over', winners: g.winners, totals: [...g.totals] });
}

/** A player leaves or is skipped out: their cards leave the table and the others carry on. */
function putOut(g: Game, seat: number, reason: 'left' | 'skipped', events: GameEvent[]): void {
  if (g.out[seat]) fail("You're out of this game");
  const wasTheirTurn = g.phase === 'play' && g.turn === seat;
  if (wasTheirTurn && g.holding) {
    g.discard.push(g.holding.card);
    g.holding = null;
  }
  g.out[seat] = true;
  g.hands[seat] = [];
  g.owesLastTurn[seat] = false;
  g.peeked[seat] = true;
  events.push({ kind: 'out', seat, reason });

  const live = activeSeats(g);
  if (live.length < MIN_PLAYERS) {
    // One player left: the game ends and they win (they may still earn nothing: see points).
    g.winners = live;
    g.phase = 'over';
    events.push({ kind: 'game-over', winners: live, totals: [...g.totals] });
    return;
  }
  // If the knocker left, the knock still stands and the others finish their last turns.
  // The next round's starter is worked out from `starter` skipping players who are out.
  if (g.phase === 'peek') startPlayIfPeeksDone(g, events);
  else if (wasTheirTurn) passTurn(g, seat, events);
}

/** The peek slots, for whoever needs to show them. */
export const peekCards = (g: Game, seat: number): Card[] => PEEK_SLOTS.map((slot) => g.hands[seat][slot]);
