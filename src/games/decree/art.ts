/**
 * Royal Decree's painted pictures. The rulers, six advisers and the scenes are Kingdom Keeper's (copied here); the
 * other villagers were painted for this game (docs/DECREE-ART-PLAN.md, scripts/decree-art.py). Every picture is
 * optional: a villager without a picture shows a coloured badge with their first letter, so nothing breaks.
 */
import type { Look } from '../../../shared/decree/server';

const FILES = import.meta.glob('./art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const file = (group: string, name: string): string | undefined => FILES[`./art/${group}/${name}.webp`];

export type SceneId = 'title' | 'council' | 'city-1' | 'city-2' | 'city-3' | 'city-4' | 'end-legendary' | 'end-good' | 'end-fair' | 'end-hard' | 'harvest-good' | 'newcomers';

export function sceneArt(id: SceneId): { wide?: string; small?: string } {
  const wide = file('scenes', id);
  return { wide, small: file('scenes', `${id}-800`) ?? wide };
}

export const personArt = (who: string) => file('people', who);
export const personThumb = (who: string) => file('people', `${who}-small`) ?? personArt(who);
export const rulerArt = (look: Look) => file('rulers', look);
export const rulerThumb = (look: Look) => file('rulers', `${look}-small`) ?? rulerArt(look);

export function allArtFiles(): string[] {
  return Object.keys(FILES);
}
