/**
 * Flyers, trails and revive potions (docs/TOON-FLAP-PLAN.md, section 5a), and what a pupil has opened. Everything here is
 * looks or a second chance, never speed: every flyer has the fantail's hit box and flies the same.
 *
 * The server works these out from saved runs (stage F.3, `my_toonflap()`); the preview's trial backend uses the same
 * functions, so both agree.
 */
import { POTION_STREAK, POTIONS_MAX, SKY_DASH_AFTER, UNLOCK_RUNS } from './config';
import { LEVELS } from './levels';
import type { Medal } from './engine';

export interface Flyer {
  id: string;
  name: string;
  /** What it looks like, for the stand-in drawing and the art plan. */
  look: string;
  /** The level whose 3 finishes unlock it. Null: everyone has it (the fantail) or the secret one. */
  level: string | null;
  /** A pupil's own idea. */
  pupils?: boolean;
}

export const FLYERS: readonly Flyer[] = [
  { id: 'fantail', name: 'Toon Fantail', look: 'a cartoon pīwakawaka with a fanned tail', level: null },
  { id: 'puppy-plane', name: 'Puppy Plane', look: 'a puppy on a paper plane', level: 'garden' },
  { id: 'rocket-carrot', name: 'Rocket Carrot', look: 'a flying carrot with a rabbit riding it', level: 'mesa', pupils: true },
  { id: 'bathtub-boat', name: 'Bathtub Boat', look: 'a bubbling bathtub with a fish in goggles', level: 'reef' },
  { id: 'mousetrap-glider', name: 'Mouse Trap Glider', look: 'a mouse riding a mousetrap', level: 'kitchen', pupils: true },
  { id: 'donut-cruiser', name: 'Donut Cruiser', look: 'a giant pink sprinkled donut with a man riding it', level: 'donut', pupils: true },
  { id: 'mini-van', name: 'Mini Van', look: 'a flying mini van with little wings', level: 'manor', pupils: true },
  { id: 'toilet-rocket', name: 'Toilet Rocket', look: 'a flying toilet with a little round boy on it', level: 'peaks', pupils: true },
  { id: 'lava-lizard', name: 'Lava Rock Lizard', look: 'a fire lizard on a glowing rock', level: 'volcano' },
  { id: 'jet-bot', name: 'Jet Bot', look: 'a small robot with a jet pack', level: 'robot' },
  { id: 'saucer-kid', name: 'Saucer Kid', look: 'an alien kid in a flying saucer', level: 'cosmic' },
  { id: 'rainbow', name: 'Rainbow Toon', look: 'a rainbow-feathered fantail', level: null },
];

export type TrailRule =
  | { kind: 'levels'; count: number }
  | { kind: 'checks'; count: number }
  | { kind: 'gold'; level: string }
  | { kind: 'clean'; count: number }
  | { kind: 'all-gold' };

export interface Trail {
  id: string;
  name: string;
  rule: TrailRule;
  /** How to earn it, in a pupil's words. */
  how: string;
  pupils?: boolean;
}

export const TRAILS: readonly Trail[] = [
  { id: 'flowers', name: 'Sparkly flowers', rule: { kind: 'levels', count: 5 }, how: 'Finish 5 levels', pupils: true },
  { id: 'cookies', name: 'Cookies', rule: { kind: 'checks', count: 10 }, how: 'Get 10 checks right', pupils: true },
  { id: 'donut-crumbs', name: 'Donut crumbs', rule: { kind: 'gold', level: 'donut' }, how: 'Gold on Donut Town', pupils: true },
  { id: 'pineapples', name: 'Pineapples', rule: { kind: 'gold', level: 'reef' }, how: 'Gold on Bubble Reef', pupils: true },
  { id: 'cheese', name: 'Cheese', rule: { kind: 'gold', level: 'kitchen' }, how: 'Gold on Cheese Kitchen', pupils: true },
  { id: 'mouse-tail', name: 'Mouse tail', rule: { kind: 'clean', count: 3 }, how: '3 clean flights (no bumps)', pupils: true },
  { id: 'rainbow-stars', name: 'Rainbow stars', rule: { kind: 'all-gold' }, how: 'Gold on every level' },
];

/** One level's record. */
export interface LevelRecord {
  finishes: number;
  /** Best time with maths and with maths off, seconds. */
  best: number | null;
  bestPlain: number | null;
  medal: Medal | null;
}

/** What a pupil has done in Toon Flap: everything the unlocks are worked out from. */
export interface Progress {
  levels: Record<string, LevelRecord>;
  checksRight: number;
  /** Right checks in a row, carried between runs (5 earns a potion). */
  streak: number;
  cleanFlights: number;
  rightGaps: number;
  potions: number;
  potionsEarned: number;
  /** The highest level opened so far (missing on early saves: worked out from the finishes). */
  opened?: number;
  /** The NZ day (YYYY-MM-DD) a new level last opened: only one opens a day (James, 11 Nov 2026). */
  openedDay?: string | null;
}

export const emptyProgress = (): Progress => ({ levels: {}, checksRight: 0, streak: 0, cleanFlights: 0, rightGaps: 0, potions: 0, potionsEarned: 0 });

const record = (p: Progress, id: string): LevelRecord => p.levels[id] ?? { finishes: 0, best: null, bestPlain: null, medal: null };
export const levelsFinished = (p: Progress): number => LEVELS.filter((l) => record(p, l.id).finishes > 0).length;
export const golds = (p: Progress): number => LEVELS.filter((l) => record(p, l.id).medal === 'gold').length;

/** The highest level opened (early saves had no `opened`: each finish opened the next). */
export function openedLevel(p: Progress): number {
  if (typeof p.opened === 'number') return p.opened;
  let n = 1;
  while (n < LEVELS.length && record(p, LEVELS[n - 1].id).finishes > 0) n++;
  return n;
}

/**
 * Level 1 is always open. Finishing the highest open level opens the next one, but only one new level a day: if one
 * already opened today (NZ day `today`), the next waits until tomorrow.
 */
export function levelOpen(p: Progress, n: number, today: string): boolean {
  const opened = openedLevel(p);
  if (n <= opened) return true;
  return n === opened + 1 && record(p, LEVELS[opened - 1].id).finishes > 0 && p.openedDay !== today;
}

/** Is a finished level's next one waiting for tomorrow? */
export const opensTomorrow = (p: Progress, today: string): boolean => {
  const opened = openedLevel(p);
  return opened < LEVELS.length && record(p, LEVELS[opened - 1].id).finishes > 0 && !levelOpen(p, opened + 1, today);
};
export const skyDashOpen = (p: Progress): boolean => record(p, LEVELS[SKY_DASH_AFTER - 1].id).finishes > 0;

/** Finishes still needed to unlock a level's flyer (0 = unlocked). */
export const finishesToUnlock = (p: Progress, level: string): number => Math.max(0, UNLOCK_RUNS - record(p, level).finishes);

export function flyersUnlocked(p: Progress): string[] {
  return FLYERS.filter((f) => (f.id === 'fantail' ? true : f.id === 'rainbow' ? golds(p) === LEVELS.length : f.level !== null && finishesToUnlock(p, f.level) === 0)).map((f) => f.id);
}

/** A gold on a level makes its flyer shiny. */
export const shiny = (p: Progress, flyer: Flyer): boolean => flyer.level !== null && record(p, flyer.level).medal === 'gold';

export function trailEarned(p: Progress, t: Trail): boolean {
  const r = t.rule;
  if (r.kind === 'levels') return levelsFinished(p) >= r.count;
  if (r.kind === 'checks') return p.checksRight >= r.count;
  if (r.kind === 'gold') return record(p, r.level).medal === 'gold';
  if (r.kind === 'clean') return p.cleanFlights >= r.count;
  return golds(p) === LEVELS.length;
}
export const trailsUnlocked = (p: Progress): string[] => TRAILS.filter((t) => trailEarned(p, t)).map((t) => t.id);

/** One finished run, as the server sees it after replaying and marking it. */
export interface RunSummary {
  level: string;
  maths: boolean;
  seconds: number;
  medal: Medal;
  bumps: number;
  /** Each check's answer in order: right or wrong. */
  checks: boolean[];
  rightGaps: number;
  potionUsed: boolean;
}

export interface Unlocks {
  flyers: string[];
  trails: string[];
  potion: boolean;
  newGold: boolean;
  firstFinish: boolean;
  newBest: boolean;
  /** This run opened the next level. */
  newLevel: boolean;
  /** This run would have opened the next level, but one already opened today. */
  levelTomorrow: boolean;
}

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };

/**
 * Adds a finished run to a pupil's progress and says what it opened, on NZ day `today` (one new level a day). Returns a
 * new object; the old one is unchanged.
 */
export function addRun(before: Progress, run: RunSummary, today: string): { progress: Progress; unlocks: Unlocks } {
  const p: Progress = { ...before, levels: { ...before.levels } };
  const n = LEVELS.find((l) => l.id === run.level)?.n ?? 1;
  let opened = openedLevel(before);
  let openedDay = before.openedDay ?? null;
  // A level that was waiting for a new day opens as it is first flown.
  if (n === opened + 1) {
    opened = n;
    openedDay = today;
  }
  let newLevel = false;
  let levelTomorrow = false;
  if (n === opened && opened < LEVELS.length) {
    if (openedDay !== today) {
      opened++;
      openedDay = today;
      newLevel = true;
    } else levelTomorrow = record(before, run.level).finishes === 0;
  }
  p.opened = opened;
  p.openedDay = openedDay;
  const was = record(before, run.level);
  const best = run.maths ? was.best : was.bestPlain;
  const newBest = best === null || run.seconds < best;
  const medal = was.medal === null || MEDAL_RANK[run.medal] > MEDAL_RANK[was.medal] ? run.medal : was.medal;
  p.levels[run.level] = {
    finishes: was.finishes + 1,
    best: run.maths && newBest ? run.seconds : was.best,
    bestPlain: !run.maths && newBest ? run.seconds : was.bestPlain,
    medal,
  };
  let potion = false;
  const earn = () => {
    if (p.potions < POTIONS_MAX) {
      p.potions++;
      p.potionsEarned++;
      potion = true;
    }
  };
  if (run.potionUsed && p.potions > 0) p.potions--;
  for (const right of run.checks) {
    if (right) {
      p.checksRight++;
      p.streak++;
      if (p.streak >= POTION_STREAK) {
        p.streak = 0;
        earn();
      }
    } else p.streak = 0;
  }
  p.rightGaps += run.rightGaps;
  if (run.bumps === 0) p.cleanFlights++;
  const newGold = run.medal === 'gold' && was.medal !== 'gold';
  if (newGold) earn();
  const flyersBefore = flyersUnlocked(before);
  const trailsBefore = trailsUnlocked(before);
  return {
    progress: p,
    unlocks: {
      flyers: flyersUnlocked(p).filter((f) => !flyersBefore.includes(f)),
      trails: trailsUnlocked(p).filter((t) => !trailsBefore.includes(t)),
      potion,
      newGold,
      firstFinish: was.finishes === 0,
      newBest,
      newLevel,
      levelTomorrow,
    },
  };
}

/** The map's next-step line (plan section 7): what to do next, in a pupil's words. */
export function nextStep(p: Progress, today: string): string {
  if (opensTomorrow(p, today)) return 'A new level opens tomorrow. Try for a better medal today!';
  const open = LEVELS.find((l) => record(p, l.id).finishes === 0);
  if (open) return open.n === 1 ? `Tap ${open.name} to start.` : `Fly ${open.name} next (level ${open.n}).`;
  const notGold = LEVELS.find((l) => record(p, l.id).medal !== 'gold');
  if (notGold) return `Try for gold on ${notGold.name}.`;
  return 'Every level done with gold! Try Sky Dash.';
}
