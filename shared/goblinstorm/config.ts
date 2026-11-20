/**
 * Every tuning number for Goblin Storm (docs/GOBLINSTORM-PLAN.md). Distances are in world units (the hero is a little
 * under 1 across; a laptop screen shows about 24 × 14). Times are steps of 1/60 s unless a name says seconds.
 */

export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND;
export const RUN_SECONDS = 180;
export const RUN_STEPS = RUN_SECONDS * STEPS_PER_SECOND;
export const MINIBOSS_AT = 90 * STEPS_PER_SECOND;
export const BOSS_AT = 150 * STEPS_PER_SECOND;

/** Pools: never more than this many at once (keeps old iPads and the server's replay quick). */
export const MAX_ENEMIES = 320;
export const MAX_SHOTS = 220;
export const MAX_GEMS = 300;

export const HERO_RADIUS = 0.45;
/** Steps the hero can't be hurt again after a hit. */
export const HURT_GAP = 30;
/** Monsters appear on a ring this far from the hero (just off a laptop screen) … */
export const SPAWN_RING = 15;
/** … and ones left further behind than this are moved back onto the ring ahead. */
export const FAR_AWAY = 26;
/** Evolved blasts reach every monster this close: the whole screen. */
export const WIPE_RADIUS = 17;
/** Bosses only take this share of a blast, so a blast can't one-shot a boss. */
export const BOSS_WIPE_SHARE = 0.25;
/** Collision grid: square cells, this many each way, centred on the hero. */
export const CELL = 2;
export const GRID = 32;
/** Only the first few neighbours in a cell push a monster apart (enough to stop stacking, cheap to replay). */
export const SEPARATE_CHECKS = 6;

export const GEM_PULL_SPEED = 11;
export const GEM_PICKUP = 0.6;
export const BASE_MAGNET = 1.6;

/** Gems needed to go from level n to n + 1. */
export function gemsToNext(level: number): number {
  return 2 + level;
}

export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 4;
export const WEAPON_LEVELS = 5;
export const PASSIVE_LEVELS = 5;
/**
 * Only every third level-up asks a maths question (James, 19 Nov 2026: one at every level-up was too many to play). The
 * others go straight to the "right" 3 cards. About 6 to 8 questions a run.
 */
export const ASK_EVERY = 3;
/** The question slot a level-up asks (level-ups 3, 6, 9 … ask slots 0, 1, 2 …), or null for a level-up with no question. */
export function questionSlot(levelUp: number): number | null {
  return levelUp % ASK_EVERY === ASK_EVERY - 1 ? (levelUp - (ASK_EVERY - 1)) / ASK_EVERY : null;
}
/** Level-up questions kept per run; past this a level-up gives the "right" 3 choices without a question. */
export const QUESTIONS_PER_RUN = 14;
export const CHOICES = { wrong: 2, right: 3, quick: 4 } as const;

// ---------------------------------------------------------------- weapons

export type WeaponId = 'blades' | 'fireball' | 'lightning' | 'aura' | 'nova' | 'axes' | 'arrows' | 'bubble';
export type PassiveId = 'armour' | 'spiky' | 'boots' | 'tome' | 'crown' | 'holywater' | 'snow' | 'gauntlets' | 'magnet' | 'heart';

/** One level of a weapon. Not every weapon uses every number. */
export interface WeaponLevel {
  damage: number;
  /** Steps between goes (blades: steps before the same monster can be cut again). */
  cooldown: number;
  /** Blades, fireballs, lightning bolts, axes, arrows; bubble: charges. */
  count: number;
  /** Orbit radius, aura radius, blast radius, nova reach. */
  area: number;
  /** Shot speed (units a second); blades: 64ths of a turn a step. */
  speed: number;
  /** Monsters a shot passes through before it's used up. */
  pierce: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** One line for the level-up card. */
  blurb: string;
  levels: WeaponLevel[];
  evolvesWith: PassiveId;
  evolved: { name: string; blurb: string; stats: WeaponLevel; wipeEvery: number; wipeDamage: number };
}

const L = (damage: number, cooldown: number, count: number, area: number, speed: number, pierce: number): WeaponLevel => ({ damage, cooldown, count, area, speed, pierce });

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  blades: {
    id: 'blades', name: 'Spinning Blades', blurb: 'Swords spin around you.',
    levels: [L(10, 20, 2, 1.8, 0.9, 0), L(12, 20, 3, 1.9, 0.9, 0), L(14, 18, 3, 2.1, 1.0, 0), L(16, 18, 4, 2.2, 1.0, 0), L(20, 16, 5, 2.4, 1.1, 0)],
    evolvesWith: 'armour',
    evolved: { name: 'Blade Storm', blurb: 'A storm of blades shreds the whole screen.', stats: L(30, 12, 8, 2.8, 1.4, 0), wipeEvery: 8 * 60, wipeDamage: 80 },
  },
  fireball: {
    id: 'fireball', name: 'Fireball', blurb: 'Hurls fire at the nearest monster.',
    levels: [L(14, 55, 1, 1.2, 9, 0), L(16, 50, 1, 1.3, 9, 0), L(18, 48, 2, 1.4, 10, 0), L(22, 45, 2, 1.5, 10, 0), L(26, 40, 3, 1.7, 11, 0)],
    evolvesWith: 'tome',
    evolved: { name: 'Meteor Storm', blurb: 'Meteors rain down on every monster.', stats: L(40, 30, 4, 2.2, 12, 0), wipeEvery: 9 * 60, wipeDamage: 100 },
  },
  lightning: {
    id: 'lightning', name: 'Lightning', blurb: 'Bolts strike random monsters.',
    levels: [L(18, 75, 2, 0.9, 0, 0), L(20, 70, 2, 1.0, 0, 0), L(22, 65, 3, 1.0, 0, 0), L(26, 60, 3, 1.1, 0, 0), L(30, 55, 4, 1.2, 0, 0)],
    evolvesWith: 'crown',
    evolved: { name: 'Thunder God', blurb: 'Thunder hits the whole screen.', stats: L(45, 40, 6, 1.6, 0, 0), wipeEvery: 8 * 60, wipeDamage: 90 },
  },
  aura: {
    id: 'aura', name: 'Holy Aura', blurb: 'A glowing circle hurts monsters near you.',
    levels: [L(5, 20, 1, 1.6, 0, 0), L(6, 20, 1, 1.8, 0, 0), L(7, 18, 1, 2.0, 0, 0), L(8, 18, 1, 2.2, 0, 0), L(10, 16, 1, 2.5, 0, 0)],
    evolvesWith: 'holywater',
    evolved: { name: 'Sun Flare', blurb: 'The sun bursts across the screen.', stats: L(16, 14, 1, 3.2, 0, 0), wipeEvery: 10 * 60, wipeDamage: 90 },
  },
  nova: {
    id: 'nova', name: 'Ice Nova', blurb: 'Freezing rings slow and hurt monsters.',
    levels: [L(8, 120, 1, 3.5, 0, 0), L(10, 110, 1, 3.8, 0, 0), L(12, 100, 1, 4.1, 0, 0), L(14, 95, 1, 4.4, 0, 0), L(18, 90, 1, 4.8, 0, 0)],
    evolvesWith: 'snow',
    evolved: { name: 'Blizzard', blurb: 'A blizzard freezes the whole screen.', stats: L(28, 70, 1, 6, 0, 0), wipeEvery: 9 * 60, wipeDamage: 80 },
  },
  axes: {
    id: 'axes', name: 'Throwing Axes', blurb: 'Axes fly up and crash down through monsters.',
    levels: [L(16, 70, 1, 0.5, 11, 99), L(18, 65, 2, 0.5, 11, 99), L(22, 60, 2, 0.6, 12, 99), L(26, 55, 3, 0.6, 12, 99), L(30, 50, 3, 0.7, 13, 99)],
    evolvesWith: 'gauntlets',
    evolved: { name: 'Axe Tornado', blurb: 'A tornado of axes tears through everything.', stats: L(40, 35, 5, 0.8, 13, 99), wipeEvery: 9 * 60, wipeDamage: 90 },
  },
  arrows: {
    id: 'arrows', name: 'Arrows', blurb: 'Arrows fly the way you are going.',
    levels: [L(9, 40, 1, 0.3, 14, 2), L(10, 36, 2, 0.3, 14, 2), L(12, 32, 2, 0.3, 15, 3), L(14, 30, 3, 0.3, 15, 3), L(16, 26, 4, 0.35, 16, 4)],
    evolvesWith: 'boots',
    evolved: { name: 'Arrow Rain', blurb: 'Arrows rain from the sky on every monster.', stats: L(24, 18, 6, 0.4, 18, 6), wipeEvery: 8 * 60, wipeDamage: 80 },
  },
  bubble: {
    id: 'bubble', name: 'Bubble Shield', blurb: 'A bubble blocks a hit, then grows back.',
    levels: [L(0, 360, 1, 1.0, 0, 0), L(0, 320, 1, 1.0, 0, 0), L(6, 300, 2, 1.6, 0, 0), L(8, 270, 2, 1.8, 0, 0), L(10, 240, 3, 2.0, 0, 0)],
    evolvesWith: 'spiky',
    evolved: { name: 'Spiky Fortress', blurb: 'A spiky fortress blasts monsters away.', stats: L(30, 180, 4, 2.8, 0, 0), wipeEvery: 10 * 60, wipeDamage: 80 },
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

// ---------------------------------------------------------------- passives

export interface PassiveDef { id: PassiveId; name: string; blurb: string }
export const PASSIVES: Record<PassiveId, PassiveDef> = {
  armour: { id: 'armour', name: 'Armour', blurb: 'Take 1 less damage from every hit.' },
  spiky: { id: 'spiky', name: 'Spiky Shield', blurb: 'Monsters that touch you get hurt.' },
  boots: { id: 'boots', name: 'Swift Boots', blurb: 'Move 8% faster.' },
  tome: { id: 'tome', name: 'Spell Tome', blurb: 'Attack 8% more often.' },
  crown: { id: 'crown', name: 'Crown', blurb: 'Gems are worth 10% more.' },
  holywater: { id: 'holywater', name: 'Holy Water', blurb: 'Slowly heal.' },
  snow: { id: 'snow', name: 'Snow Crystal', blurb: 'Attacks 8% bigger.' },
  gauntlets: { id: 'gauntlets', name: 'Gauntlets', blurb: 'Hit 10% harder.' },
  magnet: { id: 'magnet', name: 'Magnet', blurb: 'Pull gems from further away.' },
  heart: { id: 'heart', name: 'Heart', blurb: '+20 health.' },
};
export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
/** What one level of each passive adds. */
export const PASSIVE_STEP = {
  armour: 1, spiky: 6, boots: 0.08, tome: 0.08, crown: 0.1, holywater: 0.3, snow: 0.08, gauntlets: 0.1, magnet: 0.25, heart: 20,
} as const;

// ---------------------------------------------------------------- heroes

export type HeroId = 'knight' | 'ranger' | 'wizard' | 'barbarian' | 'cleric' | 'rogue' | 'witch' | 'dragonkid';

export interface HeroDef {
  id: HeroId;
  name: string;
  blurb: string;
  /** Units a second. */
  speed: number;
  health: number;
  weapon: WeaponId;
  armour: number;
  might: number;
  area: number;
  magnet: number;
  /** Health back a second. */
  regen: number;
  /** Chance (0–1) a hit does double. */
  crit: number;
  /** Monsters move this much slower (0–1). */
  chill: number;
  /** Up to this much extra might as health drops (Barbarian). */
  rage: number;
  /** How it's unlocked (`free` for the starters). */
  unlock: UnlockId;
  secret?: boolean;
}

export type UnlockId = 'free' | 'level' | 'kills' | 'boss1' | 'nohit' | 'boss4' | 'evolve3';
/**
 * The numbers in the unlocks. Raised 20 Nov 2026 (James: heroes came too fast; a first test reached level 31 and 38 and
 * about 2,000 monsters a run): level 35 needs a strong run, and 20,000 monsters is about two school days of runs.
 * record_goblinstorm_run in migration 20261120000100 uses the same numbers: change both together.
 */
export const UNLOCK_AT = { level: 35, kills: 20000, noHitSeconds: 120, evolutions: 3 } as const;
export const UNLOCK_WORDS: Record<UnlockId, string> = {
  free: 'Ready to play',
  level: `Reach level ${UNLOCK_AT.level} in one run`,
  kills: `Beat ${UNLOCK_AT.kills.toLocaleString('en-NZ')} monsters in total`,
  boss1: 'Beat the Goblin King',
  nohit: `Survive ${UNLOCK_AT.noHitSeconds} seconds without being hit`,
  boss4: 'Beat the Ice Dragon',
  evolve3: `Evolve ${UNLOCK_AT.evolutions} different weapons in one run`,
};

const hero = (h: Partial<HeroDef> & Pick<HeroDef, 'id' | 'name' | 'blurb' | 'speed' | 'health' | 'weapon' | 'unlock'>): HeroDef =>
  ({ armour: 0, might: 1, area: 1, magnet: 1, regen: 0, crit: 0, chill: 0, rage: 0, ...h });

export const HEROES: HeroDef[] = [
  hero({ id: 'knight', name: 'Knight', blurb: 'Slow but very tough.', speed: 3.0, health: 140, weapon: 'blades', armour: 2, unlock: 'free' }),
  hero({ id: 'ranger', name: 'Ranger', blurb: 'Quick, with a long gem pull.', speed: 4.2, health: 80, weapon: 'arrows', magnet: 1.3, unlock: 'free' }),
  hero({ id: 'wizard', name: 'Wizard', blurb: 'Bigger spells.', speed: 3.5, health: 80, weapon: 'fireball', area: 1.2, unlock: 'level' }),
  hero({ id: 'barbarian', name: 'Barbarian', blurb: 'Hits harder when hurt.', speed: 3.5, health: 120, weapon: 'axes', rage: 0.5, unlock: 'kills' }),
  hero({ id: 'cleric', name: 'Cleric', blurb: 'Heals as they go.', speed: 3.1, health: 100, weapon: 'aura', regen: 1, unlock: 'boss1' }),
  hero({ id: 'rogue', name: 'Rogue', blurb: 'The fastest, with lucky hits.', speed: 4.6, health: 75, weapon: 'lightning', crit: 0.2, unlock: 'nohit' }),
  hero({ id: 'witch', name: 'Frost Witch', blurb: 'Monsters near her slow down.', speed: 3.5, health: 95, weapon: 'nova', chill: 0.15, unlock: 'boss4' }),
  hero({ id: 'dragonkid', name: 'Dragon Kid', blurb: 'Tough scales, hot breath.', speed: 3.6, health: 100, weapon: 'fireball', armour: 1, might: 1.1, unlock: 'evolve3', secret: true }),
];
export function heroById(id: string): HeroDef | undefined {
  return HEROES.find((h) => h.id === id);
}

// ---------------------------------------------------------------- monsters and maps

export interface MonsterDef {
  id: string;
  name: string;
  health: number;
  /** Units a second. */
  speed: number;
  damage: number;
  radius: number;
  gems: number;
}

/** Each map's monsters: [common, fast, tough, mini-boss, boss]. */
export interface MapDef {
  id: string;
  name: string;
  /** Monster health and damage are multiplied by this. */
  tier: number;
  monsters: [MonsterDef, MonsterDef, MonsterDef, MonsterDef, MonsterDef];
}

const m = (id: string, name: string, health: number, speed: number, damage: number, radius: number, gems: number): MonsterDef => ({ id, name, health, speed, damage, radius, gems });

export const MAPS: MapDef[] = [
  { id: 'castle', name: 'Castle Fields', tier: 1, monsters: [m('goblin', 'Goblin', 8, 1.9, 6, 0.4, 1), m('bat', 'Bat', 5, 3.0, 4, 0.3, 1), m('slime', 'Big Slime', 30, 1.2, 10, 0.6, 3), m('troll', 'Troll', 350, 1.5, 16, 1.1, 40), m('goblinking', 'Goblin King', 750, 1.4, 22, 1.4, 0)] },
  { id: 'forest', name: 'Dark Forest', tier: 1.35, monsters: [m('mushroom', 'Angry Mushroom', 8, 1.8, 6, 0.4, 1), m('wolf', 'Wolf', 6, 3.2, 5, 0.4, 1), m('spider', 'Spider', 30, 1.4, 10, 0.6, 3), m('giantspider', 'Giant Spider', 350, 1.7, 16, 1.2, 40), m('ogre', 'Forest Ogre', 750, 1.4, 22, 1.5, 0)] },
  { id: 'graveyard', name: 'Haunted Graveyard', tier: 1.8, monsters: [m('skeleton', 'Skeleton', 8, 1.9, 6, 0.4, 1), m('ghost', 'Ghost', 5, 3.0, 5, 0.4, 1), m('zombie', 'Zombie', 34, 1.1, 11, 0.6, 3), m('boneknight', 'Bone Knight', 350, 1.6, 18, 1.1, 40), m('lich', 'Lich', 750, 1.4, 24, 1.3, 0)] },
  { id: 'peaks', name: 'Frozen Peaks', tier: 2.3, monsters: [m('imp', 'Ice Imp', 8, 2.0, 6, 0.4, 1), m('frostwolf', 'Frost Wolf', 6, 3.3, 5, 0.4, 1), m('yeti', 'Yeti', 34, 1.2, 12, 0.7, 3), m('yetichief', 'Yeti Chief', 350, 1.6, 18, 1.2, 40), m('icedragon', 'Ice Dragon', 750, 1.5, 26, 1.6, 0)] },
  { id: 'lava', name: 'Lava Mines', tier: 2.8, monsters: [m('sprite', 'Fire Sprite', 8, 2.1, 7, 0.35, 1), m('slug', 'Lava Slug', 6, 2.8, 6, 0.4, 1), m('magma', 'Magma Golem', 36, 1.1, 13, 0.7, 3), m('golem', 'Golem', 350, 1.5, 20, 1.3, 40), m('firedragon', 'Fire Dragon', 750, 1.5, 28, 1.7, 0)] },
];
export function mapByIndex(i: number): MapDef | undefined {
  return MAPS[i];
}

/**
 * A gentle start: for the first this-many seconds monsters do only this share of their damage (stage 4 sim: a Ranger
 * standing still on Castle Fields used to fall at 0:14). 30 seconds until 20 Nov 2026 (a little harder).
 */
export const WARM_UP_SECONDS = 20;
export const WARM_UP_DAMAGE = 0.5;

/** Monster health grows during a run: × (1 + seconds / this). 120 until 20 Nov 2026, when James asked for a little harder. */
export const HEALTH_GROWTH_SECONDS = 90;

/**
 * On top of that, monsters born near the end are tougher still (James, 20 Nov 2026): × LAST_MINUTE_HEALTH from 2:00,
 * × LAST_HALF_MINUTE_HEALTH from 2:30. Common, fast and tough monsters only; the mini-boss and boss keep their health.
 */
export const LAST_MINUTE_HEALTH = 1.5;
export const LAST_HALF_MINUTE_HEALTH = 2;

/** How much tougher a common, fast or tough monster born at step `t` is than one born at the start. */
export function healthGrowth(t: number): number {
  const seconds = t / STEPS_PER_SECOND;
  const late = seconds >= RUN_SECONDS - 30 ? LAST_HALF_MINUTE_HEALTH : seconds >= RUN_SECONDS - 60 ? LAST_MINUTE_HEALTH : 1;
  return (1 + seconds / HEALTH_GROWTH_SECONDS) * late;
}

/**
 * When each kind of monster comes (same for every map; the map's tier makes it harder). `kind` is 0 common, 1 fast,
 * 2 tough. Between `from` and `to` seconds, `count` of them every `every` steps.
 */
export interface Wave { from: number; to: number; kind: 0 | 1 | 2; every: number; count: number }
export const WAVES: Wave[] = [
  { from: 2, to: 40, kind: 0, every: 60, count: 2 },
  { from: 25, to: 70, kind: 1, every: 70, count: 3 },
  { from: 40, to: 180, kind: 0, every: 30, count: 3 },
  { from: 60, to: 180, kind: 2, every: 100, count: 2 },
  { from: 95, to: 180, kind: 1, every: 45, count: 4 },
  { from: 120, to: 180, kind: 0, every: 20, count: 4 },
];
/** A ring of common monsters closes in all at once at these seconds. */
export const SWARMS = [45, 105, 135];
export const SWARM_SIZE = 28;

/** Bosses charge: every this many steps, for this many steps, this much faster. */
export const BOSS_CHARGE = { every: 4 * 60, lasts: 40, speed: 3 };

// ---------------------------------------------------------------- gold and the shop

export const GOLD = { per8Kills: 1, miniBoss: 15, boss: 40, survived: 10 };

export type ShopId = 'might' | 'armour' | 'speed' | 'health' | 'magnet' | 'gold';
export const SHOP: Record<ShopId, { name: string; blurb: string; step: number }> = {
  might: { name: 'Might', blurb: '+5% damage', step: 0.05 },
  armour: { name: 'Armour', blurb: '+1 armour (up to 3)', step: 1 },
  speed: { name: 'Speed', blurb: '+4% speed', step: 0.04 },
  health: { name: 'Health', blurb: '+10 health', step: 10 },
  magnet: { name: 'Magnet', blurb: '+10% gem pull', step: 0.1 },
  gold: { name: 'Gold', blurb: '+5% gold', step: 0.05 },
};
export const SHOP_IDS = Object.keys(SHOP) as ShopId[];
export const SHOP_LEVELS = 5;
export const SHOP_ARMOUR_MAX = 3;
export const SHOP_COSTS = [200, 400, 700, 1100, 1600];
export type ShopLevels = Partial<Record<ShopId, number>>;

/** Monster damage grows with the map's tier more gently than health: × (1 + (tier − 1) × this). */
export const DAMAGE_PER_TIER = 0.25;

/** Runs a day on normal turns (James, 19 Nov 2026). The teacher's "Unlimited today" (or a Bonus Turns Day) lifts it. */
export const RUNS_A_DAY = 5;
