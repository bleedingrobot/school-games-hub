/**
 * The spells. Numbers (power, SP cost, level) are The Clans'; the numbering matches its spell
 * file so the class lists in gamedata.ts line up. Names are ours.
 */
import type { Stat } from './types';

export type SpellKind = 'damage' | 'heal' | 'buff' | 'debuff' | 'tie' | 'summon';

export interface SpellDef {
  id: number;
  name: string;
  kind: SpellKind;
  /** Heal or damage power. */
  value: number;
  sp: number;
  /** Makes the spell harder for the target to shrug off. */
  level: number;
  /** Targets the caster's own side. */
  friendly?: boolean;
  /** Hits every enemy. */
  all?: boolean;
  mod?: { stat: Stat; amount: number; rounds: number };
  /** Not in the game yet (helpers that fight for you come later). */
  notYet?: boolean;
}

const list: SpellDef[] = [
  { id: 1, name: 'Little Heal', kind: 'heal', value: 10, sp: 8, level: 0, friendly: true },
  { id: 2, name: 'Heal', kind: 'heal', value: 14, sp: 13, level: 0, friendly: true },
  { id: 3, name: 'Slow', kind: 'debuff', value: 0, sp: 4, level: 3, mod: { stat: 'agility', amount: -2, rounds: 3 } },
  { id: 4, name: 'Strength', kind: 'buff', value: 0, sp: 6, level: 5, friendly: true, mod: { stat: 'strength', amount: 5, rounds: 4 } },
  { id: 5, name: 'Ropes', kind: 'tie', value: 0, sp: 9, level: 3 },
  { id: 6, name: 'Call Spirit Helper', kind: 'summon', value: 1, sp: 13, level: 5, friendly: true, notYet: true },
  { id: 7, name: 'Send Spirits Away', kind: 'summon', value: 0, sp: 9, level: 5, notYet: true },
  { id: 8, name: 'Fireball', kind: 'damage', value: 9, sp: 4, level: 6 },
  { id: 9, name: "Dragon's Uppercut", kind: 'damage', value: 12, sp: 6, level: 8 },
  { id: 10, name: 'Call Ghost Warrior', kind: 'summon', value: 1, sp: 7, level: 5, friendly: true, notYet: true },
  { id: 11, name: 'Heavy Blow', kind: 'damage', value: 10, sp: 6, level: 9 },
  { id: 12, name: 'Wither', kind: 'damage', value: 3, sp: 7, level: 9, all: true },
  { id: 13, name: 'Magic Chains', kind: 'tie', value: 0, sp: 12, level: 4 },
  { id: 14, name: 'Holy Heal', kind: 'heal', value: 4, sp: 7, level: 0, friendly: true },
  { id: 15, name: 'Lightning Bolt', kind: 'damage', value: 25, sp: 15, level: 8 },
  { id: 16, name: 'Sneak Attack', kind: 'damage', value: 17, sp: 9, level: 9 },
  { id: 17, name: 'Fire Breath', kind: 'damage', value: 10, sp: 9, level: 15 },
  { id: 18, name: 'Battle Fury', kind: 'buff', value: 0, sp: 7, level: 6, friendly: true, mod: { stat: 'strength', amount: 6, rounds: 4 } },
  { id: 19, name: 'Scare', kind: 'debuff', value: 0, sp: 9, level: 6, mod: { stat: 'strength', amount: -3, rounds: 3 } },
  { id: 20, name: 'Light Blow', kind: 'damage', value: 13, sp: 4, level: 3 },
  { id: 21, name: 'Hurricane Kick', kind: 'damage', value: 10, sp: 4, level: 5 },
  { id: 22, name: 'Divine Warrior', kind: 'summon', value: 1, sp: 8, level: 5, friendly: true, notYet: true },
  { id: 23, name: 'Dazzle', kind: 'debuff', value: 0, sp: 6, level: 5, mod: { stat: 'dexterity', amount: -3, rounds: 3 } },
  { id: 24, name: 'Fire Breath', kind: 'damage', value: 6, sp: 9, level: 15 },
  { id: 25, name: 'Thunder Rain', kind: 'damage', value: 4, sp: 14, level: 12, all: true },
];

export const SPELLS: Record<number, SpellDef> = Object.fromEntries(list.map((s) => [s.id, s]));
