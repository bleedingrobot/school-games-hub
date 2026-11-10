/**
 * Game kit: the replay of a child's taps (docs/plans/GAME-KIT-PLAN.md). The browser plays it as the child taps; the server
 * replays the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * Each tap picks a number for the current go. The right one moves on; a wrong one has no penalty and the child tries again.
 * For the maths records only the first tap of a go counts, with the time to that tap.
 */
import type { FactAnswer } from '../maths/leitner';

/** One number picked: its value and how long the child took over it. */
export interface Tap {
  pick: number;
  ms: number;
}

/** What the replay needs to know about a go. */
export interface ReplayGo {
  key: string;
  answer: number;
  choices: readonly number[];
}

export interface TapReplay {
  goesDone: number;
  mistakes: number;
  /** Goes right at the first tap: what decides a good or hard round (shared/kit/help.ts). */
  firstRight: number;
  done: boolean;
  /** The answers for the maths records, in order. */
  answers: Omit<FactAnswer, 'at'>[];
}

export interface ReplayRules {
  goesPerRound: number;
  /** True: a fact asked a second time in a round is practice only. False: every go counts. */
  oncePerFact: boolean;
  /** A right first tap faster than this is still an answer but not a "first right" (S14). Left out: no floor. */
  minThinkMs?: number;
}

/** Replays a child's taps. A tap on a number that isn't one of the go's choices, or after the end, throws: the browser never sends them. */
export function replayTaps(goes: readonly ReplayGo[], taps: readonly Tap[], rules: ReplayRules): TapReplay {
  const answers: TapReplay['answers'] = [];
  const counted = new Set<string>();
  let goesDone = 0;
  let mistakes = 0;
  let firstRight = 0;
  let triedThisGo = false;
  for (const { pick, ms } of taps) {
    const go = goes[goesDone];
    if (!go) throw new Error('Taps after the round was done');
    if (!go.choices.includes(pick)) throw new Error(`${pick} isn't a choice on go ${goesDone}`);
    const right = pick === go.answer;
    if (!triedThisGo) {
      if (right && (rules.minThinkMs === undefined || ms >= rules.minThinkMs)) firstRight++;
      if (!rules.oncePerFact || !counted.has(go.key)) answers.push({ key: go.key, correct: right, ms });
      counted.add(go.key);
    }
    triedThisGo = true;
    if (right) {
      goesDone++;
      triedThisGo = false;
    } else mistakes++;
  }
  return { goesDone, mistakes, firstRight, done: goesDone === goes.length && goes.length === rules.goesPerRound, answers };
}

/**
 * The time of the first tap of each go (undefined for a go not reached), so a game that works out "right first time"
 * for each go itself can apply the same think floor as `firstRight` (S14).
 */
export function firstTapTimes(goes: readonly { answer: number }[], taps: readonly Tap[]): (number | undefined)[] {
  const times: (number | undefined)[] = goes.map(() => undefined);
  let at = 0;
  let tried = false;
  for (const { pick, ms } of taps) {
    const go = goes[at];
    if (!go) break;
    if (!tried) times[at] = ms;
    if (pick === go.answer) {
      at++;
      tried = false;
    } else tried = true;
  }
  return times;
}
