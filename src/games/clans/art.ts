/**
 * The painted pictures (made by James in ComfyUI, tidied by scripts/clans-art.py, plan in docs/CLANS-ART-PLAN.md).
 * Every picture is optional: when a file isn't there, the game shows the old Kenney tile (Sprite.tsx), so nothing breaks.
 *
 * Files live in ./art/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only downloads a
 * picture when a screen shows it.
 */
import type { BuildingKind, TroopKind } from '../../../shared/clans/types';

const FILES = import.meta.glob('./art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** "Falcon's Sword" → "falcon-s-sword". The same rule names the files the script writes. */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const file = (group: string, name: string): string | undefined => FILES[`./art/${group}/${name}.webp`];

/** The painting across the top of each place, and the fight backgrounds and moments. */
export const SCENES = [
  'village', 'news', 'scoreboard', 'market', 'training', 'church', 'mines', 'empire', 'barracks', 'raid', 'quests', 'creator',
  'battlefield', 'victory', 'rest', 'zone-meadow', 'zone-caves', 'zone-swamp', 'zone-ruins', 'zone-mountain',
] as const;
export type SceneId = (typeof SCENES)[number];

/** A place picture: the full-size one and a smaller copy for phones (either may be missing). */
export function sceneArt(id: SceneId): { wide?: string; small?: string } {
  const wide = file('scenes', id);
  return { wide, small: file('scenes', `${id}-800`) ?? wide };
}

/** The mine zone a fight happens in (Meadow, Caves, Swamp, Ruins, Mountain). */
export const zoneScene = (zone: string): SceneId => `zone-${slug(zone)}` as SceneId;

/** Each race and class has four looks, all painted once. */
export const LOOKS = ['female-1', 'female-2', 'male-1', 'male-2'] as const;
export type Look = (typeof LOOKS)[number];
const lookName = (race: string, cls: string, look: Look) => `${slug(race)}-${slug(cls)}-${look}`;
export const memberArt = (race: string, cls: string, look: Look) => file('members', lookName(race, cls, look));
export const memberThumb = (race: string, cls: string, look: Look) => file('members', `${lookName(race, cls, look)}-small`) ?? memberArt(race, cls, look);

export const monsterArt = (name: string) => file('monsters', slug(name));
export const itemArt = (name: string) => file('items', slug(name));
export const troopArt = (kind: TroopKind) => file('troops', kind);
/** steelMill → steelmill, developersHall → developershall. */
export const buildingArt = (kind: BuildingKind) => file('buildings', kind.toLowerCase());
/** A kingdom you can raid, by its id (bunny-hollow). */
export const kingdomArt = (id: string) => file('kingdoms', id);
export function kingdomScene(id: string): { wide?: string; small?: string } {
  const wide = kingdomArt(id);
  return { wide, small: file('kingdoms', `${id}-800`) ?? wide };
}
/** A quest by its title (The Wandering Goat). */
export function questArt(title: string): { wide?: string; small?: string } {
  const wide = file('quests', slug(title));
  return { wide, small: file('quests', `${slug(title)}-800`) ?? wide };
}
/** A clan's banner, from the last word of its name ("Brave Owls" → owls). */
export const bannerArt = (clanName: string) => file('banners', slug(clanName.trim().split(/\s+/).pop() ?? ''));

/** Every file the game would use, for the art test. */
export function allArtFiles(): string[] {
  return Object.keys(FILES);
}
