/**
 * The galaxy: 24 planets on a grid from -10 to +10 each way, made from a seed. The same seed always gives the same galaxy.
 * Distance is across + up (docs/TRADER-PLAN.md, section 5), so fuel for a jump is a sum a pupil can work out.
 */
import { seededRandom } from '../maths/serverQuestions';
import { GOVERNMENTS, GRID_HALF, GRID_SIZE, MIN_PLANET_GAP, PLANET_COUNT, PLANET_NAMES, RESOURCES, RESOURCE_CHANCE_PCT, SHIPS, SHIPYARD_TECH } from './config';

export interface Planet {
  id: number;
  name: string;
  x: number;
  y: number;
  tech: number;
  /** Index into GOVERNMENTS. */
  government: number;
  /** 0 (Tiny) to 4 (Huge). */
  size: number;
  /** Index into RESOURCES, 0 for none. */
  resource: number;
}

export interface Galaxy {
  seed: string;
  planets: Planet[];
}

/** A planet's place on the chart the pupils see: x across and y up, each from -10 to +10, with 0, 0 in the middle. */
export function chartPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x - GRID_HALF, y: GRID_HALF - p.y };
}

/** "(3, -4)" with a proper minus sign, for screens. */
export function coordText(p: { x: number; y: number }): string {
  const c = chartPoint(p);
  const f = (n: number) => (n < 0 ? `\u2212${-n}` : `${n}`);
  return `(${f(c.x)}, ${f(c.y)})`;
}

/** A number with a proper minus sign. */
export const signed = (n: number): string => (n < 0 ? `\u2212${-n}` : `${n}`);

/** Across + up: the fuel a jump needs. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function pick(random: () => number, n: number): number {
  return Math.floor(random() * n);
}

function tryBuild(seed: string, attempt: number): Galaxy {
  const random = seededRandom(`trader-galaxy:${seed}:${attempt}`);
  const spots: { x: number; y: number }[] = [];
  let guard = 0;
  while (spots.length < PLANET_COUNT && guard++ < 5000) {
    const spot = { x: pick(random, GRID_SIZE), y: pick(random, GRID_SIZE) };
    if (spots.every((o) => distance(o, spot) >= MIN_PLANET_GAP)) spots.push(spot);
  }
  // Names go to planets in a seeded shuffle, so a galaxy's layout isn't the same every season.
  const names = PLANET_NAMES.map((n) => n);
  for (let i = names.length - 1; i > 0; i--) {
    const j = pick(random, i + 1);
    [names[i], names[j]] = [names[j], names[i]];
  }
  const planets = spots.map((spot, id): Planet => {
    const government = pick(random, GOVERNMENTS.length);
    const g = GOVERNMENTS[government];
    const tech = g.minTech + pick(random, g.maxTech - g.minTech + 1);
    const resource = pick(random, 100) < RESOURCE_CHANCE_PCT ? 1 + pick(random, RESOURCES.length - 1) : 0;
    return { id, name: names[id], x: spot.x, y: spot.y, tech, government, size: pick(random, 5), resource };
  });
  return { seed, planets };
}

/** Can every planet be reached from every other, hopping no further than a Flea's tank? And are there shipyards? */
export function isPlayable(galaxy: Galaxy): boolean {
  const { planets } = galaxy;
  if (planets.length !== PLANET_COUNT) return false;
  if (planets.filter((p) => p.tech >= SHIPYARD_TECH).length < 4) return false;
  if (planets.filter((p) => p.tech >= SHIPS[SHIPS.length - 1].minTech).length < 2) return false;
  const range = SHIPS[0].fuelTank;
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const here = planets[queue.pop() as number];
    for (const other of planets) {
      if (!seen.has(other.id) && distance(here, other) <= range) {
        seen.add(other.id);
        queue.push(other.id);
      }
    }
  }
  return seen.size === planets.length;
}

/** The school's galaxy for a season. A galaxy that can't be played (a planet out of reach, no shipyards) is thrown away. */
export function makeGalaxy(seed: string): Galaxy {
  for (let attempt = 0; attempt < 200; attempt++) {
    const galaxy = tryBuild(seed, attempt);
    if (isPlayable(galaxy)) return galaxy;
  }
  throw new Error(`No playable galaxy for seed ${seed}`);
}

/** Where a new trader starts: the lowest-numbered planet with a shipyard-level tech and friendly pirates. */
export function startPlanet(galaxy: Galaxy): number {
  const calm = galaxy.planets.filter((p) => p.tech >= SHIPYARD_TECH && GOVERNMENTS[p.government].pirates <= 3);
  return (calm[0] ?? galaxy.planets[0]).id;
}
