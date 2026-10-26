/**
 * The painted Crystal Night pictures (docs/prompts/gem-keep-art.md). Every picture is optional: when a
 * file isn't there yet, the game draws today's code shapes instead, so nothing breaks while pictures arrive.
 *
 * Files live in ./art/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only
 * downloads a picture when the game asks for it.
 */
import type { Colour } from '../../../shared/gem-keep/gems';

const FILES = import.meta.glob('./art/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const file = (group: string, name: string): string | undefined => FILES[`./art/${group}/${name}.webp`];

/** Levels with a painted board: "level-1" … "level-10". */
export const BOARD_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
export const SPRITES = [
  'tower-1',
  'tower-2',
  'tower-3',
  'gem-red',
  'gem-blue',
  'gem-green',
  'gem-yellow',
  'walker',
  'runner',
  'brute',
  'swarm',
  'boss',
  'keep',
  'rock',
] as const;
export type SpriteName = (typeof SPRITES)[number];

/** Every file name the game looks for, by folder (for the art test). */
export const ART_NAMES: Record<string, string[]> = {
  boards: BOARD_LEVELS.flatMap((n) => [`board-level-${n}`, `board-level-${n}-800`]),
  sprites: [...SPRITES],
  campaign: ['campaign', 'campaign-800'],
};

/** A level's board, the big one or the copy for small screens (either may be missing). */
export function boardUrl(levelId: string, small: boolean): string | undefined {
  const big = file('boards', `board-${levelId}`);
  return small ? (file('boards', `board-${levelId}-800`) ?? big) : big;
}
export const hasBoard = (levelId: string) => !!boardUrl(levelId, false) || !!boardUrl(levelId, true);
export const spriteUrl = (name: SpriteName) => file('sprites', name);
export const gemSpriteUrl = (colour: Colour) => spriteUrl(`gem-${colour}`);
export const campaignUrl = (small: boolean) => (small ? (file('campaign', 'campaign-800') ?? file('campaign', 'campaign')) : file('campaign', 'campaign'));

/**
 * Where each level's marker sits on the campaign painting, as a share of its width and height (0–1).
 * A gentle wave from the dusk forest on the left to the crystal castle on the right. Tune to the painting.
 */
export const CAMPAIGN_MARKERS: [number, number][] = [
  [0.07, 0.62],
  [0.17, 0.4],
  [0.27, 0.6],
  [0.37, 0.38],
  [0.47, 0.58],
  [0.56, 0.36],
  [0.65, 0.56],
  [0.74, 0.34],
  [0.83, 0.54],
  [0.93, 0.36],
];

// ---------- Loading pictures for the canvas ----------

const images = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

/** Calls back whenever a picture finishes loading (the canvas then redraws what uses it). */
export function onPictureLoaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The picture at this URL if it has loaded; starts loading it if not. */
export function picture(url: string | undefined): HTMLImageElement | null {
  if (!url || typeof Image === 'undefined') return null;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => listeners.forEach((l) => l());
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export const spritePicture = (name: SpriteName) => picture(spriteUrl(name));

/** Starts loading everything a level shows, so it's ready before the first wave. */
export function preloadLevel(levelId: string, small: boolean) {
  picture(boardUrl(levelId, small));
  for (const name of SPRITES) picture(spriteUrl(name));
}
