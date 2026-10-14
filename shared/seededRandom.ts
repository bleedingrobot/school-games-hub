/** A tiny repeatable random number generator, so "random" test games are the same every run. */
export function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}
