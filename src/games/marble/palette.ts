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
  sky: number;
}

/** Golden sand and driftwood, for the practice courses and Boulder Beach. */
export const SAND: Palette = {
  floorA: 0xe8c77a, floorB: 0xdcb867, side: 0xb98f45, rail: 0x7a5a32, ice: 0xbfe6f5, mud: 0x6d4a2b,
  start: 0x3b82f6, checkpoint: 0xfacc15, finishA: 0xffffff, finishB: 0x1f2937, pad: 0xf97316, bumper: 0xe11d48, door: 0x16a34a, sky: 0xcfe9f3,
};

export function paletteFor(_courseId: string): Palette {
  return SAND;
}
