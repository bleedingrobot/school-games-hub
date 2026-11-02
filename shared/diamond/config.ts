/**
 * Every number in Diamond Drop (docs/DIAMOND-PLAN.md, section 3), so the rules, How to play, the simulator, the server
 * and the screens all read the same ones. Tuned with `npm run diamond:sim` (docs/DIAMOND-RULES.md has the pace tables).
 *
 * The ground is a box TICKS wide by FIELD_H tall in "field units" (screens scale it). The winch hangs at PIVOT, and the
 * claw's length along its angle is measured from there. y grows downwards.
 */

/** Steps a second. Every time in the rules is counted in ticks. */
export const TICKS_PER_SECOND = 30;

// ---- The ground ----
export const FIELD_W = 1000;
export const FIELD_H = 700;
/** Where the winch hangs (the claw's rope starts here). */
export const PIVOT = { x: 500, y: 40 } as const;
/** The top of the rock: nothing is buried above this. */
export const GROUND_Y = 130;
/** Things are buried only inside this slope from the winch (sideways ÷ down), so the claw can always reach them. */
export const REACH_SLOPE = 2.2;
/** Space kept between buried things. */
export const GAP = 8;

// ---- The claw ----
/** The claw swings between −SWING_RANGE and +SWING_RANGE tenths of a degree (−70° to +70°). */
export const SWING_RANGE = 700;
/** Tenths of a degree the claw swings each tick (60° a second). */
export const SWING_SPEED = 20;
/** The claw's own size when touching things. */
export const CLAW_R = 10;
/** Field units the claw travels out each tick. */
export const SHOOT_SPEED = 16;

export type Weight = 'empty' | 'light' | 'medium' | 'heavy' | 'veryHeavy' | 'rockSmall' | 'rockBig';
/** Field units the claw reels in each tick, by what it carries. */
export const REEL_SPEED: Record<Weight, number> = {
  empty: 24,
  light: 13,
  medium: 9,
  heavy: 6,
  veryHeavy: 4,
  rockSmall: 5,
  rockBig: 3,
};

// ---- Gems ----
export type GemId =
  | 'quartz' | 'jade' | 'amethyst' | 'topaz' | 'emerald' | 'sapphire' | 'ruby' | 'fireOpal' | 'starSapphire' | 'heartDiamond';

export interface Gem {
  id: GemId;
  name: string;
  /** Coins, and gem value towards the level's target. */
  value: number;
  weight: Weight;
  /** Chance it slips on the way up (0 to 1). The Heart Diamond always slips twice instead. */
  slip: number;
  /** Size when buried. */
  r: number;
  /** The shallowest it is ever buried. */
  minY: number;
}

/** In order of rarity; the gem at index i is new on level i + 1. */
export const GEMS: readonly Gem[] = [
  { id: 'quartz', name: 'Quartz', value: 2, weight: 'light', slip: 0, r: 24, minY: GROUND_Y + 10 },
  { id: 'jade', name: 'Jade', value: 4, weight: 'light', slip: 0.1, r: 23, minY: 170 },
  { id: 'amethyst', name: 'Amethyst', value: 6, weight: 'light', slip: 0.2, r: 22, minY: 210 },
  { id: 'topaz', name: 'Topaz', value: 10, weight: 'medium', slip: 0.3, r: 21, minY: 250 },
  { id: 'emerald', name: 'Emerald', value: 15, weight: 'medium', slip: 0.35, r: 20, minY: 290 },
  { id: 'sapphire', name: 'Sapphire', value: 25, weight: 'medium', slip: 0.4, r: 19, minY: 330 },
  { id: 'ruby', name: 'Ruby', value: 40, weight: 'heavy', slip: 0.45, r: 18, minY: 370 },
  { id: 'fireOpal', name: 'Fire Opal', value: 60, weight: 'heavy', slip: 0.5, r: 17, minY: 410 },
  { id: 'starSapphire', name: 'Star Sapphire', value: 90, weight: 'heavy', slip: 0.55, r: 16, minY: 450 },
  { id: 'heartDiamond', name: 'Heart Diamond', value: 0, weight: 'veryHeavy', slip: 1, r: 22, minY: 610 },
];
export const GEM_IDS: readonly GemId[] = GEMS.map((g) => g.id);
export const gemOf = (id: GemId): Gem => GEMS[GEM_IDS.indexOf(id)];

/** The Heart Diamond's two slips happen at these shares of the way up (from the level's seed, inside each range). */
export const DIAMOND_SLIPS: readonly [number, number][] = [[0.7, 0.85], [0.25, 0.45]];
/** A gem that slips does so somewhere between these shares of the way up. */
export const SLIP_AT: [number, number] = [0.3, 0.8];
/** A dropped gem falls this much further out along the claw's line before landing (from the seed). */
export const FALL_DISTANCE: [number, number] = [60, 140];
/** Coins for bringing up the Heart Diamond. */
export const DIAMOND_COINS = 150;

// ---- Rocks, sacks and crabs ----
export const ROCKS = {
  small: { r: 28, weight: 'rockSmall' as Weight },
  big: { r: 42, weight: 'rockBig' as Weight },
};
export const SACK_R = 22;
/** What a mystery sack can hold: coins (CHANCE shares), extra seconds, or a free boost for the next level. */
export const SACK = {
  coinsChance: 0.55,
  secondsChance: 0.3,
  /** Coins in a sack: from COINS_LOW + level × COINS_PER_LEVEL up to twice that. */
  coinsLow: 5,
  coinsPerLevel: 3,
  seconds: 5,
};
export const CRAB_R = 20;
/** Field units a crab scuttles each tick (from the seed, between these). */
export const CRAB_SPEED: [number, number] = [1, 2.2];
/** Chance a crab is carrying a gem (otherwise it's worth nothing and light). */
export const CRAB_GEM_CHANCE = 0.7;

// ---- The 10 levels ----
export interface LevelSpec {
  level: number;
  place: string;
  /** The new gem on this level. */
  gem: GemId;
  seconds: number;
  /** Gem value to bank to pass (level 10: catch the Heart Diamond instead). */
  target: number;
  /** How many of each gem are buried (index = GEMS index). */
  gems: readonly number[];
  smallRocks: number;
  bigRocks: number;
  sacks: number;
  crabs: number;
}

export const LEVELS: readonly LevelSpec[] = [
  { level: 1, place: 'Grassy Topsoil', gem: 'quartz', seconds: 60, target: 15, gems: [12], smallRocks: 3, bigRocks: 1, sacks: 1, crabs: 0 },
  { level: 2, place: 'Clay Bank', gem: 'jade', seconds: 60, target: 25, gems: [8, 7], smallRocks: 3, bigRocks: 2, sacks: 1, crabs: 0 },
  { level: 3, place: 'Old River Gravel', gem: 'amethyst', seconds: 60, target: 40, gems: [6, 6, 5], smallRocks: 4, bigRocks: 2, sacks: 1, crabs: 0 },
  { level: 4, place: 'Glow-worm Cave', gem: 'topaz', seconds: 70, target: 55, gems: [5, 5, 5, 4], smallRocks: 4, bigRocks: 2, sacks: 2, crabs: 0 },
  { level: 5, place: 'Crystal Hollow', gem: 'emerald', seconds: 70, target: 70, gems: [4, 4, 4, 4, 3], smallRocks: 4, bigRocks: 3, sacks: 2, crabs: 0 },
  { level: 6, place: 'Underground Lake', gem: 'sapphire', seconds: 70, target: 100, gems: [3, 4, 4, 4, 3, 3], smallRocks: 4, bigRocks: 3, sacks: 2, crabs: 2 },
  { level: 7, place: 'Fossil Seam', gem: 'ruby', seconds: 75, target: 145, gems: [3, 3, 3, 4, 3, 3, 2], smallRocks: 5, bigRocks: 3, sacks: 2, crabs: 2 },
  { level: 8, place: 'Hot Springs', gem: 'fireOpal', seconds: 80, target: 200, gems: [2, 3, 3, 3, 3, 3, 3, 2], smallRocks: 5, bigRocks: 3, sacks: 2, crabs: 3 },
  { level: 9, place: 'Magma Edge', gem: 'starSapphire', seconds: 80, target: 240, gems: [2, 2, 3, 3, 3, 3, 3, 2, 2], smallRocks: 5, bigRocks: 4, sacks: 2, crabs: 3 },
  { level: 10, place: 'The Diamond Heart', gem: 'heartDiamond', seconds: 90, target: 0, gems: [2, 2, 2, 3, 3, 3, 2, 2, 1, 1], smallRocks: 4, bigRocks: 4, sacks: 2, crabs: 2 },
];
export const LAST_LEVEL = LEVELS.length;
export const levelSpec = (level: number): LevelSpec => LEVELS[level - 1];
/** A field is made again (from the next seed in line) until its gems are worth at least this many times the target. */
export const FIELD_VALUE_MARGIN = 1.5;
/** Big rocks placed just above the Heart Diamond on level 10 (counted in bigRocks). */
export const DIAMOND_GUARDS = 2;
/** Extra room either side of the clear line down to the Heart Diamond. */
export const DIAMOND_CORRIDOR = 6;
/** The claw must reach the Heart Diamond first at this many whole degrees at least, so the gap isn't too fiddly. */
export const DIAMOND_OPENING = 6;

// ---- Hold on! ----
/** Most Hold on! questions in one level. After that nothing slips. */
export const QUESTION_CAP = 6;
export const QUESTION_CAP_LAST = 8;
export const questionCap = (level: number) => (level === LAST_LEVEL ? QUESTION_CAP_LAST : QUESTION_CAP);

// ---- Stars ----
/** Two stars: passed with at least this many seconds left. */
export const STAR_TWO_SECONDS = 15;

// ---- Boosts (the next level only, at most one of each) ----
export type BoostId = 'strongWinch' | 'luckyCharm' | 'extraTime' | 'rockBlaster';
export interface Boost {
  id: BoostId;
  name: string;
  /** Price: base + perLevel × level. */
  base: number;
  perLevel: number;
  about: string;
}
export const BOOSTS: readonly Boost[] = [
  { id: 'strongWinch', name: 'Strong Winch', base: 20, perLevel: 10, about: 'Heavy things reel up 50% faster.' },
  { id: 'luckyCharm', name: 'Lucky Charm', base: 15, perLevel: 10, about: 'Gems slip half as often.' },
  { id: 'extraTime', name: 'Extra Time', base: 10, perLevel: 5, about: '10 more seconds.' },
  { id: 'rockBlaster', name: 'Rock Blaster', base: 10, perLevel: 5, about: 'The first rock you grab turns to dust.' },
];
export const BOOST_IDS: readonly BoostId[] = BOOSTS.map((b) => b.id);
/** Strong Winch: everything heavier than light reels this many times as fast. */
export const STRONG_WINCH = 1.5;
/** Lucky Charm: slip chances times this (not the Heart Diamond's). */
export const LUCKY_CHARM = 0.5;
export const EXTRA_TIME_SECONDS = 10;

// ---- The guided first go (level 1) ----
/** Until the first catch the claw swings slowly and only this far each way, over a big quartz straight below. */
export const STARTER = {
  swingRange: 150,
  swingSpeed: 8,
  quartz: { x: PIVOT.x, y: 250, r: 62, value: 5 },
};

// ---- Coins and the Workshop ----
/** A replay, or a try that doesn't pass, keeps this share of its coins (rounded down). Passing a new level keeps them all. */
export const REPLAY_COIN_SHARE = 0.12;

export type Slot = 'head' | 'rope' | 'trail' | 'catch' | 'winch' | 'hat';
export const SLOTS: readonly Slot[] = ['head', 'rope', 'trail', 'catch', 'winch', 'hat'];
export type Rarity = 'common' | 'cool' | 'epic' | 'legendary';
export const RARITY_PRICE: Record<Rarity, number> = { common: 100, cool: 250, epic: 600, legendary: 1800 };
/** The special of the week costs this share of its price (rounded to 5). */
export const SPECIAL_SHARE = 0.6;
/** Week numbers count Mondays from this New Zealand date (a Monday). */
export const WEEK_ZERO = '2024-01-01';

export type AchievementMeasure = 'diamond_found' | 'diamond_stars' | 'diamond_kinds' | 'diamond_grips';
export interface WorkshopItem {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  /** Can't be bought: comes with this achievement. */
  earnedBy?: AchievementMeasure;
}
/** What each earning achievement needs (docs/DIAMOND-PLAN.md, section 6.5). */
export const ACHIEVEMENT_NEEDS: Record<AchievementMeasure, number> = {
  diamond_found: 1,
  diamond_stars: 30,
  diamond_kinds: 9,
  diamond_grips: 10,
};

/**
 * The hub achievements (docs/DIAMOND-PLAN.md, section 6.5), as the migration lists them in achievement_types: the game
 * celebrates one when a level's result crosses its goal. All kept through New Season.
 */
export const ACHIEVEMENTS = [
  { id: 'diamond-first-catch', name: 'First Catch', emoji: '💎', measure: 'diamond_gems', goal: 1, for: 'Catch your first gem' },
  { id: 'diamond-firm-grip', name: 'Firm Grip', emoji: '✊', measure: 'diamond_grips', goal: 10, for: 'Hold on to 10 slipping gems' },
  { id: 'diamond-halfway', name: 'Halfway Down', emoji: '⛏️', measure: 'diamond_level', goal: 5, for: 'Pass level 5' },
  { id: 'diamond-collector', name: 'Gem Collector', emoji: '📖', measure: 'diamond_kinds', goal: 9, for: 'Catch every kind of gem' },
  { id: 'diamond-finder', name: 'Diamond Finder', emoji: '💖', measure: 'diamond_found', goal: 1, for: 'Catch the Heart Diamond' },
  { id: 'diamond-star-miner', name: 'Star Miner', emoji: '⭐', measure: 'diamond_stars', goal: 30, for: '3 stars on every level' },
] as const;

// ---- Points (rules_fn, Stage 4) ----
export const POINTS = { firstPass: 2, newStar: 1, diamond: 5 };
