import type {
  Action, GameEvent, Player, PlayResult, PowerClashState, PowerId,
} from './types';

export const POWER_IDS: PowerId[] = ['double-trouble', 'body-swap', 'freeze-ray', 'board-wipe'];
export const LOADOUT_SIZE = 3;

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

export function newRound(
  loadout: Record<Player, PowerId[]>,
  starter: Player,
): PowerClashState {
  if (!validLoadout(loadout.X) || !validLoadout(loadout.O)) {
    throw new Error('Each player needs three different powers');
  }
  return {
    board: Array(9).fill(null),
    active: starter,
    status: 'active',
    loadout: { X: [...loadout.X], O: [...loadout.O] },
    used: { X: [], O: [] },
    frozen: [],
    powerThisTurn: null,
    placesLeft: 1,
    line: null,
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

/** Squares the active player can pick for the next target of a power. [] = none. */
export function targetChoices(state: PowerClashState, power: PowerId, picked: number[]): number[] {
  const me = state.active;
  const they = other(me);
  const all = state.board.map((_, i) => i);
  switch (power) {
    case 'double-trouble':
      return [];
    case 'body-swap':
      if (picked.length === 0) return all.filter((i) => state.board[i] === me);
      if (picked.length === 1) return all.filter((i) => state.board[i] === they);
      return [];
    case 'freeze-ray':
      return picked.length === 0 ? all.filter((i) => state.board[i] === null) : [];
    case 'board-wipe':
      return picked.length === 0 ? all.filter((i) => state.board[i] !== null) : [];
  }
}

function targetsNeeded(power: PowerId): number {
  return power === 'body-swap' ? 2 : power === 'double-trouble' ? 0 : 1;
}

/** Why the active player can't play this power right now, or null if they can. */
export function powerBlockedReason(state: PowerClashState, power: PowerId): string | null {
  if (state.status !== 'active') return 'The round is over';
  if (!hasPower(state, state.active, power)) return 'You have already used this power';
  if (state.powerThisTurn) return 'One power per turn';
  switch (power) {
    case 'double-trouble':
      return placeableSquares(state).length >= 2 ? null : 'Needs two squares you can place on';
    case 'body-swap':
      return targetChoices(state, power, []).length > 0 &&
        targetChoices(state, power, [0]).length > 0
        ? null
        : 'Needs one X and one O on the board';
    case 'freeze-ray':
      return targetChoices(state, power, []).length > 0 ? null : 'Needs an empty square';
    case 'board-wipe':
      return targetChoices(state, power, []).length > 0 ? null : 'Needs a symbol on the board';
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

function endTurn(state: PowerClashState, events: GameEvent[]): PowerClashState {
  // The player who just finished is no longer blocked by anything.
  const done = state.active;
  for (const f of state.frozen) if (f.blockedFor === done) events.push({ kind: 'thaw', square: f.square });
  return {
    ...state,
    frozen: state.frozen.filter((f) => f.blockedFor !== done),
    active: other(done),
    powerThisTurn: null,
    placesLeft: 1,
  };
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
      for (const square of targetChoices(state, power, picked)) walk([...picked, square]);
    };
    walk([]);
  }
  return actions;
}

export function play(state: PowerClashState, action: Action): PlayResult {
  if (state.status !== 'active') return { ok: false, reason: 'The round is over' };
  const me = state.active;
  const events: GameEvent[] = [];

  if (action.type === 'skip') {
    if (!legalSkip(state)) return { ok: false, reason: 'You can still place a symbol' };
    events.push({ kind: 'skip', player: me });
    return { ok: true, state: endTurn(state, events), events };
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
    if (next.placesLeft <= 0 || placeableSquares(next).length === 0) next = endTurn(next, events);
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
    case 'double-trouble':
      next.placesLeft = 2;
      events.push({ kind: 'double-trouble', player: me });
      break;
    case 'body-swap': {
      const [a, b] = targets;
      const board = state.board.slice();
      board[a] = state.board[b];
      board[b] = state.board[a];
      next.board = board;
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
  }
  next = judge(next, me, events);
  if (next.status !== 'active') return { ok: true, state: next, events };
  return { ok: true, state: next, events };
}
