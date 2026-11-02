/**
 * Sky Isles' painted pictures (docs/ISLES-ART-PLAN.md), the tries James chose (docs/isles-art/picks.json), made into
 * .webp files by `scripts/isles-art.py tidy`. Every picture is optional: when one isn't there or doesn't load, the
 * screens draw coloured shapes in the same places instead (Island.tsx), so nothing breaks.
 *
 * Vite turns each file into its own URL, and the browser only downloads a picture when a screen shows it.
 */
import { BASES, GARDEN_PLACES, KEEPERS, type DecorationId, type PlotOrEmpty } from '../../../shared/isles/config';

const FILES = import.meta.glob('./art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const file = (name: string): string | undefined => FILES[`./art/${name}.webp`];

/** The island base for this many building spots: Little, Growing, Big, Large or Grand (0 to 4). */
export function baseFor(spots: number): number {
  const i = BASES.findIndex((most) => spots <= most);
  return i === -1 ? BASES.length - 1 : i;
}
export const baseArt = (base: number) => file(`base-${base + 1}`);
/** Each base's width over its height, as cut out (so the spots line up before the picture has loaded). */
export const BASE_ASPECT = [1008 / 720, 1108 / 788, 1143 / 819, 1200 / 756, 1200 / 768];

/**
 * Where each building spot sits on each base, as percentages of the cut-out picture from its top-left, in the order
 * spots are claimed (docs/isles-art/picks.json, placed by hand on 2 Nov 2026). Spots past a base's painted clearings
 * sit on the grass between the paths (James's choice).
 */
export const SPOTS: [number, number][][] = [
  [[39, 48], [71, 43], [20, 31], [81, 24], [33, 12], [65, 11]],
  [[31, 47], [64, 50], [18, 31], [81, 33], [31, 17], [73, 18], [53, 12], [49, 33]],
  [[26, 41], [54, 47], [79, 38], [19, 21], [51, 26], [83, 25], [36, 11], [58, 9], [76, 15], [34, 29]],
  [[35, 48], [64, 48], [17, 35], [82, 35], [50, 26], [17, 20], [82, 20], [34, 11], [54, 7], [70, 12], [31, 27], [50, 40], [64, 31]],
  [[50, 54], [29, 48], [72, 48], [16, 36], [84, 35], [50, 28], [17, 22], [82, 21], [31, 12], [50, 8], [69, 12], [33, 31], [67, 29], [61, 43], [39, 19], [61, 18]],
];

/**
 * Where each decoration place sits on each base (same measure as SPOTS), around the edges and along the paths, clear of
 * the building clearings (placed on 3 Nov 2026, stage C.3). Place n keeps its number as the island grows.
 */
export const DECOR_PLACES: [number, number][][] = [
  [[55, 52], [10, 38], [89, 36], [50, 22]],
  [[47, 55], [17, 41], [75, 54], [88, 43], [42, 23], [8, 29]],
  [[44, 52], [68, 51], [13, 38], [89, 45], [44, 38], [66, 30], [24, 11], [92, 33]],
  [[50, 53], [26, 43], [74, 53], [92, 41], [8, 28], [40, 35], [73, 42], [60, 20], [92, 27], [22, 9]],
  [[40, 58], [62, 58], [20, 46], [82, 49], [49, 40], [92, 24], [6, 34], [94, 34], [50, 18], [21, 10], [78, 11], [59, 8]],
];

/**
 * The sky garden's places (it comes once the Lighthouse is lit): a loose grid on the drawn garden until `base-garden`
 * is painted and its places are set by hand (docs/prompts/isles-cosy-art.md).
 */
export const GARDEN_SPOTS: [number, number][] = Array.from({ length: GARDEN_PLACES }, (_, i) => {
  const row = Math.floor(i / 5);
  const col = i % 5;
  return [14 + col * 18 + (row % 2) * 6, 22 + row * 14];
});
export const GARDEN_ASPECT = 1344 / 768;
export const gardenArt = () => file('base-garden');

export const decorArt = (id: DecorationId) => file(`dec-${id}`);
/** The islanders who stroll the paths (six painted walkers, used in turn). */
export const WALKERS = 6;
export const walkerArt = (i: number) => file(`walker-${(i % WALKERS) + 1}`);
export const crystalArt = () => file('icon-crystal');
export const coinArt = () => file('icon-coin');

export const buildingArt = (kind: PlotOrEmpty, level: number) => (kind === 'empty' ? file('bld-empty') : file(`bld-${kind}-${Math.max(1, level)}`));

export type PipPose = 'wave' | 'point' | 'cheer' | 'think';
export const pipArt = (pose: PipPose) => file(`pip-${pose}`);

export type BoatColour = 'red' | 'blue' | 'yellow';
export const boatArt = (colour: BoatColour) => file(`boat-${colour}`);

export type Background = 'island' | 'sky' | 'race';
/** A background: the full-size one and a smaller copy for phones (either may be missing). */
export function backgroundArt(id: Background): { wide?: string; small?: string } {
  const wide = file(`bg-${id}`);
  return { wide, small: file(`bg-${id}-800`) ?? wide };
}

/** A Sky Keeper portrait (320 px), or its 96 px copy for small places. */
export const keeperArt = (id: string, small = false) => (KEEPERS.includes(id) ? file(`keepers/${id}${small ? '-96' : ''}`) : undefined);

/** Every picture file the game has, for checking against the list. */
export function allArtFiles(): string[] {
  return Object.keys(FILES);
}
