import { ARMOURS, FOREST_FIGHTS_PER_DAY, MAX_LEVEL, SEASON_DAYS, WEAPONS } from './data';
import {
  applyForestResult, applyMasterResult, buyGear, canChallengeMaster, canFaceDragon, deposit, finishDragon, forestTrip, heal,
  applyEvent, dragonBreather, loseToDragon, makeRandom, newHero, rollDay, skillsFor, startDragonStage, startFight, startMasterFight, stepFight,
  useForestTurn, withdraw,
} from './engine';
import { dragonStageOptions } from './maths';
import type { FightState, Hero, HeroClass } from './types';

/** How often the simulated pupil answers a maths question right. */
export const MATHS_RIGHT_SHARE = 0.7;

/**
 * Plays whole seasons with a simple, sensible pupil and reports the pace, so the exp curve and the
 * economy can be tuned without guessing (docs/LORD-PLAN.md section 7). Run: npm run lord:sim
 */

export interface PlayerStyle {
  name: string;
  /** Which days of the season (0-based) this pupil plays. */
  plays: (day: number) => boolean;
  /** Heal when HP falls below this share of max. */
  healBelow: number;
}

export const STYLES: PlayerStyle[] = [
  { name: 'every day', plays: () => true, healBelow: 0.4 },
  { name: '4 days a week', plays: (d) => d % 7 < 4, healBelow: 0.4 },
  { name: '2 days a week', plays: (d) => d % 7 === 0 || d % 7 === 3, healBelow: 0.4 },
];

export interface SeasonReport {
  levelDay: (number | null)[]; // index = level, the play-day count (not calendar day) when it was reached
  levelCalendarDay: (number | null)[];
  forestFights: number;
  forestWins: number;
  forestLosses: number;
  masterTries: number;
  masterWins: number;
  goldEarned: number;
  goldOnHealing: number;
  goldOnGear: number;
  dragonKills: number;
  dragonTries: number;
  dragonDay: number | null;
  playDays: number;
  avgRounds: number;
  /** The hero at the end of each calendar day (index 0 is the first day), played days or not. The computer heroes read this. */
  heroByDay: Hero[];
}

const dayString = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);

/** The pupil's fight: attack, with class skills used when it makes sense. */
function playFight(start: FightState): FightState {
  let f = start;
  let guard = 0;
  while (!f.over && guard++ < 200) {
    const hpShare = f.heroHp / f.heroMaxHp;
    const skills = f.skillLeft > 0 ? skillsFor(f.heroClass) : [];
    if (skills.includes('mend') && hpShare < 0.45 && f.heroHp < f.heroMaxHp) f = stepFight(f, { type: 'skill', skill: 'mend' });
    else if (skills.includes('power-strike')) f = stepFight(f, { type: 'skill', skill: 'power-strike' });
    else if (skills.includes('zap')) f = stepFight(f, { type: 'skill', skill: 'zap' });
    else if (skills.includes('dodge') && hpShare < 0.6) f = stepFight(f, { type: 'skill', skill: 'dodge' });
    else if (skills.includes('pinch') && f.goldPinched === 0) f = stepFight(f, { type: 'skill', skill: 'pinch' });
    else f = stepFight(f, { type: 'attack' });
  }
  return f;
}

function shop(hero: Hero, report: SeasonReport): Hero {
  let h = hero;
  for (let again = 0; again < 4; again++) {
    let bought = false;
    for (const slot of ['weapon', 'armour'] as const) {
      const top = (slot === 'weapon' ? WEAPONS : ARMOURS).length - 1;
      for (let i = top; i > h[slot]; i--) {
        const r = buyGear(h, slot, i);
        if (r.ok) {
          report.goldOnGear += r.paid - r.refund;
          h = r.hero;
          bought = true;
          break;
        }
      }
    }
    if (!bought) break;
  }
  return h;
}

export function playSeason(heroClass: HeroClass, style: PlayerStyle, seed: number, days = SEASON_DAYS): SeasonReport {
  const rand = makeRandom(seed);
  const report: SeasonReport = {
    levelDay: Array(MAX_LEVEL + 1).fill(null), levelCalendarDay: Array(MAX_LEVEL + 1).fill(null),
    forestFights: 0, forestWins: 0, forestLosses: 0, masterTries: 0, masterWins: 0, goldEarned: 0, goldOnHealing: 0, goldOnGear: 0,
    dragonKills: 0, dragonTries: 0, dragonDay: null, playDays: 0, avgRounds: 0, heroByDay: [],
  };
  let rounds = 0;
  let hero = newHero(heroClass, dayString(0));
  report.levelDay[1] = 0;
  report.levelCalendarDay[1] = 0;

  const tryHeal = (h: Hero): Hero => {
    if (h.hp >= h.maxHp * style.healBelow) return h;
    const withBank = withdraw(h, h.bank);
    const healed = heal(withBank, h.maxHp - h.hp);
    report.goldOnHealing += withBank.gold - healed.gold;
    return deposit(healed, healed.gold);
  };

  for (let day = 0; day < days; day++) {
    if (!style.plays(day)) {
      report.heroByDay.push(hero);
      continue;
    }
    report.playDays += 1;
    hero = rollDay(hero, dayString(day));
    hero = shop(withdraw(hero, hero.bank), report);

    const tryMaster = () => {
      if (!canChallengeMaster(hero).ok) return;
      report.masterTries += 1;
      const f = playFight(startMasterFight(hero, Math.floor(rand() * 4294967296)));
      hero = applyMasterResult(hero, f);
      if (f.outcome === 'won') {
        report.masterWins += 1;
        report.levelDay[hero.level] ??= report.playDays;
        report.levelCalendarDay[hero.level] ??= day;
        hero = shop(withdraw(hero, hero.bank), report);
      }
    };
    tryMaster();

    if (canFaceDragon(hero)) {
      let hp = hero.hp;
      let won = true;
      let skillLeft = hero.skillLeft; // the day's skill uses are for all three stages, not for each
      for (const stage of [1, 2, 3] as const) {
        const riddle = rand() < MATHS_RIGHT_SHARE ? 'right' : 'wrong';
        const f = playFight(startDragonStage({ ...hero, skillLeft }, stage, Math.floor(rand() * 4294967296), { ...dragonStageOptions(riddle), heroHp: hp }));
        skillLeft = f.skillLeft;
        hp = dragonBreather(hero, f.heroHp);
        if (f.outcome !== 'won') {
          won = false;
          break;
        }
      }
      report.dragonTries += 1;
      if (won) {
        report.dragonKills += 1;
        report.dragonDay ??= report.playDays;
        hero = finishDragon(hero, dayString(day));
      } else hero = loseToDragon(hero);
    }

    let guard = 0;
    while (hero.forestLeft > 0 && guard++ < FOREST_FIGHTS_PER_DAY * 4) {
      hero = tryHeal(hero);
      const trip = forestTrip(hero, Math.floor(rand() * 4294967296));
      if (trip.kind === 'event') {
        const before = hero.gold;
        hero = applyEvent(hero, trip.event, rand() < MATHS_RIGHT_SHARE);
        report.goldEarned += Math.max(0, hero.gold - before);
        continue;
      }
      hero = useForestTurn(hero);
      const f = playFight(startFight(hero, trip.monster, trip.seed));
      report.forestFights += 1;
      rounds += f.round;
      const before = hero.gold;
      hero = applyForestResult(hero, f);
      if (f.outcome === 'won') {
        report.forestWins += 1;
        report.goldEarned += hero.gold - before;
      } else if (f.outcome === 'lost') report.forestLosses += 1;
      hero = shop(hero, report);
      tryMaster();
    }

    hero = deposit(hero, Math.max(0, hero.gold - 0));
    report.heroByDay.push(hero);
  }
  report.avgRounds = report.forestFights ? rounds / report.forestFights : 0;
  return report;
}

export interface Summary {
  style: string;
  heroClass: HeroClass;
  runs: number;
  /** Median play-days to reach each level (null = most runs never did). */
  medianLevelDay: (number | null)[];
  medianLevelCalendarDay: (number | null)[];
  reachedDragonShare: number;
  beatDragonShare: number;
  dragonWinRate: number;
  lossPerFight: number;
  masterWinRate: number;
  healShareOfGold: number;
  avgRounds: number;
  medianPlayDays: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function summarise(heroClass: HeroClass, style: PlayerStyle, runs: number, baseSeed = 1): Summary {
  const reports = Array.from({ length: runs }, (_, i) => playSeason(heroClass, style, baseSeed + i * 7919));
  const medianOf = (pick: (r: SeasonReport) => (number | null)[]) =>
    Array.from({ length: MAX_LEVEL + 1 }, (_, level) => {
      const reached = reports.map((r) => pick(r)[level]).filter((n): n is number => n !== null);
      return reached.length * 2 > runs ? median(reached) : null;
    });
  const sum = (f: (r: SeasonReport) => number) => reports.reduce((a, r) => a + f(r), 0);
  return {
    style: style.name, heroClass, runs,
    medianLevelDay: medianOf((r) => r.levelDay),
    medianLevelCalendarDay: medianOf((r) => r.levelCalendarDay),
    reachedDragonShare: reports.filter((r) => r.levelDay[MAX_LEVEL] !== null).length / runs,
    beatDragonShare: reports.filter((r) => r.dragonKills > 0).length / runs,
    dragonWinRate: sum((r) => r.dragonKills) / Math.max(1, sum((r) => r.dragonTries)),
    lossPerFight: sum((r) => r.forestLosses) / Math.max(1, sum((r) => r.forestFights)),
    masterWinRate: sum((r) => r.masterWins) / Math.max(1, sum((r) => r.masterTries)),
    healShareOfGold: sum((r) => r.goldOnHealing) / Math.max(1, sum((r) => r.goldEarned)),
    avgRounds: sum((r) => r.avgRounds) / runs,
    medianPlayDays: median(reports.map((r) => r.playDays)),
  };
}
