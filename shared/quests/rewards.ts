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
  { id: 'title', name: 'Hero Title', emoji: '🏷️', what: 'A title to show under your name, like “the Brave”.', ready: false },
  { id: 'turns', name: 'Bonus Turns Day', emoji: '⏳', what: 'One day of unlimited turns in this game, on a day you choose.', ready: false },
  { id: 'frame', name: 'Quest Frame', emoji: '🖼️', what: 'A painted frame around your avatar.', ready: false },
  { id: 'coins', name: 'Game Coins', emoji: '💰', what: 'A pouch of this game’s money.', ready: false },
];

export const DEFAULT_REWARD: QuestReward = 'scroll';

export const questReward = (id: string | null | undefined): QuestRewardInfo | undefined => QUEST_REWARDS.find((r) => r.id === id);

/** Games whose daily turns a Bonus Turns Day can lift (the "Unlimited turns today" games). */
const TURNS_GAMES = new Set(['Star Trader', 'Dragon Maths', 'Clan Quest', 'Maths Monsters', 'Diamond Drop', 'Sky Isles']);
/** Games with money a pupil spends. */
const COINS_GAMES = new Set(['Star Trader', 'Dragon Maths', 'Clan Quest', 'Archery Challenge', 'Diamond Drop', 'Sky Isles']);

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
