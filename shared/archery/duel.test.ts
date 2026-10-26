import { describe, expect, it } from 'vitest';
import { chooseForRun } from './bot';
import { PASS, duelScores, duelSetup, readTurns, replayDuel } from './duel';
import { startFight, takeShot } from './fight';
import type { PlayerSetup, Shot } from './types';

const packs: [PlayerSetup, PlayerSetup] = [
  { quiver: { steel: 2, apple: 1 }, shield: 'wood', bow: 'long' },
  { quiver: { giant: 1 }, shield: null, bow: 'starter' },
];

/** Plays a whole classmate fight with two Hard bots taking each other's seat (and some turns used up). */
function wholeFight(seed: number, passEvery = 0) {
  const setup = duelSetup('desert', packs);
  const run = startFight(seed, setup);
  const turns: Shot[] = [];
  while (run.winner === null) {
    const shot = passEvery && turns.length % passEvery === passEvery - 1 ? PASS : chooseForRun(run, 'hard').shot;
    expect(takeShot(run, shot).problem).toBeNull();
    turns.push(shot);
  }
  return { setup, run, turns };
}

describe('classmate fights', () => {
  it('replay the same from the turn list, used-up turns and all', () => {
    const { setup, run, turns } = wholeFight(7, 5);
    expect(turns.some((t) => t.pass)).toBe(true);
    const again = replayDuel(7, setup, readTurns(JSON.parse(JSON.stringify(turns)))!);
    expect(again.problem).toBeNull();
    expect(again.run.winner).toBe(run.winner);
    expect(again.run.used).toEqual(run.used);
    expect(again.run.round.archers).toEqual(run.round.archers);
    expect(duelScores(again.run)).toEqual(duelScores(run));
  });
});
