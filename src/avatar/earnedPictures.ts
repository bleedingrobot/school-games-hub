/**
 * Earned profile pictures (docs/plans/profile/PLAN.md, card P3). A pupil who has won a picture trophy can wear it in place
 * of their built avatar. The saved avatar then carries two more short codes: `pic` (the trophy's id) and `picTier` (the
 * ring's metal). The server checks `pic` and writes `picTier` itself (save_my_avatar, award_trophy), so the browser only
 * draws what it is given.
 */
import { GARDEN_PICTURES } from './gardenPictures';
import { BACKDROP_GOLD, paintedPicture, paintedPictureByTier } from './paintedArt';

export const TIERS = ['bronze', 'silver', 'gold'] as const;
export type Tier = (typeof TIERS)[number];

/**
 * The metal for a number of wins (or, for a "steps" trophy, the step reached): 1 bronze, 2 silver, 3 or more gold.
 * Must match trophy_tier() in supabase/migrations/20261112000800_trophies.sql.
 */
export function tierOf(level: number): Tier | null {
  if (!(level >= 1)) return null;
  return level >= 3 ? 'gold' : level >= 2 ? 'silver' : 'bronze';
}

/** Ring colours: [light, main, dark] for each metal. */
export const TIER_COLOURS: Record<Tier, readonly [string, string, string]> = {
  bronze: ['#f0b98a', '#c47a3c', '#7a4318'],
  silver: ['#f4f6fa', '#b9c0cc', '#6f7785'],
  gold: ['#fff1a8', '#f2c230', '#a87900'],
};

export interface PictureArt {
  /** The game's emoji: the placeholder until the painting lands, and the fallback if it fails to load. */
  emoji: string;
  /** The painting's URL (an imported image), once there is one. */
  art?: string;
  /** The same painting at 160 px, for sizes of 80 px or less. */
  artSmall?: string;
  /** A glow painted behind a cut-out picture (the early-years friends). */
  backdrop?: string;
  /** A picture with its own painting for each metal (the Dragon Head). */
  byTier?: Record<Tier, { art: string; artSmall: string }>;
}

/** An emoji placeholder plus the painting named `name`, if it is there. */
const painted = (emoji: string, name: string): PictureArt => ({ emoji, ...paintedPicture(name) });

/**
 * One line per picture trophy, added by the card that adds the trophy (the first is P4's Dragon Head).
 * A picture that is not listed yet still draws: a trophy cup on its metal disc.
 */
export const EARNED_PICTURES: Record<string, PictureArt> = {
  // P9: the 62 early-years friends, each on the painted gold glow.
  ...Object.fromEntries(Object.entries(GARDEN_PICTURES).map(([id, pic]) => [id, { ...pic, backdrop: BACKDROP_GOLD?.art }])),
  // Dragon Maths (P4): one of the first five in the school to slay the dragon this season.
  'dm-first-five': { emoji: '🐉', byTier: paintedPictureByTier('dragon-head') },
  // Card P7: the painted pictures (card P2); the emoji draws if a painting is missing.
  'clan-banner': painted('🚩', 'clan-banner'),
  'isles-lighthouse': painted('🗼', 'lighthouse'),
  'mm-book': painted('📖', 'book-master'),
  'gem-crown': painted('👑', 'gem-crown'),
  'trader-blackhole': painted('🕳️', 'black-hole'),
  'diamond-heart': painted('💎', 'heart-diamond'),
  'toonflap-rainbow': painted('🌈', 'rainbow-toon'),
  'chess-crown': painted('♛', 'chess-crown'),
  'checkers-crown': painted('⛀', 'checkers-crown'),
  'archery-bow': painted('🏹', 'golden-bow'),
  'marble-golden': painted('🟡', 'golden-marble'),
  'bond-perfect': painted('💞', 'perfect-match'),
  'mine-pickaxe': painted('⛏️', 'golden-pickaxe'),
  'decree-crown': painted('👑', 'royal-crown'),
  // Card P10: the hub-wide and Two games pictures.
  'hub-allrounder': painted('🌟', 'all-rounder'),
  'pair-double-slayer': painted('⚔️', 'double-slayer'),
  'pair-board-master': painted('♞', 'board-master'),
  'pair-treasure-keeper': painted('🗝️', 'treasure-keeper'),
};

export const UNKNOWN_PICTURE: PictureArt = { emoji: '🏆' };

export interface WornPicture extends PictureArt {
  id: string;
  tier: Tier;
}

/** The earned picture a saved avatar is wearing, or null for a built avatar. */
export function pictureOf(saved: unknown): WornPicture | null {
  if (!saved || typeof saved !== 'object') return null;
  const { pic, picTier } = saved as Record<string, unknown>;
  if (typeof pic !== 'string' || !/^[a-z0-9][a-z0-9-]{0,23}$/.test(pic)) return null;
  const tier = (TIERS as readonly unknown[]).includes(picTier) ? (picTier as Tier) : 'bronze';
  const { byTier, ...found } = EARNED_PICTURES[pic] ?? UNKNOWN_PICTURE;
  return { id: pic, tier, ...found, ...(byTier?.[tier] ?? {}) };
}
