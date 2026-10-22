import { describe, expect, it } from 'vitest';
import type { Board, Square } from './board';
import {
  canCharge,
  DEFAULT_SETTINGS,
  FUEL_WARNING_ROUNDS,
  KEEP_ITEMS,
  MINE_ROUNDS,
  missionRounds,
  newGame,
  placesFor,
  play,
  SpaceRuleError,
  usableItems,
  MATHS_CHARGE_STEPS,
  validTargets,
  type Settings,
  type SpaceAction,
  type SpaceEvent,
  type SpaceState,
} from './engine';
import type { ItemKind } from './items';
import { fixedDice, seededDice } from './random';

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
const kinds = (events: SpaceEvent[]) => events.map((e) => e.kind);

describe('starting a game', () => {
  it('puts every rocket on square 1, first seat to play', () => {
    const { state, events } = newGame(testBoard({}), DEFAULT_SETTINGS, 4);
    expect(state.rockets.map((r) => r.position)).toEqual([1, 1, 1, 1]);
    expect(state.turn).toBe(0);
    expect(state.round).toBe(1);
    expect(kinds(events)).toEqual(['round-start', 'turn-start']);
  });

  it('needs 2 to 4 rockets', () => {
    expect(() => newGame(testBoard({}), DEFAULT_SETTINGS, 1)).toThrow(SpaceRuleError);
    expect(() => newGame(testBoard({}), DEFAULT_SETTINGS, 5)).toThrow(SpaceRuleError);
  });

  it('classic mode keeps only the wormholes and black holes', () => {
    const board = testBoard(
      { 5: { kind: 'wormhole', to: 20 }, 30: { kind: 'black-hole', to: 10 }, 8: { kind: 'star', star: 'red-dwarf' }, 12: { kind: 'mystery' } },
      { comet: { head: 40, length: 5, speed: 3 }, cosmicEvents: true },
    );
    const s = start(board, 2, { mode: 'classic', cosmicEvents: true });
    expect(Object.keys(s.board.squares)).toEqual(['5', '30']);
    expect(s.comet).toBeNull();
    expect(s.settings.cosmicEvents).toBe(false);
  });
});

describe('moving', () => {
  it('moves by the roll and passes the turn on', () => {
    const { state, events } = run(start(testBoard({})), roll, [4]);
    expect(state.rockets[0].position).toBe(5);
    expect(state.turn).toBe(1);
    expect(events).toContainEqual({ kind: 'move', seat: 0, from: 1, to: 5, cause: 'roll' });
    expect(events.at(-1)).toEqual({ kind: 'turn-start', seat: 1, round: 1 });
  });

  it('starts a new round after the last seat', () => {
    let s = start(testBoard({}), 2);
    s = run(s, roll, [1]).state;
    const { state, events } = run(s, roll, [1]);
    expect(state.round).toBe(2);
    expect(state.turn).toBe(0);
    expect(kinds(events)).toContain('round-start');
  });

  it('any roll that reaches the last square docks and ends the game', () => {
    const s = setUp(start(testBoard({}), 3), [97, 50, 60]);
    const { state, events } = run(s, roll, [6]);
    expect(state.rockets[0].position).toBe(100);
    expect(state.phase).toBe('over');
    expect(state.ending).toBe('docked');
    expect(state.places).toEqual([1, 3, 2]);
    expect(events.at(-1)).toEqual({ kind: 'game-over', ending: 'docked', places: [1, 3, 2] });
  });

  it('with "exact roll", overshooting bounces back', () => {
    const s = setUp(start(testBoard({}), 2, { finish: 'exact' }), [97, 1]);
    const { state, events } = run(s, roll, [5]);
    expect(state.rockets[0].position).toBe(98);
    expect(events).toContainEqual({ kind: 'move', seat: 0, from: 97, to: 98, cause: 'bounce', bounced: true });
    expect(state.phase).toBe('ready');
  });

  it("won't take an action after the game is over", () => {
    const s = setUp(start(testBoard({}), 2), [99, 1]);
    const over = run(s, roll, [3]).state;
    expect(() => run(over, roll, [3])).toThrow('This game is over.');
  });

  it("never changes the state it's given", () => {
    const s = start(testBoard({ 5: { kind: 'wormhole', to: 30 } }));
    const copy = structuredClone(s);
    run(s, roll, [4]);
    expect(s).toEqual(copy);
  });

  it('places share a place on a tie', () => {
    const s = setUp(start(testBoard({}), 4), [50, 70, 50, 20]);
    expect(placesFor(s)).toEqual([2, 1, 2, 4]);
  });
});

describe('wormholes and black holes', () => {
  it('a wormhole carries you up', () => {
    const { state, events } = run(start(testBoard({ 5: { kind: 'wormhole', to: 30 } })), roll, [4]);
    expect(state.rockets[0].position).toBe(30);
    expect(events).toContainEqual({ kind: 'wormhole', seat: 0, from: 5, to: 30 });
  });

  it('a black hole pulls you down', () => {
    const s = setUp(start(testBoard({ 40: { kind: 'black-hole', to: 12 } })), [36, 1]);
    const { state, events } = run(s, roll, [4]);
    expect(state.rockets[0].position).toBe(12);
    expect(events).toContainEqual({ kind: 'black-hole', seat: 0, from: 40, to: 12 });
  });

  it('a Force Field blocks one black hole, and is used up', () => {
    const s = setUp(start(testBoard({ 40: { kind: 'black-hole', to: 12 } })), [36, 1], [['force-field', 'escape-pod']]);
    const { state, events } = run(s, roll, [4]);
    expect(state.rockets[0].position).toBe(40);
    expect(state.rockets[0].items).toEqual(['escape-pod']);
    expect(events).toContainEqual({ kind: 'force-field', seat: 0, square: 40 });
  });

  it('an Escape Pod halves the drop, always losing at least 1 square', () => {
    const board = testBoard({ 40: { kind: 'black-hole', to: 12 }, 20: { kind: 'black-hole', to: 19 } });
    const half = run(setUp(start(board), [36, 1], [['escape-pod']]), roll, [4]).state;
    expect(half.rockets[0].position).toBe(26); // 28 down, halved to 14
    expect(half.rockets[0].items).toEqual([]);
    const one = run(setUp(start(board), [16, 1], [['escape-pod']]), roll, [4]).state;
    expect(one.rockets[0].position).toBe(19);
  });
});

describe('chain reactions', () => {
  it('stop after 3 squares have acted in one move', () => {
    // 5 → wormhole 10, 10 → wormhole 20, 20 → wormhole 30, 30 → wormhole 40 (never reached)
    const board = testBoard({
      5: { kind: 'wormhole', to: 10 }, 10: { kind: 'wormhole', to: 20 },
      20: { kind: 'wormhole', to: 30 }, 30: { kind: 'wormhole', to: 40 },
    });
    const { state, events } = run(start(board), roll, [4]);
    expect(state.rockets[0].position).toBe(30);
    expect(events).toContainEqual({ kind: 'chain-cap', seat: 0, square: 30 });
    expect(events.filter((e) => e.kind === 'wormhole')).toHaveLength(3);
  });

  it('even a loop of squares always finishes', () => {
    const board = testBoard({ 5: { kind: 'wormhole', to: 10 }, 10: { kind: 'black-hole', to: 5 } });
    const { state } = run(start(board), roll, [4]);
    expect([5, 10]).toContain(state.rockets[0].position);
    expect(state.turn).toBe(1);
  });
});

describe('star squares', () => {
  const starAt = (star: Square & { kind: 'star' }) => testBoard({ 5: star });

  it('a red dwarf gives a common item (and a better one to the rocket in last place)', () => {
    // Seat 1 is ahead, so seat 0 isn't last: common tier, 12 weight in all; 1 = Booster.
    let s = setUp(start(starAt({ kind: 'star', star: 'red-dwarf' })), [1, 20]);
    let result = run(s, roll, [4, 1]);
    expect(result.state.rockets[0].items).toEqual(['booster']);
    expect(result.events).toContainEqual({ kind: 'item-gained', seat: 0, item: 'booster', from: 'star' });
    // Seat 0 is still behind after landing: "random" tier (18 in all), and 18 = Quantum Swap.
    s = setUp(start(starAt({ kind: 'star', star: 'red-dwarf' })), [1, 7]);
    result = run(s, roll, [4, 18]);
    expect(result.state.rockets[0].items).toEqual(['quantum-swap']);
  });

  it('a blue giant gives a rare item; a white dwarf gives a Force Field', () => {
    const blue = run(start(starAt({ kind: 'star', star: 'blue-giant' })), roll, [4, 2]).state;
    expect(blue.rockets[0].items).toEqual(['navigator']);
    const white = run(start(starAt({ kind: 'star', star: 'white-dwarf' })), roll, [4]).state;
    expect(white.rockets[0].items).toEqual(['force-field']);
  });

  it('a binary star lets you roll two dice next turn and pick one', () => {
    let s = run(start(starAt({ kind: 'star', star: 'binary-star' })), roll, [4]).state;
    expect(s.rockets[0].binary).toBe(true);
    s = run(s, roll, [1]).state; // seat 1
    const two = run(s, roll, [2, 6]);
    expect(two.state.phase).toBe('choice');
    expect(two.state.pending).toEqual({ kind: 'binary', dice: [2, 6] });
    const picked = run(two.state, { kind: 'choose', option: 1 }).state;
    expect(picked.rockets[0].position).toBe(11);
    expect(picked.rockets[0].binary).toBe(false);
  });

  it('a neutron star halves your next 2 rolls, rounded up', () => {
    let s = run(start(starAt({ kind: 'star', star: 'neutron-star' })), roll, [4]).state;
    expect(s.rockets[0].gravity).toEqual({ kind: 'heavy', rolls: 2 });
    s = run(s, roll, [1]).state;
    s = run(s, roll, [5]).state; // 5 → 3
    expect(s.rockets[0].position).toBe(8);
    s = run(s, roll, [1]).state;
    s = run(s, roll, [1]).state; // 1 → 1, never 0
    expect(s.rockets[0].position).toBe(9);
    expect(s.rockets[0].gravity).toBeNull();
  });

  it('a pulsar pushes every other rocket within 5 squares (either way) back 2, never below 1', () => {
    const board = testBoard({ 30: { kind: 'star', star: 'pulsar' } });
    const s = setUp(start(board, 4), [26, 35, 25, 36]);
    const { state } = run(s, roll, [4]);
    expect(state.rockets.map((r) => r.position)).toEqual([30, 33, 23, 36]);
    const low = setUp(start(testBoard({ 5: { kind: 'star', star: 'pulsar' } }), 2), [1, 2]);
    expect(run(low, roll, [4]).state.rockets[1].position).toBe(1);
  });

  it('a supernova blasts you forward 5, pushes rockets within 10 back 2, then becomes a nebula', () => {
    const board = testBoard({ 30: { kind: 'star', star: 'supernova' } });
    const s = setUp(start(board, 3), [26, 39, 41]);
    const { state, events } = run(s, roll, [4]);
    expect(state.rockets.map((r) => r.position)).toEqual([35, 37, 41]);
    expect(state.board.squares[30]).toEqual({ kind: 'nebula' });
    expect(kinds(events)).toContain('supernova-spent');
    // Landing on it again does nothing.
    const again = run({ ...setUp(state, [26, 37, 41]), turn: 0 }, roll, [4]);
    expect(again.state.rockets[0].position).toBe(30);
  });

  it('Matariki gives everyone a common item', () => {
    const board = testBoard({ 5: { kind: 'star', star: 'matariki' } });
    const s = setUp(start(board, 3), [1, 10, 20]);
    const { state } = run(s, roll, [4, 1, 4, 6]); // seat 1 booster, seat 2 force field, seat 0 escape pod
    expect(state.rockets.map((r) => r.items)).toEqual([['escape-pod'], ['booster'], ['force-field']]);
  });

  it('with pockets full, you choose to swap one out or keep what you have', () => {
    const board = testBoard({ 5: { kind: 'star', star: 'blue-giant' } });
    const full: ItemKind[] = ['booster', 'space-mine', 'repair-kit'];
    const asked = run(setUp(start(board), [1, 1], [full]), roll, [4, 1]);
    expect(asked.state.pending).toEqual({ kind: 'inventory', item: 'hyperdrive' });
    expect(() => run(asked.state, roll)).toThrow('Make your choice first.');
    const swapped = run(asked.state, { kind: 'choose', option: 1 }).state;
    expect(swapped.rockets[0].items).toEqual(['booster', 'hyperdrive', 'repair-kit']);
    expect(swapped.turn).toBe(1);
    const kept = run(asked.state, { kind: 'choose', option: KEEP_ITEMS }).state;
    expect(kept.rockets[0].items).toEqual(full);
    const timedOut = run(asked.state, { kind: 'timeout' }).state;
    expect(timedOut.rockets[0].items).toEqual(full);
  });
});

describe('gravity squares', () => {
  it('low gravity: +2 on the next 2 rolls; slingshot: next roll doubled; a new one replaces the old', () => {
    const board = testBoard({ 5: { kind: 'gravity', gravity: 'low' }, 12: { kind: 'gravity', gravity: 'slingshot' } });
    let s = run(start(board), roll, [4]).state;
    expect(s.rockets[0].gravity).toEqual({ kind: 'low', rolls: 2 });
    s = run(s, roll, [1]).state;
    s = run(s, roll, [5]).state; // 5 + 2 = 7 → square 12, slingshot replaces low gravity
    expect(s.rockets[0].position).toBe(12);
    expect(s.rockets[0].gravity).toEqual({ kind: 'slingshot', rolls: 1 });
    s = run(s, roll, [1]).state;
    s = run(s, roll, [3]).state; // doubled
    expect(s.rockets[0].position).toBe(18);
    expect(s.rockets[0].gravity).toBeNull();
  });
});

describe('items', () => {
  const empty = () => start(testBoard({}), 3);

  it('Booster +2, Hyperdrive doubles, Navigator picks the number', () => {
    const boost = run(run(setUp(empty(), [1, 1, 1], [['booster']]), { kind: 'use-item', item: 'booster' }).state, roll, [3]);
    expect(boost.state.rockets[0].position).toBe(6);
    expect(boost.events).toContainEqual({ kind: 'roll', seat: 0, die: 3, steps: 5, changes: ['booster'] });
    const hyper = run(run(setUp(empty(), [1, 1, 1], [['hyperdrive']]), { kind: 'use-item', item: 'hyperdrive' }).state, roll, [3]);
    expect(hyper.state.rockets[0].position).toBe(7);
    const nav = run(setUp(empty(), [1, 1, 1], [['navigator']]), { kind: 'use-item', item: 'navigator', value: 5 }).state;
    const navRoll = run(nav, roll); // no dice needed
    expect(navRoll.state.rockets[0].position).toBe(6);
    expect(() => run(setUp(empty(), [1, 1, 1], [['navigator']]), { kind: 'use-item', item: 'navigator', value: 7 })).toThrow('1 to 6');
  });

  it('one item a turn, only before rolling, only ones you hold, never automatic ones', () => {
    const s = setUp(empty(), [1, 1, 1], [['booster', 'booster', 'force-field']]);
    const used = run(s, { kind: 'use-item', item: 'booster' }).state;
    expect(() => run(used, { kind: 'use-item', item: 'booster' })).toThrow('one item a turn');
    expect(() => run(s, { kind: 'use-item', item: 'hyperdrive' })).toThrow("don't have");
    expect(() => run(s, { kind: 'use-item', item: 'force-field' })).toThrow('by itself');
    expect(usableItems(s)).toEqual(['booster']);
  });

  it('Repair Kit clears gravity and an anchor, and only works when there is something to fix', () => {
    const s = setUp(empty(), [1, 1, 1], [['repair-kit']]);
    expect(() => run(s, { kind: 'use-item', item: 'repair-kit' })).toThrow('Nothing to repair');
    s.rockets[0].gravity = { kind: 'heavy', rolls: 2 };
    s.rockets[0].anchored = true;
    const fixed = run(s, { kind: 'use-item', item: 'repair-kit' }).state;
    expect(fixed.rockets[0].gravity).toBeNull();
    expect(fixed.rockets[0].anchored).toBe(false);
  });

  it('Warp Key jumps to the nearest wormhole ahead and rides it, then you still roll', () => {
    const board = testBoard({ 3: { kind: 'wormhole', to: 8 }, 20: { kind: 'wormhole', to: 45 }, 30: { kind: 'wormhole', to: 60 } });
    const s = setUp(start(board), [10, 1], [['warp-key']]);
    const warped = run(s, { kind: 'use-item', item: 'warp-key' });
    expect(warped.state.rockets[0].position).toBe(45);
    expect(warped.state.turn).toBe(0);
    expect(warped.state.phase).toBe('ready');
    expect(run(warped.state, roll, [2]).state.rockets[0].position).toBe(47);
    expect(() => run(setUp(start(board), [40, 1], [['warp-key']]), { kind: 'use-item', item: 'warp-key' })).toThrow('No wormholes ahead');
  });

  it('Tractor Beam pulls a rocket back 3, which is then shielded until its next turn', () => {
    const s = setUp(empty(), [10, 30, 5], [['tractor-beam', 'tractor-beam']]);
    const pulled = run(s, { kind: 'use-item', item: 'tractor-beam', target: 1 });
    expect(pulled.state.rockets[1].position).toBe(27);
    expect(pulled.state.rockets[1].shielded).toBe(true);
    expect(pulled.events).toContainEqual({ kind: 'pushed', seat: 1, from: 30, to: 27, by: 'tractor-beam', source: 0 });
    // Shield wears off when it's that rocket's turn.
    const next = run(pulled.state, roll, [1]).state;
    expect(next.turn).toBe(1);
    expect(next.rockets[1].shielded).toBe(false);
  });

  it("hinders can't target the rocket in last place, a shielded rocket, or the same rocket twice in a row", () => {
    const s = setUp(empty(), [10, 30, 5], [['tractor-beam']]);
    expect(validTargets(s, 'tractor-beam')).toEqual([1]); // seat 2 is last
    expect(() => run(s, { kind: 'use-item', item: 'tractor-beam', target: 2 })).toThrow("can't aim");
    s.rockets[0].lastTarget = 1;
    expect(validTargets(s, 'tractor-beam')).toEqual([]);
    expect(usableItems(s)).toEqual([]);
    s.rockets[0].lastTarget = null;
    s.rockets[1].shielded = true;
    expect(validTargets(s, 'tractor-beam')).toEqual([]);
  });

  it('Gravity Anchor halves the target’s next roll', () => {
    let s = setUp(empty(), [10, 30, 5], [['gravity-anchor']]);
    s = run(s, { kind: 'use-item', item: 'gravity-anchor', target: 1 }).state;
    s = run(s, roll, [1]).state;
    s = run(s, roll, [5]).state; // seat 1: 5 → 3
    expect(s.rockets[1].position).toBe(33);
    expect(s.rockets[1].anchored).toBe(false);
  });

  it('Quantum Swap: a rocket up to 15 ahead, never one on square 90 or higher', () => {
    const s = setUp(empty(), [20, 34, 5], [['quantum-swap']]);
    const swapped = run(s, { kind: 'use-item', item: 'quantum-swap', target: 1 }).state;
    expect(swapped.rockets.map((r) => r.position)).toEqual([34, 20, 5]);
    expect(validTargets(setUp(s, [20, 36, 5]), 'quantum-swap')).toEqual([]);
    expect(validTargets(setUp(s, [80, 90, 5]), 'quantum-swap')).toEqual([]);
    expect(validTargets(setUp(s, [80, 89, 5]), 'quantum-swap')).toEqual([1]);
  });

  it('Space Mine: the next other rocket to land there goes back 3; your own mine is harmless', () => {
    let s = setUp(empty(), [10, 6, 1], [['space-mine']]);
    s = run(s, { kind: 'use-item', item: 'space-mine' }).state;
    expect(s.mines).toEqual([{ square: 10, owner: 0, round: 1 }]);
    s = run(s, roll, [2]).state; // seat 0 moves off to 12
    const hit = run(s, roll, [4]); // seat 1 lands on 10
    expect(hit.state.rockets[1].position).toBe(7);
    expect(hit.state.mines).toEqual([]);
    expect(hit.events).toContainEqual({ kind: 'pushed', seat: 1, from: 10, to: 7, by: 'space-mine', source: 0 });
  });

  it('only one mine each, and mines fizzle out after 5 rounds', () => {
    let s = setUp(empty(), [10, 2, 3], [['space-mine', 'space-mine']]);
    s = run(s, { kind: 'use-item', item: 'space-mine' }).state;
    s = run(s, roll, [1]).state;
    s = run(s, roll, [1]).state;
    s = run(s, roll, [1]).state;
    expect(s.turn).toBe(0);
    expect(() => run(s, { kind: 'use-item', item: 'space-mine' })).toThrow('already have a mine');
    let fizzled: SpaceEvent[] = [];
    for (let i = 0; i < 3 * MINE_ROUNDS && s.mines.length > 0; i++) {
      const result = run(s, roll, [1]);
      s = result.state;
      fizzled = result.events;
    }
    expect(s.round).toBe(1 + MINE_ROUNDS);
    expect(fizzled).toContainEqual({ kind: 'mine-fizzled', owner: 0, square: 10 });
  });

  it('a Rescue Beacon is sent to the rocket in last place when 30+ behind, and jumps 10', () => {
    let s = setUp(start(testBoard({}), 2), [60, 25]);
    const result = run(s, roll, [1]);
    expect(result.events).toContainEqual({ kind: 'item-gained', seat: 1, item: 'rescue-beacon', from: 'rescue' });
    s = run(result.state, { kind: 'use-item', item: 'rescue-beacon' }).state;
    expect(s.rockets[1].position).toBe(35);
    // Not again for a while.
    s = run(s, roll, [1]).state;
    const later = run(s, roll, [1]);
    expect(kinds(later.events)).not.toContain('item-gained');
  });

  it('classic mode never sends a Rescue Beacon', () => {
    const s = setUp(start(testBoard({}), 2, { mode: 'classic' }), [60, 25]);
    expect(kinds(run(s, roll, [1]).events)).not.toContain('item-gained');
  });
});

describe('teleports', () => {
  const board = testBoard({ 5: { kind: 'gate', twin: 20 }, 20: { kind: 'gate', twin: 5 }, 30: { kind: 'mystery' } });

  it('a gate asks: jump to its twin, or stay. Time running out means stay', () => {
    const asked = run(start(board), roll, [4]);
    expect(asked.state.pending).toEqual({ kind: 'gate', square: 5, twin: 20 });
    expect(asked.state.turn).toBe(0);
    const jumped = run(asked.state, { kind: 'choose', option: 1 }).state;
    expect(jumped.rockets[0].position).toBe(20);
    expect(jumped.turn).toBe(1);
    const stayed = run(asked.state, { kind: 'timeout' }).state;
    expect(stayed.rockets[0].position).toBe(5);
    expect(() => run(asked.state, { kind: 'choose', option: 2 })).toThrow('one of the choices');
  });

  it('the mystery station draws where it sends you only after the card is picked', () => {
    const asked = run(setUp(start(board), [26, 1]), roll, [4]);
    expect(asked.state.pending).toEqual({ kind: 'mystery', square: 30 });
    // Nothing about the destination is in the state yet.
    expect(JSON.stringify(asked.state)).not.toContain('offset');
    const result = run(asked.state, { kind: 'choose', option: 2 }, [3]); // weight 3 = +5
    expect(result.state.rockets[0].position).toBe(35);
    expect(result.events).toContainEqual({ kind: 'mystery', seat: 0, card: 2, from: 30, to: 35 });
  });
});

describe('the comet', () => {
  it('land on its tail to ride to its head; it moves every round and wraps round', () => {
    const board = testBoard({}, { comet: { head: 20, length: 5, speed: 3 } });
    const ride = run(start(board), roll, [6]); // square 7 isn't on it (16–19 is the tail)
    expect(ride.state.rockets[0].position).toBe(7);
    const onTail = run(setUp(start(board), [12, 1]), roll, [5]);
    expect(onTail.state.rockets[0].position).toBe(20);
    expect(onTail.events).toContainEqual({ kind: 'comet', seat: 0, from: 17, to: 20 });
    let s = run(start(board), roll, [1]).state;
    const round2 = run(s, roll, [1]);
    expect(round2.state.comet!.head).toBe(23);
    s = structuredClone(round2.state);
    s.comet!.head = 98;
    s = run(run(s, roll, [1]).state, roll, [1]).state;
    expect(s.comet!.head).toBe(7); // 98 + 3 wraps past 99 to the start (lowest head is 6)
  });
});

describe('the mission clock', () => {
  it('warns 5 rounds before, then ends the game with places by how far everyone got', () => {
    const board = testBoard({}, { missionRounds: 10 });
    let s = start(board, 4);
    expect(missionRounds(s)).toBe(10);
    expect(missionRounds(start(board, 2))).toBe(20); // fewer rockets get more rounds
    const all: SpaceEvent[] = [];
    while (s.phase !== 'over') {
      const result = run(s, roll, [s.turn + 1]);
      s = result.state;
      all.push(...result.events);
    }
    expect(all).toContainEqual({ kind: 'fuel-warning', roundsLeft: FUEL_WARNING_ROUNDS });
    expect(s.ending).toBe('mission-clock');
    expect(s.round).toBe(10);
    expect(s.places).toEqual([4, 3, 2, 1]);
  });
});

describe('settings', () => {
  it('roll again on a 6, at most once a turn', () => {
    let s = start(testBoard({}), 2, { rollAgainOnSix: true });
    const six = run(s, roll, [6]);
    expect(six.state.turn).toBe(0);
    expect(kinds(six.events)).toContain('roll-again');
    s = run(six.state, roll, [6]).state;
    expect(s.turn).toBe(1);
    expect(s.rockets[0].position).toBe(13);
  });

  it('a Navigator 6 is not a rolled 6', () => {
    const s = setUp(start(testBoard({}), 2, { rollAgainOnSix: true }), [1, 1], [['navigator']]);
    const nav = run(run(s, { kind: 'use-item', item: 'navigator', value: 6 }).state, roll).state;
    expect(nav.turn).toBe(1);
  });
});

describe('cosmic events', () => {
  const board = testBoard({ 10: { kind: 'wormhole', to: 40 }, 50: { kind: 'star', star: 'red-dwarf' } }, { cosmicEvents: true });

  /** Plays rounds 1–5 so the next roll starts round 6 (a cosmic event round). */
  function toRoundSix(): SpaceState {
    let s = start(board, 2, { cosmicEvents: true });
    for (let i = 0; i < 9; i++) s = run(s, roll, [1]).state;
    return s;
  }

  it('solar wind gives everyone +1 on their next roll', () => {
    const { state, events } = run(toRoundSix(), roll, [1, 1]);
    expect(events).toContainEqual({ kind: 'cosmic', event: 'solar-wind' });
    expect(state.rockets.every((r) => r.solarWind)).toBe(true);
    expect(run(state, roll, [2]).state.rockets[0].position).toBe(state.rockets[0].position + 3);
  });

  it('a meteor shower makes 5 empty squares into asteroids for one round', () => {
    const { state } = run(toRoundSix(), roll, [1, 2, 1, 1, 1, 1, 1]);
    expect(state.asteroids).toHaveLength(5);
    for (const n of state.asteroids) expect(state.board.squares[n]).toBeUndefined();
  });

  it('a wormhole shift moves a wormhole exit up to 5 squares onto a plain square', () => {
    const { state, events } = run(toRoundSix(), roll, [1, 3, 1, 1]);
    const shift = events.find((e) => e.kind === 'cosmic')!;
    expect(shift).toMatchObject({ event: 'wormhole-shift', wormhole: 10, from: 40 });
    const to = (state.board.squares[10] as { to: number }).to;
    expect(Math.abs(to - 40)).toBeLessThanOrEqual(5);
    expect(to).not.toBe(40);
  });
});

describe('repeatable', () => {
  it('the same dice always give the same game', () => {
    const playOut = () => {
      const dice = seededDice('same');
      let s = start(testBoard({ 5: { kind: 'wormhole', to: 30 }, 50: { kind: 'black-hole', to: 9 } }), 3);
      const all: SpaceEvent[] = [];
      while (s.phase !== 'over') {
        const result = play(s, roll, dice);
        s = result.state;
        all.push(...result.events);
      }
      return all;
    };
    expect(playOut()).toEqual(playOut());
  });

  it('state survives being saved as JSON', () => {
    let s = start(testBoard({ 5: { kind: 'wormhole', to: 30 } }, { comet: { head: 40, length: 5, speed: 3 } }), 2);
    s = run(s, roll, [4]).state;
    const reloaded = JSON.parse(JSON.stringify(s)) as SpaceState;
    expect(run(reloaded, roll, [3])).toEqual(run(s, roll, [3]));
  });
});

describe('Mission Control maths', () => {
  const choose = (option: number): SpaceAction => ({ kind: 'choose', option });
  const board = testBoard({ 10: { kind: 'wormhole', to: 30 }, 50: { kind: 'black-hole', to: 20 } });
  const maths = (positions: number[], items: ItemKind[][] = []) => setUp(start(board, 2, { maths: true }), positions, items);

  it('asks at a wormhole: right flies 3 further, wrong flies as normal', () => {
    const asked = run(maths([7, 1]), roll, [3]).state;
    expect(asked.pending).toEqual({ kind: 'question', square: 10 });
    expect(run(asked, choose(1)).state.rockets[0].position).toBe(33);
    expect(run(asked, choose(0)).state.rockets[0].position).toBe(30);
  });

  it('asks at a black hole: right falls half as far, wrong falls all the way', () => {
    const asked = run(maths([47, 1]), roll, [3]).state;
    expect(asked.pending).toEqual({ kind: 'question', square: 50, moment: 'black-hole' });
    const right = run(asked, choose(1));
    expect(right.state.rockets[0].position).toBe(35);
    expect(right.events).toContainEqual({ kind: 'question', seat: 0, correct: true, from: 50, to: 35, moment: 'black-hole' });
    expect(run(asked, choose(0)).state.rockets[0].position).toBe(20);
  });

  it('a wrong answer still lets an Escape Pod work, and a right one keeps the pod', () => {
    const asked = run(maths([47, 1], [['escape-pod']]), roll, [3]).state;
    const wrong = run(asked, choose(0)).state;
    expect(wrong.rockets[0].position).toBe(35);
    expect(wrong.rockets[0].items).toEqual([]);
    expect(run(asked, choose(1)).state.rockets[0].items).toEqual(['escape-pod']);
  });

  it('a Force Field blocks the black hole with no question', () => {
    const { state } = run(maths([47, 1], [['force-field']]), roll, [3]);
    expect(state.pending).toBeNull();
    expect(state.rockets[0].position).toBe(50);
  });

  it('a timeout counts as wrong', () => {
    const asked = run(maths([47, 1]), roll, [3]).state;
    expect(run(asked, { kind: 'timeout' }).state.rockets[0].position).toBe(20);
  });

  it('the charge answer: not on a first turn, once a turn, right adds MATHS_CHARGE_STEPS to the roll, wrong changes nothing', () => {
    let s = start(board, 2, { maths: true });
    // Nobody has played yet, so there's nothing to answer.
    expect(canCharge(s)).toBe(false);
    expect(() => run(s, { kind: 'charge', right: true })).toThrow(SpaceRuleError);
    s = run(s, roll, [1]).state; // seat 0 plays, seat 1's first turn
    expect(() => run(s, { kind: 'charge', right: true })).toThrow(SpaceRuleError);
    s = run(s, roll, [1]).state; // seat 1 plays, seat 0's second turn
    expect(s.turn).toBe(0);
    expect(canCharge(s)).toBe(true);
    const right = run(s, { kind: 'charge', right: true });
    expect(right.events).toEqual([{ kind: 'charge', seat: 0, right: true }]);
    expect(canCharge(right.state)).toBe(false);
    expect(() => run(right.state, { kind: 'charge', right: true })).toThrow(SpaceRuleError);
    const rolled = run(right.state, roll, [2]);
    expect(rolled.events).toContainEqual(expect.objectContaining({ kind: 'roll', die: 2, steps: 2 + MATHS_CHARGE_STEPS, changes: ['maths-charge'] }));
    // Wrong: recorded, nothing else; the roll is normal.
    const wrong = run(s, { kind: 'charge', right: false }).state;
    expect(wrong.turnInfo.mathsCharge).toBeFalsy();
    expect(run(wrong, roll, [2]).events).toContainEqual(expect.objectContaining({ kind: 'roll', steps: 2, changes: [] }));
    // Skipped: just roll.
    expect(run(s, roll, [2]).events).toContainEqual(expect.objectContaining({ kind: 'roll', steps: 2 }));
    // The charge is used up by the roll and doesn't carry over to the next player.
    expect(rolled.state.turnInfo.mathsCharge).toBeFalsy();
  });

  it('the charge goes with a roll-again on a 6 only once', () => {
    let s = start(board, 2, { maths: true, rollAgainOnSix: true });
    s = run(s, roll, [2]).state; // (not 1: the charged six would land on the wormhole at 10)
    s = run(s, roll, [1]).state;
    s = run(s, { kind: 'charge', right: true }).state;
    const six = run(s, roll, [6]);
    expect(six.events).toContainEqual(expect.objectContaining({ kind: 'roll', steps: 6 + MATHS_CHARGE_STEPS }));
    expect(six.state.turn).toBe(0);
    expect(() => run(six.state, { kind: 'charge', right: true })).toThrow(SpaceRuleError);
    expect(run(six.state, roll, [2]).events).toContainEqual(expect.objectContaining({ kind: 'roll', steps: 2 }));
  });

  it('with maths off nothing is asked and there is no boost (games exactly as before)', () => {
    const s = setUp(start(board, 2), [47, 1]);
    expect(s.rockets[0].hasPlayed).toBeUndefined();
    expect(run(s, roll, [3]).state.rockets[0].position).toBe(20);
    const played = run(run(s, roll, [1]).state, roll, [1]).state;
    expect(canCharge(played)).toBe(false);
    expect(() => run(played, { kind: 'charge', right: true })).toThrow(SpaceRuleError);
  });
});
