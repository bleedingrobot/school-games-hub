/**
 * "What's new" on the home page: news for pupils, newest first.
 *
 * Only things a pupil would care about: a new game, new achievements or trophies, new pictures, a game made easier or
 * harder, maths changes they will notice. Never fixes, teacher pages, tests or behind-the-scenes work.
 *
 * Add a line at the top when a change like that goes live (game guide, 8-going-live.md "Write it down"). Keep the words
 * short and friendly, for ages 5 to 11. `id` never changes once it is live (it is how a device remembers what it has seen).
 * `game` is the game's registry id: the line only shows to classes that can see that game's card.
 */
export interface NewsItem {
  id: string;
  /** The day it went live, YYYY-MM-DD (NZ). */
  date: string;
  emoji: string;
  title: string;
  text: string;
  game?: string;
  /** Where "Have a look" goes. Defaults to the game's page when `game` is set. */
  to?: string;
}

export const HUB_NEWS: NewsItem[] = [
  {
    id: 'chess-bots-2026-11-19',
    date: '2026-11-19',
    emoji: '🐣',
    title: 'Meet the chess bots!',
    text: 'The chess bots are now a chick, a robot and a wizard. Watch them think!',
    game: 'chess',
  },
  {
    id: 'achievement-pop-2026-11-19',
    date: '2026-11-19',
    emoji: '🏅',
    title: 'Achievements now pop!',
    text: 'Earn one and its medallion bursts onto your screen with a chime. Collect them all!',
    to: '/achievements',
  },
  {
    id: 'chess-sets-2026-11-19',
    date: '2026-11-19',
    emoji: '♞',
    title: 'Six new chess sets to unlock!',
    text: 'Wood, ice, robots, dragons, gold and NZ birds. Open the Chess Locker to win them!',
    game: 'chess',
  },
  {
    id: 'achievement-hall-2026-11-19',
    date: '2026-11-19',
    emoji: '🏛️',
    title: 'The Achievement Hall is open!',
    text: 'See every achievement shine on its shelf, and tap one to find out how to win it.',
    to: '/achievements',
  },
  {
    id: 'achievement-words-2026-11-19',
    date: '2026-11-19',
    emoji: '🏅',
    title: 'Achievements now say how to get them',
    text: 'Every achievement now tells you what to do to earn it. See what you’re close to!',
    to: '/profile#achievements',
  },
  {
    id: 'gemkeep-red-blast-2026-11-18',
    date: '2026-11-18',
    emoji: '🔺',
    title: 'Red gems hit harder in Gem Keep',
    text: 'Red gems now blast a bigger area and hurt the whole group more. Watch for the red ring!',
    game: 'gem-keep',
  },
  {
    id: 'diamond-rare-gems-2026-11-18',
    date: '2026-11-18',
    emoji: '💎',
    title: 'Rare gems in Diamond Drop',
    text: 'A pupil’s idea! Seven sparkly rare gems hide deep down. Can you find the 1% Fablet Rose?',
    game: 'diamond',
  },
  {
    id: 'marble-easier-2026-11-18',
    date: '2026-11-18',
    emoji: '🎉',
    title: 'Marble Rush is easier',
    text: 'More rails, fewer gaps, slower geysers. And confetti and stars when you finish!',
    game: 'marble',
  },
  {
    id: 'whats-new-2026-11-18',
    date: '2026-11-18',
    emoji: '📣',
    title: 'What’s new',
    text: 'This box tells you about new games, pictures and achievements.',
  },
  {
    id: 'chess-locker-2026-11-18',
    date: '2026-11-18',
    emoji: '♟️',
    title: 'Chess Locker',
    text: 'Unlock 6 painted backgrounds and 4 painted boards. Pick your own look!',
    game: 'chess',
  },
  {
    id: 'full-window-2026-11-18',
    date: '2026-11-18',
    emoji: '🖼️',
    title: 'Bigger games',
    text: 'Lots of games now fill the whole screen, with big new paintings.',
  },
  {
    id: 'class-quests-2026-11-18',
    date: '2026-11-18',
    emoji: '🎯',
    title: 'More class quests',
    text: 'Every maths game now has class quests to finish together.',
  },
  {
    id: 'swamphen-2026-11-18',
    date: '2026-11-18',
    emoji: '🪺',
    title: 'Reed Rows is gentler',
    text: 'Swamp Hen’s Reed Rows now has nine smaller steps.',
    game: 'swamphen',
  },
  {
    id: 'clan-duels-2026-11-17',
    date: '2026-11-17',
    emoji: '⚔️',
    title: 'Clan Duels and Village Raids',
    text: 'Duel classmates live and raid their villages. Nobody loses anything!',
    game: 'clan-quest',
  },
  {
    id: 'dragon-arena-2026-11-17',
    date: '2026-11-17',
    emoji: '🐉',
    title: 'Dragon Maths arena',
    text: 'Practice clashes and live clashes with classmates in the arena.',
    game: 'dragon-maths',
  },
  {
    id: 'clan-monster-2026-11-16',
    date: '2026-11-16',
    emoji: '👹',
    title: 'The season monster',
    text: 'Clan Quest has a huge new monster to fight, one try a day.',
    game: 'clan-quest',
  },
];

/** How long a line stays on the home page after it goes live. */
export const NEWS_DAYS = 14;

/** How many lines the box shows before "More". */
export const NEWS_SHOWN = 3;

/** The lines to show today, newest first: recent, and for a game this class can see (or for everyone). */
export function newsToShow(today: string, canSee: (game: string) => boolean, news: NewsItem[] = HUB_NEWS): NewsItem[] {
  const oldest = new Date(`${today}T00:00:00Z`).getTime() - NEWS_DAYS * 86_400_000;
  return news
    .filter((n) => new Date(`${n.date}T00:00:00Z`).getTime() >= oldest && n.date <= today)
    .filter((n) => !n.game || canSee(n.game))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
