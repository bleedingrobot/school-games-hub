/**
 * Eggs (docs/MONSTERS-QUESTS-PLAN.md section 5). An egg's insides are rolled when it is found. It
 * hatches after enough days of play (3, 5 or 7 by rarity: James, 2 Nov 2026), counted by the
 * database so a Chromebook's clock can't hurry it, and only at its own hatching spot. Eggs left for
 * EGGS.coldAfter days in a row without a battle go cold and are lost, with a warning on the last day.
 */
import { MONSTER_BOOK, RARE_FAMILIES, speciesOf, type Rarity } from '../monsterBook';
import { makeMonster, TUNING, type Monster } from '../rules';
import type { TypeId } from '../types';
import type { Egg, EggKind, QuestSave } from './types';

/** EASY TO EDIT. */
export const EGGS = {
  /** Most eggs a pupil can carry. */
  basket: 3,
  /** Days of play to hatch, by what's inside. */
  days: { common: 3, uncommon: 3, rare: 5, ultra: 7 } as Record<Rarity, number>,
  /** What's inside a found egg: chances out of 100. */
  odds: { uncommon: 50, rare: 40, ultra: 10 },
  hatchLevel: 5,
  /** Days in a row without a battle (calendar days, holidays too) before every egg goes cold and is lost: James, 2 Nov 2026. */
  coldAfter: 4,
};

export const EGG_TYPE: Record<EggKind, TypeId> = { leafy: 'leaf', water: 'water', warm: 'fire', cold: 'ice', glowing: 'spark', stony: 'stone' };

export const EGG_LABEL: Record<EggKind, string> = { leafy: 'leafy egg', water: 'water egg', warm: 'warm egg', cold: 'cold egg', glowing: 'glowing egg', stony: 'stony egg' };

/** Where each kind hatches: a spot on a map (Q.4 adds the glowing rings). And what the egg says when it's ready. */
export const HATCH_SPOTS: Record<EggKind, { map: string; spot: string; place: string; wants: string }> = {
  leafy: { map: 'kauri-bush', spot: 'old-kauri', place: 'the old kauri in Kauri Bush', wants: 'somewhere green and leafy' },
  water: { map: 'lagoon-isle', spot: 'rock-pools', place: 'the rock pools on Lagoon Isle', wants: 'somewhere wet and salty' },
  warm: { map: 'steam-valley', spot: 'hot-springs', place: 'the hot springs in Steam Valley', wants: 'somewhere warm' },
  cold: { map: 'aurora-hollow', spot: 'ice-cave', place: 'the ice cave in Aurora Hollow', wants: 'somewhere icy cold' },
  glowing: { map: 'glowworm-caves', spot: 'crystal-pool', place: 'the crystal pool in Glowworm Caves', wants: 'somewhere dark and glowing' },
  stony: { map: 'harbour-city', spot: 'quarry', place: 'the quarry in Harbour City', wants: 'somewhere rocky' },
};

/** The first forms an egg of this kind can hold, by rarity. Every type has an uncommon family, a rare family and an ultra rare. */
export function eggPool(kind: EggKind): Record<'uncommon' | 'rare' | 'ultra', string[]> {
  const type = EGG_TYPE[kind];
  const firsts = MONSTER_BOOK.filter((s) => s.stage === 1);
  return {
    uncommon: firsts.filter((s) => s.rarity === 'uncommon' && s.type === type).map((s) => s.id),
    // A giant's first form hatches only from its own kind of egg (its type).
    rare: firsts.filter((s) => s.rarity === 'rare' && s.type === type && (RARE_FAMILIES[s.family] !== undefined)).map((s) => s.id),
    ultra: firsts.filter((s) => s.rarity === 'ultra' && (s.type === type || s.type2 === type)).map((s) => s.id),
  };
}

/** A newly found egg. `roll` gives 0-1 numbers (the world's dice): three are always used. */
export function findEgg(id: string, kind: EggKind, found: number, roll: () => number, inside?: string): Egg {
  const pool = eggPool(kind);
  const r = roll() * 100;
  const tier = r < EGGS.odds.uncommon ? 'uncommon' : r < EGGS.odds.uncommon + EGGS.odds.rare ? 'rare' : 'ultra';
  const list = pool[tier];
  const pick = list[Math.floor(roll() * list.length)] ?? pool.uncommon[0];
  const shiny = roll() < TUNING.shinyChance;
  return { id, kind, species: inside ?? pick, found, ...(shiny ? { shiny: true } : {}) };
}

/** Days of play this egg needs (one fewer if warmed). */
export const daysNeeded = (egg: Egg) => EGGS.days[speciesOf(egg.species).rarity] - (egg.warmed ? 1 : 0);

/** How many of its days it has had. */
export const daysHad = (egg: Egg, playDays: number) => Math.max(0, Math.min(daysNeeded(egg), playDays - egg.found));

export const isReady = (egg: Egg, playDays: number) => daysHad(egg, playDays) >= daysNeeded(egg);

/** Puts a found egg in the basket, unless it's full or this egg was found before. */
export function addEgg(q: QuestSave, egg: Egg): { q: QuestSave; added: boolean } {
  if (q.eggs.length >= EGGS.basket || q.eggs.some((e) => e.id === egg.id) || q.flags.includes(`egg:${egg.id}`)) return { q, added: false };
  return { q: { ...q, eggs: [...q.eggs, egg], flags: [...q.flags, `egg:${egg.id}`] }, added: true };
}

/** Uses an egg warmer (made at the Tinker) on one egg. */
export function warmEgg(q: QuestSave, eggId: string): QuestSave {
  return { ...q, eggs: q.eggs.map((e) => (e.id === eggId && !e.warmed ? { ...e, warmed: true } : e)) };
}

/**
 * Hatches an egg standing on its spot. Refuses (null) if it isn't ready or this isn't its spot.
 * The monster joins the team, or the box if the team is full (the caller does that), at level 5.
 */
export function hatch(q: QuestSave, eggId: string, playDays: number, where: { map: string; spot: string }): { q: QuestSave; monster: Monster } | null {
  const egg = q.eggs.find((e) => e.id === eggId);
  if (!egg || !isReady(egg, playDays)) return null;
  const spot = HATCH_SPOTS[egg.kind];
  if (spot.map !== where.map || spot.spot !== where.spot) return null;
  const monster: Monster = { ...makeMonster(egg.species, EGGS.hatchLevel), ...(egg.shiny ? { shiny: true } : {}) };
  const flag = `hatched:${egg.kind}`;
  return {
    q: { ...q, eggs: q.eggs.filter((e) => e.id !== eggId), flags: q.flags.includes(flag) ? q.flags : [...q.flags, flag] },
    monster,
  };
}

/** Whole calendar days from NZ day `a` to NZ day `b` ("2026-11-02" to "2026-11-04" is 2). */
const daysFrom = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/**
 * How the eggs are keeping on `today`: 'warm', 'cooling' (the last day: a battle today saves them) or
 * 'cold' (lost). No eggs, or no battle yet since this rule began, is always warm.
 */
export function eggWarmth(q: Pick<QuestSave, 'eggs' | 'lastDay'>, today: string): 'warm' | 'cooling' | 'cold' {
  if (!q.eggs.length || !q.lastDay) return 'warm';
  const away = daysFrom(q.lastDay, today);
  return away > EGGS.coldAfter ? 'cold' : away === EGGS.coldAfter ? 'cooling' : 'warm';
}

/** Takes away eggs that went cold. `lost` is what was taken (empty if none). */
export function coldEggs(q: QuestSave, today: string): { q: QuestSave; lost: Egg[] } {
  if (eggWarmth(q, today) !== 'cold') return { q, lost: [] };
  return { q: { ...q, eggs: [] }, lost: q.eggs };
}

/** What the game says about cold eggs when it opens. */
export const coldWords = {
  lost: (n: number) => n === 1
    ? 'Brrr! Your egg went cold while you were away, and it won’t hatch now. Eggs need a battle at least every 4 days.'
    : `Brrr! Your ${n} eggs went cold while you were away, and they won’t hatch now. Eggs need a battle at least every 4 days.`,
  cooling: 'Your eggs are getting cold! Have a battle today to keep them warm.',
};
