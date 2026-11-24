/** Auction House treasures as the screens show them: a name, a stand-in emoji until the painting lands, and the painting's file. */
import type { TreasureKind } from '../../../shared/showdown/auction';

export const TREASURE: Record<TreasureKind, { name: string; emoji: string }> = {
  goblet: { name: 'Golden goblet', emoji: '🏆' },
  lamp: { name: 'Magic lamp', emoji: '🪔' },
  map: { name: 'Treasure map', emoji: '🗺️' },
  orb: { name: 'Crystal orb', emoji: '🔮' },
  egg: { name: 'Dragon egg', emoji: '🥚' },
  mystery: { name: 'Mystery box', emoji: '🎁' },
  dragon: { name: 'Golden dragon', emoji: '🐉' },
};
