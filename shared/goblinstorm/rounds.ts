/**
 * Round bonuses (James, 27 Nov 2026): to spread play over every map, each map counts how many times its boss has been
 * beaten. Beating every boss in a group once is round 1 and pays +10 gold, every boss again is round 2 (+20), then
 * round 3 (+30) and so on. The Kingdom (the first five maps) and the Storm Lands (maps 6–10) are separate groups, each
 * with its own rounds. Gold only: hub points are untouched.
 *
 * The database's record_goblinstorm_run pays the same bonus (migration 20261127210645): keep them together.
 */
import { HEROES, MAPS, STORM_FIRST, type HeroId } from './config';

export type RoundGroup = 'kingdom' | 'storm';
export const ROUND_GROUPS: Record<RoundGroup, { name: string; maps: readonly number[] }> = {
  kingdom: { name: 'Kingdom', maps: Array.from({ length: STORM_FIRST }, (_, i) => i) },
  storm: { name: 'Storm Lands', maps: Array.from({ length: MAPS.length - STORM_FIRST }, (_, i) => STORM_FIRST + i) },
};
export const ROUND_GROUP_IDS = Object.keys(ROUND_GROUPS) as RoundGroup[];

/** Gold for finishing round `n` (1, 2, 3 …): 10, 20, 30 … */
export const ROUND_GOLD_STEP = 10;
export const roundGold = (n: number): number => ROUND_GOLD_STEP * n;

/** The group a map belongs to. */
export const groupOf = (map: number): RoundGroup => (map < STORM_FIRST ? 'kingdom' : 'storm');

/** Times each map's boss has been beaten, by map index (missing = 0). */
export type Beats = readonly number[];
/** Rounds already paid, by group. */
export type RoundsPaid = Partial<Record<RoundGroup, number>>;

/** Whole rounds finished in a group: the fewest beats of any map in it. */
export const roundsDone = (beats: Beats, group: RoundGroup): number =>
  Math.min(...ROUND_GROUPS[group].maps.map((m) => beats[m] ?? 0));

/** Gold still owed for rounds finished but not yet paid (e.g. rounds 1 to 3 at once: 10 + 20 + 30). */
export function goldOwed(beats: Beats, paid: RoundsPaid, group: RoundGroup): number {
  let gold = 0;
  for (let n = (paid[group] ?? 0) + 1; n <= roundsDone(beats, group); n++) gold += roundGold(n);
  return gold;
}

/** Where a group's next round stands: its number, its gold, and the maps still to beat for it. */
export function nextRound(beats: Beats, group: RoundGroup): { round: number; gold: number; toBeat: number[]; done: number } {
  const round = roundsDone(beats, group) + 1;
  const maps = ROUND_GROUPS[group].maps;
  const toBeat = maps.filter((m) => (beats[m] ?? 0) < round);
  return { round, gold: roundGold(round), toBeat, done: maps.length - toBeat.length };
}

/** A save's beats with one more win on `map`. */
export const withBeat = (beats: Beats, map: number): number[] =>
  Array.from({ length: Math.max(beats.length, map + 1) }, (_, i) => (beats[i] ?? 0) + (i === map ? 1 : 0));

/** Round bonus gold between two saves (what the end screen shows after a run). */
export function bonusBetween(before: { roundsPaid?: RoundsPaid; heroRoundsPaid?: number } | null | undefined, after: { roundsPaid?: RoundsPaid; heroRoundsPaid?: number } | null | undefined): { maps: number; heroes: number } {
  const none = { maps: 0, heroes: 0 };
  if (!before || !after) return none;
  let maps = 0;
  for (const g of ROUND_GROUP_IDS) {
    for (let n = (before.roundsPaid?.[g] ?? 0) + 1; n <= (after.roundsPaid?.[g] ?? 0); n++) maps += roundGold(n);
  }
  let heroes = 0;
  for (let n = (before.heroRoundsPaid ?? 0) + 1; n <= (after.heroRoundsPaid ?? 0); n++) heroes += roundGold(n);
  return { maps, heroes };
}

/**
 * One finished run on `map`: the beats and rounds paid after it, and the bonus gold it pays (0 unless it finished a
 * round, or rounds finished before bonuses began are still owed). The database does the same in record_goblinstorm_run.
 */
export function afterRun(save: { beats: Beats; roundsPaid: RoundsPaid }, map: number, bossBeaten: boolean): { beats: number[]; roundsPaid: RoundsPaid; bonus: number } {
  const beats = bossBeaten ? withBeat(save.beats, map) : [...save.beats];
  const group = groupOf(map);
  const bonus = goldOwed(beats, save.roundsPaid, group);
  const roundsPaid = { ...save.roundsPaid, [group]: Math.max(save.roundsPaid[group] ?? 0, roundsDone(beats, group)) };
  return { beats, roundsPaid, bonus };
}

// ---------------------------------------------------------------- hero rounds

/**
 * Hero rounds (James, 28 Nov 2026): to spread play over every hero, a boss win with each hero the pupil has opened is a
 * hero round, paid like map rounds (+10, +20, +30 …). The heroes who have won since the last hero round are kept in
 * `heroRound`; a hero opened mid-round joins the round. Each hero's boss wins are counted for its card. Gold only.
 * The database does the same in record_goblinstorm_run (migration 20261128064254): keep them together.
 */
export interface HeroRounds {
  /** Boss wins by hero. */
  heroWins: Partial<Record<HeroId, number>>;
  /** Heroes with a boss win since the last hero round was paid. */
  heroRound: HeroId[];
  /** Hero rounds paid so far. */
  heroRoundsPaid: number;
}

/** The heroes a save has open: the free ones and those unlocked. */
export const openHeroes = (unlocked: readonly HeroId[]): HeroId[] =>
  HEROES.filter((h) => h.unlock === 'free' || unlocked.includes(h.id)).map((h) => h.id);

/** The next hero round: its number, gold, and the open heroes still to win with. */
export function nextHeroRound(save: HeroRounds & { heroes: readonly HeroId[] }): { round: number; gold: number; toWin: HeroId[]; done: number; of: number } {
  const open = openHeroes(save.heroes);
  const toWin = open.filter((h) => !save.heroRound.includes(h));
  const round = save.heroRoundsPaid + 1;
  return { round, gold: roundGold(round), toWin, done: open.length - toWin.length, of: open.length };
}

/** One finished run with `hero` (`heroes`: the save's unlocked heroes after this run): the hero rounds after it and the bonus. */
export function afterHeroRun(save: HeroRounds, heroes: readonly HeroId[], hero: HeroId, bossBeaten: boolean): HeroRounds & { bonus: number } {
  if (!bossBeaten) return { ...save, heroWins: { ...save.heroWins }, heroRound: [...save.heroRound], bonus: 0 };
  const heroWins = { ...save.heroWins, [hero]: (save.heroWins[hero] ?? 0) + 1 };
  const heroRound = save.heroRound.includes(hero) ? [...save.heroRound] : [...save.heroRound, hero];
  if (openHeroes(heroes).every((h) => heroRound.includes(h))) {
    return { heroWins, heroRound: [], heroRoundsPaid: save.heroRoundsPaid + 1, bonus: roundGold(save.heroRoundsPaid + 1) };
  }
  return { heroWins, heroRound, heroRoundsPaid: save.heroRoundsPaid, bonus: 0 };
}
