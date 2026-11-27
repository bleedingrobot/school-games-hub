/**
 * How each puzzle screen looks (docs/MONSTERS-PUZZLE-ART-PLAN.md): the painted landscape behind it, who says the
 * instructions, the style of its title plank and board, and the glowworm counts drawn on the cave roof. The words and
 * rules stay in shared/monsters/quests/puzzles.ts; this file is only the look.
 */
export interface PuzzleLook {
  /** A battle landscape (art/painted/scenes). */
  scene: string;
  /** Whose face is beside the instructions (art/painted/people, by slug). */
  person: string;
  /** The title plank and buttons: warm wood, carved stone, ice, or night ice. */
  theme: 'wood' | 'stone' | 'ice';
  /** Stepping stones: rocks, or lily pads and coral in the lagoon. */
  stones?: 'rock' | 'lagoon';
  /** The ice slide at night under the lights. */
  night?: boolean;
  /** The lock: glowworm groups to count (the code), or a chest by the hot springs. */
  glow?: number[];
  chest?: boolean;
}

export const PUZZLE_LOOK: Record<string, PuzzleLook> = {
  'kauri-seeds': { scene: 'kauri-bush', person: 'hermit', theme: 'wood' },
  'shell-stones': { scene: 'shell-beach', person: 'diver-ngaio', theme: 'wood', stones: 'rock' },
  'fire-lanterns': { scene: 'fire-mountain', person: 'firefighter-kate', theme: 'stone' },
  'snow-slide': { scene: 'snowy-peaks', person: 'ranger-fern', theme: 'ice' },
  'cave-count': { scene: 'glowworm-caves', person: 'glow-gran', theme: 'stone', glow: [4, 7, 2] },
  'wharf-crates': { scene: 'harbour-city', person: 'dock-worker-sione', theme: 'wood' },
  'lagoon-stones': { scene: 'lagoon-isle', person: 'swimmer-aroha', theme: 'wood', stones: 'lagoon' },
  'aurora-slide': { scene: 'aurora-hollow', person: 'skier-jo', theme: 'ice', night: true },
  'steam-lock': { scene: 'steam-valley', person: 'geyser-gus', theme: 'wood', chest: true },
};

export const lookOf = (id: string): PuzzleLook => PUZZLE_LOOK[id] ?? { scene: 'harbour-town', person: '', theme: 'wood' };
