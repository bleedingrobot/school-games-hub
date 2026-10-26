/**
 * Kingdom Keeper's painted pictures (made for this game with an image AI, docs/kingdom-art/PROMPTS.md, tidied by
 * scripts/kingdom-art.py). Every picture is optional: when a file isn't there, the stage shows a colour wash in the
 * place's colours (kingdom.css) and people simply aren't drawn, so nothing breaks.
 *
 * Files live in ./art/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only downloads a
 * picture when a screen shows it.
 */
import type { Adviser } from '../../../shared/kingdom/engine';
import type { Look } from '../../../shared/kingdom/reign';

const FILES = import.meta.glob('./art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const file = (group: string, name: string): string | undefined => FILES[`./art/${group}/${name}.webp`];

export const SCENES = [
  'title', 'map', 'city-1', 'city-2', 'city-3', 'city-4', 'council', 'market', 'granary', 'fields',
  'harvest-good', 'harvest-poor', 'rats', 'newcomers', 'leaving', 'sickness',
  'end-legendary', 'end-good', 'end-fair', 'end-hard',
] as const;
export type SceneId = (typeof SCENES)[number];

/** A place picture: the full-size one and a smaller copy for phones (either may be missing). */
export function sceneArt(id: SceneId): { wide?: string; small?: string } {
  const wide = file('scenes', id);
  return { wide, small: file('scenes', `${id}-800`) ?? wide };
}

export type Person = Adviser | 'steward';
export const personArt = (who: Person) => file('people', who);
export const rulerArt = (look: Look) => file('rulers', look);
export const rulerThumb = (look: Look) => file('rulers', `${look}-small`) ?? rulerArt(look);

/** Who's who at court. */
export const PEOPLE: Record<Person, { name: string; title: string }> = {
  steward: { name: 'Hale', title: 'Hale the steward' },
  reeve: { name: 'Marigold', title: 'Marigold the reeve' },
  ratcatcher: { name: 'Nettle', title: 'Nettle the rat catcher' },
  trader: { name: 'Quince', title: 'Quince the trader' },
  healer: { name: 'Rowan', title: 'Rowan the healer' },
  builder: { name: 'Bram', title: 'Bram the builder' },
};

/**
 * Where each place is drawn on the valley map, as percentages from the top-left (docs/kingdom-art/map-spots.json,
 * read off the chosen painting).
 */
export const MAP_SPOTS: Record<'council' | 'market' | 'granary' | 'fields' | 'gate', [number, number]> = {
  council: [57, 57],
  market: [37, 73],
  granary: [84, 70],
  fields: [22, 57],
  gate: [80, 79],
};

/** Every picture file the game has, for checking against the list. */
export function allArtFiles(): string[] {
  return Object.keys(FILES);
}
