import { MAX_LEVEL, SEASON_DAYS, masterFor } from './data';
import { duelistOf, type Duelist } from './engine';
import { playSeason, type PlayerStyle } from './sim';
import type { Hero, HeroClass } from './types';

/**
 * The village's computer heroes (docs/LORD-PLAN.md section 11). They are heroes like any other: each one is a
 * whole season played by the SAME engine and simulator that tunes the pupils' pace (not LORD.ts's different
 * fight maths), at a steady rhythm, so they level up on a schedule and look believable. Everything is worked out
 * from the season number, so the same hero is the same on every request and nothing is stored. They never cost a
 * pupil anything: an arena fight against one only ever pays the pupil.
 */
export interface ComputerHeroSpec {
  id: string;
  name: string;
  heroClass: HeroClass;
  /** Which painted hero they look like (LOOKS in data.ts). */
  look: string;
  /** Which days of the week this hero goes adventuring (Monday first). */
  plays: boolean[];
}

const days = (...on: number[]) => Array.from({ length: 7 }, (_, d) => on.includes(d));

export const COMPUTER_HEROES: ComputerHeroSpec[] = [
  { id: 'gareth', name: 'Sir Gareth', heroClass: 'knight', look: 'knight-boy-03-1', plays: days(0, 1, 2, 3, 4) },
  { id: 'maple', name: 'Dame Maple', heroClass: 'mage', look: 'mage-girl-01-1', plays: days(0, 1, 2, 3) },
  { id: 'bram', name: 'Old Bram', heroClass: 'knight', look: 'knight-boy-10-1', plays: days(0, 2, 4) },
  { id: 'wren', name: 'Lady Wren', heroClass: 'trickster', look: 'trickster-girl-03-1', plays: days(0, 1, 2, 3, 4, 5, 6) },
  { id: 'flint', name: 'Captain Flint', heroClass: 'trickster', look: 'trickster-boy-05-1', plays: days(1, 2, 3, 4) },
  { id: 'orrin', name: 'Wizard Pim', heroClass: 'mage', look: 'mage-boy-02-1', plays: days(0, 1, 3, 4) },
  { id: 'hazel', name: 'Sister Hazel', heroClass: 'mage', look: 'mage-girl-04-1', plays: days(1, 3, 5) },
  { id: 'mort', name: 'Big Mort', heroClass: 'knight', look: 'knight-boy-07-1', plays: days(0, 1, 2, 3, 4, 5) },
];

const hashOf = (text: string) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** One full season of one computer hero, kept for the next request (the server process stays warm for a while). */
const seasons = new Map<string, Hero[]>();

function seasonOfHero(spec: ComputerHeroSpec, seasonNumber: number): Hero[] {
  const key = `${spec.id}:${seasonNumber}`;
  let heroes = seasons.get(key);
  if (!heroes) {
    const style: PlayerStyle = { name: spec.name, plays: (d) => spec.plays[d % 7], healBelow: 0.4 };
    heroes = playSeason(spec.heroClass, style, hashOf(key), SEASON_DAYS).heroByDay;
    seasons.set(key, heroes);
    // Only a couple of seasons are ever wanted at once.
    if (seasons.size > 40) seasons.delete(seasons.keys().next().value as string);
  }
  return heroes;
}

export interface ComputerHero {
  id: string;
  name: string;
  hero: Hero;
  duelist: Duelist;
}

/** Where every computer hero stands at the end of the day (`dayOfSeason` 1 to 35). */
export function computerHeroes(seasonNumber: number, dayOfSeason: number): ComputerHero[] {
  const index = Math.max(0, Math.min(SEASON_DAYS, dayOfSeason) - 1);
  return COMPUTER_HEROES.map((spec) => {
    const hero = seasonOfHero(spec, seasonNumber)[index];
    return { id: spec.id, name: spec.name, hero: { ...hero, look: spec.look }, duelist: duelistOf(hero, spec.name) };
  });
}

/** What the computer heroes did on a day: a level gained (by beating a master) or the dragon beaten. */
export function computerDeeds(seasonNumber: number, dayOfSeason: number): { id: string; text: string; kind: 'level' | 'dragon' }[] {
  if (dayOfSeason < 2) return [];
  const out: { id: string; text: string; kind: 'level' | 'dragon' }[] = [];
  for (const spec of COMPUTER_HEROES) {
    const run = seasonOfHero(spec, seasonNumber);
    const before = run[Math.min(SEASON_DAYS, dayOfSeason) - 2];
    const after = run[Math.min(SEASON_DAYS, dayOfSeason) - 1];
    if (after.dragonKills > before.dragonKills) {
      out.push({ id: spec.id, kind: 'dragon', text: `${spec.name} (computer hero) beat the Red Dragon! The village cheers.` });
    } else if (after.level > before.level && after.level <= MAX_LEVEL) {
      const master = masterFor(after.level - 1);
      out.push({ id: spec.id, kind: 'level', text: `${spec.name} (computer hero) beat ${master?.name ?? 'a master'} and reached level ${after.level}!` });
    }
  }
  return out;
}
