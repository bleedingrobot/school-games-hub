import { computerDeeds } from './computer';

/**
 * The Daily News. Every line is written by the code from something that really happened (accepted by the server),
 * plus one village line a day. No student text ever goes in. `{p}` stands for the hero's hub name, filled in
 * when the news is read, so a name is never frozen into the text.
 */
export interface NewsLine {
  kind: 'village' | 'computer' | 'master' | 'dragon' | 'arena' | 'flattened';
  text: string;
  /** The pupil the line is about (null for the village and the computer heroes). */
  player: string | null;
  /** One line with this key per day: the same thing can't flood the page. */
  dedupe: string;
}

/**
 * The village's event of the day: a little life, often with a number in it. Lines only: nothing about the day
 * changes (the plan's "market day 10% off" would be a real rule, and is left for later).
 */
export const VILLAGE_EVENTS: string[] = [
  'Market day! The baker has 6 trays of pies with 8 pies on each. That is 48 pies, and one goblin has already tried to buy them all.',
  'A fog rolls over Hollowbrook. The lamplighter lights 20 lamps, then gets lost on the way to the 21st.',
  'The blacksmith gives a free sharpen to anyone who can say what 7 × 8 is. The whole queue says 56, and he runs out of sharpening stones.',
  'The inn is full tonight: 4 tables, 5 heroes at each. That is 20 heroes, all arguing about whose goblin was biggest.',
  'A travelling pedlar sells 3 turnips for 12 gold. Each turnip costs 4. Nobody wants a turnip.',
  'The village clock has chimed 13 times. The clockmaker says that is one more than it should. He is looking for the extra one.',
  'A sheep has been found on the bank roof. The farmer counts his flock: 30 sheep, so 29 now on the ground. He says it is a very clever sheep.',
  'The healer is running a sale on bandages: buy 2, get 1 free. Nobody has been hurt, but the queue is long.',
  'A rainbow lands behind the mill. The children count 7 colours. The goblins count 9 and are told to count again.',
  'The bard has a new song with 12 verses. By verse 8, the audience has gone to the shop.',
  'Heavy rain! Puddles everywhere. The ducks have 10 new swimming pools and are very happy about it.',
  'A baker’s dozen is 13, says the baker, putting 13 buns in each bag. 4 bags is 52 buns, and no profit.',
  'Dragon-watch: the tower guard sees a smoke cloud on the hill. It is the cook burning the porridge again.',
  'The mayor measures the town square: 12 steps one way and 10 the other. That is 120 steps of paving to sweep!',
  'A lost cat is found in the library, asleep on the book about dogs.',
  'Training day at the grounds: 5 heroes each do 9 press-ups. The master counts 45 and gives them a biscuit.',
  'The fishmonger has 24 fish and 6 customers. Everyone gets 4 fish, and one customer gets a surprised look.',
  'Somebody has painted the well bright pink. The pink is very good. Nobody will say who did it.',
  'Frost this morning! The pond is icy. A brave frog is sliding across it on purpose.',
  'The armourer polishes 15 helmets. Each one takes 2 minutes. He will be done in half an hour, or at tea time.',
  'A bag of gold coins is found by the bridge: 100 coins, if you count the one that is chocolate.',
  'The village band plays 3 songs, each 4 minutes long. The goblins in the front row ask for a 4th, and a snack.',
  'A kite festival! 18 kites go up and 9 come down in a tree. The tree has asked to be left in peace.',
  'The mill grinds 50 sacks of flour in a day. The baker says that is 50 reasons to expect more pies.',
  'A quiet day in Hollowbrook. The only thing to report is that nothing happened, and that the news-writer is very tired.',
  'The grocer sells apples at 5 gold each. A hero buys 6 and pays 30, and gets a free worm.',
  'A comet streaks over the forest tonight. The wizard says it is a sign. The sign says "back in 5 minutes".',
  'The bank has counted the village savings: 1,000 gold in the vault, 250 more in the tin, and 1 button.',
  'A parade of 8 ducks, in 2 neat rows of 4. The ducks do not know it is a parade.',
  'Someone has tied a ribbon round the Great Oak, 9 metres round. The oak says nothing but looks pleased.',
];

const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);

export const villageEventFor = (day: string): string => VILLAGE_EVENTS[((dayNumber(day) % VILLAGE_EVENTS.length) + VILLAGE_EVENTS.length) % VILLAGE_EVENTS.length];

/** The lines that belong to a day whoever plays: the village event and what the computer heroes did. */
export function dailyNews(day: string, season: { number: number; dayOfSeason: number }): NewsLine[] {
  const lines: NewsLine[] = [{ kind: 'village', text: villageEventFor(day), player: null, dedupe: 'village' }];
  for (const deed of computerDeeds(season.number, season.dayOfSeason)) {
    lines.push({ kind: 'computer', text: deed.text, player: null, dedupe: `computer:${deed.id}` });
  }
  return lines;
}

// The lines about a pupil (written by the server when it accepts the thing that happened).
export const masterWonLine = (player: string, masterName: string, level: number): NewsLine => ({
  kind: 'master', text: `{p} beat ${masterName} and reached level ${level}!`, player, dedupe: `master:${player}:${level}`,
});
export const dragonWonLine = (player: string, star: number): NewsLine => ({
  kind: 'dragon', text: `{p} beat the Red Dragon! That is star number ${star}. The village treasure, food and light are back!`, player, dedupe: `dragon:${player}`,
});
export const arenaWonLine = (player: string, opponent: string | null): NewsLine => ({
  kind: 'arena', text: opponent ? `{p} beat ${opponent} (computer hero) in the arena!` : '{p} won a fight in the arena!', player, dedupe: `arena:${player}`,
});
export const flattenedLine = (player: string, monster: string): NewsLine => ({
  kind: 'flattened', text: `{p} was flattened by ${/^[aeiou]/i.test(monster) ? 'an' : 'a'} ${monster}. The healer has put the kettle on.`, player, dedupe: `flat:${player}`,
});
