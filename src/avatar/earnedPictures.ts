/**
 * Earned profile pictures (docs/plans/profile/PLAN.md, card P3). A pupil who has won a picture trophy can wear it in place
 * of their built avatar. The saved avatar then carries two more short codes: `pic` (the trophy's id) and `picTier` (the
 * ring's metal). The server checks `pic` and writes `picTier` itself (save_my_avatar, award_trophy), so the browser only
 * draws what it is given.
 */

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
}

/**
 * One line per picture trophy, added by the card that adds the trophy (the first is P4's Dragon Head).
 * A picture that is not listed yet still draws: a trophy cup on its metal disc.
 */
export const EARNED_PICTURES: Record<string, PictureArt> = {
  // Card P7 (placeholders until card P2's paintings land).
  'clan-banner': { emoji: '🚩' },
  'isles-lighthouse': { emoji: '🗼' },
  'mm-book': { emoji: '📖' },
  'gem-crown': { emoji: '👑' },
  'trader-blackhole': { emoji: '🕳️' },
  'diamond-heart': { emoji: '💎' },
  'toonflap-rainbow': { emoji: '🌈' },
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
  return { id: pic, tier, ...(EARNED_PICTURES[pic] ?? UNKNOWN_PICTURE) };
}
