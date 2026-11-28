/**
 * Smash Quest (docs/BONKERS-PLAN.md): every tuning number in one place. The rules (engine.ts) and the server
 * (server.ts) read these, and the simulator (`npm run bonkers:sim`) checks the pace.
 */

/** Hero levels: start at 1, a trainer stands between each pair, so 9 trainers. */
export const MAX_LEVEL = 10;

/** Adventures: one a school day, saved up for missed weekdays, never more than this waiting. */
export const ADVENTURES_A_DAY = 1;
export const MAX_SAVED_ADVENTURES = 3;

/**
 * Hearts at the start of every fight (full again each fight: nothing carries over). The monster swings back while the
 * hero smashes before each question (a heart a swing, never the last one: James, 28 Nov 2026, "they never seem to get
 * hit", then "still needs to get hit more"), and a wrong answer costs 2 hearts. So 3 wrong answers still lose a fight
 * (4 against a trainer).
 */
export const HEARTS = 10;
export const TRAINER_HEARTS = 13;
/** The monster's swings while the hero smashes before each question. */
export const MONSTER_SWINGS = 2;
/** Hearts a wrong answer costs (the monster's big smash back). */
export const WRONG_HEARTS = 2;
/** The monster's health is shown as this many hearts (James, 28 Nov 2026: "use hearts for monster health as well"). */
export const FOE_HEARTS = 10;

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

/** A monster's health (doubled 27 Nov 2026, James: "more hp"), as a number of ordinary right hits (`v` 0 to 2: the zone's weakest to strongest). */
export const MONSTER_HITS = [9, 10, 12];
/** The zone's big monster (the "bonk the big one" quest) and the trainers. */
export const BIG_MONSTER_HITS = 16;
export const TRAINER_HITS = 20;
/** The class's Friday boss, fought by each pupil on Friday (B.3): the longest fight, about 3 right answers. */
export const BOSS_HITS = 28;

/**
 * The class boss (B.3, James 27 Nov 2026: "chip all week, finish Friday"). Its health is sized by the class: this many
 * per pupil (at least 8 pupils). Every right answer all week chips 1, up to CHIP_SHARE of it, so only Friday's boss
 * fights can finish it: each one won hits BOSS_FINISH more (plus its right answers).
 */
export const CLASS_BOSS = { perPupil: 25, megaPerPupil: 35, minPupils: 8, chipShare: 0.8, finish: 12 } as const;

/**
 * Less maths, more smashing (James, 27 Nov 2026: "a bit too much maths", then "one question per fight"): the hero smashes
 * away on their own (at least this share of their power a smash, never the last one) until the question's boosted smash
 * will finish the monster. Right: the boosted smash wins the fight. Wrong: no smash, the monster smashes back, the right
 * answer is shown, and another question comes.
 */
export const AUTO_SHARE = 0.25;
export const AUTO_BONKS = { min: 4, max: 8 } as const; // twice as long (James, 28 Nov 2026)
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

/** Questions the server makes for an adventure (more than any adventure can use: 1 a fight when right, at worst 3). */
export const QUESTIONS_AN_ADVENTURE = 80;

/** Hub points (inside the 40-a-day cap): never for maths results. */
export const POINTS = { fightWon: 2, quest: 3, trainer: 5 } as const;

/** How long an answer can count as taking, at most. */
export const MAX_ANSWER_MS = 120_000;
