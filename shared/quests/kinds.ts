/**
 * The kinds of weekly class quest (docs/CLASS-QUESTS-PLAN.md). Each must match a row in public.quest_kinds and a watcher on
 * its game's own table (migration 20261118000100_class_quests.sql). A new kind = an entry here, a row, a watcher, a painting.
 */
export type QuestKind = 'trader' | 'lord' | 'clans';

export interface QuestKindInfo {
  id: QuestKind;
  /** The quest's name, shown on the bar and the teacher's card. */
  name: string;
  /** The game's home card id (its address and its "moves left" chip). */
  card: string;
  /** The game's name. */
  game: string;
  /** What a pupil must do each day, as a command. */
  daily: string;
  /** One turn's name, for "6 jumps left today". */
  turn: { one: string; many: string };
  /** What lights a done day-stone. */
  spark: string;
}

export const DAYS_IN_QUEST = 7;
export const DAYS_NEEDED = 5;

export const QUEST_KINDS: QuestKindInfo[] = [
  { id: 'trader', name: 'Every Jump', card: 'trader', game: 'Star Trader', daily: 'Use all your jumps', turn: { one: 'jump', many: 'jumps' }, spark: '🚀' },
  { id: 'lord', name: 'Forest Hunter', card: 'dragon-maths', game: 'Dragon Maths', daily: 'Use all your forest fights', turn: { one: 'forest fight', many: 'forest fights' }, spark: '🔥' },
  { id: 'clans', name: 'Mine Raider', card: 'clan-quest', game: 'Clan Quest', daily: 'Use all your mine fights', turn: { one: 'mine fight', many: 'mine fights' }, spark: '⛏️' },
];

export const questKind = (id: string | null | undefined): QuestKindInfo | undefined => QUEST_KINDS.find((k) => k.id === id);
