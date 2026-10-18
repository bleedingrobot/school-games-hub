import type { ExtraTopicId } from '../maths/skillPacks';
import type { TopicId } from '../maths/skillPacks';
import { MAX_LEVEL, friendly, levelUpGain, tierPower } from './data';
import type { FightOptions } from './engine';
import type { Hero } from './types';

/**
 * Where maths turns up in Dragon Maths, and what each result is worth (docs/LORD-PLAN.md section 8).
 *
 * The rules that never change: no timer and no speed bonus; a wrong answer shows the worked answer and
 * the game goes on with nothing lost; one hint per question. The questions themselves come from the
 * shared packs and are made and marked by code (the server rebuilds each one from its numbers).
 */

export type MomentId = 'size-it-up' | 'shop' | 'healer' | 'bank' | 'riddle' | 'treasure' | 'inn-guess' | 'master-trial' | 'dragon-trial';

/** How a question went. A "hint" is a right answer given after using the hint. */
export type Result = 'right' | 'hint' | 'wrong';

type PackId = TopicId | ExtraTopicId;

/** The pack each moment draws from. Where the teacher has turned a topic off, the game uses the next in the list. */
export const MOMENT_TOPICS: Record<MomentId, PackId[]> = {
  'size-it-up': ['add-sub', 'times-tables', 'place-value', 'division', 'fractions', 'decimals'], // whichever the teacher has on
  shop: ['money', 'add-sub'],
  healer: ['times-tables', 'division'],
  bank: ['decimals', 'add-sub'],
  riddle: ['patterns', 'place-value'],
  treasure: ['place-value', 'division', 'money', 'patterns'],
  'inn-guess': [], // the number-guess game is logic, not a pack
  'master-trial': ['add-sub', 'times-tables', 'place-value', 'division', 'fractions', 'decimals', 'money', 'patterns'],
  'dragon-trial': ['add-sub', 'times-tables', 'place-value', 'division', 'fractions', 'decimals', 'money', 'patterns'],
};

/** Questions in a master's trial. */
export const MASTER_TRIAL_QUESTIONS = 3;
/** About one fight in this many offers "size it up". */
export const SIZE_IT_UP_ONE_IN = 3;

/** The difficulty band (1 easiest, 4 hardest) that suits a hero's level when nothing better is known. */
export const defaultBand = (level: number) => Math.min(4, Math.max(1, Math.ceil(level / 3)));

/** Does this fight offer a "size it up" question? A pure function of the seed so a replay agrees. */
export const offersSizeItUp = (seed: number) => (Math.imul(seed >>> 0, 2654435761) >>> 0) % SIZE_IT_UP_ONE_IN === 0;

// ---------- Rewards ----------

/** Size it up: a right answer finds the monster's weak spot. */
export const sizeItUpBonus = (result: Result): number => (result === 'right' ? 1.5 : result === 'hint' ? 1.25 : 1);

/** Shop and healer: a right answer is 10% off (a hint earns 5%); wrong is full price. */
export const priceDiscount = (result: Result): number => (result === 'right' ? 0.1 : result === 'hint' ? 0.05 : 0);

/** Master's trial: each right answer adds a little strength when you level up (a tenth of the usual gain, at least 1). */
export function masterTrialStrength(toLevel: number, results: Result[]): number {
  const per = Math.max(1, Math.round(levelUpGain(toLevel).strength * 0.1));
  return results.reduce((sum, r) => sum + (r === 'right' ? per : r === 'hint' ? Math.ceil(per / 2) : 0), 0);
}

export function addMasterTrialBonus(hero: Hero, results: Result[]): Hero {
  return { ...hero, strength: hero.strength + masterTrialStrength(hero.level, results) };
}

/**
 * Before each dragon stage: a right answer gives a small shield and a slightly bigger first hit. A wrong answer gives
 * neither, and the fight still goes on. The dragon is a fight, not a test (James, 18 Oct): gear and class skills
 * decide it, and the riddles are a nudge.
 */
export function dragonStageOptions(result: Result): Pick<FightOptions, 'shield' | 'firstHitBonus'> {
  const shield = Math.round(tierPower(MAX_LEVEL) * 0.02);
  if (result === 'right') return { shield, firstHitBonus: 1.2 };
  if (result === 'hint') return { shield: Math.round(shield / 2), firstHitBonus: 1.1 };
  return {};
}

/** Bank interest question (optional, older pupils): a right answer adds a little interest, once a day. */
export const interestFor = (bank: number, result: Result): number => (result === 'right' ? Math.floor(bank * 0.05) : result === 'hint' ? Math.floor(bank * 0.025) : 0);

/** The inn's number guess: pick 1-100 and guess in 7 tries (halving always works). A win pays well, a miss pays a little for trying. */
export const NUMBER_GUESS_TRIES = 7;
export const numberGuessPrize = (level: number, won: boolean): number => Math.round(tierPower(level) * (won ? 1 : 0.2));

/** The inn's riddle of the day: a right answer pays well, a wrong one pays a little for trying. */
export const riddleGold = (level: number, result: Result): number => friendly(tierPower(level) * (result === 'right' ? 1.5 : result === 'hint' ? 0.75 : 0.3));
