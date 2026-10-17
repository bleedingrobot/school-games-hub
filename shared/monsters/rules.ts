/**
 * The numbers behind battles: stats at a level, damage, exp and catching. Every tunable number
 * is in TUNING so the simulator (`npm run monsters:sim`) and a human can find them in one place.
 *
 * The exp curve (level³) and the idea that a catch is easier at low health are adapted from
 * Monster Tamer by Dev Share Academy (MIT, © 2024), https://github.com/devshareacademy/monster-tamer
 */
import { speciesOf, type Species } from './monsterBook';
import { typeMultiplier } from './types';

export type AnswerResult = 'right' | 'quick-right' | 'wrong';

export const TUNING = {
  maxLevel: 50,
  /** Damage = power × (attack ÷ defence) × (level + 2) ÷ 7 × this × type × answer, so hits grow with the monster. */
  damageScale: 0.3,
  /** Wild monsters and trainers hit softer than a student's team (they ask no question). */
  foeDamageScale: 0.55,
  /** Each hit is between (1 - this) and 1 of its full size. */
  damageSpread: 0.15,
  answerMultiplier: { right: 1, 'quick-right': 1.5, wrong: 0.25 } as Record<AnswerResult, number>,
  /** Exp a defeated monster gives = yield × its level ÷ 5, by its stage; trainers give more. */
  expCurve: 2.5,
  expYield: [11, 16, 21] as readonly number[],
  trainerExpBonus: 1.5,
  /** Catching: chance when the monster is at full health, and how much low health adds. */
  catchBase: 0.2,
  catchLowHealthBonus: 0.4,
  /** Times the chance, by answer. */
  catchAnswer: { right: 2.2, 'quick-right': 2.8, wrong: 0.6 } as Record<AnswerResult, number>,
  /** Grown monsters are harder to catch, by stage. */
  catchStage: [1, 0.8, 0.6] as readonly number[],
  catchMax: 0.95,
  /** Items. */
  potionHeal: 40,
  superPotionHeal: 120,
  ballPower: { ball: 1, 'great-ball': 1.6 } as Record<string, number>,
  /** Chance a wild monster picks its best-looking attack instead of a random one. */
  wildSmartChance: 0.5,
  shinyChance: 1 / 64,
};

export interface Monster {
  species: string;
  level: number;
  exp: number;
  hp: number;
  shiny?: boolean;
}

/**
 * Total exp a monster has when it just reached this level (level 1 = 0). Monster Tamer uses level³;
 * we use level^2.5 so levels 30-40 don't take six times as many battles as levels 5-10.
 */
export const expForLevel = (level: number) => (level <= 1 ? 0 : Math.round(level ** TUNING.expCurve));

export function maxHp(species: Species, level: number): number {
  return Math.round((species.stats.hp * level) / 10) + level + 10;
}

const power = (base: number, level: number) => base * (level + 8);

/** A fresh monster at full health. `random` rolls whether it is a shiny. */
export function makeMonster(speciesId: string, level: number, random?: () => number): Monster {
  const species = speciesOf(speciesId);
  const lv = Math.min(Math.max(Math.round(level), 1), TUNING.maxLevel);
  const shiny = random ? random() < TUNING.shinyChance : false;
  return { species: speciesId, level: lv, exp: expForLevel(lv), hp: maxHp(species, lv), ...(shiny ? { shiny } : {}) };
}

export const maxHpOf = (m: Monster) => maxHp(speciesOf(m.species), m.level);

export type Effect = 'strong' | 'weak' | 'normal';

export interface DamageResult {
  damage: number;
  effect: Effect;
}

/**
 * Damage from one attack. `answer` is the student's result for their own attacks; foes pass
 * undefined (they ask no question) and hit a bit softer. `roll` is a 0-1 random number.
 */
export function damageFor(attacker: Monster, attackPower: number, defender: Monster, answer: AnswerResult | undefined, roll: number): DamageResult {
  const a = speciesOf(attacker.species);
  const d = speciesOf(defender.species);
  const typeMult = typeMultiplier(a.type, d.type);
  const answerMult = answer ? TUNING.answerMultiplier[answer] : 1;
  const side = answer ? 1 : TUNING.foeDamageScale;
  const spread = 1 - roll * TUNING.damageSpread;
  const raw = attackPower * (power(a.stats.atk, attacker.level) / power(d.stats.def, defender.level)) * TUNING.damageScale * ((attacker.level + 2) / 7) * side * typeMult * answerMult * spread;
  return { damage: Math.max(1, Math.floor(raw)), effect: typeMult > 1 ? 'strong' : typeMult < 1 ? 'weak' : 'normal' };
}

/** Exp for beating a monster, before it is shared out. */
export function expYield(foe: Monster, trainer: boolean): number {
  const stage = speciesOf(foe.species).stage;
  return Math.max(1, Math.floor(((TUNING.expYield[stage - 1] * foe.level) / 5) * (trainer ? TUNING.trainerExpBonus : 1)));
}

/** The chance a ball works: easier at low health, much easier after a right answer. */
export function catchChance(wild: Monster, answer: AnswerResult, ball: string): number {
  const stage = speciesOf(wild.species).stage;
  const hpLeft = wild.hp / maxHpOf(wild);
  const base = TUNING.catchBase + TUNING.catchLowHealthBonus * (1 - hpLeft);
  const chance = base * TUNING.catchAnswer[answer] * TUNING.catchStage[stage - 1] * (TUNING.ballPower[ball] ?? 1);
  return Math.min(TUNING.catchMax, Math.max(0, chance));
}

/**
 * Puts exp on a monster and levels it up (and grows it) as far as it goes.
 * Returns what happened, for the screens.
 */
export function gainExp(m: Monster, amount: number): { monster: Monster; levelUps: number[]; evolvedTo: string[] } {
  const out: Monster = { ...m, exp: m.exp + amount };
  const levelUps: number[] = [];
  const evolvedTo: string[] = [];
  while (out.level < TUNING.maxLevel && out.exp >= expForLevel(out.level + 1)) {
    const before = maxHpOf(out);
    out.level += 1;
    levelUps.push(out.level);
    let sp = speciesOf(out.species);
    if (sp.evolvesTo && sp.evolveAt !== undefined && out.level >= sp.evolveAt) {
      out.species = sp.evolvesTo;
      evolvedTo.push(sp.evolvesTo);
      sp = speciesOf(out.species);
    }
    // A fainted monster stays fainted; otherwise the extra health comes in already full.
    if (out.hp > 0) out.hp += maxHpOf(out) - before;
  }
  return { monster: out, levelUps, evolvedTo };
}
