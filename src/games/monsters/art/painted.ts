/**
 * The painted pictures (made by James with Z-Image Turbo in ComfyUI, tidied by scripts/monsters-art.py, see
 * docs/prompts/maths-monsters-art.md). Every picture is optional: when a file isn't there yet, the game shows what it
 * showed before (the SVG monster drawings, the colour wash behind a battle, no portrait), so nothing breaks while
 * pictures arrive one at a time.
 *
 * Files live in ./painted/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only downloads a
 * picture when a screen shows it.
 */
import type { ItemId } from '../../../../shared/monsters/engine';
import { LOOKS } from '../../../../shared/monsters/world/start';

const FILES = import.meta.glob('./painted/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** "Dock worker Sione" → "dock-worker-sione". The same rule names the files the script writes. */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const file = (group: string, name: string): string | undefined => FILES[`./painted/${group}/${name}.webp`];
/** The small copy when asked for (and there is one), else the full-size picture. */
const sized = (group: string, name: string, small?: boolean) => (small && file(group, `${name}-small`)) || file(group, name);

/** A monster from the monster book ("carrycrab-2"), plain or shiny. `small` is the 128 px copy for lists and the team strip. */
export const monsterPic = (species: string, shiny?: boolean, small?: boolean) => sized('monsters', `${species}${shiny ? '-shiny' : ''}`, small);

/** Someone on a map, by the name the talk box shows. `small` is the head-and-shoulders copy for the talk box. */
export const personPic = (name: string, small?: boolean) => sized('people', slug(name), small);

/** A trainer look (LOOKS in shared/monsters/world/start.ts). `small` is the copy for the picker. */
export const lookPic = (look: string, small?: boolean) => sized('looks', look, small);
/** The picture for a game saved before there were looks. */
export const DEFAULT_LOOK = LOOKS[0];

/** Which landscape a map's battles are in: its own for the places, one per Topic Tower for both its rooms. */
export const sceneFor = (map: string) => map.match(/^(tower-\d+)-/)?.[1] ?? map;

/** A battle background for a map: the full-size one and a smaller copy for phones (either may be missing). */
export function scenePic(map: string): { wide?: string; small?: string } {
  const id = sceneFor(map);
  const wide = file('scenes', id);
  return { wide, small: file('scenes', `${id}-800`) ?? wide };
}

/** A badge by its name in areas.ts ("leaf" … "stone"). */
export const badgePic = (badge: string) => file('badges', badge);
/** A plain picture of a bag item, for the Bag. */
export const itemPic = (id: ItemId) => file('items', id);

/** Starts downloading pictures before a screen needs them (the two monsters as the battle flash starts). */
export function preload(...urls: (string | undefined)[]) {
  for (const url of urls) if (url) new Image().src = url;
}

/** Every file the game could use, for the art test. */
export function allPaintedFiles(): string[] {
  return Object.keys(FILES);
}
