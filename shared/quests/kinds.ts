/**
 * The kinds of weekly class quest (docs/CLASS-QUESTS-PLAN.md). Each must match a row in public.quest_kinds (same rule and
 * amount) and a watcher on its game's own table (migrations 20261118000100, 20261118003100 and later ones for newer games). A new kind = an entry here,
 * a row, a watcher, a painting (docs/quests-art/config.json).
 *
 * Rules: 'turns' use all of the day's turns on 5 of 7 days; 'days' do `amount` on 5 of 7 days; 'total' reach `amount` in the
 * week on any days; 'distinct' reach `amount` different things in the week.
 */
export type QuestKind = string;
export type QuestRule = 'turns' | 'days' | 'total' | 'distinct';
export type QuestGroup = 'complex' | 'easy';

export interface QuestKindInfo {
  id: QuestKind;
  /** The quest's name, shown on the bar and the teacher's card. */
  name: string;
  /** The game's home card id (its address and its "moves left" chip). */
  card: string;
  /** The game's name. */
  game: string;
  group: QuestGroup;
  rule: QuestRule;
  /** 'days': the amount a day. 'total' and 'distinct': the week's target. Not used by 'turns'. */
  amount?: number;
  /** What to do, as a command: each day for 'turns' and 'days', this week for 'total' and 'distinct'. */
  goal: string;
  /** One thing counted, for "7 of 12 runs" and "6 jumps left today". */
  unit: { one: string; many: string };
  /** What lights a played day-stone. */
  spark: string;
}

export const DAYS_IN_QUEST = 7;
export const DAYS_NEEDED = 5;

const k = (
  id: string, name: string, card: string, game: string, group: QuestGroup, rule: QuestRule, amount: number | undefined,
  goal: string, one: string, many: string, spark: string,
): QuestKindInfo => ({ id, name, card, game, group, rule, amount, goal, unit: { one, many }, spark });

export const QUEST_KINDS: QuestKindInfo[] = [
  // Complex maths
  k('trader', 'Every Jump', 'trader', 'Star Trader', 'complex', 'turns', undefined, 'Use all your jumps', 'jump', 'jumps', '🚀'),
  k('trader-planets', 'Star Explorer', 'trader', 'Star Trader', 'complex', 'distinct', 6, 'Land at 6 different planets', 'planet', 'planets', '🪐'),
  k('lord', 'Forest Hunter', 'dragon-maths', 'Dragon Maths', 'complex', 'turns', undefined, 'Use all your forest fights', 'forest fight', 'forest fights', '🔥'),
  k('lord-arena', 'Arena Regular', 'dragon-maths', 'Dragon Maths', 'complex', 'days', 1, 'Fight 1 arena fight (any result)', 'arena fight', 'arena fights', '⚔️'),
  k('clans', 'Mine Raider', 'clan-quest', 'Clan Quest', 'complex', 'turns', undefined, 'Use all your mine fights', 'mine fight', 'mine fights', '⛏️'),
  k('clans-raids', 'Village Raider', 'clan-quest', 'Clan Quest', 'complex', 'total', 6, 'Raid classmates’ villages 6 times', 'raid', 'raids', '🚩'),
  k('kingdom-years', 'Royal Routine', 'kingdom', 'Kingdom Keeper', 'complex', 'days', 1, 'Rule 1 year of your reign', 'year', 'years', '👑'),
  k('kingdom-reigns', 'Crown Week', 'kingdom', 'Kingdom Keeper', 'complex', 'total', 2, 'Finish 2 reigns (any rating)', 'reign', 'reigns', '🏰'),
  k('monsters-battles', 'Monster Trainer', 'monsters', 'Maths Monsters', 'complex', 'days', 3, 'Have 3 battles', 'battle', 'battles', '⚡'),
  k('monsters-catches', 'Monster Catcher', 'monsters', 'Maths Monsters', 'complex', 'total', 3, 'Catch 3 monsters', 'monster', 'monsters', '🔮'),
  // Easy maths
  k('archery-fights', 'Daily Archer', 'archery', 'Archery Challenge', 'easy', 'days', 1, 'Finish 1 bot fight (win or lose)', 'fight', 'fights', '🏹'),
  k('archery-sets', 'Quiver Filler', 'archery', 'Archery Challenge', 'easy', 'total', 6, 'Finish 6 maths sets', 'set', 'sets', '🎯'),
  k('bond-daily', 'Match Habit', 'bond-match', 'Bond Match', 'easy', 'days', 2, 'Finish 2 matches', 'match', 'matches', '🃏'),
  k('bond-total', 'Match Marathon', 'bond-match', 'Bond Match', 'easy', 'total', 10, 'Finish 10 matches', 'match', 'matches', '✨'),
  k('decree-cards', 'Daily Decrees', 'decree', 'Royal Decree', 'easy', 'days', 10, 'Decide 10 cards', 'card', 'cards', '📜'),
  k('decree-villagers', 'Meet the Village', 'decree', 'Royal Decree', 'easy', 'distinct', 6, 'Meet 6 different villagers', 'villager', 'villagers', '🧑‍🌾'),
  k('diamond-daily', 'Daily Dig', 'diamond', 'Diamond Drop', 'easy', 'days', 1, 'Play 1 level (replays count)', 'level', 'levels', '💎'),
  k('diamond-total', 'Claw Champion', 'diamond', 'Diamond Drop', 'easy', 'total', 10, 'Play 10 levels (replays count)', 'level', 'levels', '🦾'),
  k('gemkeep-daily', 'Keeper’s Watch', 'gem-keep', 'Gem Keep', 'easy', 'days', 1, 'Play 1 level (any result)', 'level', 'levels', '🛡️'),
  k('gemkeep-total', 'Wave Breaker', 'gem-keep', 'Gem Keep', 'easy', 'total', 6, 'Play 6 levels', 'level', 'levels', '🌊'),
  k('isles-turns', 'Island Keeper', 'isles', 'Sky Isles', 'easy', 'days', 6, 'Use all 6 turns', 'turn', 'turns', '🏝️'),
  k('isles-races', 'Sky Racer', 'isles', 'Sky Isles', 'easy', 'total', 6, 'Start 6 races (any result)', 'race', 'races', '⛵'),
  k('marble-daily', 'Daily Roll', 'marble', 'Marble Rush', 'easy', 'days', 2, 'Roll 2 runs', 'run', 'runs', '🔵'),
  k('marble-total', 'Marble Marathon', 'marble', 'Marble Rush', 'easy', 'total', 12, 'Roll 12 runs', 'run', 'runs', '🌀'),
  k('mine-daily', 'Daily Dive', 'mine', 'Mine Runner', 'easy', 'days', 2, 'Fly 2 runs', 'run', 'runs', '🔦'),
  k('mine-total', 'Deep Diver', 'mine', 'Mine Runner', 'easy', 'total', 10, 'Fly 10 runs', 'run', 'runs', '💥'),
  k('space-games', 'Launch Day', 'space', 'Wormholes & Black Holes', 'easy', 'days', 1, 'Finish 1 space game (bots or classmates)', 'game', 'games', '🛸'),
  k('space-wormholes', 'Wormhole Rider', 'space', 'Wormholes & Black Holes', 'easy', 'total', 10, 'Ride 10 wormholes', 'wormhole', 'wormholes', '🌌'),
  k('toonflap-daily', 'Daily Flight', 'toonflap', 'Toon Flap', 'easy', 'days', 3, 'Finish 3 runs', 'run', 'runs', '🎈'),
  k('toonflap-total', 'Frequent Flyer', 'toonflap', 'Toon Flap', 'easy', 'total', 15, 'Finish 15 runs', 'run', 'runs', '🪶'),
  k('goblinstorm-daily', 'Daily Storm', 'goblinstorm', 'Goblin Storm', 'easy', 'days', 2, 'Finish 2 runs', 'run', 'runs', '⚔️'),
  k('goblinstorm-total', 'Storm Chaser', 'goblinstorm', 'Goblin Storm', 'easy', 'total', 12, 'Finish 12 runs', 'run', 'runs', '🌪️'),
];

export const questKind = (id: string | null | undefined): QuestKindInfo | undefined => QUEST_KINDS.find((q) => q.id === id);

/** A daily quest (lit days count) or a weekly one (a count to reach). */
export const isDaily = (rule: QuestRule) => rule === 'turns' || rule === 'days';
