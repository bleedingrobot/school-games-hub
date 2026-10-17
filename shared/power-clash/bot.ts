/**
 * The Power Clash bots. Pure rules code: no screen, no clock. Every random choice comes from
 * the `random` source passed in (a seeded one in real games), so the server can replay a
 * bot game and get the same moves. Nothing here is based on time either: Medium stops
 * thinking after a fixed number of positions, not after a fixed number of milliseconds.
 *
 * A bot picks ONE action at a time (a power, then a square, is two calls), always from
 * `legalActions`, so it can only ever do what the engine allows.
 *
 *  - Very Easy: random legal moves, and now and then uses a power.
 *  - Easy: takes a win it can see, blocks a win it can see, uses powers a bit randomly.
 *  - Medium: looks ahead through placements and powers, and has a fixed good set of powers.
 *    It still slips now and then, so it can be beaten.
 */
import type { BotLevel } from '../botGame';
import { LINES, legalActions, other, play, POWER_IDS } from './engine';
import type { Action, Player, PowerClashState, PowerId } from './types';

export type Random = () => number;

/** Medium's three powers. Chosen by the simulation (scripts/power-clash-sim.mjs). */
export const MEDIUM_POWERS: PowerId[] = ['double-trouble', 'body-swap', 'board-wipe'];

/** The chance each level does something silly instead of its best idea. */
const EASY_SLIP = 0.2;
const MEDIUM_SLIP = 0.15;
/** How often Easy uses a power when it can, and Very Easy. */
const EASY_POWER = 0.22;
const VERY_EASY_POWER = 0.12;
/** The most positions Medium looks at for one move. A fixed count, not a clock, so a replay gets the same answer. */
export const MEDIUM_NODE_BUDGET = 20000;
const MEDIUM_MAX_DEPTH = 3;

const pick = <T,>(random: Random, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** The three powers a bot brings to a match. Only Medium has a fixed set. */
export function chooseLoadout(level: BotLevel, random: Random): PowerId[] {
  if (level === 'medium') return [...MEDIUM_POWERS];
  const pool = [...POWER_IDS];
  const chosen: PowerId[] = [];
  while (chosen.length < 3) chosen.push(pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0]);
  return chosen;
}

/** The action the active player's bot takes. Always one of `legalActions(state)`. */
export function chooseAction(state: PowerClashState, level: BotLevel, random: Random): Action {
  const actions = legalActions(state);
  if (actions.length === 0) throw new Error('No legal action: the round is over');
  if (actions.length === 1) return actions[0];
  if (level === 'very-easy') return veryEasy(actions, random);
  if (level === 'easy') return easy(state, actions, random);
  return medium(state, actions, random);
}

const isPower = (a: Action) => a.type === 'use-power';

function veryEasy(actions: Action[], random: Random): Action {
  const powers = actions.filter(isPower);
  if (powers.length > 0 && random() < VERY_EASY_POWER) return pick(random, powers);
  const rest = actions.filter((a) => !isPower(a));
  return pick(random, rest.length ? rest : actions);
}

/** Does this action win the round for `me` straight away? */
const wins = (state: PowerClashState, action: Action, me: Player) => {
  const r = play(state, action);
  return r.ok && r.state.status === me;
};

function easy(state: PowerClashState, actions: Action[], random: Random): Action {
  const me = state.active;
  const win = actions.find((a) => wins(state, a, me));
  if (win && random() < 0.95) return win;

  const powers = actions.filter(isPower);
  if (powers.length > 0 && random() < EASY_POWER) return pick(random, powers);

  const places = actions.filter((a) => !isPower(a));
  const pool = places.length ? places : actions;
  if (random() < EASY_SLIP) return pick(random, pool);
  // Don't hand the opponent a win they can see: after this move, can they place and win?
  const safe = pool.filter((a) => {
    const r = play(state, a);
    if (!r.ok || r.state.status !== 'active' || r.state.active === me) return true;
    return !legalActions(r.state).some((o) => o.type === 'place' && wins(r.state, o, other(me)));
  });
  return pick(random, safe.length ? safe : pool);
}

// ---------- Medium: look ahead ----------

const WIN = 10000;

/** How good the board looks for `root`, when the search stops looking. */
function evaluate(state: PowerClashState, root: Player): number {
  const foe = other(root);
  let score = 0;
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const i of line) {
      if (state.board[i] === root) mine++;
      else if (state.board[i] === foe) theirs++;
    }
    if (theirs === 0 && mine > 0) score += mine === 1 ? 1 : 9;
    if (mine === 0 && theirs > 0) score -= theirs === 1 ? 1 : 9;
  }
  if (state.board[4] === root) score += 2;
  else if (state.board[4] === foe) score -= 2;
  // Keeping a power in hand is worth a little: it can still turn a game round.
  score += 2 * (state.loadout[root].length - state.used[root].length);
  score -= 2 * (state.loadout[foe].length - state.used[foe].length);
  return score;
}

class OutOfBudget extends Error {}

function medium(state: PowerClashState, actions: Action[], random: Random): Action {
  const me = state.active;
  const win = actions.find((a) => wins(state, a, me));
  if (win) return win;
  if (random() < MEDIUM_SLIP) return pick(random, actions);

  let nodes = 0;
  const search = (s: PowerClashState, depth: number, alpha: number, beta: number): number => {
    if (s.status !== 'active') {
      if (s.status === 'draw') return 0;
      return s.status === me ? WIN + depth : -(WIN + depth);
    }
    if (++nodes > MEDIUM_NODE_BUDGET) throw new OutOfBudget();
    if (depth === 0) return evaluate(s, me);
    const maximising = s.active === me;
    let best = maximising ? -Infinity : Infinity;
    for (const a of legalActions(s)) {
      const r = play(s, a);
      if (!r.ok) continue;
      const v = search(r.state, depth - 1, alpha, beta);
      if (maximising) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    return best;
  };

  // Look one move deeper each time, until the budget runs out; keep the last full answer.
  let ranked: { action: Action; value: number }[] = actions.map((action) => ({ action, value: 0 }));
  for (let depth = 1; depth <= MEDIUM_MAX_DEPTH; depth++) {
    try {
      const scored = ranked.map(({ action }) => {
        const r = play(state, action);
        return { action, value: r.ok ? search(r.state, depth - 1, -Infinity, Infinity) : -Infinity };
      });
      scored.sort((a, b) => b.value - a.value);
      ranked = scored;
      if (ranked[0].value >= WIN) break;
    } catch (error) {
      if (!(error instanceof OutOfBudget)) throw error;
      break;
    }
  }
  const top = ranked[0].value;
  return pick(random, ranked.filter((r) => r.value === top)).action;
}
