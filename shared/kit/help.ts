/**
 * Game kit: help that follows the child, not the calendar (docs/LEARNING-DESIGN.md rule 5, docs/plans/GAME-KIT-PLAN.md).
 * No game words here: each game names its own help steps and passes its own numbers.
 *
 * Two ways to follow a child, for two kinds of game:
 *  - per fact (`helpForFact`), from the child's maths record of each fact, when the game's facts can be told apart. A wrong
 *    answer drops a fact to box 1 (shared/maths/leitner.ts), so its full help comes back by itself.
 *  - per child (`fadeAfter`, `placeAfter`), from how each counted round went, when they can't (one key for many questions).
 *
 * Either way the server works the help out when a round starts and saves it with the round, so the browser and the replay
 * agree. These rules only count on the day's first finish, so playing again for fun never moves the help.
 */
import type { FactStats } from '../maths/leitner';

/** Goes in a row with a wrong first tap that bring full help back for the rest of the round. Not saved. */
export const STRUGGLE_GOES = 3;

// ---------------------------------------------------------------- the teacher's setting

/** 'fade' follows the child; 'always' keeps the help on; 'off' takes it away. */
export type HelpSetting = 'fade' | 'always' | 'off';
export const HELP_SETTINGS: readonly HelpSetting[] = ['fade', 'always', 'off'];

/** The teacher's setting on top of the child's own help. The game says what 'always' and 'off' show. */
export const helpWithSetting = <H>(help: H, setting: HelpSetting, shown: { always: H; off: H }): H =>
  setting === 'always' ? shown.always : setting === 'off' ? shown.off : help;

// ---------------------------------------------------------------- per fact

/** One step of a game's help, most help first. It stays until the fact's record reaches every number in `until`. */
export interface FactRung<H> {
  help: H;
  until?: { box?: number; quickDays?: number; correct?: number };
}

/** The help for a fact from its record: the first rung it hasn't passed. No record gets the first; the last rung is never left. */
export function helpForFact<H>(stats: Pick<FactStats, 'box' | 'correct' | 'quickDays'> | undefined, rungs: readonly FactRung<H>[]): H {
  if (!stats) return rungs[0].help;
  const stays = ({ until = {} }: FactRung<H>) =>
    stats.box < (until.box ?? 0) || stats.quickDays.length < (until.quickDays ?? 0) || stats.correct < (until.correct ?? 0);
  return (rungs.slice(0, -1).find(stays) ?? rungs[rungs.length - 1]).help;
}

// ---------------------------------------------------------------- per child

export interface FadeRules {
  /** Right at the first tap on this many goes or more makes a good round. */
  good: number;
  /** This many or fewer makes a hard one. */
  hard: number;
  /** Good rounds in a row that take the help down a level. */
  goodToFade: number;
  /** The most help there is. Levels run from this down to 0, no help. */
  topLevel: number;
}

/** The numbers in LEARNING-DESIGN rule 5, for a round of ten goes. The game adds its `topLevel`. */
export const ROUND_OF_TEN = { good: 8, hard: 4, goodToFade: 2 } as const;

export interface Fade {
  /** How much help: 0 none, up to `topLevel`. */
  level: number;
  /** Good rounds in a row so far. */
  goodInRow: number;
}

/**
 * The help after a counted round with `right` goes right at the first tap: enough good rounds in a row take it down one
 * level, a hard round brings one level back at once. `faded` says it went down on this round.
 */
export function fadeAfter(p: Fade, right: number, rules: FadeRules): Fade & { faded: boolean } {
  let { level } = p;
  let goodInRow = right >= rules.good ? p.goodInRow + 1 : 0;
  let faded = false;
  if (goodInRow >= rules.goodToFade) {
    level = Math.max(0, level - 1);
    goodInRow = 0;
    faded = true;
  }
  if (right <= rules.hard) level = Math.min(rules.topLevel, level + 1);
  return { level, goodInRow, faded };
}

/** The help for each kind of go: a map from the kind's name (the game's own string) to its level and good rounds in a row. */
export type KindLevels = Record<string, Fade>;

/**
 * Help for each kind of go, after a counted round. For each kind with at least 2 goes, the goes right at the first tap are
 * scaled to ten (`Math.round(10 * right / n)`) and `fadeAfter` is run with the rules (use `ROUND_OF_TEN`), so a kind fades
 * after two good rounds and comes back after a hard one. A kind with fewer than 2 goes is left as it was. A kind not in the
 * map yet starts at `startLevel` (the child's own level, which already has a new step's full help). Returns a new map; the
 * kinds the round did not ask keep what they had. The kind is only a string: the game names its own.
 */
export function fadeByKind(kindLevels: KindLevels, goes: readonly { kind: string; right: boolean }[], rules: FadeRules, startLevel: number): KindLevels {
  const tally = new Map<string, { n: number; right: number }>();
  for (const g of goes) {
    const t = tally.get(g.kind) ?? { n: 0, right: 0 };
    t.n += 1;
    if (g.right) t.right += 1;
    tally.set(g.kind, t);
  }
  const out: KindLevels = { ...kindLevels };
  for (const [kind, { n, right }] of tally) {
    if (n < 2) continue;
    const { level, goodInRow } = fadeAfter(kindLevels[kind] ?? { level: startLevel, goodInRow: 0 }, Math.round((10 * right) / n), rules);
    out[kind] = { level, goodInRow };
  }
  return out;
}

export interface StepRules extends FadeRules {
  /** Good rounds at a step that pass it. */
  goodToPass: number;
  /** The last step, which is never passed. */
  topStep: number;
  /** Levels of help a new step brings back, unless the help faded on that same round. */
  newStepHelp: number;
  /** A new step always has at least this much help. */
  newStepLevel: number;
}

/** Where a child is in a game with steps as well as help. */
export interface Place extends Fade {
  step: number;
  /** Good rounds at this step so far. */
  goodAtStep: number;
}

/**
 * `fadeAfter`, for a game with steps. A new step brings `newStepHelp` back only if the help didn't fade on this same round:
 * a pass and a fade usually land together, and the fade must stand, or a strong child never sees the help go. Test fade and
 * step-up together (LEARNING-DESIGN rule 5).
 */
export function placeAfter(p: Place, right: number, rules: StepRules): Place {
  const fade = fadeAfter(p, right, rules);
  const goodAtStep = right >= rules.good ? p.goodAtStep + 1 : p.goodAtStep;
  if (goodAtStep < rules.goodToPass || p.step >= rules.topStep) return { step: p.step, level: fade.level, goodInRow: fade.goodInRow, goodAtStep };
  const level = Math.min(rules.topLevel, fade.faded ? fade.level : fade.level + rules.newStepHelp);
  return { step: p.step + 1, level: Math.max(rules.newStepLevel, level), goodInRow: 0, goodAtStep: 0 };
}
