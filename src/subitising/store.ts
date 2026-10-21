/** Preview storage for Quick looks: the browser only, wrapped so it still works if storage is blocked. */
import type { StageNumber } from '../../shared/subitising/config';
import { SUBITISING_CONFIG } from '../../shared/subitising/config';
import type { SubAnswer } from '../../shared/subitising/engine';
import { readJson, writeJson } from '../training/store';

export interface SubState {
  /** The answers that count (and help-view ones, marked), oldest first. */
  answers: SubAnswer[];
  /** False until the starting check has been done. */
  placed: boolean;
  startStage: StageNumber;
  /** Pictures never flash: they stay on screen until the student answers. */
  guidedMode: boolean;
  sessionsDone: number;
  /** How many stages, from the first, are finished (kept so a stage finished long ago is never forgotten). */
  finished: 0 | 1 | 2 | 3 | 4;
}

export const emptySubState = (): SubState => ({ answers: [], placed: false, startStage: 1, guidedMode: false, sessionsDone: 0, finished: 0 });

const KEY = 'quick-looks-v1';

export function loadSubState(): SubState {
  const s = readJson<Partial<SubState>>(KEY, {});
  return { ...emptySubState(), ...s, answers: Array.isArray(s.answers) ? s.answers : [] };
}

export function saveSubState(state: SubState): void {
  writeJson(KEY, { ...state, answers: state.answers.slice(-SUBITISING_CONFIG.keepAnswers) });
}
