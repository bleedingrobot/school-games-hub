/**
 * Class quest rewards (docs/QUEST-REWARDS-PLAN.md). The teacher picks one when starting a quest; everyone who finishes gets
 * it. The server's quest_reward_fits() mirrors `rewardFit` and has the last word.
 */
import { questKind, type QuestKind } from './kinds';

export type QuestReward = 'scroll' | 'title' | 'turns' | 'frame' | 'coins';

export interface QuestRewardInfo {
  id: QuestReward;
  name: string;
  emoji: string;
  /** What the pupil gets, for the teacher's card and the pupil's reward card. */
  what: string;
  /** False until its stage is built: the card shows "Coming soon". */
  ready: boolean;
}

export const QUEST_REWARDS: QuestRewardInfo[] = [
  { id: 'scroll', name: 'Rename Scroll', emoji: '📜', what: 'A Name Scroll: make up your own name (your teacher says yes).', ready: true },
  { id: 'title', name: 'Hero Title', emoji: '🏷️', what: 'A title to show under your name, like “the Brave”.', ready: true },
  { id: 'turns', name: 'Bonus Turns Day', emoji: '⏳', what: 'One day of unlimited turns in this game, on a day you choose.', ready: true },
  { id: 'frame', name: 'Quest Frame', emoji: '🖼️', what: 'A frame to go around your avatar.', ready: true },
  { id: 'coins', name: 'Game Coins', emoji: '💰', what: 'A pouch of this game’s money, waiting next time you play.', ready: true },
];

export const DEFAULT_REWARD: QuestReward = 'scroll';

export const questReward = (id: string | null | undefined): QuestRewardInfo | undefined => QUEST_REWARDS.find((r) => r.id === id);

/** Games whose daily turns a Bonus Turns Day can lift (the "Unlimited turns today" games). */
const TURNS_GAMES = new Set(['Star Trader', 'Dragon Maths', 'Clan Quest', 'Maths Monsters', 'Diamond Drop', 'Sky Isles', 'Toon Flap', 'Goblin Storm', 'Marble Rush']);
/** Games with money a pupil spends. */
const COINS_GAMES = new Set(['Star Trader', 'Dragon Maths', 'Clan Quest', 'Archery Challenge', 'Diamond Drop', 'Sky Isles']);

/**
 * What a Game Coins pouch holds, by the game id the server stores (quest_coins_game / quest_coins_amount in
 * supabase/migrations/20261119000700_game_coins.sql mirror this). Dragon Maths counts forest wins at the hero's level.
 */
export const COIN_POUCH = {
  trader: { amount: 200, money: 'credits', game: 'Star Trader' },
  'dragon-maths': { amount: 5, money: 'forest wins of gold', game: 'Dragon Maths' },
  'clan-quest': { amount: 150, money: 'gold', game: 'Clan Quest' },
  archery: { amount: 150, money: 'coins', game: 'Archery Challenge' },
  diamond: { amount: 75, money: 'coins', game: 'Diamond Drop' },
  isles: { amount: 75, money: 'coins', game: 'Sky Isles' },
} as const;
export type CoinGame = keyof typeof COIN_POUCH;

/** Whether a reward can go with a quest: null if it can, or the reason it can't (shown on the greyed-out card). */
export function rewardFit(kind: QuestKind | null | undefined, reward: QuestReward): string | null {
  const info = questReward(reward);
  if (!info) return 'There is no reward like that.';
  if (!info.ready) return 'Coming soon';
  const game = questKind(kind)?.game;
  if (!game) return null;
  if (reward === 'turns' && !TURNS_GAMES.has(game)) return `${game} has no daily turns`;
  if (reward === 'coins' && !COINS_GAMES.has(game)) return `${game} has no coins`;
  return null;
}
