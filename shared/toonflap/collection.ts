/**
 * Flyers, trails and revive potions (docs/TOON-FLAP-PLAN.md, section 5a), and what a pupil has opened. Everything here is
 * looks or a second chance, never speed: every flyer has the fantail's hit box and flies the same.
 *
 * The server works these out from saved runs (stage F.3, `my_toonflap()`); the preview's trial backend uses the same
 * functions, so both agree.
 */
import { EASY_LEVELS, POTION_STREAK, POTIONS_MAX, PRESENTS_PER_POTION, SEASONAL_UNLOCK_RUNS, SKY_DASH_AFTER, UNLOCK_RUNS } from './config';
import { inSeason, isSeasonal, levelById, LEVELS, SEASONAL_LEVELS } from './levels';
import type { Medal } from './engine';

export interface Flyer {
  id: string;
  name: string;
  /** What it looks like, for the stand-in drawing and the art plan. */
  look: string;
  /** The level whose finishes unlock it (`unlockRuns`). Null: everyone has it (the fantail) or the secret one. */
  level: string | null;
  /** A pupil's own idea. */
  pupils?: boolean;
  /** Unlocked by grabbing every present in one flight of this (seasonal) level, instead of by finishes. */
  allPresents?: string;
  /** Unlocked by a clean flight (no bumps) on this (seasonal) level. */
  cleanOn?: string;
  /** Everyone can fly it, but only between these NZ days of the year (MM-DD, inclusive), e.g. 1 to 26 December. */
  window?: { from: string; to: string };
  /** Drawn by the pupils themselves (their scanned drawing is the picture). */
  drawnByPupils?: boolean;
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
  // Christmas Coast's (December and January only); once unlocked they stay all year.
  { id: 'surf-sleigh', name: 'Surf Sleigh', look: 'a jolly Santa in board shorts on a flying surfboard sleigh', level: 'xmas' },
  { id: 'santa-fantail', name: 'Santa Fantail', look: 'a fantail in a Santa hat', level: null, allPresents: 'xmas' },
  // Pupils' own ideas and drawings (26 Nov 2026): the elf in a snow globe, only from 1 December to Boxing Day, and the
  // grumpy Santa, for a flight on Christmas Coast with no bumps.
  { id: 'elf-globe', name: 'Elf Snow Globe', look: 'an elf on a Christmas tree inside a snow globe (a pupil\'s drawing)', level: null, pupils: true, drawnByPupils: true, window: { from: '12-01', to: '12-26' } },
  { id: 'grumpy-santa', name: 'Grumpy Santa', look: 'a grumpy Santa (a pupil\'s drawing)', level: null, pupils: true, drawnByPupils: true, cleanOn: 'xmas' },
];

/** Is NZ day `today` (YYYY-MM-DD) inside a flyer's window? */
export const inWindow = (f: Flyer, today: string | undefined): boolean => !!f.window && !!today && today.slice(5) >= f.window.from && today.slice(5) <= f.window.to;

export type TrailRule =
  | { kind: 'levels'; count: number }
  | { kind: 'checks'; count: number }
  | { kind: 'gold'; level: string }
  | { kind: 'clean'; count: number }
  | { kind: 'all-gold' }
  | { kind: 'presents'; count: number };

export interface Trail {
  id: string;
  name: string;
  rule: TrailRule;
  /** How to earn it, in a pupil's words. */
  how: string;
  pupils?: boolean;
}

export const TRAILS: readonly Trail[] = [
  { id: 'flowers', name: 'Sparkly flowers', rule: { kind: 'levels', count: 8 }, how: 'Finish 8 levels', pupils: true },
  { id: 'cookies', name: 'Cookies', rule: { kind: 'checks', count: 50 }, how: 'Get 50 checks right', pupils: true },
  { id: 'donut-crumbs', name: 'Donut crumbs', rule: { kind: 'gold', level: 'donut' }, how: 'Gold on Donut Town', pupils: true },
  { id: 'pineapples', name: 'Pineapples', rule: { kind: 'gold', level: 'reef' }, how: 'Gold on Bubble Reef', pupils: true },
  { id: 'cheese', name: 'Cheese', rule: { kind: 'gold', level: 'kitchen' }, how: 'Gold on Cheese Kitchen', pupils: true },
  { id: 'mouse-tail', name: 'Mouse tail', rule: { kind: 'clean', count: 15 }, how: '15 clean flights (no bumps)', pupils: true },
  { id: 'rainbow-stars', name: 'Rainbow stars', rule: { kind: 'all-gold' }, how: 'Gold on every level' },
  { id: 'candy-canes', name: 'Candy canes', rule: { kind: 'gold', level: 'xmas' }, how: 'Gold on Christmas Coast' },
  { id: 'baubles', name: 'Bauble lights', rule: { kind: 'presents', count: 30 }, how: 'Grab 30 presents', pupils: true },
];

/** One level's record. */
export interface LevelRecord {
  finishes: number;
  /** Best time with maths and with maths off, seconds. */
  best: number | null;
  bestPlain: number | null;
  medal: Medal | null;
  /** Seasonal levels with presents: flights that grabbed every one. */
  allPresents?: number;
  /** Seasonal levels: flights with no bumps. */
  clean?: number;
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
  /** Sky Dash: dashes finished, and the most walls ever flown past in one (the class board keeps the season's best). */
  dashes?: number;
  dashBest?: number;
  /** Seasonal levels (Christmas Coast), kept apart from the trail's 10 so they never count as "a level" for unlocks. */
  seasonal?: Record<string, LevelRecord>;
  /** Presents grabbed, all time. */
  presents?: number;
  /** Presents towards the next revive potion (pupils' rule, 26 Nov 2026: 3 presents = 1 potion), 0 to 2. */
  sack?: number;
}

export const emptyProgress = (): Progress => ({ levels: {}, checksRight: 0, streak: 0, cleanFlights: 0, rightGaps: 0, potions: 0, potionsEarned: 0 });

const record = (p: Progress, id: string): LevelRecord => p.levels[id] ?? p.seasonal?.[id] ?? { finishes: 0, best: null, bestPlain: null, medal: null };
/** A level's record (the trail's or a seasonal one). */
export const levelRecord = record;
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
  // A seasonal level: open in its months to anyone who has finished Toon Garden (so the guided first go comes first).
  const seasonal = SEASONAL_LEVELS.find((l) => l.n === n);
  if (seasonal) return inSeason(seasonal, today) && record(p, LEVELS[0].id).finishes > 0;
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

/** Finishes of a level that unlock its flyer: 15 on the easy levels (1 to 5), 10 on the harder ones. */
export const unlockRuns = (level: string): number => {
  const def = levelById(level);
  if (def && isSeasonal(def)) return SEASONAL_UNLOCK_RUNS;
  return (def?.n ?? 1) <= EASY_LEVELS ? UNLOCK_RUNS.easy : UNLOCK_RUNS.hard;
};

/** Finishes still needed to unlock a level's flyer (0 = unlocked). */
export const finishesToUnlock = (p: Progress, level: string): number => Math.max(0, unlockRuns(level) - record(p, level).finishes);

/** Flyers a pupil can fly. `today` (NZ day) matters only for a flyer with a window (the Elf Snow Globe). */
export function flyersUnlocked(p: Progress, today?: string): string[] {
  return FLYERS.filter((f) => {
    if (f.id === 'fantail') return true;
    if (f.window) return inWindow(f, today);
    if (f.cleanOn) return (record(p, f.cleanOn).clean ?? 0) > 0;
    if (f.id === 'rainbow') return golds(p) === LEVELS.length;
    if (f.allPresents) return (record(p, f.allPresents).allPresents ?? 0) > 0;
    return f.level !== null && finishesToUnlock(p, f.level) === 0;
  }).map((f) => f.id);
}

/** A gold on a level makes its flyer shiny. */
export const shiny = (p: Progress, flyer: Flyer): boolean => flyer.level !== null && record(p, flyer.level).medal === 'gold';

export function trailEarned(p: Progress, t: Trail): boolean {
  const r = t.rule;
  if (r.kind === 'levels') return levelsFinished(p) >= r.count;
  if (r.kind === 'checks') return p.checksRight >= r.count;
  if (r.kind === 'gold') return record(p, r.level).medal === 'gold';
  if (r.kind === 'clean') return p.cleanFlights >= r.count;
  if (r.kind === 'presents') return (p.presents ?? 0) >= r.count;
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
  /** Presents grabbed, and how many the course had (levels with presents). */
  presents?: number;
  presentsOf?: number;
}

export interface Unlocks {
  flyers: string[];
  trails: string[];
  potion: boolean;
  /** The potion came from presents (3 presents = 1 potion). */
  potionFromPresents?: boolean;
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
  const def = levelById(run.level);
  const seasonal = !!def && isSeasonal(def);
  const n = seasonal ? 0 : def?.n ?? 1; // a seasonal level never opens the trail's next one
  let opened = openedLevel(before);
  let openedDay = before.openedDay ?? null;
  // A level that was waiting for a new day opens as it is first flown.
  if (n > 0 && n === opened + 1) {
    opened = n;
    openedDay = today;
  }
  let newLevel = false;
  let levelTomorrow = false;
  if (n > 0 && n === opened && opened < LEVELS.length) {
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
  const rec: LevelRecord = {
    finishes: was.finishes + 1,
    best: run.maths && newBest ? run.seconds : was.best,
    bestPlain: !run.maths && newBest ? run.seconds : was.bestPlain,
    medal,
  };
  if (seasonal) {
    const all = (run.presentsOf ?? 0) > 0 && run.presents === run.presentsOf;
    p.seasonal = { ...before.seasonal, [run.level]: { ...rec, allPresents: (was.allPresents ?? 0) + (all ? 1 : 0), clean: (was.clean ?? 0) + (run.bumps === 0 ? 1 : 0) } };
  } else p.levels[run.level] = rec;
  if (run.presents) p.presents = (before.presents ?? 0) + run.presents;
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
  // Pupils' rule (26 Nov 2026): every 3 presents grabbed make a revive potion, at most one a flight; spare presents wait
  // in the sack for the next flight (at most 2 wait, so the sack never holds a potion's worth).
  let potionFromPresents = false;
  if (run.presents) {
    let sack = (before.sack ?? 0) + run.presents;
    if (sack >= PRESENTS_PER_POTION) {
      sack -= PRESENTS_PER_POTION;
      const had = potion;
      earn();
      potionFromPresents = potion && !had;
    }
    p.sack = Math.min(PRESENTS_PER_POTION - 1, sack);
  }
  const flyersBefore = flyersUnlocked(before, today);
  const trailsBefore = trailsUnlocked(before);
  return {
    progress: p,
    unlocks: {
      flyers: flyersUnlocked(p, today).filter((f) => !flyersBefore.includes(f)),
      trails: trailsUnlocked(p).filter((t) => !trailsBefore.includes(t)),
      potion,
      ...(potionFromPresents ? { potionFromPresents } : {}),
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
  const festive = SEASONAL_LEVELS.find((l) => levelOpen(p, l.n, today) && record(p, l.id).finishes === 0);
  if (festive) return seasonalLine(festive.name);
  const open = LEVELS.find((l) => record(p, l.id).finishes === 0);
  if (open) return open.n === 1 ? `Tap ${open.name} to start.` : `Fly ${open.name} next (level ${open.n}).`;
  const notGold = LEVELS.find((l) => record(p, l.id).medal !== 'gold');
  if (notGold) return `Try for gold on ${notGold.name}.`;
  return 'Every level done with gold! Try Sky Dash.';
}

/** The map's line when a seasonal level is waiting (said by Bella, so one per seasonal level). */
export const seasonalLine = (name: string): string => `${name} is here! A special level for a little while.`;

/** Seasonal levels open on NZ day `today` for this pupil. */
export const seasonalOpen = (p: Progress, today: string) => SEASONAL_LEVELS.filter((l) => levelOpen(p, l.n, today));

/** Adds a finished Sky Dash to a pupil's progress (a potion used is spent). Returns a new object. */
export function addDash(before: Progress, walls: number, potionUsed: boolean): { progress: Progress; newBest: boolean } {
  const newBest = walls > (before.dashBest ?? 0);
  return {
    progress: {
      ...before,
      dashes: (before.dashes ?? 0) + 1,
      dashBest: Math.max(before.dashBest ?? 0, walls),
      potions: potionUsed ? Math.max(0, before.potions - 1) : before.potions,
    },
    newBest,
  };
}
