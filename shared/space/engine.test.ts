import { describe, expect, it } from 'vitest';
import type { Board, Square } from './board';
import { DEFAULT_SETTINGS, newGame, play, type Settings, type SpaceAction, type SpaceState } from './engine';
import type { ItemKind } from './items';
import { fixedDice } from './random';

function testBoard(squares: Record<number, Square>, extra: Partial<Board> = {}): Board {
  return { id: 'test', name: 'Test', size: 100, squares, comet: null, missionRounds: 40, cosmicEvents: false, ...extra };
}

function start(board: Board, players = 2, settings: Partial<Settings> = {}): SpaceState {
  return newGame(board, { ...DEFAULT_SETTINGS, ...settings }, players).state;
}

/** A copy of the state with rockets moved and given items, for setting up a test. */
function setUp(state: SpaceState, positions: number[], items: ItemKind[][] = []): SpaceState {
  const s = structuredClone(state);
  positions.forEach((p, i) => (s.rockets[i].position = p));
  items.forEach((list, i) => (s.rockets[i].items = [...list]));
  return s;
}

function run(state: SpaceState, action: SpaceAction, dice: number[] = []) {
  return play(state, action, fixedDice(dice));
}

const roll: SpaceAction = { kind: 'roll' };

describe('moving', () => {
  it('any roll that reaches the last square docks and ends the game', () => {
    const s = setUp(start(testBoard({}), 3), [97, 50, 60]);
    const { state, events } = run(s, roll, [6]);
    expect(state.rockets[0].position).toBe(100);
    expect(state.phase).toBe('over');
    expect(state.ending).toBe('docked');
    expect(state.places).toEqual([1, 3, 2]);
    expect(events.at(-1)).toEqual({ kind: 'game-over', ending: 'docked', places: [1, 3, 2] });
  });
});

describe('wormholes and black holes', () => {
  it('a wormhole carries you up and a black hole pulls you down', () => {
    const up = run(start(testBoard({ 5: { kind: 'wormhole', to: 30 } })), roll, [4]);
    expect(up.state.rockets[0].position).toBe(30);
    expect(up.events).toContainEqual({ kind: 'wormhole', seat: 0, from: 5, to: 30 });
    const s = setUp(start(testBoard({ 40: { kind: 'black-hole', to: 12 } })), [36, 1]);
    const down = run(s, roll, [4]);
    expect(down.state.rockets[0].position).toBe(12);
    expect(down.events).toContainEqual({ kind: 'black-hole', seat: 0, from: 40, to: 12 });
  });
});
