import { describe, expect, it } from 'vitest';
import { CARDS, RIDDLES } from './cards';
import { CAST } from './cast';
import { CARDS_IN_REIGN, METER_MOST, METERS } from './config';
import { newReign, nextCard, play, playAll, pointsFor, type Move, type Reign } from './engine';
import { DECK } from './server';

// Royal Decree's rules: 2 tests here, 3 for the server (supabase/functions/decree), 2 for the screens. 7 in all.

describe('Royal Decree rules', () => {
  it('the deck is sound: every villager exists, every story can start, every effect is small', () => {
    const ids = new Set(CAST.map((v) => v.id));
    const flags = new Set(CARDS.flatMap((c) => [c.no.sets, c.yes.sets]).filter(Boolean));
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) {
      expect(ids.has(c.who), c.id).toBe(true);
      if (c.needs) expect(flags.has(c.needs), c.id).toBe(true);
      for (const side of [c.no, c.yes]) for (const v of Object.values(side.effect)) expect(Math.abs(v!)).toBeLessThanOrEqual(3);
    }
    for (const r of RIDDLES) expect(ids.has(r.who)).toBe(true);
  });

  it('a reign is the same every time from its seed, meters stay 0 to 10, and it ends by 24 cards', () => {
    const run = (seed: string) => {
      let r: Reign | null = newReign(seed);
      const moves: Move[] = [];
      while (r && r.status === 'playing') {
        const n = nextCard(r, DECK)!;
        const move: Move = n.kind === 'riddle' ? 'riddle' : r.turn % 2 ? 'yes' : 'no';
        moves.push(move);
        r = play(r, DECK, move, true);
        for (const m of METERS) {
          expect(r!.meters[m]).toBeGreaterThanOrEqual(0);
          expect(r!.meters[m]).toBeLessThanOrEqual(METER_MOST);
        }
      }
      return { r: r!, moves };
    };
    // The first visitor brings a request, so a riddle move there is refused.
    expect(play(newReign('x'), DECK, 'riddle')).toBeNull();
    for (const seed of ['a', 'b', 'c', 'd']) {
      const { r, moves } = run(seed);
      expect(r.turn).toBeLessThanOrEqual(CARDS_IN_REIGN);
      expect(playAll(newReign(seed), DECK, moves, () => true)).toEqual(r);
      expect(pointsFor(r)).toBeGreaterThanOrEqual(1);
    }
  });
});
