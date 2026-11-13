/**
 * Plain colours for each level's rock (one look per mine, matching its place).
 * Colours are 0 to 1 red, green, blue. Each level's rock is a different colour so a pupil knows where they are.
 */
export interface Palette {
  /** The rock inside rooms. */
  room: readonly [number, number, number];
  /** The rock in tunnels (a little different, so you can tell a room from a tunnel). */
  tunnel: readonly [number, number, number];
  /** The distance haze and the sky behind it. */
  fog: number;
  /** The glowing crystals (or embers) in this mine's rooms (docs/plans/mine-flight/PLAN.md, M4). */
  glow: number;
  /** Share of ceiling spots with a glow-worm (0 to 1): a starry sky in the glow-worm caves, a few elsewhere. */
  worms: number;
  /** Which painted rock (src/games/mine/art/rock/<n>.webp), 1 to 6. */
  mine: number;
}

export const PALETTES: readonly Palette[] = [
  { room: [0.36, 0.6, 0.46], tunnel: [0.29, 0.5, 0.38], fog: 0x050c08, glow: 0x3dffa0, worms: 0.04, mine: 1 }, // greenstone: pounamu seams
  { room: [0.68, 0.58, 0.34], tunnel: [0.56, 0.47, 0.28], fog: 0x0e0b05, glow: 0xffd23f, worms: 0.03, mine: 2 }, // gold-rush diggings: gold nuggets
  { room: [0.62, 0.52, 0.42], tunnel: [0.5, 0.42, 0.36], fog: 0x0b0806, glow: 0xffc24a, worms: 0.03, mine: 3 }, // gold tunnel
  { room: [0.36, 0.39, 0.5], tunnel: [0.29, 0.31, 0.41], fog: 0x07080c, glow: 0xff7a2b, worms: 0.02, mine: 4 }, // coal: glowing embers
  { room: [0.34, 0.6, 0.66], tunnel: [0.28, 0.5, 0.56], fog: 0x050b0e, glow: 0x7ee8ff, worms: 0.45, mine: 5 }, // glow-worm caves: a starry ceiling
  { room: [0.7, 0.4, 0.34], tunnel: [0.58, 0.32, 0.28], fog: 0x0e0605, glow: 0xff5a1a, worms: 0.02, mine: 6 }, // volcanic: lava crystals
];

export function paletteFor(levelId: string): Palette {
  const n = Number(levelId.replace(/\D/g, ''));
  return PALETTES[(Number.isFinite(n) && n > 0 ? n - 1 : 0) % PALETTES.length];
}

export const DOOR_COLOURS = { blue: 0x2f6df6, yellow: 0xe8b90c, red: 0xd9413e, question: 0x9a4de0 } as const;
export const PICKUP_COLOURS = { shield: 0x35d07f, energy: 0xffd23f, missiles: 0xff8a2b } as const;
