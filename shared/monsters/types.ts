/**
 * The six monster types and the maths topic each one stands for. The type wheel is
 * Leaf > Water > Fire > Ice > Spark > Stone > Leaf ("A > B": A is strong against B).
 */
import type { TopicId } from '../maths/skillPacks';

export type TypeId = 'leaf' | 'water' | 'fire' | 'ice' | 'spark' | 'stone';

/** In wheel order: each type is strong against the one after it, and weak against the one before it. */
export const TYPES: readonly TypeId[] = ['leaf', 'water', 'fire', 'ice', 'spark', 'stone'];

export const TYPE_LABEL: Record<TypeId, string> = {
  leaf: 'Leaf', water: 'Water', fire: 'Fire', ice: 'Ice', spark: 'Spark', stone: 'Stone',
};

/** The topic a type's attacks (and its catch questions) are asked from. */
export const TYPE_TOPIC: Record<TypeId, TopicId> = {
  leaf: 'place-value',
  water: 'add-sub',
  fire: 'times-tables',
  ice: 'division',
  spark: 'fractions',
  stone: 'decimals',
};

export const STRONG_MULTIPLIER = 1.5;
export const WEAK_MULTIPLIER = 0.75;

/** The type this one is strong against. */
export const strongAgainst = (t: TypeId): TypeId => TYPES[(TYPES.indexOf(t) + 1) % TYPES.length];
/** The type that is strong against this one. */
export const weakTo = (t: TypeId): TypeId => TYPES[(TYPES.indexOf(t) + TYPES.length - 1) % TYPES.length];

/** ×1.5 when the attacker is strong against the defender, ×0.75 when it is weak, otherwise ×1. */
export function typeMultiplier(attack: TypeId, defender: TypeId): number {
  if (strongAgainst(attack) === defender) return STRONG_MULTIPLIER;
  if (weakTo(attack) === defender) return WEAK_MULTIPLIER;
  return 1;
}
