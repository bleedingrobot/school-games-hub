import { describe, expect, it } from 'vitest';
import { movesFromRaw, type RawMovesLeft } from './movesLeft';

const base: RawMovesLeft = { lord: null, clans: null };
const texts = (raw: RawMovesLeft, id: string) => movesFromRaw(raw)[id]?.chips.map((c) => `${c.emoji} ${c.text}`);

describe('Toon Flap and Goblin Storm on the home cards', () => {
  it('shows wins left, and Sky Dashes once Sky Dash is open', () => {
    expect(texts({ ...base, toonflap: null }, 'toonflap')).toEqual(['🏁 10 wins']);
    expect(texts({ ...base, toonflap: { wins: 3, dashes: 1, dashOpen: true } }, 'toonflap')).toEqual(['🏁 7 wins', '☄️ 1 Sky Dash']);
    const done = movesFromRaw({ ...base, toonflap: { wins: 10, dashes: 2, dashOpen: true } }).toonflap;
    expect(done.allDone).toBe(true);
  });

  it('shows Goblin Storm runs left, and Unlimited today when the switch or a bonus day is on', () => {
    expect(texts({ ...base, goblinstorm: { runs: 2 } }, 'goblinstorm')).toEqual(['⚔️ 3 of 5 runs']);
    const lifted = movesFromRaw({ ...base, unlimited: ['goblinstorm', 'toonflap'], goblinstorm: { runs: 5 }, toonflap: { wins: 10, dashes: 0, dashOpen: false } });
    expect(lifted.goblinstorm).toMatchObject({ allDone: false, chips: [{ text: 'Unlimited today' }] });
    expect(lifted.toonflap).toMatchObject({ allDone: false, chips: [{ text: 'Unlimited today' }] });
  });

  it('shows nothing for a database that does not send them yet', () => {
    expect(movesFromRaw(base).toonflap).toBeUndefined();
    expect(movesFromRaw(base).goblinstorm).toBeUndefined();
  });
});
