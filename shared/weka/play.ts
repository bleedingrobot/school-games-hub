/**
 * The replay of a child's taps on a round (docs/WEKA-PLAN.md section 3). The browser plays it as the child taps; the
 * server replays the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * Each tap is a number picked for the current go (the stone where Weka lands). The first step of a full-help go ("how
 * many hops to the big rock?") is help only: the browser never sends it. The right number moves on; a wrong one wobbles
 * back, with no penalty, and the child tries again. For the maths records each fact counts once a
 * round: right if the first pick at its first go was right, with the time to that pick. A fact asked a second time in the
 * same round is practice only.
 */
import { replayTaps, type Tap as KitTap, type TapReplay } from '../kit/replay';
import { JUNIOR_MIN_THINK_MS } from '../juniorQuick';
import { GOES_PER_ROUND, showRound, type LandKind, type Round } from './round';
import { slipsOf as kitSlipsOf } from '../kit/slips';

/** One number picked: its value and how long the child took over it. */
export type Tap = KitTap;
export type Replay = TapReplay;

/** Replays a child's taps. A tap on a number that isn't one of the go's choices, or after the end, stops the replay: the browser never sends them. */
export const replay = (round: Round, taps: readonly Tap[]): Replay =>
  replayTaps(showRound(round), taps, { goesPerRound: GOES_PER_ROUND, oncePerFact: true, minThinkMs: JUNIOR_MIN_THINK_MS });

/** The kind of slip behind each go's first wrong tap (null for a go right first time), saved for the teacher's "usual slip" line (LEARNING-DESIGN rule 9). */
export const slipsOf = (round: Round, taps: readonly Tap[]): (LandKind | null)[] =>
  kitSlipsOf(
    showRound(round).map((go) => ({ answer: go.answer, kindOf: (pick: number): LandKind | null => go.wrongs.find((w) => w.n === pick)?.kind ?? null })),
    taps,
  );
