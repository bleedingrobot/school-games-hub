/**
 * Plays a bot clan through many days, to see how fast it grows and how often it wins, so the
 * numbers in config.ts and gamedata.ts can be tuned (npm run clans:sim). Not used by the game.
 */
import { averageLevel, botChores, botOrders } from './bot';
import { CONFIG } from './config';
import { dayReset, gainXp, rollMember } from './character';
import { botEmpire, type EmpireDay } from './empireBot';
import { empireNewDay, empireOf, joinFollowers, levelTotal, maxLevel, might, newEmpire } from './empire';
import { nextFloat } from './rng';
import { bossAt, newFight, playRound, settle, type FightResult } from './fight';
import { SPELLS } from './spells';
import { VILLAGE_BUILDINGS, type Clan } from './types';

export type Lineup = 'balanced' | 'fighters';

const LINEUPS: Record<Lineup, [string, string][]> = {
  balanced: [['Dwarf', 'Warrior'], ['Elf', 'Healer'], ['Halfling', 'Wizard'], ['Human', 'Knight']],
  fighters: [['Dwarf', 'Barbarian'], ['Orc', 'Warrior'], ['Human', 'Samurai'], ['Half-Elf', 'Martial Artist']],
};

export function newClan(lineup: Lineup, seed: number): Clan {
  const dice = { rng: seed | 0 };
  const names = ['Ash', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern'];
  return {
    name: 'Test Clan',
    members: LINEUPS[lineup].map(([race, cls], i) => rollMember(dice, names[i], race, cls, i === 0)),
    gold: CONFIG.startGold,
    followers: 0,
    village: { trainingHall: 0, smithy: 0, church: 0 },
    empire: newEmpire(),
  };
}

export interface SimOptions {
  days: number;
  seed: number;
  lineup: Lineup;
  /** Chance a Battle Cry question is answered right each round. */
  mathsRate: number;
  /** Mine depth relative to the clan's average level (0 = "just right"). */
  depthOffset: number;
  /** Rounds the bot answers a Battle Cry at all (1 = every round). */
  askEvery?: number;
  /** Also run the bot's empire each evening (stage C.4). */
  empire?: boolean;
  /** Days a week the clan plays (1 to 7, default 7). The other days pass with no play; they still save builds. */
  playDays?: number;
}

export interface DayReport {
  day: number;
  avgLevel: number;
  depth: number;
  fights: number;
  wins: number;
  knockOuts: number;
  rounds: number;
  /** Skill points the clan spent on spells, over all of the day's fights. */
  spSpent: number;
  gold: number;
  /** Empire figures at the end of the day (only when the empire is on). */
  empire?: EmpireDay & { might: number; levels: number; barracks: number; allMax: boolean };
}

export interface SimReport {
  days: DayReport[];
  fights: number;
  wins: number;
  results: Record<FightResult, number>;
  /** The day the average level reached 20, or null. */
  dayAtMax: number | null;
  bossWins: number;
}

export function simulate(opts: SimOptions): SimReport {
  const clan = newClan(opts.lineup, opts.seed);
  const dice = { rng: (opts.seed * 7919) | 0 };
  const days: DayReport[] = [];
  const results: Record<FightResult, number> = { won: 0, lost: 0, fled: 0, timeout: 0 };
  let seedCounter = opts.seed * 100003;
  let totalFights = 0;
  let totalWins = 0;
  let dayAtMax: number | null = null;
  let bossWins = 0;
  const bossesBeaten = new Set<number>();

  const play = Math.max(1, Math.min(7, opts.playDays ?? 7));
  let lastPlayed = 0;
  for (let day = 1; day <= opts.days; day++) {
    // Play days are spread through the week: day d is played when it is the first day of a new "slot" of 7/play days.
    const plays = day === 1 || Math.floor((day * play) / 7) > Math.floor(((day - 1) * play) / 7);
    if (!plays) {
      const prev = days[days.length - 1];
      days.push({ ...prev, day, fights: 0, wins: 0, knockOuts: 0, rounds: 0, spSpent: 0 });
      continue;
    }
    dayReset(clan);
    if (opts.empire && day > 1) empireNewDay(clan, day - lastPlayed - 1);
    lastPlayed = day;
    const report: DayReport = { day, avgLevel: 0, depth: 0, fights: 0, wins: 0, knockOuts: 0, rounds: 0, spSpent: 0, gold: 0 };
    for (let n = 0; n < CONFIG.fightsPerDay; n++) {
      botChores(clan);
      const fit = clan.members.filter((m) => !m.knockedOut);
      if (fit.length === 0) break;
      const depth = Math.max(0, Math.min(20, Math.floor(averageLevel(clan)) - 1 + opts.depthOffset));
      const boss = !!bossAt(depth) && !bossesBeaten.has(depth) && averageLevel(clan) >= depth + 1;
      const state = newFight(clan.members, depth, ++seedCounter, boss);
      const ours = new Set(state.clan.map((f) => f.name));
      while (!state.result) {
        const cry = nextFloat(dice) < opts.mathsRate ? 'damage' : null;
        const from = state.log.length;
        playRound(state, botOrders(state), cry);
        // Each member acts once a round; a "hits every enemy" spell logs once per enemy but is paid for once.
        const cast = new Map<string, string>();
        for (const e of state.log.slice(from)) if (e.type === 'cast' && ours.has(e.who)) cast.set(e.who, e.spell);
        for (const name of cast.values()) report.spSpent += Object.values(SPELLS).find((sp) => sp.name === name)?.sp ?? 0;
      }
      const before = clan.members.filter((m) => m.knockedOut).length;
      settle(clan.members, state, gainXp);
      report.knockOuts += clan.members.filter((m) => m.knockedOut).length - before;
      if (state.result === 'won') {
        clan.gold += state.gold;
        clan.followers += state.followers;
        if (opts.empire) joinFollowers(clan);
        if (boss) {
          bossesBeaten.add(depth);
          bossWins++;
        }
        report.wins++;
        totalWins++;
      }
      results[state.result]++;
      report.fights++;
      report.depth = depth;
      report.rounds += state.round;
      totalFights++;
    }
    if (opts.empire) {
      const e = empireOf(clan);
      const today = botEmpire(clan, opts.seed * 1000 + day);
      report.empire = { ...today, might: might(e.troops), levels: levelTotal(e), barracks: e.levels.barracks, allMax: VILLAGE_BUILDINGS.every((b) => e.levels[b] >= maxLevel(b)) };
    }
    report.avgLevel = averageLevel(clan);
    report.gold = clan.gold;
    days.push(report);
    if (dayAtMax === null && clan.members.every((m) => m.level >= CONFIG.maxLevel)) dayAtMax = day;
  }
  return { days, fights: totalFights, wins: totalWins, results, dayAtMax, bossWins };
}
