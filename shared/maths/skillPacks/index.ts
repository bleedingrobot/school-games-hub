/**
 * Every skill pack, in teaching order. Games pick packs from here by id.
 */
import { BandedPack, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';
import type { SkillPack } from '../skillPack';
import { ADD_SUB } from './addSub';
import { DECIMALS } from './decimals';
import { DIVISION } from './division';
import { FRACTIONS } from './fractions';
import { MONEY } from './money';
import { PATTERNS } from './patterns';
import { PLACE_VALUE } from './placeValue';
import { TimesTables } from './timesTables';

export type TopicId = 'place-value' | 'add-sub' | 'times-tables' | 'division' | 'fractions' | 'decimals';

/** The banded packs (everything except times tables, which has its own campaign steps). */
export const BANDED_PACKS: Record<Exclude<TopicId, 'times-tables'>, PackDefinition> = {
  'place-value': PLACE_VALUE,
  'add-sub': ADD_SUB,
  division: DIVISION,
  fractions: FRACTIONS,
  decimals: DECIMALS,
};

export const TOPICS: { id: TopicId; label: string }[] = [
  { id: 'place-value', label: PLACE_VALUE.label },
  { id: 'add-sub', label: ADD_SUB.label },
  { id: 'times-tables', label: 'Times tables' },
  { id: 'division', label: DIVISION.label },
  { id: 'fractions', label: FRACTIONS.label },
  { id: 'decimals', label: DECIMALS.label },
];

/** A fresh pack for a topic, loaded with the student's saved records. */
export function makePack(id: TopicId, saved: FactStats[] = [], random?: () => number, now?: () => number): SkillPack {
  if (id === 'times-tables') return new TimesTables(saved, random, now);
  return new BandedPack(BANDED_PACKS[id], saved, random, now);
}

/** Which topic a mastery key belongs to ("add:7+8" → add-sub), or undefined. */
export function topicOfKey(key: string): TopicId | undefined {
  if (/^mul:/.test(key)) return 'times-tables';
  for (const [id, def] of Object.entries(BANDED_PACKS)) {
    if (Object.values(def.families).some((f) => f.keys.includes(key))) return id as TopicId;
  }
  return undefined;
}

/**
 * Packs used only by Dragon Maths for now. They are kept out of TopicId / BANDED_PACKS / TOPICS so
 * Maths Monsters' teacher switches and topic lists do not change. Add them to those when another game wants them.
 */
export type ExtraTopicId = 'money' | 'patterns';
export const EXTRA_PACKS: Record<ExtraTopicId, PackDefinition> = { money: MONEY, patterns: PATTERNS };

export function makeExtraPack(id: ExtraTopicId, saved: FactStats[] = [], random?: () => number, now?: () => number): SkillPack {
  return new BandedPack(EXTRA_PACKS[id], saved, random, now);
}
