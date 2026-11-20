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
  /** The last day it shows, YYYY-MM-DD (NZ), for a line that stops being true (a "last chance" that has passed). */
  until?: string;
}

export const HUB_NEWS: NewsItem[] = [
  {
    id: 'stories-openings-2026-11-21',
    date: '2026-11-21',
    emoji: '📖',
    title: 'New stories!',
    text: 'Clan Quest, Dragon Maths and Star Trader now open with a story. You can skip it.',
  },
  {
    id: 'game-keys-2026-11-20',
    date: '2026-11-20',
    emoji: '⌨️',
    title: 'Keyboard keys in every game',
    text: 'On a computer? Press Enter to go on, 1 to 9 to pick, and Esc to go back.',
  },
  // Dated Sunday: newsToShow holds a line back until its date, so this one shows from Season 2 day 1.
  {
    id: 'dragon-season-2-begins-2026-11-22',
    date: '2026-11-22',
    emoji: '🌅',
    title: 'Dragon Maths Season 2 has begun!',
    text: 'Every hero starts again. See the Season 1 Hall of Heroes in Dragon Maths.',
    game: 'dragon-maths',
  },
  {
    id: 'goblinstorm-card-keys-2026-11-20',
    date: '2026-11-20',
    emoji: '⌨️',
    title: 'Goblin Storm power keys',
    text: 'On a keyboard? Press 1, 2, 3 or 4 to pick a power, or use the arrows and Enter.',
    game: 'goblinstorm',
  },
  {
    id: 'clans-season-1-ends-2026-11-20',
    date: '2026-11-20',
    emoji: '🛡️',
    title: 'Clan Quest Season 1 ends Saturday',
    text: 'Last chance to beat Grimmor! Then clans start again, but trophies and the Hall stay.',
    game: 'clan-quest',
  },
  {
    id: 'dragon-season-1-ends-2026-11-20',
    date: '2026-11-20',
    emoji: '⏳',
    title: 'Dragon Maths Season 1 ends Saturday',
    text: 'Last chance to slay the Red Dragon! Then heroes start again, but stars and trophies stay.',
    game: 'dragon-maths',
    until: '2026-11-21',
  },
  {
    id: 'trader-keys-2026-11-20',
    date: '2026-11-20',
    emoji: '⌨️',
    title: 'Star Trader keyboard keys',
    text: 'Type x and y, then press Enter to jump! Bolt\'s help lists all the keys.',
    game: 'trader',
  },
  {
    id: 'isles-keys-2026-11-20',
    date: '2026-11-20',
    emoji: '⌨️',
    title: 'Sky Isles keyboard keys',
    text: 'Press Enter to zoom through your turn and B to build. How to play lists all the keys.',
    game: 'isles',
  },
  {
    id: 'ultimate-dragon-slayer-2026-11-20',
    date: '2026-11-20',
    emoji: '🐲',
    title: 'Ultimate Dragon Slayer',
    text: 'Slay the dragon twice in one season to win a crown trophy and a gold title!',
    game: 'dragon-maths',
  },
  {
    id: 'gem-keep-card-2026-11-20',
    date: '2026-11-20',
    emoji: '🔑',
    title: 'Gem Keep: new level ready?',
    text: 'Its card now says when you can unlock a new level.',
  },
  {
    id: 'marble-ten-runs-2026-11-20',
    date: '2026-11-20',
    emoji: '🔵',
    title: 'Marble Rush: 10 runs a day',
    text: 'Its card shows runs left. Win Bonus Turns from a class quest!',
  },
  {
    id: 'bonus-turns-flap-storm-2026-11-20',
    date: '2026-11-20',
    emoji: '⏳',
    title: 'Bonus Turns Days for Toon Flap and Goblin Storm',
    text: 'Win one from a class quest! Their cards now show your goes left today.',
  },
  {
    id: 'lobby-stars-2026-11-20',
    date: '2026-11-20',
    emoji: '⭐',
    title: 'Star your friends',
    text: 'Star your friends to keep them at the top of the Lobby.',
    to: '/lobby',
  },
  {
    id: 'toonflap-daily-limits-2026-11-20',
    date: '2026-11-20',
    emoji: '🐦',
    title: 'Toon Flap: 10 wins and 2 Sky Dashes a day',
    text: 'Make every flight count! Your teacher can switch on Unlimited today for extra goes.',
    game: 'toonflap',
  },
  {
    id: 'gem-keep-short-key-2026-11-20',
    date: '2026-11-20',
    emoji: '🗝️',
    title: 'Gem Keep: a shorter Level Key',
    text: 'The Level Key is just 5 questions now. You can open one new level each day.',
    game: 'gem-keep',
  },
  {
    id: 'gem-keep-short-well-2026-11-20',
    date: '2026-11-20',
    emoji: '💧',
    title: 'Gem Keep: a quicker Mana Well',
    text: 'The Mana Well is just 3 questions now, and each right answer gives lots more mana!',
    game: 'gem-keep',
  },
  {
    id: 'clan-raids-school-wide-2026-11-20',
    date: '2026-11-20',
    emoji: '🏰',
    title: 'Clan Quest: raid any village at school',
    text: 'Raid clans from other classes too, and see the whole school’s Banners board!',
    game: 'clan-quest',
  },
  {
    id: 'invite-by-name-2026-11-20',
    date: '2026-11-20',
    emoji: '🎲',
    title: 'Invite a friend by name',
    text: 'Invite anyone who’s here to Chess, Checkers, 101, Wormholes or Power Clash!',
    to: '/lobby',
  },
  {
    id: 'play-a-friend-lobby-2026-11-20',
    date: '2026-11-20',
    emoji: '🤝',
    title: 'A new Play a friend page',
    text: 'See who’s here, pick a game, and challenge a friend from any class!',
    to: '/lobby',
  },
  {
    id: 'trader-show-map-2026-11-20',
    date: '2026-11-20',
    emoji: '🗺️',
    title: 'Star Trader: find it on the star chart',
    text: 'On the hold card, press Show on star chart to see where to fly and the way there.',
    game: 'trader',
  },
  {
    id: 'trader-you-paid-2026-11-20',
    date: '2026-11-20',
    emoji: '💰',
    title: 'Star Trader: what did you pay?',
    text: 'The hold card shows what you paid each, and warns you if selling here loses money.',
    game: 'trader',
  },
  {
    id: 'trader-sells-best-2026-11-20',
    date: '2026-11-20',
    emoji: '🪐',
    title: 'Star Trader: where does it sell best?',
    text: 'Tap a good in your hold to see the two best planets to sell it.',
    game: 'trader',
  },
  {
    id: 'trader-hold-2026-11-20',
    date: '2026-11-20',
    emoji: '🚀',
    title: 'Star Trader: see your hold',
    text: 'In the market your ship has a box for every hold. Watch them fill up with what you buy!',
    game: 'trader',
  },
  {
    id: 'goblinstorm-hero-powers-2026-11-20',
    date: '2026-11-20',
    emoji: '🧙',
    title: 'Goblin Storm: every hero has their own powers',
    text: 'The Wizard casts runes, the Ranger sends hawks, the Rogue throws daggers. Try them all!',
    game: 'goblinstorm',
  },
  {
    id: 'goblinstorm-runs-left-2026-11-20',
    date: '2026-11-20',
    emoji: '🌙',
    title: 'Goblin Storm: see your runs left',
    text: 'See how many of your 5 runs are left today, and when they are all used up.',
    game: 'goblinstorm',
  },
  {
    id: 'goblinstorm-dearer-shop-2026-11-20',
    date: '2026-11-20',
    emoji: '🪙',
    title: 'Goblin Storm: the shop costs more',
    text: 'Shop upgrades now cost more gold. Save up! What you have bought stays yours.',
    game: 'goblinstorm',
  },
  {
    id: 'goblinstorm-tough-ending-2026-11-20',
    date: '2026-11-20',
    emoji: '💪',
    title: 'Goblin Storm: a tougher ending',
    text: 'Monsters in the last minute are tougher, and tougher again in the last 30 seconds!',
    game: 'goblinstorm',
  },
  {
    id: 'challenge-anywhere-2026-11-20',
    date: '2026-11-20',
    emoji: '⚔️',
    title: 'Challenges reach you anywhere',
    text: "Friends can now challenge you even when you're not in that game!",
  },
  {
    id: 'goblinstorm-quests-2026-11-20',
    date: '2026-11-20',
    emoji: '🐉',
    title: 'Goblin Storm: class quests and a new trophy',
    text: 'Your teacher can now pick Goblin Storm quests. Beat the Fire Dragon to win its Scale!',
    game: 'goblinstorm',
  },
  {
    id: 'play-other-classes-2026-11-20',
    date: '2026-11-20',
    emoji: '🤝',
    title: 'Play friends in other classes',
    text: 'You can now challenge friends in other classes in Archery, Dragon Maths and Clan duels!',
  },
  {
    id: 'goblinstorm-gold-card-2026-11-20',
    date: '2026-11-20',
    emoji: '🪙',
    title: 'Goblin Storm: a Gold card every level',
    text: 'Every level-up now has a Gold card. Watch out: the monsters get tough faster!',
    game: 'goblinstorm',
  },
  {
    id: 'goblinstorm-harder-2026-11-20',
    date: '2026-11-20',
    emoji: '🦸',
    title: 'Goblin Storm heroes are a bigger quest',
    text: 'Wizard, Barbarian and Rogue take longer to unlock. Shop upgrades cost more gold.',
    game: 'goblinstorm',
  },
  {
    id: 'goblinstorm-new-2026-11-19',
    date: '2026-11-19',
    emoji: '🌪️',
    title: 'New game: Goblin Storm',
    text: 'Survive the goblin swarm! Level up, evolve your weapons and wipe the whole screen.',
    game: 'goblinstorm',
  },
  {
    id: 'quest-frames-painted-2026-11-19',
    date: '2026-11-19',
    emoji: '🎨',
    title: 'Painted Quest Frames',
    text: 'All eight Quest Frames are now painted pictures. Leaves, flames, stars, gems and more!',
    to: '/profile#rewards',
  },
  {
    id: 'checkers-pirate-bots-2026-11-19',
    date: '2026-11-19',
    emoji: '🏴‍☠️',
    title: 'Pirate bots',
    text: 'The checkers bots are now a pirate crew: a chick, a robot and a kea captain!',
    game: 'checkers',
  },
  {
    id: 'diamond-rare-rarer-2026-11-19',
    date: '2026-11-19',
    emoji: '💎',
    title: 'Rare gems are rarer',
    text: 'Diamond Drop rare gems now turn up about 1 go in 4. Each one is a real treasure!',
    game: 'diamond',
  },
  {
    id: 'quest-frames-2026-11-19',
    date: '2026-11-19',
    emoji: '🖼️',
    title: 'Quest Frames!',
    text: 'Some class quests now give a Quest Frame to go around your avatar. Pick your favourite!',
    to: '/profile#rewards',
  },
  {
    id: 'game-coins-2026-11-19',
    date: '2026-11-19',
    emoji: '💰',
    title: 'Coin pouches!',
    text: 'Some class quests now give a pouch of game money. Play that game to open it!',
    to: '/profile#rewards',
  },
  {
    id: 'bonus-turns-2026-11-19',
    date: '2026-11-19',
    emoji: '⏳',
    title: 'Bonus Turns Days!',
    text: 'Win a Bonus Turns Day from a class quest: unlimited turns in that game, on a day you pick.',
    to: '/profile#rewards',
  },
  {
    id: 'hero-titles-2026-11-19',
    date: '2026-11-19',
    emoji: '🏷️',
    title: 'Hero Titles!',
    text: 'Some class quests now give a Hero Title, like “Moon Walker”, to show under your name.',
    to: '/profile#rewards',
  },
  {
    id: 'quest-rewards-2026-11-19',
    date: '2026-11-19',
    emoji: '🎁',
    title: 'Quests give rewards!',
    text: 'Finish a class quest to win a reward, like a Rename Scroll to make up your own name!',
    to: '/profile#rewards',
  },
  {
    id: 'achievements-menu-2026-11-19',
    date: '2026-11-19',
    emoji: '🏆',
    title: 'Achievements in the menu',
    text: 'Tap Achievements at the top of the page to visit your Achievement Hall any time.',
    to: '/achievements',
  },
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
    to: '/achievements',
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

/** The lines to show today, newest first: recent (none before its date or after its `until`), and for a game this class can see (or for everyone). */
export function newsToShow(today: string, canSee: (game: string) => boolean, news: NewsItem[] = HUB_NEWS): NewsItem[] {
  const oldest = new Date(`${today}T00:00:00Z`).getTime() - NEWS_DAYS * 86_400_000;
  return news
    .filter((n) => new Date(`${n.date}T00:00:00Z`).getTime() >= oldest && n.date <= today && (!n.until || today <= n.until))
    .filter((n) => !n.game || canSee(n.game))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
