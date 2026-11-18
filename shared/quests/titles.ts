/**
 * Hero Titles (docs/QUEST-REWARDS-PLAN.md, stage 2): a fixed list of friendly titles a pupil can win from a class quest and
 * show under their name. No rank words and nothing that compares pupils, so teachers never need to check them.
 *
 * The ids are mirrored in hero_title_ids() in supabase/migrations/20261119000500_hero_titles.sql (a test checks they match).
 * Ids are worn in the avatar's `title` key, so each must be lower-case letters and dashes, 24 characters at most.
 */
export interface HeroTitle {
  id: string;
  name: string;
  emoji: string;
}

export const HERO_TITLES: readonly HeroTitle[] = [
  { id: 'the-brave', name: 'the Brave', emoji: '🦁' },
  { id: 'the-kind', name: 'the Kind', emoji: '💛' },
  { id: 'the-curious', name: 'the Curious', emoji: '🔍' },
  { id: 'the-bold', name: 'the Bold', emoji: '⚡' },
  { id: 'the-wise', name: 'the Wise', emoji: '🦉' },
  { id: 'the-cheerful', name: 'the Cheerful', emoji: '😊' },
  { id: 'the-patient', name: 'the Patient', emoji: '🐢' },
  { id: 'the-steady', name: 'the Steady', emoji: '⛰️' },
  { id: 'moon-walker', name: 'Moon Walker', emoji: '🌙' },
  { id: 'star-seeker', name: 'Star Seeker', emoji: '⭐' },
  { id: 'gem-finder', name: 'Gem Finder', emoji: '💎' },
  { id: 'dragon-friend', name: 'Dragon Friend', emoji: '🐉' },
  { id: 'kind-captain', name: 'Kind Captain', emoji: '⚓' },
  { id: 'cloud-rider', name: 'Cloud Rider', emoji: '☁️' },
  { id: 'wave-surfer', name: 'Wave Surfer', emoji: '🌊' },
  { id: 'number-explorer', name: 'Number Explorer', emoji: '🧭' },
  { id: 'puzzle-solver', name: 'Puzzle Solver', emoji: '🧩' },
  { id: 'map-maker', name: 'Map Maker', emoji: '🗺️' },
  { id: 'treasure-hunter', name: 'Treasure Hunter', emoji: '🪙' },
  { id: 'forest-ranger', name: 'Forest Ranger', emoji: '🌲' },
  { id: 'sky-sailor', name: 'Sky Sailor', emoji: '⛵' },
  { id: 'comet-chaser', name: 'Comet Chaser', emoji: '☄️' },
  { id: 'glow-worm-keeper', name: 'Glow-worm Keeper', emoji: '✨' },
  { id: 'kiwi-guardian', name: 'Kiwi Guardian', emoji: '🥝' },
  { id: 'storm-dancer', name: 'Storm Dancer', emoji: '🌩️' },
  { id: 'quest-keeper', name: 'Quest Keeper', emoji: '🛡️' },
  { id: 'rainbow-maker', name: 'Rainbow Maker', emoji: '🌈' },
  { id: 'monster-tamer', name: 'Monster Tamer', emoji: '👾' },
  { id: 'castle-builder', name: 'Castle Builder', emoji: '🏰' },
  { id: 'river-runner', name: 'River Runner', emoji: '🏞️' },
  { id: 'mountain-climber', name: 'Mountain Climber', emoji: '🧗' },
  { id: 'light-bringer', name: 'Light Bringer', emoji: '🔦' },
];

const BY_ID = new Map(HERO_TITLES.map((t) => [t.id, t]));

export const heroTitle = (id: unknown): HeroTitle | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined);

/** The title a saved avatar is wearing, if any. */
export const titleOf = (avatar: unknown): HeroTitle | undefined =>
  avatar && typeof avatar === 'object' ? heroTitle((avatar as Record<string, unknown>).title) : undefined;
