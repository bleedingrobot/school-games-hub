/**
 * "Feedback on this question" (James, 26 Nov 2026): a tab on the left of the question pop-up, the mirror of the scribble
 * pad, where a teacher writes what is wrong with a question or its Help me. Each note keeps a copy of what the pop-up
 * showed (the question, its picture, the Help me card and which help box it had), so the note still makes sense after the
 * question or help is changed. School admins read them as a tweak list on Admin > Question feedback.
 *
 * The box doesn't talk to the database itself: the website sets the sink for teachers (src/data/questionFeedback.ts). In
 * tests, previews and for pupils nothing is set, so the tab isn't shown.
 */
import { useSyncExternalStore } from 'react';
import type { HelpCard } from '../../shared/maths/help/types';
import type { Picture } from '../../shared/maths/pictures/types';

export type FeedbackTag = 'question' | 'help' | 'picture' | 'other';
export const FEEDBACK_TAGS: readonly { tag: FeedbackTag; label: string }[] = [
  { tag: 'question', label: 'The question' },
  { tag: 'help', label: 'Help me' },
  { tag: 'picture', label: 'The picture' },
  { tag: 'other', label: 'Something else' },
];

/** What the pop-up showed, saved with the note. */
export interface ShownCopy {
  title: string;
  parts: readonly string[];
  prompt?: string;
  spoken?: string;
  choices?: readonly number[];
  choiceLabels?: readonly string[];
  figure?: unknown;
  /** The game's answer, when the box knew it. */
  answer?: number;
  /** The extra help box shown with Help me ('angles', 'units'...), if any. */
  helpBox?: string;
  skill?: string;
}

export interface FeedbackItem {
  feedback: string;
  tags: FeedbackTag[];
  /** Where it was: the page (e.g. "#/games/gems") and the box's kind ("Pit stop"). */
  game: string;
  key: string;
  question: ShownCopy;
  picture: Picture | null;
  /** Every Help me card shown, best first (older notes hold just one card). */
  help: HelpCard[] | HelpCard | null;
}

export interface FeedbackSink {
  send: (item: FeedbackItem) => Promise<void>;
}

let sink: FeedbackSink | null = null;
const watchers = new Set<() => void>();

export function setFeedbackSink(next: FeedbackSink | null): void {
  if (next === sink) return;
  sink = next;
  watchers.forEach((w) => w());
}

/** The sink, or null when this person can't leave feedback (pupils, signed out, tests). */
export function useFeedbackSink(): FeedbackSink | null {
  return useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => watchers.delete(watcher);
    },
    () => sink,
    () => sink,
  );
}
