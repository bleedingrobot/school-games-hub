/**
 * Balance check for Royal Decree: plays many reigns with simple pretend players and prints how long they last and how
 * they end. Run: npx tsx scripts/decree-sim.ts
 */
import { METERS } from '../shared/decree/config';
import { newReign, nextCard, play, applyEffect, type Reign, type Side } from '../shared/decree/engine';
import { DECK } from '../shared/decree/server';

type Player = (r: Reign, yes: Reign['meters'], no: Reign['meters']) => Side;
const lowest = (m: Reign['meters']) => Math.min(...METERS.map((k) => m[k]));
const players: Record<string, Player> = {
  random: () => (Math.random() < 0.5 ? 'yes' : 'no'),
  'always yes': () => 'yes',
  sensible: (_r, y, n) => (lowest(y) >= lowest(n) ? 'yes' : 'no'),
};

for (const [name, pick] of Object.entries(players)) {
  for (const rightRate of [0, 0.7]) {
    const turns: number[] = [];
    const ends: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      let r: Reign | null = newReign(`sim-${name}-${i}`);
      while (r && r.status === 'playing') {
        const n = nextCard(r, DECK)!;
        if (n.kind === 'riddle') r = play(r, DECK, 'riddle', Math.random() < rightRate);
        else r = play(r, DECK, pick(r, applyEffect(r.meters, n.card.yes.effect), applyEffect(r.meters, n.card.no.effect)));
      }
      turns.push(r!.turn);
      ends[r!.ending ?? '?'] = (ends[r!.ending ?? '?'] ?? 0) + 1;
    }
    turns.sort((a, b) => a - b);
    const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
    console.log(`${name.padEnd(10)} riddles right ${String(rightRate * 100).padStart(2)}%: avg ${avg.toFixed(1)} cards, median ${turns[1000]}, endings ${JSON.stringify(ends)}`);
  }
}
