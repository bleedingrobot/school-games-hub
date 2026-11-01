/**
 * The painted pictures (made by James with an image AI from docs/lord-art/PROMPTS.md, tidied by scripts/lord-art.py).
 * Every picture is optional: when a file isn't there yet, the game shows the old Kenney tile (Sprite.tsx) or a
 * painted-looking colour wash (lord.css), so nothing breaks while pictures arrive one at a time.
 *
 * Files live in ./art/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only downloads a
 * picture when a screen shows it.
 */
import type { HeroClass } from '../../../shared/lord/types';

const FILES = import.meta.glob('./art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** "Cave Spider Queen" → "cave-spider-queen". The same rule names the files the script writes. */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const file = (group: string, name: string): string | undefined => FILES[`./art/${group}/${name}.webp`];

export const SCENES = ['village', 'map', 'forest-1', 'forest-2', 'forest-3', 'lair', 'inn', 'shop', 'healer', 'bank', 'training', 'arena', 'hall', 'news'] as const;
export type SceneId = (typeof SCENES)[number];

/** A place picture: the full-size one and a smaller copy for phones (either may be missing). */
export function sceneArt(id: SceneId): { wide?: string; small?: string } {
  const wide = file('scenes', id);
  return { wide, small: file('scenes', `${id}-800`) ?? wide };
}

/** Which forest picture a monster of this level fights in: bright, dusk, then ash near the dragon. */
export const forestScene = (level: number): SceneId => (level <= 4 ? 'forest-1' : level <= 8 ? 'forest-2' : 'forest-3');

export const monsterArt = (name: string) => file('monsters', slug(name));
/** Shop gear, by its name in WEAPONS or ARMOURS (data.ts). */
export const weaponArt = (name: string) => file('weapons', slug(name));
export const armourArt = (name: string) => file('armour', slug(name));
export const masterArt = (name: string) => file('masters', slug(name));
export const dragonArt = () => file('dragon', 'scorchtail');
/** The round pictures on the season road (scripts/lord-timeline-art.py). */
export const stageArt = (stage: 'forest' | 'masters' | 'dragon' | 'new') => file('timeline', stage === 'new' ? 'stage-new-season' : `stage-${stage}`);
/** A look the pupil can pick (LOOKS in data.ts): a whole painted hero, and a small copy for the picker. */
export const lookArt = (look: string) => file('heroes', look);
/** How each class looks before a look is picked: on the class choice, and for heroes made before there were looks. */
export const CLASS_LOOKS: Record<HeroClass, string> = { knight: 'knight-girl-03-1', mage: 'mage-boy-01-1', trickster: 'trickster-girl-07-1' };
export const heroArt = (heroClass: HeroClass) => lookArt(CLASS_LOOKS[heroClass]);
export const lookThumb = (look: string) => file('heroes', `${look}-small`) ?? lookArt(look);

/** The people who work in the village, by the place they work. */
export const PEOPLE = {
  inn: { id: 'innkeeper', name: 'Bryn the innkeeper' },
  shop: { id: 'blacksmith', name: 'Greta the blacksmith' },
  healer: { id: 'healer', name: 'Old Fern the healer' },
  bank: { id: 'banker', name: 'Mr Penny the banker' },
  bard: { id: 'bard', name: 'The bard' },
} as const;
export type PersonId = keyof typeof PEOPLE;
export const personArt = (who: PersonId) => file('people', PEOPLE[who].id);

/** Every file the game would use, for the art test and the tidy-up script's checklist. */
export function allArtFiles(): string[] {
  return Object.keys(FILES);
}
