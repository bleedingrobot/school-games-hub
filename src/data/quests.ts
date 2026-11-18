/**
 * Weekly class quests (docs/CLASS-QUESTS-PLAN.md, migration 20261118000100_class_quests.sql). Everything that counts is
 * worked out on the server; these just read it and send the teacher's start and stop.
 */
import { supabase } from '../lib/supabase';
import type { QuestKind, QuestRule } from '../../shared/quests/kinds';
import type { QuestReward } from '../../shared/quests/rewards';
import { FriendlyError } from './profile';

export interface ClassQuest {
  id: string;
  kind: QuestKind;
  startsOn: string;
  endsOn: string;
  daysNeeded: number;
  /** Missing before stage 2 (then it is a 'turns' quest). */
  rule?: QuestRule;
  /** What finishing gives (quest rewards stage 1). */
  reward?: QuestReward;
}

export interface MyQuest {
  quest: ClassQuest;
  today: string;
  /** The days to light: done days for a daily quest, days played for a weekly one. */
  days: string[];
  /** My count and the target: days for a daily quest, goes (or different things) for a weekly one. */
  count?: number;
  target?: number;
  won: boolean;
  /** My reward from this quest, once won (its id in My rewards). */
  myReward?: string | null;
  /** How many in my class have finished it (a number only). */
  classWon: number;
  /** My quests finished, ever. */
  questsDone: number;
}

export interface TeacherQuestRow {
  id: string;
  kind: QuestKind;
  startsOn: string;
  endsOn: string;
  stoppedAt: string | null;
  reward?: QuestReward;
  won: number;
}

export interface TeacherQuestPupil {
  id: string;
  /** Their count and the target in the shown quest (as MyQuest). */
  count?: number;
  target?: number | null;
  /** One of the class's teachers, playing along (James, 18 Nov 2026). */
  teacher?: boolean;
  /** A teacher's made-up name (pupils' names come from the teacher's own pupil list). */
  name?: string | null;
  days: string[];
  won: boolean;
  questsDone: number;
}

export interface TeacherQuests {
  today: string;
  /** Whether each quest's game is switched on for the class (null: not known). */
  switches: Partial<Record<QuestKind, boolean | null>>;
  quests: TeacherQuestRow[];
  /** The quest the pupils' days are for (the newest, or the one asked for). */
  shown: string | null;
  pupils: TeacherQuestPupil[];
}

function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export async function fetchTeacherQuests(classId: string, which?: string): Promise<TeacherQuests> {
  const { data, error } = await supabase.rpc('teacher_class_quests', { target_class: classId, which: which ?? null });
  if (error || !data) fail(error, 'We couldn’t load the class quests.');
  return data as TeacherQuests;
}

export async function startQuest(classId: string, kind: QuestKind, reward: QuestReward): Promise<void> {
  const { error } = await supabase.rpc('teacher_start_class_quest', { target_class: classId, which: kind, reward });
  if (error) fail(error, 'We couldn’t start the quest.');
}

export async function stopQuest(classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_stop_class_quest', { target_class: classId });
  if (error) fail(error, 'We couldn’t stop the quest.');
}

/** A reward from a class quest, on the profile's My rewards shelf. */
export interface MyQuestReward {
  id: string;
  reward: QuestReward;
  kind: QuestKind;
  gotAt: string;
  /** When it was used (a Rename Scroll: when its name was asked for). Null: still waiting to be used. */
  usedAt: string | null;
  /** A used Hero Title: the title it became. */
  title?: string | null;
  /** A used Bonus Turns Day: the NZ day ('YYYY-MM-DD') it was for. */
  day?: string | null;
}

export async function fetchMyQuestRewards(): Promise<MyQuestReward[]> {
  const { data, error } = await supabase.rpc('my_quest_rewards');
  if (error) fail(error, 'We couldn’t load your rewards.');
  return (data ?? []) as MyQuestReward[];
}

/** Spends a reward. Hero Title: { title: id }. */
export async function spendQuestReward(rewardId: string, choice: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('use_quest_reward', { reward_id: rewardId, choice });
  if (error) fail(error, 'We couldn’t use that reward. Please try again.');
}

export interface MyTitles {
  owned: string[];
  wearing: string | null;
}

export async function fetchMyTitles(): Promise<MyTitles> {
  const { data, error } = await supabase.rpc('my_titles');
  if (error) fail(error, 'We couldn’t load your titles.');
  return (data ?? { owned: [], wearing: null }) as MyTitles;
}

/** Wears one of my titles, or none (null). */
export async function setMyTitle(title: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_my_title', { title });
  if (error) fail(error, 'We couldn’t change your title. Please try again.');
}
