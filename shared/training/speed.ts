/** Thinking time, speed bands, and a fact's colour. Seconds are never shown to students. */
import { BANDS, TRAINING_CONFIG, type SpeedBand, type TrainingConfig } from './config';

/** Index into BANDS: 0 = "Just know it!" ... 5 = "New to me". */
export type BandIndex = number;
export const NEW_TO_ME: BandIndex = BANDS.length - 1;

export const bandAt = (i: BandIndex): SpeedBand => BANDS[Math.min(Math.max(i, 0), BANDS.length - 1)];
export const bandIndexById = (id: string): BandIndex => BANDS.findIndex((b) => b.id === id);

/** Thinking time = answer time minus how long this child takes to type that many digits. Never below zero. */
export function thinkingMs(answerMs: number, typingMs: number): number {
  return Math.max(0, answerMs - Math.max(0, typingMs));
}

/** Which band a thinking time lands in. An edge belongs to the slower band (1500 ms is "Quick thinking"). */
export function bandIndexForMs(ms: number, bands: readonly SpeedBand[] = BANDS): BandIndex {
  for (let i = 0; i < bands.length; i++) if (ms < bands[i].upToMs) return i;
  return bands.length - 1;
}

export interface Answer {
  correct: boolean;
  /** Thinking time in ms. Null for a wrong answer. */
  thinkMs: number | null;
  /** Local date, "YYYY-MM-DD". */
  day: string;
}

/** One answer's band. A wrong answer counts as "New to me". */
export function answerBandIndex(a: Answer): BandIndex {
  return a.correct && a.thinkMs !== null ? bandIndexForMs(a.thinkMs) : NEW_TO_ME;
}

/**
 * A fact's colour: the middle of its last 3 answers, so one slow (or fast) day doesn't swing it.
 * With only two answers we take the slower of the two; with one, that one. Null before any answer.
 */
export function factBandIndex(answers: readonly Answer[], config: TrainingConfig = TRAINING_CONFIG): BandIndex | null {
  if (answers.length === 0) return null;
  const recent = answers.slice(-config.colourFromLastAnswers).map(answerBandIndex).sort((x, y) => x - y);
  return recent[Math.floor(recent.length / 2)];
}

/** Middle value of a list of numbers (upper middle for an even count). Null for an empty list. */
export function middle(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The most typing time that can be taken off an answer this many digits long. */
export function typingCeilingMs(digits: number, config: TrainingConfig = TRAINING_CONFIG): number {
  const d = Math.min(Math.max(digits, 1), 3);
  return config.typing.ceilingMs[d];
}

/**
 * Typing time for an answer with this many digits: the fastest of the last several checks (a slow check is a child reading or
 * slipping, not typing), and never more than the ceiling.
 */
export function typingMsFor(digits: number, samples: Record<number, number[]>, config: TrainingConfig = TRAINING_CONFIG): number {
  const d = Math.min(Math.max(digits, 1), 3);
  const recent = (samples[d] ?? []).slice(-config.typing.keep);
  const fastest = recent.length ? Math.min(...recent) : config.typing.defaultMs[d];
  return Math.min(fastest, typingCeilingMs(d, config));
}
