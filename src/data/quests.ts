/**
 * Weekly class quests (docs/CLASS-QUESTS-PLAN.md, migration 20261118000100_class_quests.sql). Everything that counts is
 * worked out on the server; these just read it and send the teacher's start and stop.
 */
import { supabase } from '../lib/supabase';
import type { QuestKind, QuestRule } from '../../shared/quests/kinds';
import { FriendlyError } from './profile';

export interface ClassQuest {
  id: string;
  kind: QuestKind;
  startsOn: string;
  endsOn: string;
  daysNeeded: number;
  /** Missing before stage 2 (then it is a 'turns' quest). */
  rule?: QuestRule;
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

export async function startQuest(classId: string, kind: QuestKind): Promise<void> {
  const { error } = await supabase.rpc('teacher_start_class_quest', { target_class: classId, which: kind });
  if (error) fail(error, 'We couldn’t start the quest.');
}

/** Stops one running quest (a class can run a daily and a weekly one together). */
export async function stopQuest(classId: string, questId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_stop_class_quest', { target_class: classId, which: questId });
  if (error) fail(error, 'We couldn’t stop the quest.');
}
