/**
 * Plays the real game route with pretend students: each area in order, its real wild monsters
 * (from the map's long grass), its real trainers and its real Tower trainer, and reports how many
 * battles and minutes it takes and whether a 50%, 75% or 90% student beats each Tower.
 * Used by `npm run monsters:sim`; no screens, no browser.
 */
import { randomFromSeed } from '../../space/random';
import { AREA_LEVELS } from '../bands';
import { healTeam } from '../engine';
import { WORLD_MAPS } from '../maps';
import { formAt, speciesOf } from '../monsterBook';
import { makeMonster, type Monster } from '../rules';
import { playBattle, randomTeam, spread, type Spread, type Student } from '../sim';
import { AREAS } from './areas';
import { wildLevels, wildSpecies } from './encounters';
import type { Thing } from './types';

const towerOf = (area: number): Thing => WORLD_MAPS[AREAS[area - 1].towerTop].things.find((t) => t.kind === 'trainer')!;
const trainersOf = (area: number): Thing[] => WORLD_MAPS[AREAS[area - 1].map].things.filter((t) => t.kind === 'trainer');
const teamOf = (t: Thing): Monster[] => (t.team ?? []).map((m) => makeMonster(m.species, m.level));

/** A wild monster from the area's real wild list, in the near or far half. */
function wildMonster(area: number, far: boolean, random: () => number): Monster {
  const wild = WORLD_MAPS[AREAS[area - 1].map].wild;
  const [lo, hi] = wildLevels(area, far);
  const entry = wild[Math.floor(random() * wild.length)];
  const level = lo + Math.floor(random() * (hi - lo + 1));
  return makeMonster(wildSpecies(entry, level), level);
}

export interface TowerReport {
  area: number;
  /** Share of fights won by a team whose lead matches the area's top wild level, and by one that is 3 levels behind. */
  ready: { winRate: number; questions: Spread; minutes: Spread };
  behind: { winRate: number };
}

/** The real Tower trainer against a team of 3 at the area's top level (ready) or 3 levels lower (behind). */
export function simRealTower(area: number, student: Student, battles: number, seed: string): TowerReport {
  const random = randomFromSeed(seed);
  const top = AREA_LEVELS[area - 1][1];
  const run = (level: number) => {
    const questions: number[] = [];
    const minutes: number[] = [];
    let won = 0;
    for (let i = 0; i < battles; i++) {
      const r = playBattle({ kind: 'trainer', area, far: true, team: randomTeam(level, 3, random), bag: { potion: 3, 'super-potion': 1 }, foes: teamOf(towerOf(area)) }, student, random);
      if (r.won) won += 1;
      questions.push(r.questions);
      minutes.push(r.seconds / 60);
    }
    return { winRate: won / battles, questions: spread(questions), minutes: spread(minutes) };
  };
  return { area, ready: run(top), behind: { winRate: run(top - 3).winRate } };
}

export interface RouteReport {
  /** Wild battles it took in each area to get the lead as strong as the area's top wild monster. */
  battlesToReady: number[];
  /** Lead monster's level when facing each Tower. */
  leadAtTower: number[];
  /** Tries it took to beat each Tower (1 = first time). */
  towerTries: number[];
  totalBattles: number;
  /** Battles lost in all (nothing is lost but time). */
  losses: number;
  minutes: number;
}

/**
 * One student walks the whole game. In each area: wild battles until the lead is as strong as the
 * area's top wild level (at most 80), then every trainer on the map, then the Tower trainer
 * (retrying after a loss, which heals the team: that is exactly what the game does).
 */
export function simRoute(student: Student, seed: string): RouteReport {
  const random = randomFromSeed(seed);
  let team = randomTeam(5, 3, random);
  let battles = 0;
  let losses = 0;
  let seconds = 0;
  const lead = () => team.reduce((m, x) => Math.max(m, x.level), 0);
  const fight = (kind: 'wild' | 'trainer', area: number, far: boolean, foes: Monster[]) => {
    team = [...team].sort((a, b) => b.level - a.level); // the lead goes first, like a student's favourite
    const r = playBattle({ kind, area, far, team, bag: { potion: 5, 'super-potion': 2, ball: 0 }, foes }, student, random);
    team = healTeam(r.state.team);
    battles += 1;
    seconds += r.seconds;
    if (!r.won) losses += 1;
    return r.won;
  };
  const battlesToReady: number[] = [];
  const leadAtTower: number[] = [];
  const towerTries: number[] = [];
  for (const a of AREAS) {
    const [, hi] = AREA_LEVELS[a.area - 1];
    const mid = wildLevels(a.area, true)[0];
    let n = 0;
    while (lead() < hi && n < 80) {
      fight('wild', a.area, lead() >= mid, [wildMonster(a.area, lead() >= mid, random)]);
      n += 1;
    }
    battlesToReady.push(n);
    for (const t of trainersOf(a.area)) fight('trainer', a.area, true, teamOf(t));
    leadAtTower.push(lead());
    let tries = 0;
    do {
      tries += 1;
    } while (!fight('trainer', a.area, true, teamOf(towerOf(a.area))) && tries < 8);
    towerTries.push(tries);
    // The rest of the team catches up between areas (new catches, a little training).
    team = team.map((m) => (m.level < lead() - 3 ? makeMonster(formAt(speciesOf(m.species).family, lead() - 3), lead() - 3) : m));
  }
  return { battlesToReady, leadAtTower, towerTries, totalBattles: battles, losses, minutes: seconds / 60 };
}
