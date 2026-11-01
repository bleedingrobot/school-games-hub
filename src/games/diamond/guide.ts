/**
 * Nugget's help for new players (docs/DIAMOND-PLAN.md, section 8): the guided first go, first-time tips, and the
 * shop's advice with its working. Pure functions of what the pupil can see, so the guide follows whatever they do and
 * can never get stuck. Help fades: lots at first, less as they play more, or the pupil picks Lots / Some / Off.
 * Nugget never helps with the maths questions.
 */
import { BOOSTS, LAST_LEVEL, levelSpec, type BoostId } from '../../../shared/diamond/config';
import { boostPrice, type Player } from '../../../shared/diamond/progress';

export type Help = 'lots' | 'some' | 'off';
export type HelpChoice = Help | 'auto';

/** Levels played before "auto" help drops from Lots to Some, and from Some to Off. */
const LOTS_UNTIL = 5;
const SOME_UNTIL = 20;

export function helpFor(choice: HelpChoice, plays: number): Help {
  if (choice !== 'auto') return choice;
  return plays < LOTS_UNTIL ? 'lots' : plays < SOME_UNTIL ? 'some' : 'off';
}

export type TipId = 'rock' | 'passed' | 'crab' | 'sack';

/** First-time tips, each shown once on this device. "Some" help keeps only the ones marked `some`. */
export const TIPS: Record<TipId, { text: string; some: boolean }> = {
  rock: { text: 'Rocks are heavy and worth nothing. Aim for the shiny ones!', some: false },
  passed: { text: 'Target reached: level passed! Keep digging for more coins and stars, or press Finish.', some: true },
  crab: { text: 'Cave crabs scuttle about, and some carry a gem. Grab a crab and its gem comes up with it!', some: true },
  sack: { text: 'Mystery sacks hold coins, extra seconds or a free boost. Worth a grab!', some: false },
};

export const showsTip = (help: Help, id: TipId, seen: readonly string[]) => help !== 'off' && !seen.includes(id) && (help === 'lots' || TIPS[id].some);

/** What the guided first go can see of the level. */
export interface GuideView {
  drops: number;
  /** Gem coins banked so far. */
  banked: number;
  passed: boolean;
  /** The claw is out or reeling. */
  busy: boolean;
  target: number;
}

/** What lights up while a guide line shows. */
export type GuideGlow = 'drop' | 'bar' | 'finish' | null;

/**
 * The guided first go's line for this moment, worked out fresh each time from the level as it is now (so skipping
 * ahead just moves it on), or null once there's nothing left to say.
 */
export function guideStep(v: GuideView): { text: string; glow: GuideGlow } | null {
  if (v.passed) return { text: 'You passed level 1! Keep digging for coins, or press Finish to see what you caught.', glow: 'finish' };
  if (v.banked > 0) {
    return v.busy
      ? { text: 'Every gem you bring up fills the bar. Fill it to pass!', glow: 'bar' }
      : { text: `Your first gem! Bank ${v.target} before the clock runs out. Aim and Drop again!`, glow: 'drop' };
  }
  if (v.busy) return { text: v.drops === 1 ? 'Down it goes! The claw grabs the first thing it touches and reels it up.' : 'Up it comes…', glow: null };
  if (v.drops === 0) return { text: 'Watch the claw swing. Press Drop when it points straight down at the big gem!', glow: 'drop' };
  return { text: 'So close! Wait for the claw to point at the gem, then press Drop.', glow: 'drop' };
}

/**
 * Nugget's advice in the boost shop: the numbers and an opinion, with the working, never the choice itself. Null when
 * help is off.
 */
export function shopAdvice(help: Help, player: Player, level: number): string | null {
  if (help === 'off') return null;
  const spec = levelSpec(level);
  const price = (id: BoostId) => (id === player.freeBoost ? 0 : boostPrice(id, level));
  const name = (id: BoostId) => BOOSTS.find((b) => b.id === id)!.name;
  const cost = (id: BoostId) => (price(id) === 0 ? `${name(id)} is free this time` : `${name(id)} costs ${price(id)} of your ${player.coins} coins, leaving ${player.coins - price(id)}`);
  const passed = level <= player.deepest;
  if (passed) return `You’ve passed level ${level} before, so you may not need a boost. Coins saved go towards the Workshop.`;
  if (level === LAST_LEVEL) {
    return `The Heart Diamond is heavy and slippery. A Lucky Charm halves the slips of every other gem, and a Strong Winch brings heavy things up faster. ${cost('strongWinch')}.`;
  }
  if (spec.bigRocks >= 3 && price('rockBlaster') <= player.coins) {
    return `Level ${level} has ${spec.bigRocks} big rocks, and an empty grab on one wastes seconds. ${cost('rockBlaster')}. Maybe worth it, if your aim slips!`;
  }
  if (spec.crabs > 0 && price('strongWinch') <= player.coins) {
    return `Level ${level} has ${spec.crabs} cave crabs carrying gems, and heavy gems are slow to reel. ${cost('strongWinch')}.`;
  }
  return `Level ${level} needs ${spec.target} gem coins in ${spec.seconds} seconds. With good aim you may not need a boost, so you could save your coins.`;
}
