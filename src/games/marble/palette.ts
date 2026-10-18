/** Colours for a course's blocks (the Douglas Park look: flat colours, no textures). Hex numbers for three.js. */
export interface Palette {
  floorA: number;
  floorB: number;
  side: number;
  rail: number;
  ice: number;
  mud: number;
  start: number;
  checkpoint: number;
  finishA: number;
  finishB: number;
  pad: number;
  bumper: number;
  door: number;
  belt: number;
  geyser: number;
  trapdoor: number;
  gate: number;
  sky: number;
}

/** Golden sand and driftwood, for the practice courses and Boulder Beach. */
export const SAND: Palette = {
  floorA: 0xe8c77a, floorB: 0xdcb867, side: 0xb98f45, rail: 0x7a5a32, ice: 0xbfe6f5, mud: 0x6d4a2b,
  start: 0x3b82f6, checkpoint: 0xfacc15, finishA: 0xffffff, finishB: 0x1f2937, pad: 0xf97316, bumper: 0xe11d48, door: 0x16a34a, belt: 0x52606d, geyser: 0xb45309, trapdoor: 0x8b5e34, gate: 0xdc2626, sky: 0xcfe9f3,
};

const make = (over: Partial<Palette>): Palette => ({ ...SAND, ...over });

const PALETTES: Record<string, Palette> = {
  // Alpine road: grey tarmac, snow poles.
  'crown-range': make({ floorA: 0x9aa5b1, floorB: 0x8b97a4, side: 0x6b7683, rail: 0xe5e7eb, sky: 0xdbeafe, start: 0x2563eb }),
  // Rotorua: ochre ground, dark mud.
  'geyser-valley': make({ floorA: 0xd9a066, floorB: 0xcb915a, side: 0x8a5a2b, rail: 0x5b3a1e, sky: 0xf3e3c3, mud: 0x4a3a2b, geyser: 0x7c4a1d }),
  // Glacier: blue-white ice at the top, gravel and mud below.
  'glacier-run': make({ floorA: 0xe3f4fa, floorB: 0xd0eaf5, side: 0x8ec9e0, rail: 0x5b8da6, ice: 0x8fd3f4, mud: 0x6d5a4a, sky: 0xeaf6fb }),
  // Wellington wharf: concrete, steel, orange cranes.
  'windy-welly': make({ floorA: 0xb7c0c9, floorB: 0xa9b3bd, side: 0x6e7a86, rail: 0x34495e, sky: 0xcfe3ee, gate: 0xf59e0b, belt: 0x3b4a59 }),
  // Volcanic ridge: red-brown scoria.
  'alpine-crossing': make({ floorA: 0xa8553f, floorB: 0x964a37, side: 0x5a2e22, rail: 0x3a2a26, sky: 0xd7e4f0, trapdoor: 0xd08a4a, start: 0x38bdf8, checkpoint: 0xfde047 }),
};

export function paletteFor(courseId: string): Palette {
  return PALETTES[courseId] ?? SAND;
}
