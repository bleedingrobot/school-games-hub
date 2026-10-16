/**
 * Every tuning number for Gem Keep, in one place, so the game can be balanced without
 * hunting through code. Distances are in tiles, times in seconds, speeds in tiles a second.
 */

/** The simulation runs at a fixed 60 steps a second, whatever the screen does. */
export const STEPS_PER_SECOND = 60;
export const STEP = 1 / STEPS_PER_SECOND;

/** The map grid, and the size of one tile on the canvas (in logical pixels). */
export const GRID_COLUMNS = 16;
export const GRID_ROWS = 10;
export const TILE = 60;

export const KEEP_HEALTH = 100;

/** Mana. The Mana Well (maths) is meant to be the main source; kills and the trickle are small. */
export const MANA = {
  /** Used when a level doesn't say. */
  start: 200,
  /** Paid after every wave is cleared. */
  waveClear: 10,
  max: 9999,
};

/** Building and upgrading the one tower type. Index 0 is building it (level 1). */
export const TOWER = {
  buildCost: 60,
  /** Cost to go from level 1 → 2 and 2 → 3. */
  upgradeCost: [60, 100],
  maxLevel: 3,
  /** Added to the gem's range at levels 1, 2, 3. */
  rangeBonus: [0, 0.4, 0.8],
  /** Multiplies the gem's shots a second at levels 1, 2, 3. */
  rateBonus: [1, 1.2, 1.45],
};

export const GEM = {
  maxGrade: 5,
  /** Mana to make a new grade 1 gem. */
  createCost: 40,
  /** Mana to combine two gems of this grade (index = grade - 1). */
  combineCost: [20, 40, 70, 110],
  /** How many gems the student can hold at once. */
  inventorySlots: 8,
  /** Damage of one shot at grade 1, and how much each grade multiplies it. */
  damage: 9,
  damagePerGrade: 2.1,
  /** Shots a second at grade 1, and how much each grade adds. */
  rate: 1.1,
  ratePerGrade: 0.08,
  /** Range at grade 1, and how much each grade adds. */
  range: 2.4,
  rangePerGrade: 0.15,
  /** A mixed gem (two or more colours) has every effect, but each at this strength. */
  mixedStrength: 0.6,
  projectileSpeed: 9,
};

/** What each colour does. "g" in a comment means the gem's grade. */
export const EFFECTS = {
  /** Red: area damage. Everything within radius (+ per g) takes this share of the hit. */
  red: { radius: 0.8, radiusPerGrade: 0.1, share: 0.5 },
  /** Blue: slows. Speed is cut by this much (+ per g, up to max) for this long. */
  blue: { slow: 0.3, slowPerGrade: 0.05, maxSlow: 0.6, seconds: 1.5 },
  /** Green: poison. This share of the hit again every second, for this long. */
  green: { share: 0.35, sharePerGrade: 0.03, seconds: 3 },
  /** Yellow: critical hits. This chance (+ per g) of hitting this many times as hard. */
  yellow: { chance: 0.15, chancePerGrade: 0.05, multiplier: 2.5 },
};

export type EnemyKind = 'walker' | 'runner' | 'brute' | 'swarm' | 'boss';

/** health, speed (tiles/s), damage to the Keep, mana for a kill, size (tiles, for drawing and splash). */
export const ENEMIES: Record<EnemyKind, { health: number; speed: number; damage: number; mana: number; size: number }> = {
  walker: { health: 30, speed: 1.1, damage: 5, mana: 2, size: 0.32 },
  runner: { health: 16, speed: 2.1, damage: 4, mana: 2, size: 0.26 },
  brute: { health: 110, speed: 0.6, damage: 12, mana: 6, size: 0.42 },
  swarm: { health: 9, speed: 1.5, damage: 2, mana: 1, size: 0.18 },
  boss: { health: 340, speed: 0.5, damage: 30, mana: 30, size: 0.55 },
};

/** Enemy health grows by this share every wave after the first (wave 5 = 1 + 4 × share). */
export const HEALTH_PER_WAVE = 0.15;

/** Stars for winning, by Keep health left. */
export const STARS = { three: 0.9, two: 0.5 };

/**
 * The maths in the game. Right answers give; wrong answers never take anything away.
 */
export const MATHS = {
  /** Mana Well: up to this many questions between waves, this much mana each, plus a bonus from 3 right in a row. */
  well: { questions: 10, mana: 15, streakFrom: 3, streakBonus: 5 },
  /** Wave Gate before a boss wave: 3 questions. 3 right = Power Surge (+25% damage that wave), 2 right = +10%. */
  gate: { questions: 3, surge: [0, 0, 0.1, 0.25] as const },
  /** Keep Shield: once a level, when the Keep drops below this share, 5 quick questions, each right one heals this share. */
  shield: { below: 0.25, questions: 5, heal: 0.05 },
  /** Level Key: questions on the level's focus tables, and how many must be right to unlock the next level. */
  key: { questions: 10, passMark: 8 },
  /** Gem Forge: combining gems of this grade asks facts from these mastery boxes (none listed = any). */
  combineBoxes: { 1: [3, 4], 2: [], 3: [0, 1, 2], 4: [0, 1, 2] } as Record<number, number[]>,
  /** Challenge mode: the game keeps running at this share of its speed while a question is up. */
  challengeSpeed: 0.5,
};

/** Speeds the student can pick. */
export const SPEEDS = [1, 2] as const;
