/**
 * The replay of a child's taps on a round (docs/ROBIN-PLAN.md). The browser plays it as the child taps; the server replays
 * the same taps on its own saved round, so nothing that counts comes from the browser. Built on the kit's `replayTaps`.
 *
 * A tap is the number the child settled on for the current go: how many berries were in the basket when they pressed
 * "That's all", or the card they picked. A "give" go takes any count up to its pile; a card go only one of its cards.
 */
import { replayTaps, type TapReplay, type Tap } from '../kit/replay';
import { GOES_PER_ROUND, showRound, slipOf, tapsAllowed, type Round, type Slip } from './round';

export type { Tap };
export type Replay = TapReplay;

export function replay(round: Round, taps: readonly Tap[]): Replay {
  const goes = showRound(round).map((go) => ({ key: go.key, answer: go.answer, choices: tapsAllowed(go) }));
  return replayTaps(goes, taps, { goesPerRound: GOES_PER_ROUND, oncePerFact: true });
}

/** The slip behind each go's first wrong tap (null for a go right first time): over, under, skip, double and so on, for the teacher's line. */
export function slipsOf(round: Round, taps: readonly Tap[]): (Slip | null)[] {
  const goes = showRound(round);
  const slips: (Slip | null)[] = goes.map(() => null);
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
    if (!tried) slips[at] = slipOf(go, pick);
    tried = true;
  }
  return slips;
}
