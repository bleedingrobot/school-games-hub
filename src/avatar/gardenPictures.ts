/**
 * The early-years friends as earned profile pictures (docs/plans/profile/PLAN.md card P9). Finishing a friend's 30-day
 * golden prize wins that friend's picture: trophy id `<game>-<friend>`, given by garden_rewards in
 * supabase/migrations/20261112002500_garden_trophies.sql. The painting is the friend's `-cheer` picture from its game (no new
 * art); a friend painted only sitting uses that, and Parrot's friends are one picture each. Only the addresses are bundled.
 */
import type { PictureArt } from './earnedPictures';

const FILES = import.meta.glob(
  [
    '../games/{beanstalk,hop,pipi,korora,weka,tui,lizard,parrot,pigeon,robin,swamphen}/art/paint/friends/*-{cheer,sit}.webp',
    '../games/parrot/art/paint/friends/*.webp',
    '../games/tui/art/paint/tui/tui-cheer.webp',
  ],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

/** Each game's friends in its own FRIENDS order (the order the SQL's `sort` keeps), with the game's emoji as placeholder. */
export const GARDEN_FRIENDS: Record<string, { emoji: string; friends: readonly string[] }> = {
  beanstalk: { emoji: '🌱', friends: ['kiwi', 'tui', 'kereru', 'weta', 'ruru', 'takahe'] },
  hop: { emoji: '✨', friends: ['hop', 'gecko', 'weta', 'tuatara', 'kiwi', 'ruru'] },
  pipi: { emoji: '🐚', friends: ['pipi', 'korora', 'tuatara', 'weta', 'kiwi', 'tui'] },
  korora: { emoji: '🐧', friends: ['korora', 'hoiho', 'kiwi', 'pukeko', 'kereru', 'takahe'] },
  weka: { emoji: '🪨', friends: ['weka', 'kiwi', 'takahe', 'kakapo', 'pukeko', 'kea'] },
  tui: { emoji: '🌸', friends: ['tui', 'kereru', 'piwakawaka', 'korimako', 'kaka'] },
  lizard: { emoji: '🦎', friends: ['lizard', 'kiwi', 'fantail', 'bellbird', 'kea'] },
  parrot: { emoji: '🦜', friends: ['parrot', 'robin', 'kiwi', 'duck', 'owl'] },
  pigeon: { emoji: '🕊️', friends: ['pigeon', 'sparrow', 'fantail', 'bellbird', 'parrot'] },
  robin: { emoji: '🫐', friends: ['robin', 'kiwi', 'kea', 'weka', 'pukeko', 'tui'] },
  swamphen: { emoji: '🌾', friends: ['swamphen', 'pigeon', 'kea', 'weka', 'tui', 'heron'] },
};

function friendPainting(game: string, friend: string): string | undefined {
  const at = `../games/${game}/art/paint/`;
  return FILES[`${at}friends/${friend}-cheer.webp`] ?? FILES[`${at}${friend}/${friend}-cheer.webp`]
    ?? FILES[`${at}friends/${friend}-sit.webp`] ?? FILES[`${at}friends/${friend}.webp`];
}

/** One entry per friend picture, for EARNED_PICTURES. */
export const GARDEN_PICTURES: Record<string, PictureArt> = Object.fromEntries(
  Object.entries(GARDEN_FRIENDS).flatMap(([game, { emoji, friends }]) =>
    friends.map((friend) => {
      const art = friendPainting(game, friend);
      return [`${game}-${friend}`, art ? { emoji, art } : { emoji }];
    })),
);
