/** Test helper: a player who can see every card and clears the board in the fewest flips. */
import { partnersOf } from './deck';
import { flip, type GameState } from './engine';

/** The flip list of a perfect game: each card, then its partner. */
export function perfectFlips(state: GameState): number[] {
  const partners = partnersOf(state.deck);
  const done = new Set<number>();
  const flips: number[] = [];
  state.deck.cards.forEach((_, i) => {
    if (done.has(i)) return;
    const j = partners[i].find((k) => !done.has(k))!;
    flips.push(i, j);
    done.add(i);
    done.add(j);
  });
  return flips;
}

/** Plays flips one by one; throws if any is refused. */
export function play(state: GameState, flips: readonly number[]): GameState {
  return flips.reduce((s, i) => {
    const r = flip(s, i);
    if (r.refused) throw new Error(`flip ${i} refused: ${r.refused}`);
    return r.state;
  }, state);
}
