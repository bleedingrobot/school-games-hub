/**
 * The painted pictures (made by James in ComfyUI, tidied by scripts/clans-art.py, plan in docs/CLANS-ART-PLAN.md).
 * Every picture is optional: when a file isn't there, the game shows the old Kenney tile (Sprite.tsx), so nothing breaks.
 *
 * Files live in ./art/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only downloads a
 * picture when a screen shows it.
 */
import type { MonsterKind, TroopKind, VillageBuilding } from '../../../shared/clans/types';
import { LOOKS, type Look } from '../../../shared/clans/looks';

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

/** Each race and class has four looks (shared/clans/looks.ts), all painted once. */
export { LOOKS, type Look };
const lookName = (race: string, cls: string, look: Look) => `${slug(race)}-${slug(cls)}-${look}`;
export const memberArt = (race: string, cls: string, look: Look) => file('members', lookName(race, cls, look));
export const memberThumb = (race: string, cls: string, look: Look) => file('members', `${lookName(race, cls, look)}-small`) ?? memberArt(race, cls, look);

export const monsterArt = (name: string) => file('monsters', slug(name));
export const itemArt = (name: string) => file('items', slug(name));
export const troopArt = (kind: TroopKind) => file('troops', kind);
/** A building's picture grows with its level: small for levels 0-2, medium for 3-4, big for 5 and up. */
export type BuildingSize = 'small' | 'medium' | 'big';
export const buildingSize = (level: number): BuildingSize => (level >= 5 ? 'big' : level >= 3 ? 'medium' : 'small');
/** The one-size pictures that were made first. The Forge was the Steel Mill. */
const OLD_BUILDING_FILE: Partial<Record<VillageBuilding, string>> = { forge: 'steelmill' };
/**
 * The picture for a building at a level: buildings/<kind>-small|medium|big.webp (kind in lower case: trainingHall → traininghall),
 * then the old one-size buildings/<kind>.webp. Undefined when neither is there, and the screen simply shows no picture.
 */
export function pickBuildingArt(kind: VillageBuilding, level: number, find: (name: string) => string | undefined): string | undefined {
  const name = kind.toLowerCase();
  const old = OLD_BUILDING_FILE[kind];
  return find(`${name}-${buildingSize(level)}`) ?? find(name) ?? (old ? find(old) : undefined);
}
export const buildingArt = (kind: VillageBuilding, level = 1): string | undefined => pickBuildingArt(kind, level, (name) => file('buildings', name));
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

/**
 * The season monster (docs/CLANS-SEASON-GOALS-PLAN.md): a portrait (season-monsters/<kind>) and a "village under attack" scene
 * (season-monsters/siege-<kind>, plus a -800 copy). Optional: without them the Monster screen shows the framed emoji.
 */
export const seasonMonsterArt = (kind: MonsterKind) => file('season-monsters', kind);
export function siegeArt(kind: MonsterKind): { wide?: string; small?: string } {
  const wide = file('season-monsters', `siege-${kind}`);
  return { wide, small: file('season-monsters', `siege-${kind}-800`) ?? wide };
}

/**
 * The fight's painted effects (scripts/clans-fx-art.py, docs/CLANS-FIGHT-FEEL.md stage 2): glowing light painted on black,
 * with the black made see-through, so only the light shows. Without a picture the effect is a CSS glow.
 */
export const FX = ['fire', 'lightning', 'heal', 'magic', 'impact', 'victory'] as const;
export type FxId = (typeof FX)[number];
export const fxArt = (id: FxId) => file('fx', id);

/** Every file the game would use, for the art test. */
export function allArtFiles(): string[] {
  return Object.keys(FILES);
}
