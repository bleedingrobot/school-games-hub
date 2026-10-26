import { describe, expect, it } from 'vitest';
import { ENEMIES, MANA, STEP } from './config';
import { act, newGame, spawnEnemy, step, type GameState } from './engine';
import type { LevelData } from './level';

/** A straight path along row 5, left to right, with the Keep at the end. */
const STRAIGHT: LevelData = {
  id: 'test',
  name: 'Test',
  map: Array(10).fill('................'),
  paths: [[[-1, 5], [15, 5]]],
  startMana: 1000,
  waves: [{ groups: [{ kind: 'walker', count: 1, gap: 0 }] }, { groups: [{ kind: 'walker', count: 1, gap: 0 }] }],
};

/** A game mid-wave with nothing spawning, so tests can place enemies themselves. */
function inWave(level = STRAIGHT): GameState {
  const state = newGame(level);
  act(state, { type: 'start-wave' });
  state.spawns.length = 0;
  return state;
}

function runSeconds(state: GameState, seconds: number) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(state);
}

describe('towers', () => {
  it('a tower with a gem shoots and kills, and the kill pays mana', () => {
    const state = inWave();
    act(state, { type: 'build', x: 5, y: 4 });
    act(state, { type: 'create', colour: 'red' });
    act(state, { type: 'place', slot: 0, x: 5, y: 4 });
    const mana = state.mana;
    spawnEnemy(state, 'swarm', 0, 4);
    runSeconds(state, 2);
    expect(state.stats.kills).toBe(1);
    expect(state.mana).toBe(mana + ENEMIES.swarm.mana + MANA.waveClear);
    expect(state.events.some((e) => e.type === 'shot')).toBe(true);
  });
});
