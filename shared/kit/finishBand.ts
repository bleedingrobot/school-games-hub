/** How a finished round went, for the one honest line on a finish screen (S15). No game words in here. See src/kit/README.md. */
import { ROUND_OF_TEN } from './help';

export type FinishBand = 'most' | 'some' | 'tricky';

/**
 * Most right (8 or more of 10 at the first tap), tricky today (4 or fewer), or some right in between: the same cut-offs the
 * help ladder uses (`ROUND_OF_TEN`), scaled if a round is not ten goes.
 */
export function finishBand(firstRight: number, goes = 10): FinishBand {
  const per10 = goes === 10 ? firstRight : (firstRight * 10) / goes;
  if (per10 >= ROUND_OF_TEN.good) return 'most';
  if (per10 <= ROUND_OF_TEN.hard) return 'tricky';
  return 'some';
}
