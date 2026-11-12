/**
 * Toon Flap's painted pictures (made in ComfyUI on James's gaming PC by `scripts/toonflap-art.py`, see
 * docs/TOON-FLAP-ART-PLAN.md). Every picture is optional: each function gives undefined when there's no painting, and the
 * game then draws its stand-in, so nothing ever breaks. Vite turns each file into its own URL, downloaded only when drawn.
 *
 * Layout (agreed with the game build, 11 Nov 2026):
 *   worlds/<1-10>/back.webp   2048 x 768, opaque, repeats left to right
 *   worlds/<1-10>/mid.webp    2048 wide, see-through above, repeats left to right, sits on the ground line
 *   worlds/<1-10>/wall-top|wall-bottom.webp   256 wide, see-through: the wall's end (bottom wall: end points up; top wall: down)
 *   worlds/<1-10>/wall-middle.webp            256 x 512, repeats top to bottom, fills the wall between its end and the edge
 *   flyers/<flyerId>-<pose>.webp   256 x 256, see-through, body centred in the square (one hit box for every flyer)
 *   trails/<trailId>.webp 64, potion.webp 128, extras/<name>.webp 256, ui/<name>.webp 256, map/hangar/card(.webp)
 */
const FILES = import.meta.glob('./**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const WORLD_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const WORLD_PARTS = ['back', 'mid', 'wall-top', 'wall-bottom', 'wall-middle'] as const;
export type WorldPart = (typeof WORLD_PARTS)[number];
export type WorldLayer = WorldPart;

export const FLYER_IDS = ['fantail', 'puppy-plane', 'rocket-carrot', 'bathtub-boat', 'mousetrap-glider', 'donut-cruiser', 'mini-van',
  'toilet-rocket', 'lava-lizard', 'jet-bot', 'saucer-kid', 'rainbow'] as const;
/** Every flyer has glide, up (zooming upward, shown after a flap) and dizzy (after a bump); the fantail also perches and cheers. */
export const FLYER_POSES = ['glide', 'up', 'perched', 'cheer', 'dizzy'] as const;
export type FlyerPose = (typeof FLYER_POSES)[number];
export const POSES_PAINTED: Record<string, readonly FlyerPose[]> = {
  ...Object.fromEntries(FLYER_IDS.map((f) => [f, ['glide', 'up', 'dizzy']])),
  fantail: ['glide', 'up', 'perched', 'cheer', 'dizzy'],
  rainbow: ['glide', 'up', 'dizzy'],
};

export const TRAIL_IDS = ['flowers', 'cookies', 'donut-crumbs', 'pineapples', 'cheese', 'mouse-tail', 'rainbow-stars'] as const;
/** gust: the icy wind zone; bubble: the low-gravity zone (draw it see-through); bump-stars: the ring after a bump. */
export const EXTRA_IDS = ['jellyfish', 'ghost', 'steam', 'comet', 'gust', 'bubble', 'bump-stars'] as const;
/** badge: the blank round coin behind each answer gap's number (the game writes the number). */
export const UI_IDS = ['perch', 'nest', 'sign', 'badge'] as const;
export const SCREENS = ['map', 'hangar', 'card', 'card-small', 'potion'] as const;

const file = (path: string): string | undefined => FILES[`./${path}.webp`];

/** A world's layer, or undefined (draw the stand-in). */
export const worldArt = (world: number, part: WorldPart = 'back'): string | undefined => file(`worlds/${world}/${part}`);

/**
 * A flyer's picture. A pose with no painting falls back to glide (the game tilts it for up), and
 * a flyer with no painting gives undefined.
 */
export const flyerArt = (id: string, pose: FlyerPose = 'glide'): string | undefined =>
  file(`flyers/${id}-${pose}`) ?? file(`flyers/${id}-glide`);

export const trailArt = (id: string): string | undefined => file(`trails/${id}`);
export const extraArt = (id: string): string | undefined => file(`extras/${id}`);
export const uiArt = (id: string): string | undefined => file(`ui/${id}`);
export const screenArt = (id: (typeof SCREENS)[number]): string | undefined => file(id);

/** Every file, for the art test. */
export const allArtFiles = (): string[] => Object.keys(FILES);
