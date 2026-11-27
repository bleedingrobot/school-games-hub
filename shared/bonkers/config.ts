/**
 * Bonkers Quest (docs/BONKERS-PLAN.md): every tuning number in one place. The rules (engine.ts) and the server
 * (server.ts) read these, and the simulator (`npm run bonkers:sim`) checks the pace.
 */

/** Hero levels: start at 1, a trainer stands between each pair, so 9 trainers. */
export const MAX_LEVEL = 10;

/** Adventures: one a school day, saved up for missed weekdays, never more than this waiting. */
export const ADVENTURES_A_DAY = 1;
export const MAX_SAVED_ADVENTURES = 3;

/** Hearts at the start of every fight (full again each fight: nothing carries over). */
export const HEARTS = 3;
export const TRAINER_HEARTS = 4;

/** Stars from a fight. */
export const STARS = { win: 3, bonked: 1, quest: 3 } as const;

/** Stickers (for the sticker shop, stage B.2) from each fight won. */
export const STICKERS_A_WIN = 1;

/** Stars to fill the bar on each level before its trainer appears (index = level). */
export const STARS_TO_TRAINER = [0, 22, 26, 30, 34, 38, 42, 46, 50, 54, 0];

/** The hero's own hitting power at a level, before gear. */
export const basePower = (level: number) => 10 + 3 * (level - 1);

/** What an ordinary hero carries in gear power by this level (monsters are sized for it). */
export const expectedGear = (level: number) => 3 * (level - 1);

/** A monster's health, as a number of ordinary right hits (`v` 0 to 2: the zone's weakest to strongest). */
export const MONSTER_HITS = [4.5, 5, 6];
/** The zone's big monster (the "bonk the big one" quest) and the trainers. */
export const BIG_MONSTER_HITS = 8;
export const TRAINER_HITS = 10;

/**
 * Less maths, more bonking (James, 27 Nov 2026: "a bit too much maths"): the hero bonks away on their own (this share of
 * their power a bonk, never the last bonk), and every few bonks a question pops up with a surprise damage boost. Right: the
 * boosted hit. Wrong: no hit, the monster bonks you back, and the right answer is shown. About 2 questions a fight.
 */
export const AUTO_SHARE = 0.25;
export const AUTO_BONKS = { min: 2, max: 4 } as const;
export const BOOSTS = [
  { times: 2, weight: 6, name: 'DOUBLE DAMAGE!' },
  { times: 3, weight: 3, name: 'TRIPLE DAMAGE!' },
  { times: 10, weight: 1, name: 'ABSURD DAMAGE!' },
] as const;

/** The special moves, once a fight. */
export const SPECIAL = {
  knight: { times: 3 },
  dazzler: { times: 1.5 },
  granny: { calmQuestions: 2 },
  ninja: { times: 2, stickers: 2 },
} as const;

/** Fights in an adventure: each quest says how many (4 to 6). */
export const FIGHTS = { min: 4, max: 6 } as const;

/** Questions the server makes for an adventure (more than any adventure can use: about 4 a fight, at worst 12). */
export const QUESTIONS_AN_ADVENTURE = 80;

/** Hub points (inside the 40-a-day cap): never for maths results. */
export const POINTS = { fightWon: 2, quest: 3, trainer: 5 } as const;

/** How long an answer can count as taking, at most. */
export const MAX_ANSWER_MS = 120_000;
