/**
 * Question pictures (docs/plans/help-me/PLAN.md H8; James said yes to all 47 picture ideas, 26 Nov 2026). A picture is
 * worked out in the browser from what the question shows (parts, prompt, choices), like the help cards, and drawn above
 * the question by src/maths/QuestionPicture.tsx. It only ever adds to the question: it shows the numbers in a way a pupil
 * can see (dots, bars, a number line), never the answer itself (no '?' filled in, no answer marked).
 *
 * A question with a figure from its server (shared/maths/figure.ts) keeps that one; a picture is for the rest.
 */
import type { Figure } from '../figure';

/** One colour group of counters. */
export type Shade = 'a' | 'b';

export type Picture =
  /** Five- or ten-frames filled in order: `counts[0]` counters in colour a, then `counts[1]` in colour b. Up to 20 in all. */
  | { kind: 'frames'; size: 5 | 10; counts: number[] }
  /** Rows of dots, one row per number. `fives` leaves a small gap after every 5 dots. */
  | { kind: 'dot-rows'; rows: number[]; fives?: boolean }
  /** A number track: one box per value, '?' boxes drawn highlighted and empty. */
  | { kind: 'track'; cells: string[] }
  /**
   * A number line from `from` to `to` with a tick every `step`; ticks in `labels` get their number. `marks` are points on
   * the line with a short label ('8253', '−3', ''). `words` labels ticks with words instead (chance: impossible…certain).
   */
  | { kind: 'number-line'; from: number; to: number; step: number; labels: number[]; marks?: { at: number; label: string }[]; words?: { at: number; label: string }[] }
  /** A hundred square with the first `shaded` squares shaded (row by row). */
  | { kind: 'hundred'; shaded: number }
  /**
   * Fraction bars, one under another: each cut into `parts` equal parts with the first `shaded` shaded. `label` sits over
   * the whole bar ('35', '$40', '').
   */
  | { kind: 'bars'; bars: { parts: number; shaded: number; label?: string; shade?: Shade }[] }
  /** Whole circles each cut into `parts`, the first `shaded` parts shaded across them all (mixed numbers, ÷ fractions). */
  | { kind: 'wholes'; count: number; parts: number; shaded: number }
  /** An array: `rows` rows of `cols` dots, then `extra` loose dots in colour b (remainders). `groups` rings each row. */
  | { kind: 'array'; rows: number; cols: number; extra?: number; groups?: boolean }
  /** An area box for 2-digit × 1-digit: the top split into `tens` and `ones`, the side `by`. No products written. */
  | { kind: 'split-box'; tens: number; ones: number; by: number }
  /** A place-value chart: `headings` (largest first) and the digits under them ('' for an empty column). */
  | { kind: 'place'; headings: string[]; digits: string[] }
  /** A thermometer from `from` to `to` degrees with a marker at `start`. */
  | { kind: 'thermometer'; from: number; to: number; start: number }
  /** Two clock faces (start and end) with labels under them; an end of null is drawn blank with '?'. */
  | { kind: 'clocks'; start: { hour: number; minute: number; label: string }; end: { hour: number; minute: number; label: string } | null }
  /** A 12-hour clock face with the 24-hour numbers (13-24) in a ring outside. */
  | { kind: 'clock-24' }
  /** A balance: left and right pan labels ('2x + 3', '11'). */
  | { kind: 'balance'; left: string; right: string }
  /** Bar towers, one per value, labelled with the value. */
  | { kind: 'towers'; values: number[] }
  /** A unit ladder: steps from big to small with the ×/÷ between them ('km', '× 1000', 'm', ...), the two asked highlighted. */
  | { kind: 'unit-ladder'; units: string[]; links: string[]; highlight: string[] }
  /** A figure that the server-side figure kinds already draw (angle, compass, grid, clock...). */
  | { kind: 'figure'; figure: Figure };

export type PictureKind = Picture['kind'];

/** What a picture rule can see of a question: what the pupil sees. */
export interface PictureQuestion {
  parts: readonly string[];
  prompt?: string;
  choices?: readonly number[];
  choiceLabels?: readonly string[];
  figure?: unknown;
}

export type PictureRule = (q: PictureQuestion) => Picture | null;
