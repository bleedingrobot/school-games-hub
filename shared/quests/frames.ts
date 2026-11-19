/**
 * Quest Frames (docs/QUEST-REWARDS-PLAN.md, stage 4): painted rings a pupil can win from a class quest and wear around their
 * avatar. The ids are mirrored in quest_frame_ids() in supabase/migrations/20261119000800_quest_frames.sql (a test checks
 * they match) and worn in the avatar's `frame` key, which only the server writes.
 *
 * Until a frame is painted (docs/quests-art/config.json, `frame-<id>`), AvatarImage draws it from `colours` and `bead`.
 */
export interface QuestFrame {
  id: string;
  name: string;
  emoji: string;
  /** Light, main and dark: the drawn ring's gradient. */
  colours: readonly [string, string, string];
  /** The little beads drawn around the ring. */
  bead: string;
}

export const QUEST_FRAMES: readonly QuestFrame[] = [
  { id: 'vine', name: 'Vine', emoji: '🌿', colours: ['#b8f07a', '#4caf50', '#1f6b2a'], bead: '#ff8fb1' },
  { id: 'flame', name: 'Flame', emoji: '🔥', colours: ['#ffe066', '#ff8a1f', '#c2261b'], bead: '#fff3b0' },
  { id: 'starfield', name: 'Starfield', emoji: '🌌', colours: ['#8f8cff', '#3b2f9e', '#120d40'], bead: '#ffe680' },
  { id: 'crystal', name: 'Crystal', emoji: '💎', colours: ['#e3fbff', '#7fd8f0', '#3a7fb8'], bead: '#ffffff' },
  { id: 'ocean', name: 'Ocean Wave', emoji: '🌊', colours: ['#a8f0ff', '#2196c9', '#0b4a7a'], bead: '#e8fbff' },
  { id: 'autumn', name: 'Autumn Leaves', emoji: '🍁', colours: ['#ffd27a', '#e8742a', '#8a3a12'], bead: '#c2261b' },
  { id: 'laurel', name: 'Golden Laurel', emoji: '🏅', colours: ['#fff1a8', '#e6b422', '#8a6200'], bead: '#fff8d6' },
  { id: 'glow-worm', name: 'Glow-worm', emoji: '✨', colours: ['#c8fff0', '#27c4a8', '#0b3d4a'], bead: '#d8ffb0' },
];

const BY_ID = new Map(QUEST_FRAMES.map((f) => [f.id, f]));

export const questFrame = (id: unknown): QuestFrame | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined);

/** The frame a saved avatar is wearing, if any. */
export const frameOf = (avatar: unknown): QuestFrame | undefined =>
  avatar && typeof avatar === 'object' ? questFrame((avatar as Record<string, unknown>).frame) : undefined;
