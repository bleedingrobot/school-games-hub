/**
 * Class Showdown's boss roster (docs/SHOWDOWN-PLAN.md, Decisions "Boss roster"): four bosses, each with 3 painted phases
 * (`src/games/showdown/art/paint/bosses/<id>-<phase>.webp`) and a backdrop (`back/<backdrop>.webp`). A class beats them
 * in order: each boss beaten unlocks the next. After all four, the class picks any.
 */
export const BOSSES = [
  { id: 'river-titan', name: 'River Titan', backdrop: 'river-valley', roar: 'The River Titan rises!' },
  { id: 'storm-kraken', name: 'Storm Kraken', backdrop: 'stormy-sea', roar: 'The Storm Kraken surfaces!' },
  { id: 'clockwork-colossus', name: 'Clockwork Colossus', backdrop: 'clock-tower', roar: 'The Clockwork Colossus winds up!' },
  { id: 'comet-wyrm', name: 'Comet Wyrm', backdrop: 'night-sky', roar: 'The Comet Wyrm streaks in!' },
] as const;

export type BossId = (typeof BOSSES)[number]['id'];
export const BOSS_IDS: readonly BossId[] = BOSSES.map((b) => b.id);
export const isBossId = (v: unknown): v is BossId => typeof v === 'string' && (BOSS_IDS as readonly string[]).includes(v);
export const bossInfo = (id: BossId | null | undefined) => BOSSES.find((b) => b.id === id) ?? BOSSES[0];

/** One boss on a class's roster: beaten yet, and the class's best time (ms) to beat it. */
export interface RosterRow {
  boss: BossId;
  beaten: boolean;
  bestMs: number | null;
  /** True for a boss the class can fight now (beaten ones, and the first one not beaten yet). */
  open: boolean;
}

/** The roster from the bosses a class has beaten (with best times). */
export function roster(beaten: Partial<Record<BossId, number>>): RosterRow[] {
  const firstNew = BOSS_IDS.find((id) => beaten[id] === undefined);
  return BOSS_IDS.map((id) => ({ boss: id, beaten: beaten[id] !== undefined, bestMs: beaten[id] ?? null, open: beaten[id] !== undefined || id === firstNew }));
}

/** The boss a new round fights: the one asked for if it's open, else the first not beaten, else the next after `last`. */
export function pickBoss(beaten: Partial<Record<BossId, number>>, asked?: unknown, last?: BossId | null): BossId {
  const rows = roster(beaten);
  if (isBossId(asked) && rows.find((r) => r.boss === asked)?.open) return asked;
  const firstNew = rows.find((r) => !r.beaten);
  if (firstNew) return firstNew.boss;
  const i = last ? BOSS_IDS.indexOf(last) : -1;
  return BOSS_IDS[(i + 1) % BOSS_IDS.length];
}

/** What a pupil gets at the end of a round (shown on their iPad). */
export interface Reward {
  /** Hub points (inside the shared daily cap, like any game). */
  points: number;
  /** The Showdown chest: gold or coins for the pupil's own favourite game that has them. */
  chest: { game: ChestGame; amount: number };
}

/** Games a Showdown chest can pay into, with what it pays. */
export const CHEST_GAMES = {
  archery: { name: 'Archery Challenge', coin: 'coins', base: 5, beaten: 3 },
  goblinstorm: { name: 'Goblin Storm', coin: 'gold', base: 20, beaten: 10 },
} as const;
export type ChestGame = keyof typeof CHEST_GAMES;

/** A round's reward: every round pays (no cap on the chest); beating the boss pays a little more. */
export function rewardFor(game: ChestGame, beaten: boolean, correct: number): Reward {
  const c = CHEST_GAMES[game];
  return {
    points: correct > 0 ? (beaten ? 5 : 3) : 1,
    chest: { game, amount: c.base + (beaten ? c.beaten : 0) },
  };
}
