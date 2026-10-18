import type {
  Action, Cell, ChaosKind, GameEvent, Player, PlayResult, PowerClashState, PowerId, Random, TurnSnapshot, WildEffect,
} from './types';

export const POWER_IDS: PowerId[] = [
  'body-swap', 'freeze-ray', 'board-wipe', 'force-field', 'portal-chaos', 'wild-card', 'time-heist',
];
export const LOADOUT_SIZE = 3;
/** Chaos Mode: a surprise after every third finished go of a round. */
export const CHAOS_EVERY = 3;

/**
 * The dice used when nobody passes any: always the middle choice. Only for a bot looking ahead
 * (it can't know how the dice will fall) and for tests. A real game always passes its own.
 */
export const FIXED_RANDOM: Random = () => 0.5;

export const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (p: Player): Player => (p === 'X' ? 'O' : 'X');

export function winningLine(board: (Player | null)[], player: Player): number[] | null {
  return LINES.find((line) => line.every((i) => board[i] === player)) ?? null;
}

export function validLoadout(powers: PowerId[]): boolean {
  return (
    powers.length === LOADOUT_SIZE &&
    new Set(powers).size === LOADOUT_SIZE &&
    powers.every((p) => POWER_IDS.includes(p))
  );
}

const pickFrom = <T,>(random: Random, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** How things stand right now, for Time Heist to come back to. */
function snapshot(state: Pick<PowerClashState, 'board' | 'frozen' | 'shields' | 'used'>, heist = false): TurnSnapshot {
  return {
    board: state.board.slice(),
    frozen: state.frozen.map((f) => ({ ...f })),
    shields: state.shields.map((s) => ({ ...s })),
    used: { X: [...state.used.X], O: [...state.used.O] },
    heist,
  };
}

export function newRound(
  loadout: Record<Player, PowerId[]>,
  starter: Player,
  chaos = false,
): PowerClashState {
  if (!validLoadout(loadout.X) || !validLoadout(loadout.O)) {
    throw new Error('Each player needs three different powers');
  }
  const base = {
    board: Array<Cell>(9).fill(null),
    frozen: [],
    shields: [],
    used: { X: [], O: [] },
  };
  return {
    ...base,
    active: starter,
    status: 'active',
    loadout: { X: [...loadout.X], O: [...loadout.O] },
    powerThisTurn: null,
    placesLeft: 1,
    line: null,
    chaos,
    turns: 0,
    turnStart: snapshot(base),
    rewind: null,
  };
}

/** Squares the active player may place on right now. */
export function placeableSquares(state: PowerClashState): number[] {
  if (state.status !== 'active') return [];
  const blocked = new Set(
    state.frozen.filter((f) => f.blockedFor === state.active).map((f) => f.square),
  );
  return state.board.flatMap((c, i) => (c === null && !blocked.has(i) ? [i] : []));
}

export function hasPower(state: PowerClashState, player: Player, power: PowerId): boolean {
  return state.loadout[player].includes(power) && !state.used[player].includes(power);
}

const shieldedSquares = (state: PowerClashState) => new Set(state.shields.map((s) => s.square));

/** Squares holding a symbol (of `who`, or anyone) that no Force Field protects. */
function unprotected(state: PowerClashState, who?: Player): number[] {
  const shielded = shieldedSquares(state);
  return state.board.flatMap((c, i) => (c !== null && (who === undefined || c === who) && !shielded.has(i) ? [i] : []));
}

/** Would this board give `me`'s opponent a line and not `me`? The dice never allow that. */
const handsOverWin = (board: Cell[], me: Player) => winningLine(board, other(me)) !== null && winningLine(board, me) === null;

// ---------- Portal Chaos ----------

/**
 * Every way the portals can throw the symbols on `a` and `b`: the first goes to `to[0]`, the
 * second to `to[1]`, two different squares among a, b and the empty squares that aren't
 * frozen. The board always ends up different, and the other player never gets a line from it.
 */
function portalOutcomes(state: PowerClashState, a: number, b: number, limit = Infinity): [number, number][] {
  const me = state.active;
  const frozen = new Set(state.frozen.map((f) => f.square));
  const pool = [a, b, ...state.board.flatMap((c, i) => (c === null && !frozen.has(i) ? [i] : []))].sort((x, y) => x - y);
  const same = state.board[a] === state.board[b];
  const out: [number, number][] = [];
  for (const d1 of pool) {
    for (const d2 of pool) {
      if (d1 === d2 || (d1 === a && d2 === b) || (same && d1 === b && d2 === a)) continue;
      const board = state.board.slice();
      board[a] = null;
      board[b] = null;
      board[d1] = state.board[a];
      board[d2] = state.board[b];
      if (handsOverWin(board, me)) continue;
      out.push([d1, d2]);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// ---------- Wild Card ----------

type WildOutcome =
  | { effect: 'bonus' }
  | { effect: 'freeze'; square: number }
  | { effect: 'swap'; squares: [number, number] }
  | { effect: 'remove'; square: number };

const WILD_EFFECTS: WildEffect[] = ['bonus', 'freeze', 'swap', 'remove'];

const swapped = (board: Cell[], a: number, b: number): Cell[] => {
  const next = board.slice();
  next[a] = board[b];
  next[b] = board[a];
  return next;
};

/** Everything the Wild Card could do right now: only legal targets, never touching protection, never handing over a win. */
function wildOutcomes(state: PowerClashState): WildOutcome[] {
  const me = state.active;
  const they = other(me);
  const out: WildOutcome[] = [];
  if (placeableSquares(state).length >= 2) out.push({ effect: 'bonus' });
  const frozenForThem = new Set(state.frozen.filter((f) => f.blockedFor === they).map((f) => f.square));
  state.board.forEach((c, i) => {
    if (c === null && !frozenForThem.has(i)) out.push({ effect: 'freeze', square: i });
  });
  for (const a of unprotected(state, me)) {
    for (const b of unprotected(state, they)) {
      if (!handsOverWin(swapped(state.board, a, b), me)) out.push({ effect: 'swap', squares: [a, b] });
    }
  }
  for (const i of unprotected(state)) out.push({ effect: 'remove', square: i });
  return out;
}

// ---------- Chaos Mode ----------

type ChaosOutcome =
  | { event: 'earthquake'; squares: [number, number] }
  | { event: 'frost-wave'; squares: [number] }
  | { event: 'meteor'; squares: [number] }
  | { event: 'lucky-star'; squares: [] }
  | { event: 'recharge'; squares: []; power: PowerId };

const CHAOS_KINDS: ChaosKind[] = ['earthquake', 'frost-wave', 'meteor', 'lucky-star', 'recharge'];

/** The surprises that could happen now, for the player about to move. None of them can make a line. */
function chaosOutcomes(state: PowerClashState): ChaosOutcome[] {
  const next = state.active;
  const out: ChaosOutcome[] = [];
  const x = unprotected(state, 'X');
  const o = unprotected(state, 'O');
  for (const a of x) {
    for (const b of o) {
      const board = swapped(state.board, a, b);
      if (!winningLine(board, 'X') && !winningLine(board, 'O')) out.push({ event: 'earthquake', squares: [a, b] });
    }
  }
  const placeable = placeableSquares(state);
  const frozen = new Set(state.frozen.map((f) => f.square));
  if (placeable.length >= 3) {
    for (const i of placeable) if (!frozen.has(i)) out.push({ event: 'frost-wave', squares: [i] });
  }
  for (const i of unprotected(state)) out.push({ event: 'meteor', squares: [i] });
  if (placeable.length >= 2) out.push({ event: 'lucky-star', squares: [] });
  for (const power of state.used[next]) out.push({ event: 'recharge', squares: [], power });
  return out;
}

/** The surprise after a finished go. `state.active` is already the player about to move. */
function chaosEvent(state: PowerClashState, events: GameEvent[], random: Random): PowerClashState {
  const options = chaosOutcomes(state);
  const kinds = CHAOS_KINDS.filter((k) => options.some((o) => o.event === k));
  if (kinds.length === 0) return state;
  const kind = pickFrom(random, kinds);
  const chosen = pickFrom(random, options.filter((o) => o.event === kind));
  const affects = state.active;
  let next = state;
  switch (chosen.event) {
    case 'earthquake':
      next = { ...state, board: swapped(state.board, chosen.squares[0], chosen.squares[1]) };
      break;
    case 'frost-wave':
      next = { ...state, frozen: [...state.frozen, { square: chosen.squares[0], blockedFor: affects }] };
      break;
    case 'meteor': {
      const board = state.board.slice();
      board[chosen.squares[0]] = null;
      next = { ...state, board };
      break;
    }
    case 'lucky-star':
      next = { ...state, placesLeft: 2 };
      break;
    case 'recharge':
      next = { ...state, used: { ...state.used, [affects]: state.used[affects].filter((p) => p !== chosen.power) } };
      break;
  }
  events.push({
    kind: 'chaos',
    event: chosen.event,
    affects,
    squares: [...chosen.squares],
    ...(chosen.event === 'recharge' ? { power: chosen.power } : {}),
  });
  return next;
}

// ---------- Targets and why a power can't be used ----------

/** Squares the active player can pick for the next target of a power. [] = none. */
export function targetChoices(state: PowerClashState, power: PowerId, picked: number[]): number[] {
  const me = state.active;
  const they = other(me);
  const all = state.board.map((_, i) => i);
  switch (power) {
    case 'wild-card':
    case 'time-heist':
      return [];
    case 'body-swap':
      if (picked.length === 0) return unprotected(state, me);
      if (picked.length === 1) return unprotected(state, they);
      return [];
    case 'freeze-ray':
      return picked.length === 0 ? all.filter((i) => state.board[i] === null) : [];
    case 'board-wipe':
      return picked.length === 0 ? unprotected(state) : [];
    case 'force-field':
      return picked.length === 0 ? unprotected(state, me) : [];
    case 'portal-chaos': {
      if (picked.length === 0) {
        return unprotected(state).filter((a) => unprotected(state).some((b) => b !== a && portalOutcomes(state, a, b, 1).length > 0));
      }
      if (picked.length === 1) {
        return unprotected(state).filter((b) => b !== picked[0] && portalOutcomes(state, picked[0], b, 1).length > 0);
      }
      return [];
    }
  }
}

function targetsNeeded(power: PowerId): number {
  switch (power) {
    case 'body-swap':
    case 'portal-chaos':
      return 2;
    case 'wild-card':
    case 'time-heist':
      return 0;
    default:
      return 1;
  }
}

const sameStuff = (a: TurnSnapshot, b: TurnSnapshot) => {
  const key = (s: TurnSnapshot) =>
    JSON.stringify([s.board, [...s.frozen].sort((p, q) => p.square - q.square), [...s.shields].sort((p, q) => p.square - q.square), s.used]);
  return key(a) === key(b);
};

/** Why the active player can't play this power right now, or null if they can. */
export function powerBlockedReason(state: PowerClashState, power: PowerId): string | null {
  if (state.status !== 'active') return 'The round is over';
  if (!hasPower(state, state.active, power)) return 'You have already used this power';
  if (state.powerThisTurn) return 'One power per turn';
  switch (power) {
    case 'body-swap':
      return targetChoices(state, power, []).length > 0 &&
        targetChoices(state, power, [0]).length > 0
        ? null
        : state.shields.length > 0
          ? 'Needs one X and one O that aren’t protected'
          : 'Needs one X and one O on the board';
    case 'freeze-ray':
      return targetChoices(state, power, []).length > 0 ? null : 'Needs an empty square';
    case 'board-wipe':
      return targetChoices(state, power, []).length > 0
        ? null
        : state.shields.length > 0 ? 'Needs a symbol that isn’t protected' : 'Needs a symbol on the board';
    case 'force-field':
      return targetChoices(state, power, []).length > 0 ? null : 'Needs one of your symbols that isn’t protected';
    case 'portal-chaos':
      return targetChoices(state, power, []).length > 0 ? null : 'Needs two symbols that aren’t protected';
    case 'wild-card':
      return wildOutcomes(state).length > 0 ? null : 'Nothing wild can happen right now';
    case 'time-heist':
      if (!state.rewind) return 'Nobody has finished a go yet';
      if (state.rewind.heist) return 'A Time Heist can’t be undone';
      if (sameStuff(state.rewind, snapshot(state))) return 'Their last go changed nothing';
      return null;
  }
}

/** Win/draw check after any board change. The player who just acted wins ties. */
function judge(state: PowerClashState, mover: Player, events: GameEvent[]): PowerClashState {
  const lineMover = winningLine(state.board, mover);
  const lineOther = winningLine(state.board, other(mover));
  const winner = lineMover ? mover : lineOther ? other(mover) : null;
  if (winner) {
    const line = (lineMover ?? lineOther) as number[];
    events.push({ kind: 'win', player: winner, line });
    return { ...state, status: winner, line };
  }
  if (state.board.every((c) => c !== null)) {
    events.push({ kind: 'draw' });
    return { ...state, status: 'draw' };
  }
  return state;
}

function endTurn(state: PowerClashState, events: GameEvent[], random: Random): PowerClashState {
  // The player who just finished is no longer blocked by anything, and their opponent's shields wear off.
  const done = state.active;
  for (const f of state.frozen) if (f.blockedFor === done) events.push({ kind: 'thaw', square: f.square });
  for (const s of state.shields) if (s.owner !== done) events.push({ kind: 'shield-off', square: s.square });
  let next: PowerClashState = {
    ...state,
    frozen: state.frozen.filter((f) => f.blockedFor !== done),
    shields: state.shields.filter((s) => s.owner === done),
    active: other(done),
    powerThisTurn: null,
    placesLeft: 1,
    turns: state.turns + 1,
    rewind: { ...state.turnStart, heist: state.powerThisTurn === 'time-heist' },
  };
  if (next.chaos && next.turns % CHAOS_EVERY === 0) next = chaosEvent(next, events, random);
  return { ...next, turnStart: snapshot(next) };
}

/**
 * The clock ran out on a turn (classmates games only): the turn passes to the other player
 * without a symbol being placed. Never a loss by itself. A power already played this turn
 * stays played. The engine's own 'skip' event tells the screen what happened.
 */
export function timeoutTurn(state: PowerClashState, random: Random = FIXED_RANDOM): PlayResult {
  if (state.status !== 'active') return { ok: false, reason: 'The round is over' };
  const events: GameEvent[] = [{ kind: 'skip', player: state.active }];
  return { ok: true, state: endTurn(state, events, random), events };
}

export function legalSkip(state: PowerClashState): boolean {
  return state.status === 'active' && state.placesLeft > 0 && placeableSquares(state).length === 0;
}

/** Every action the active player may take right now (what a bot picks from). */
export function legalActions(state: PowerClashState): Action[] {
  if (state.status !== 'active') return [];
  const actions: Action[] = placeableSquares(state).map((square) => ({ type: 'place', square }));
  if (legalSkip(state)) actions.push({ type: 'skip' });
  for (const power of state.loadout[state.active]) {
    if (powerBlockedReason(state, power)) continue;
    const walk = (picked: number[]) => {
      if (picked.length === targetsNeeded(power)) {
        actions.push({ type: 'use-power', power, targets: picked });
        return;
      }
      for (const square of targetChoices(state, power, picked)) {
        // Portal Chaos doesn't care which symbol is picked first: list each pair once.
        if (power === 'portal-chaos' && picked.length === 1 && square < picked[0]) continue;
        walk([...picked, square]);
      }
    };
    walk([]);
  }
  return actions;
}

export function play(state: PowerClashState, action: Action, random: Random = FIXED_RANDOM): PlayResult {
  if (state.status !== 'active') return { ok: false, reason: 'The round is over' };
  const me = state.active;
  const events: GameEvent[] = [];

  if (action.type === 'skip') {
    if (!legalSkip(state)) return { ok: false, reason: 'You can still place a symbol' };
    events.push({ kind: 'skip', player: me });
    return { ok: true, state: endTurn(state, events, random), events };
  }

  if (action.type === 'place') {
    if (!placeableSquares(state).includes(action.square)) {
      return { ok: false, reason: 'You cannot place there' };
    }
    const board = state.board.slice();
    board[action.square] = me;
    events.push({ kind: 'place', player: me, square: action.square });
    let next: PowerClashState = { ...state, board, placesLeft: state.placesLeft - 1 };
    next = judge(next, me, events);
    if (next.status !== 'active') return { ok: true, state: next, events };
    if (next.placesLeft <= 0 || placeableSquares(next).length === 0) next = endTurn(next, events, random);
    return { ok: true, state: next, events };
  }

  // use-power
  const { power, targets } = action;
  const blocked = powerBlockedReason(state, power);
  if (blocked) return { ok: false, reason: blocked };
  if (targets.length !== targetsNeeded(power)) return { ok: false, reason: 'Wrong number of targets' };
  for (let i = 0; i < targets.length; i++) {
    if (!targetChoices(state, power, targets.slice(0, i)).includes(targets[i])) {
      return { ok: false, reason: 'That is not a legal target' };
    }
  }

  let next: PowerClashState = {
    ...state,
    used: { ...state.used, [me]: [...state.used[me], power] },
    powerThisTurn: power,
  };
  switch (power) {
    case 'body-swap': {
      const [a, b] = targets;
      next.board = swapped(state.board, a, b);
      events.push({ kind: 'body-swap', player: me, squares: [a, b] });
      break;
    }
    case 'freeze-ray':
      next.frozen = [...state.frozen, { square: targets[0], blockedFor: other(me) }];
      events.push({ kind: 'freeze', player: me, square: targets[0] });
      break;
    case 'board-wipe': {
      const board = state.board.slice();
      board[targets[0]] = null;
      next.board = board;
      events.push({ kind: 'wipe', player: me, square: targets[0] });
      break;
    }
    case 'force-field':
      next.shields = [...state.shields, { square: targets[0], owner: me }];
      events.push({ kind: 'force-field', player: me, square: targets[0] });
      break;
    case 'portal-chaos': {
      const [a, b] = targets;
      const [d1, d2] = pickFrom(random, portalOutcomes(state, a, b));
      const board = state.board.slice();
      board[a] = null;
      board[b] = null;
      board[d1] = state.board[a];
      board[d2] = state.board[b];
      next.board = board;
      events.push({ kind: 'portal-chaos', player: me, from: [a, b], to: [d1, d2] });
      break;
    }
    case 'wild-card': {
      const all = wildOutcomes(state);
      const effect = pickFrom(random, WILD_EFFECTS.filter((e) => all.some((o) => o.effect === e)));
      const chosen = pickFrom(random, all.filter((o) => o.effect === effect));
      events.push({ kind: 'wild-card', player: me, effect });
      switch (chosen.effect) {
        case 'bonus':
          next.placesLeft = 2;
          events.push({ kind: 'bonus-move', player: me });
          break;
        case 'freeze':
          next.frozen = [...state.frozen, { square: chosen.square, blockedFor: other(me) }];
          events.push({ kind: 'freeze', player: me, square: chosen.square });
          break;
        case 'swap':
          next.board = swapped(state.board, chosen.squares[0], chosen.squares[1]);
          events.push({ kind: 'body-swap', player: me, squares: chosen.squares });
          break;
        case 'remove': {
          const board = state.board.slice();
          board[chosen.square] = null;
          next.board = board;
          events.push({ kind: 'wipe', player: me, square: chosen.square });
          break;
        }
      }
      break;
    }
    case 'time-heist': {
      // Their last go never happened (and they have the power back). I carry on with mine.
      const back = state.rewind!;
      events.push({ kind: 'time-heist', player: me, board: state.board.slice() });
      next = {
        ...next,
        board: back.board.slice(),
        frozen: back.frozen.map((f) => ({ ...f })),
        shields: back.shields.map((s) => ({ ...s })),
        used: { ...back.used, [me]: [...back.used[me], power] },
        rewind: null,
        turns: Math.max(0, state.turns - 1),
      };
      break;
    }
  }
  next = judge(next, me, events);
  return { ok: true, state: next, events };
}
