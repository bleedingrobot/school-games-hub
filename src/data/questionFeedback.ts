/**
 * "Feedback on this question" (src/maths/questionFeedback.ts): saving a teacher's note on a question, and the tweak list on
 * Admin > Question feedback (migration 20261127052528_maths_question_feedback.sql).
 */
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { setFeedbackSink, type FeedbackItem, type FeedbackTag, type ShownCopy } from '../maths/questionFeedback';
import type { HelpCard } from '../../shared/maths/help/types';
import type { Picture } from '../../shared/maths/pictures/types';
import { FriendlyError } from './profile';

export async function sendFeedback(item: FeedbackItem): Promise<void> {
  const { error } = await supabase.rpc('maths_feedback_add', { item });
  if (error) throw new FriendlyError('We couldn’t save that. Please try again.');
}

/** Teachers get the feedback tab on every question pop-up; pupils don't. Used once, in the app's routes. */
export function useQuestionFeedbackSync(): void {
  const { profile } = useAuth();
  const teacher = profile?.role === 'teacher';
  useEffect(() => {
    setFeedbackSink(teacher ? { send: sendFeedback } : null);
    return () => setFeedbackSink(null);
  }, [teacher]);
}

export type FeedbackStatus = 'open' | 'fixed' | 'skip';

export interface FeedbackNote {
  id: number;
  at: string;
  game: string;
  key: string;
  question: ShownCopy;
  picture: Picture | null;
  help: HelpCard | null;
  feedback: string;
  tags: FeedbackTag[];
  status: FeedbackStatus;
  note: string;
  doneAt: string | null;
  author: string;
  authorEmail: string;
}

export async function fetchFeedback(which: 'open' | 'done' | 'all' = 'open'): Promise<FeedbackNote[]> {
  const { data, error } = await supabase.rpc('maths_feedback_list', { which });
  if (error || !Array.isArray(data)) throw new FriendlyError('We couldn’t load the question feedback.');
  return data as FeedbackNote[];
}

export async function setFeedbackStatus(id: number, status: FeedbackStatus, note = ''): Promise<void> {
  const { error } = await supabase.rpc('maths_feedback_set_status', { feedback_id: id, new_status: status, done_note: note });
  if (error) throw new FriendlyError('We couldn’t save that. Please try again.');
}
