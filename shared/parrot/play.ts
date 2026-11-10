/**
 * The replay of a child's taps on a round (docs/PARROT-PLAN.md). The browser plays it as the child taps; the server replays
 * the same taps on its own saved round, so nothing that counts comes from the browser. Built on the kit's `replayTaps`.
 *
 * A tap is the number picked for the current go: a card, or the count of stones the child checked. On a stone-go the
 * cards are not shown, so any count up to 20 is allowed; on a card go the pick must be one of its cards.
 */
import { firstTapTimes, replayTaps, type TapReplay, type Tap } from '../kit/replay';
import { JUNIOR_MIN_THINK_MS, thoughtOf } from '../juniorQuick';
import { GOES_PER_ROUND, showRound, slipOfPick, tapsAllowed, type Round } from './round';

export type { Tap };
export type Replay = TapReplay;

export function replay(round: Round, taps: readonly Tap[]): Replay {
  const goes = showRound(round).map((go) => ({ key: go.key, answer: go.answer, choices: tapsAllowed(go) }));
  return replayTaps(goes, taps, { goesPerRound: GOES_PER_ROUND, oncePerFact: true, minThinkMs: JUNIOR_MIN_THINK_MS });
}

/** The kind of slip behind each go's first wrong tap (null for a go right first time), for the teacher's line. */
export function slipsOf(round: Round, taps: readonly Tap[]): (import('./round').ParrotKind | null)[] {
  const goes = showRound(round);
  const slips: (import('./round').ParrotKind | null)[] = goes.map(() => null);
  let at = 0;
  let tried = false;
  for (const { pick } of taps) {
    const go = goes[at];
    if (!go) break;
    if (pick === go.answer) {
      at++;
      tried = false;
      continue;
    }
    if (!tried) slips[at] = slipOfPick(go, pick) ?? 'near';
    tried = true;
  }
  return slips;
}

/** Whether each go was right at the first tap and not too fast to be a thought (S14), for the help of each kind. Slips are unchanged. */
export function rightFirstOf(round: Round, taps: readonly Tap[]): boolean[] {
  const slips = slipsOf(round, taps);
  const times = firstTapTimes(showRound(round), taps);
  return slips.map((s, i) => s === null && times[i] !== undefined && thoughtOf(times[i]!));
}
