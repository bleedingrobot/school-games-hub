/**
 * The two monsters a new game starts with. The player picks two types; both start at level 5 as the
 * first form of the type's first family (a second pick of the same type gets the type's second family,
 * so the two are different). Shared by the new-game screen, the test page and the server check.
 */
import { FAMILIES } from '../monsterBook';
import { makeMonster, type Monster } from '../rules';
import type { TypeId } from '../types';

export const START_LEVEL = 5;

export function starterFor(type: TypeId, nth: number): Monster {
  const family = Object.entries(FAMILIES).filter(([, f]) => f.type === type)[nth]?.[0];
  if (!family) throw new Error(`There is no family number ${nth} for type ${type}`);
  return makeMonster(`${family}-1`, START_LEVEL);
}

export const startTeam = (picks: readonly [TypeId, TypeId]): Monster[] => [starterFor(picks[0], 0), starterFor(picks[1], picks[1] === picks[0] ? 1 : 0)];
