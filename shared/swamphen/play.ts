/**
 * The replay of a child's taps on a round (docs/SWAMPHEN-PLAN.md). The browser plays it as the child taps; the server replays
 * the same taps on its own saved round, so nothing that counts comes from the browser.
 *
 * A tap is a card: a total, the shoots in a row, or a which-garden picture's code (`pictureCode`). Planting a row, turning the
 * garden and sharing are what the child does to see the picture; only the card counts. The right card moves on; a wrong one has
 * no penalty and the child tries again. For the maths records each key counts once a round: right if the first tap at its
 * first go was right, with the time to that tap; a go that is a times fact also counts for the plain times-table key.
 * `firstRight` counts every go right at the first tap. It uses the game kit's replay (shared/kit/replay.ts).
 */
import type { FactAnswer } from '../maths/leitner';
import { replayTaps, type TapReplay } from '../kit/replay';
import { GOES_PER_ROUND, mulKeyOf, showRound, type Kind, type Round, type Slip } from './round';

export type { Tap } from '../kit/replay';

export interface Replay extends TapReplay {
  /** The slip behind each go's first tap when it was wrong, in order. */
  slips: Slip[];
  /** Each go's kind and whether its first tap was right, in order (for the help level of each kind). */
  kindGoes: { kind: Kind; right: boolean }[];
}

/** The answers for the maths records: each go's key, then the plain times-table key of it (once each). */
function withTimes(answers: TapReplay['answers']): TapReplay['answers'] {
  const out: TapReplay['answers'] = [];
  const seen = new Set<string>();
  for (const a of answers) {
    out.push(a);
    const mul = mulKeyOf(a.key);
    if (mul && !seen.has(mul)) {
      seen.add(mul);
      out.push({ key: mul, correct: a.correct, ms: a.ms });
    }
  }
  return out;
}

/** Replays a child's taps. A tap that couldn't be made, or one after the end, throws: the browser never sends them. */
export function replay(round: Round, taps: readonly { pick: number; ms: number }[]): Replay {
  const goes = showRound(round);
  const played = replayTaps(goes, taps, { goesPerRound: GOES_PER_ROUND, oncePerFact: true });
  const slips: Slip[] = [];
  const kindGoes: Replay['kindGoes'] = [];
  let at = 0;
  let first = true;
  for (const { pick } of taps) {
    const go = goes[at];
    if (first && pick !== go.answer) {
      const w = go.wrongs.find((x) => x.n === pick);
      if (w) slips.push(w.kind);
    }
    if (first) kindGoes.push({ kind: round.goes[at].kind, right: pick === go.answer });
    first = pick === go.answer;
    if (pick === go.answer) at++;
  }
  return { ...played, answers: withTimes(played.answers), slips, kindGoes };
}

export type { FactAnswer };
