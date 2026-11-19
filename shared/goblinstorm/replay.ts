/**
 * Sending and checking a Goblin Storm run (docs/GOBLINSTORM-PLAN.md, "Replay"). The browser keeps one steering
 * direction per played step (paused steps aren't steps) and the card index picked at each level-up. Steering is sent
 * run-length encoded: "4x120,16x30" is direction 4 for 120 steps, then still for 30.
 *
 * The server knows how many cards each level-up earned (from its own marks), replays the run with the shared engine
 * and keeps only what the replay says.
 */
import { CHOICES, QUESTIONS_PER_RUN, RUN_STEPS } from './config';
import { applyPick, makeOffer, newRun, stepRun, summary, waiting, type RunSetup, type RunState, type RunSummary } from './engine';
import { STILL } from './trig';

export function encodeSteering(dirs: readonly number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < dirs.length) {
    let j = i;
    while (j < dirs.length && dirs[j] === dirs[i]) j++;
    parts.push(`${dirs[i]}x${j - i}`);
    i = j;
  }
  return parts.join(',');
}

/** The steering list, or null if the text isn't a run's steering (bad numbers, or longer than a whole run). */
export function decodeSteering(text: string): number[] | null {
  if (text === '') return [];
  if (text.length > 200_000) return null;
  const out: number[] = [];
  for (const part of text.split(',')) {
    const m = /^(\d{1,2})x(\d{1,5})$/.exec(part);
    if (!m) return null;
    const dir = Number(m[1]);
    const n = Number(m[2]);
    if (dir > STILL || n < 1 || out.length + n > RUN_STEPS) return null;
    for (let k = 0; k < n; k++) out.push(dir);
  }
  return out;
}

/** How many cards a level-up gets from its mark: null (no question asked: past the last one) counts as right. */
export function choicesFor(mark: 'wrong' | 'right' | 'quick' | null): number {
  return mark === null ? CHOICES.right : CHOICES[mark];
}

export interface ReplayInput {
  setup: RunSetup;
  steering: readonly number[];
  picks: readonly number[];
  /** Cards earned at each level-up, from the server's marks (slot i = level-up i). */
  choices: readonly number[];
}

export interface Replay {
  valid: boolean;
  state: RunState;
  summary: RunSummary;
}

/**
 * Plays the steering and picks through the engine. Valid only if every pick fits its offer, the picks run out exactly
 * when the level-ups do, and the steering ends exactly when the run did (or the pupil quit part way, in which case
 * the outcome is 'quit').
 */
export function replayRun(input: ReplayInput): Replay {
  const s = newRun(input.setup);
  let step = 0;
  let pick = 0;
  let valid = true;
  while (s.outcome === 'running') {
    if (waiting(s)) {
      if (pick >= input.picks.length) break;
      const slot = s.levelUps;
      makeOffer(s, slot < QUESTIONS_PER_RUN ? input.choices[slot] ?? CHOICES.wrong : CHOICES.right);
      if (!applyPick(s, input.picks[pick++])) { valid = false; break; }
      continue;
    }
    if (step >= input.steering.length) break;
    stepRun(s, input.steering[step++]);
  }
  if (step !== input.steering.length || pick !== input.picks.length) valid = false;
  if (s.outcome === 'running') s.outcome = 'quit';
  return { valid, state: s, summary: summary(s) };
}
