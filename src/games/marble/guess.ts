/** "Guess your time" (maths, never saved): within 10% of the real time is a star. */
export const GUESS_TOLERANCE = 0.1;

export function isGoodGuess(guessSeconds: number, realSeconds: number): boolean {
  return Number.isFinite(guessSeconds) && guessSeconds > 0 && realSeconds > 0 && Math.abs(guessSeconds - realSeconds) <= realSeconds * GUESS_TOLERANCE;
}
