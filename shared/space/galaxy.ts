/**
 * Random Galaxy: boards made by a generator that follows the fairness rules, named by easy
 * "galaxy codes" like Comet-Kiwi-48 so a whole class can type one in and play the same board.
 */
import {
  checkBoard,
  expectedRolls,
  type Board,
  type BoardSize,
  type GravityKind,
  type Square,
  type StarKind,
} from './board';
import { pickWeighted, seededDice, type Dice } from './random';

const SPACE_WORDS = [
  'Comet', 'Rocket', 'Nova', 'Orbit', 'Lunar', 'Solar', 'Star', 'Astro',
  'Nebula', 'Quasar', 'Meteor', 'Galaxy', 'Cosmo', 'Pulsar', 'Rover', 'Saturn',
  'Jupiter', 'Mars', 'Venus', 'Pluto', 'Aurora', 'Eclipse', 'Zenith', 'Photon',
  'Vega', 'Sirius', 'Titan', 'Apollo', 'Gemini', 'Orion', 'Halley', 'Kepler',
] as const;

const FRIENDLY_WORDS = [
  'Kiwi', 'Kea', 'Weka', 'Ruru', 'Moa', 'Kauri', 'Rimu', 'Tuatara',
  'Fantail', 'Fern', 'Penguin', 'Gecko', 'Dolphin', 'Orca', 'Whale', 'Seal',
  'Gannet', 'Albatross', 'Pipi', 'Kelp', 'Pavlova', 'Jandal', 'Glacier', 'Volcano',
  'Harbour', 'Otter', 'Falcon', 'Robin', 'Panda', 'Tiger', 'Koala', 'Puffin',
] as const;

/** How many different galaxy codes there are (32 × 32 × 90 = 92,160). */
export const GALAXY_CODE_COUNT = SPACE_WORDS.length * FRIENDLY_WORDS.length * 90;

/** Galaxy code number 0, 1, 2… as words: "Comet-Kiwi-10". */
export function galaxyCodeAt(index: number): string {
  const n = ((Math.floor(index) % GALAXY_CODE_COUNT) + GALAXY_CODE_COUNT) % GALAXY_CODE_COUNT;
  const number = 10 + (n % 90);
  const rest = Math.floor(n / 90);
  return `${SPACE_WORDS[Math.floor(rest / FRIENDLY_WORDS.length)]}-${FRIENDLY_WORDS[rest % FRIENDLY_WORDS.length]}-${number}`;
}

/**
 * Tidies what a student typed into a galaxy code, or null if it isn't one.
 * Forgives capitals, spaces instead of dashes and extra spaces: "comet kiwi 48" works.
 */
export function parseGalaxyCode(text: string): string | null {
  const parts = text.trim().split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const find = (words: readonly string[], word: string) => words.find((w) => w.toLowerCase() === word.toLowerCase());
  const space = find(SPACE_WORDS, parts[0]);
  const friendly = find(FRIENDLY_WORDS, parts[1]);
  const number = /^\d{2}$/.test(parts[2]) ? Number(parts[2]) : NaN;
  if (!space || !friendly || !(number >= 10 && number <= 99)) return null;
  return `${space}-${friendly}-${number}`;
}

/** A new random galaxy code. */
export function randomGalaxyCode(dice: Dice): string {
  return galaxyCodeAt(dice(GALAXY_CODE_COUNT) - 1);
}

/** Today's date in New Zealand as "2026-10-15", so "Galaxy of the day" changes at NZ midnight. */
export function nzDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(date);
}

/** Everyone gets the same galaxy on the same NZ day. */
export function galaxyOfTheDay(date: Date): string {
  return galaxyCodeAt(seededDice(`galaxy-of-the-day:${nzDateKey(date)}`)(GALAXY_CODE_COUNT) - 1);
}

/** What goes on a generated board. */
export interface GalaxyRecipe {
  size: BoardSize;
  wormholes: number;
  blackHoles: number;
  /** Wormhole lengths, smallest and biggest. */
  wormholeLength: readonly [number, number];
  blackHoleLength: readonly [number, number];
  /** How many star squares, and how likely each kind is. */
  stars: number;
  starWeights: readonly (readonly [StarKind, number])[];
  /** Stars there's only ever one of on a board. */
  onlyOne: readonly StarKind[];
  gravity: readonly GravityKind[];
  gatePairs: number;
  mystery: boolean;
  comet: boolean;
  missionRounds: number;
  cosmicEvents: boolean;
  /** Check wormholes and black holes are balanced (Random Galaxy always is). */
  balanced: boolean;
  /** Only keep boards where one rocket needs this many rolls on average (see expectedRolls). */
  rolls?: readonly [number, number];
}

const ALL_STARS: readonly (readonly [StarKind, number])[] = [
  ['red-dwarf', 4], ['yellow-star', 3], ['blue-giant', 1], ['white-dwarf', 2], ['binary-star', 2],
  ['neutron-star', 2], ['pulsar', 1], ['supernova', 1], ['matariki', 1],
];

export const RANDOM_GALAXY: Record<BoardSize, GalaxyRecipe> = {
  100: {
    size: 100, wormholes: 8, blackHoles: 8, wormholeLength: [8, 30], blackHoleLength: [8, 30],
    stars: 10, starWeights: ALL_STARS, onlyOne: ['supernova', 'matariki', 'pulsar'],
    gravity: ['heavy', 'low', 'slingshot', 'heavy'], gatePairs: 1, mystery: true, comet: true,
    missionRounds: 45, cosmicEvents: false, balanced: true, rolls: [26, 38],
  },
  50: {
    size: 50, wormholes: 4, blackHoles: 4, wormholeLength: [5, 15], blackHoleLength: [5, 15],
    stars: 5, starWeights: ALL_STARS, onlyOne: ['supernova', 'matariki', 'pulsar'],
    gravity: ['heavy', 'low'], gatePairs: 1, mystery: true, comet: false,
    missionRounds: 30, cosmicEvents: false, balanced: true, rolls: [13, 18],
  },
};

const between = (dice: Dice, low: number, high: number) => low + dice(high - low + 1) - 1;

/** How far apart a pair of gates is, nearest and furthest. */
const GATE_GAP: Record<BoardSize, readonly [number, number]> = { 100: [8, 20], 50: [5, 12] };

/** One attempt at a board. Returns null if it ran out of room. */
function tryBoard(dice: Dice, recipe: GalaxyRecipe, id: string, name: string): Board | null {
  const { size } = recipe;
  const squares: Record<number, Square> = {};
  const landings = new Set<number>(); // where wormholes and black holes come out
  const taken = (n: number) => squares[n] !== undefined;
  // Special squares are never side by side, and never on a landing square.
  const free = (n: number) =>
    n >= 2 && n <= size - 1 && !taken(n) && !taken(n - 1) && !taken(n + 1) && !landings.has(n);

  const placeSpecial = (low: number, high: number): number | null => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const n = between(dice, Math.max(2, low), Math.min(size - 1, high));
      if (free(n)) return n;
    }
    return null;
  };

  const placeLink = (kind: 'wormhole' | 'black-hole', [shortest, longest]: readonly [number, number]) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const length = between(dice, shortest, longest);
      const from = kind === 'wormhole' ? between(dice, 2, size - 1 - length) : between(dice, Math.max(6, 2 + length), size - 1);
      const to = kind === 'wormhole' ? from + length : from - length;
      if (!free(from) || taken(to) || to === from) continue;
      squares[from] = { kind, to };
      landings.add(to);
      return true;
    }
    return false;
  };

  for (let i = 0; i < recipe.wormholes; i++) if (!placeLink('wormhole', recipe.wormholeLength)) return null;
  for (let i = 0; i < recipe.blackHoles; i++) if (!placeLink('black-hole', recipe.blackHoleLength)) return null;

  // Gate pairs are a short hop apart: a long pair is a giant free wormhole (the simulation showed it).
  const [nearest, furthest] = GATE_GAP[size];
  for (let i = 0; i < recipe.gatePairs; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const low = between(dice, 4, size - 4 - nearest);
      const high = low + between(dice, nearest, furthest);
      if (high > size - 4 || !free(low) || !free(high)) continue;
      squares[low] = { kind: 'gate', twin: high };
      squares[high] = { kind: 'gate', twin: low };
      placed = true;
    }
    if (!placed) return null;
  }
  if (recipe.mystery) {
    const n = placeSpecial(Math.floor(size * 0.2), Math.floor(size * 0.8));
    if (n === null) return null;
    squares[n] = { kind: 'mystery' };
  }
  for (const gravity of recipe.gravity) {
    const n = placeSpecial(3, size - 3);
    if (n === null) return null;
    squares[n] = { kind: 'gravity', gravity };
  }
  const placedStars: StarKind[] = [];
  for (let i = 0; i < recipe.stars; i++) {
    const weights = recipe.starWeights.filter(([star]) => !(recipe.onlyOne.includes(star) && placedStars.includes(star)));
    const star = pickWeighted(dice, weights);
    const n = placeSpecial(3, size - 2);
    if (n === null) return null;
    squares[n] = { kind: 'star', star };
    placedStars.push(star);
  }

  const comet = recipe.comet ? { head: between(dice, 20, size - 20), length: 5, speed: 3 } : null;
  return { id, name, size, squares, comet, missionRounds: recipe.missionRounds, cosmicEvents: recipe.cosmicEvents };
}

/** Makes a board from any text. The same text and recipe always make the same board. */
export function generateBoard(seed: string, recipe: GalaxyRecipe, id: string, name: string): Board {
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = tryBoard(seededDice(`${seed}#${attempt}`), recipe, id, name);
    if (!board || checkBoard(board, { balanced: recipe.balanced }).length > 0) continue;
    const rolls = expectedRolls(board);
    if (!recipe.rolls || (rolls >= recipe.rolls[0] && rolls <= recipe.rolls[1])) return board;
  }
  throw new Error(`Couldn't make a fair board from "${seed}"`);
}

/** The Random Galaxy for a galaxy code. */
export function galaxyBoard(code: string, size: BoardSize): Board {
  const tidy = parseGalaxyCode(code);
  if (!tidy) throw new Error(`"${code}" isn't a galaxy code`);
  return generateBoard(`galaxy:${tidy}:${size}`, RANDOM_GALAXY[size], `galaxy-${size}`, `Random Galaxy ${tidy}`);
}
