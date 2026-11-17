import type { ExtraTopicId } from '../maths/skillPacks';
import type { TopicId } from '../maths/skillPacks';
import { MAX_LEVEL, friendly, levelUpGain, tierPower } from './data';
import type { FightOptions } from './engine';
import type { Hero } from './types';

/**
 * Where maths turns up in Dragon Maths, and what each result is worth (docs/LORD-PLAN.md section 8).
 *
 * The rules that never change: no timer and no speed bonus; a wrong answer shows the worked answer and
 * the game goes on with nothing lost; one hint per question. The questions themselves are ladder questions from
 * the pupil's maths focus, made, kept and marked by the server (`ask` and `ask-check` in server.ts).
 */

export type MomentId = 'size-it-up' | 'shop' | 'healer' | 'bank' | 'riddle' | 'treasure' | 'inn-guess' | 'master-trial' | 'dragon-trial' | 'arena';

/** How a question went. A "hint" is a right answer given after using the hint. */
export type Result = 'right' | 'hint' | 'wrong';

type PackId = TopicId | ExtraTopicId;

/**
 * How many ladder questions each moment asks (`ask` on the server). Every question comes from the pupil's own maths focus
 * (the ladder, or what the teacher set), the same as the other games: the moment only decides what a right answer is worth.
 */
export const ASK_COUNT: Record<MomentId, number> = {
  'size-it-up': 1, shop: 1, healer: 1, bank: 1, riddle: 1, treasure: 1,
  'inn-guess': 0, // the number-guess game is logic, not a question
  'master-trial': 3, 'dragon-trial': 1,
  // An arena clash: each round's question powers that round's attack (shared/lord/clash.ts).
  arena: 1,
};

/** The topics of the forest's treasure events (once the teacher's tick-list; questions now come from the maths focus). */
export const ALL_TOPICS: PackId[] = ['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals', 'money', 'patterns'];

/** The topics to use from a settings list: the known ones only, and never none (an empty or unreadable list means all). */
export function topicsOn(list: unknown): PackId[] {
  const on = Array.isArray(list) ? ALL_TOPICS.filter((t) => list.includes(t)) : [];
  return on.length ? on : ALL_TOPICS;
}

/** Questions in a master's trial. */
export const MASTER_TRIAL_QUESTIONS = 3;
/** About one fight in this many offers "size it up". */
export const SIZE_IT_UP_ONE_IN = 3;

/** Does this fight offer a "size it up" question? A pure function of the seed so a replay agrees. */
export const offersSizeItUp = (seed: number) => (Math.imul(seed >>> 0, 2654435761) >>> 0) % SIZE_IT_UP_ONE_IN === 0;

// ---------- Rewards ----------

/** Size it up: a right answer finds the monster's weak spot. */
export const sizeItUpBonus = (result: Result): number => (result === 'right' ? 1.5 : result === 'hint' ? 1.25 : 1);

/** Size it up, a right answer: this much more gold for winning the fight (question skips, James 22 Oct 2026: answering should beat skipping). */
export const SIZE_IT_UP_GOLD = 0.2;
/** The gold a won forest fight pays: a right Size it up adds SIZE_IT_UP_GOLD (rounded up, so at least 1). */
export const sizeItUpGold = (gold: number, result: Result | null): number => (result === 'right' && gold > 0 ? gold + Math.ceil(gold * SIZE_IT_UP_GOLD) : gold);

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

/**
 * Bank interest (optional, from level 4, once a day). The banker pays 1 gold for every INTEREST_EVERY gold saved (5%)
 * and asks the pupil to work out how much that is for their own savings. A right answer gets it all, a right answer
 * after a hint gets half (rounded up), a wrong answer gets nothing (and is shown the right amount).
 */
export const INTEREST_EVERY = 20;
/** The interest on these savings: the answer to the banker's question. */
export const interestDue = (bank: number): number => Math.floor(Math.max(0, bank) / INTEREST_EVERY);
export const interestFor = (bank: number, result: Result): number => {
  const due = interestDue(bank);
  return result === 'right' ? due : result === 'hint' ? Math.ceil(due / 2) : 0;
};

/** The inn's number guess: pick 1-100 and guess in 7 tries (halving always works). A win pays well, a miss pays a little for trying. */
export const NUMBER_GUESS_TRIES = 7;
export const numberGuessPrize = (level: number, won: boolean): number => Math.round(tierPower(level) * (won ? 1 : 0.2));

/** The inn's riddle of the day: a right answer pays well, a wrong one pays a little for trying. */
export const riddleGold = (level: number, result: Result): number => friendly(tierPower(level) * (result === 'right' ? 1.5 : result === 'hint' ? 0.75 : 0.3));
