/** How a Quick looks answer becomes a Training answer to save (shared/training/save.ts then checks it again on the server). */
import { helpedKey } from '../../shared/subitising/keys';
import type { QuickSettings } from '../../shared/subitising/saved';
import type { AnswerEvent } from '../../shared/training/save';
import type { QuickAnswerEvent } from './SubitisingApp';
import type { SubState } from './store';

/**
 * An answer given with the picture on screen after a struggle is saved under its own "helped" key, so it
 * never counts towards a stage. Nothing is typed and nothing is timed: a tap answer saves no speed at all.
 */
export const toTrainingAnswer = (a: QuickAnswerEvent): AnswerEvent => ({
  key: a.helped ? helpedKey(a.key) : a.key,
  given: a.given,
  ms: 0,
  typingMs: 0,
  at: a.at,
  day: a.day,
  seed: a.seed,
});

/** The settings that follow the student, from the screen's state. */
export const settingsOf = (s: SubState): QuickSettings => ({ placed: s.placed, startStage: s.startStage, finished: s.finished, guided: s.guidedMode });
