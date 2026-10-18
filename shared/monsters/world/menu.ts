/**
 * What the map menu can do, as plain rules: swap the team's order, move monsters between the team
 * and the box (a team has 1 to 6, never none), use a potion or a Repel, and look up the monster book.
 * Every function gives back a new `WorldState` and never changes the one it is given.
 */
import { MAX_TEAM, type ItemId } from '../engine';
import { MONSTER_BOOK } from '../monsterBook';
import { maxHpOf, TUNING } from '../rules';
import { REPEL_STEPS } from './rewards';
import type { WorldState } from './types';

export type MenuResult = { ok: true; state: WorldState; message: string } | { ok: false; why: string };

const no = (why: string): MenuResult => ({ ok: false, why });

/** Swaps two monsters on the team (so you can choose who goes first). */
export function swapTeam(state: WorldState, a: number, b: number): MenuResult {
  const t = state.team;
  if (!t[a] || !t[b]) return no('No such monster');
  if (a === b) return no('Pick two different monsters');
  const team = t.slice();
  [team[a], team[b]] = [team[b], team[a]];
  return { ok: true, state: { ...state, team }, message: 'Swapped.' };
}

/** Moves a monster from the team to the box. The team can never be empty. */
export function moveToBox(state: WorldState, i: number): MenuResult {
  if (!state.team[i]) return no('No such monster');
  if (state.team.length <= 1) return no('Your team needs at least one monster');
  const team = state.team.filter((_, k) => k !== i);
  return { ok: true, state: { ...state, team, box: [...state.box, state.team[i]] }, message: 'Sent to the box.' };
}

/** Moves a monster from the box to the team. The team can hold at most six. */
export function moveToTeam(state: WorldState, i: number): MenuResult {
  if (!state.box[i]) return no('No such monster');
  if (state.team.length >= MAX_TEAM) return no('Your team is full (six monsters)');
  const box = state.box.filter((_, k) => k !== i);
  return { ok: true, state: { ...state, box, team: [...state.team, state.box[i]] }, message: 'Joined your team.' };
}

/** Can this item be used from the menu on this monster? (Potions need a hurt monster that isn't tired out.) */
export function canHeal(state: WorldState, target: number): string | null {
  const m = state.team[target];
  if (!m) return 'No such monster';
  if (m.hp <= 0) return 'Tired out: only a rest at a healing spot helps';
  if (m.hp >= maxHpOf(m)) return 'Already at full health';
  return null;
}

/** Uses a potion or super potion on a team monster, or a Repel (no target). Balls can't be used on the map. */
export function applyItem(state: WorldState, item: ItemId, target?: number): MenuResult {
  if ((state.bag[item] ?? 0) < 1) return no('You have none of those');
  if (item === 'repel') {
    if (state.repel > 0) return no('A Repel is still working');
    return { ok: true, state: { ...state, repel: REPEL_STEPS, bag: { ...state.bag, repel: (state.bag.repel ?? 0) - 1 } }, message: `Repel on: no wild battles for ${REPEL_STEPS} steps in long grass.` };
  }
  if (item !== 'potion' && item !== 'super-potion') return no('That can only be used in a battle');
  const why = canHeal(state, target ?? -1);
  if (why) return no(why);
  const m = state.team[target!];
  const heal = Math.min(item === 'potion' ? TUNING.potionHeal : TUNING.superPotionHeal, maxHpOf(m) - m.hp);
  const team = state.team.map((x, i) => (i === target ? { ...x, hp: x.hp + heal } : x));
  return { ok: true, state: { ...state, team, bag: { ...state.bag, [item]: (state.bag[item] ?? 0) - 1 } }, message: `+${heal} health.` };
}

export type BookStatus = 'owned' | 'seen' | 'unknown';

/** How a monster shows in the book: owned (in your team or box now or before), seen (met in a battle), or unknown (dark shape). */
export function bookStatus(state: Pick<WorldState, 'seen' | 'owned'>, species: string): BookStatus {
  return state.owned.includes(species) ? 'owned' : state.seen.includes(species) ? 'seen' : 'unknown';
}

export function bookCounts(state: Pick<WorldState, 'seen' | 'owned'>) {
  return { owned: state.owned.length, seen: state.seen.length, total: MONSTER_BOOK.length };
}
