/**
 * The four designed boards, and how a game picks its board (designed, or a Random Galaxy).
 *
 * These were first drafted by the Random Galaxy generator (with a recipe for each board's
 * feel), tuned with the simulation, then a few stars were changed by hand. They're fixed
 * data now, so changing the generator can never change them. Saved games name a board by
 * its id, so don't change a board once it's live: add a new one instead.
 *
 * - Inner Solar System: gentle. More wormholes, short black holes, only helpful stars.
 * - Nebula: balanced, with a pair of gates and the mystery station.
 * - Deep Space: chaotic. Long wormholes and black holes, the comet, a pulsar, a supernova,
 *   and cosmic events on.
 * - Asteroid Belt: the 50-square quick game.
 */
import type { Board, BoardSize } from './board';
import { galaxyBoard } from './galaxy';

export type DesignedBoardId = 'inner-solar-system' | 'nebula' | 'deep-space' | 'asteroid-belt';
export const DESIGNED_BOARD_IDS: readonly DesignedBoardId[] = ['inner-solar-system', 'nebula', 'deep-space', 'asteroid-belt'];

export type BoardChoice = { id: DesignedBoardId } | { galaxy: string; size: BoardSize };

export const DESIGNED_BOARDS: Record<DesignedBoardId, Board> = {
  'inner-solar-system': {
    id: 'inner-solar-system',
    name: 'Inner Solar System',
    size: 100,
    missionRounds: 40,
    cosmicEvents: false,
    comet: null,
    squares: {
      3: { kind: 'wormhole', to: 27 },
      8: { kind: 'star', star: 'yellow-star' },
      12: { kind: 'star', star: 'red-dwarf' },
      18: { kind: 'wormhole', to: 37 },
      21: { kind: 'wormhole', to: 41 },
      23: { kind: 'wormhole', to: 33 },
      28: { kind: 'black-hole', to: 20 },
      31: { kind: 'black-hole', to: 17 },
      36: { kind: 'black-hole', to: 25 },
      40: { kind: 'star', star: 'red-dwarf' },
      44: { kind: 'wormhole', to: 57 },
      48: { kind: 'gravity', gravity: 'heavy' },
      50: { kind: 'wormhole', to: 73 },
      56: { kind: 'star', star: 'blue-giant' },
      59: { kind: 'wormhole', to: 82 },
      62: { kind: 'black-hole', to: 52 },
      64: { kind: 'star', star: 'binary-star' },
      66: { kind: 'wormhole', to: 80 },
      70: { kind: 'star', star: 'matariki' },
      72: { kind: 'wormhole', to: 96 },
      75: { kind: 'star', star: 'red-dwarf' },
      77: { kind: 'star', star: 'white-dwarf' },
      79: { kind: 'star', star: 'red-dwarf' },
      81: { kind: 'gravity', gravity: 'slingshot' },
      83: { kind: 'gravity', gravity: 'low' },
      91: { kind: 'gravity', gravity: 'low' },
      93: { kind: 'star', star: 'yellow-star' },
      95: { kind: 'black-hole', to: 84 },
      99: { kind: 'black-hole', to: 89 },
    },
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    size: 100,
    missionRounds: 40,
    cosmicEvents: false,
    comet: null,
    squares: {
      6: { kind: 'gravity', gravity: 'slingshot' },
      9: { kind: 'star', star: 'white-dwarf' },
      13: { kind: 'gravity', gravity: 'heavy' },
      20: { kind: 'star', star: 'red-dwarf' },
      23: { kind: 'wormhole', to: 41 },
      25: { kind: 'star', star: 'yellow-star' },
      30: { kind: 'star', star: 'blue-giant' },
      33: { kind: 'star', star: 'red-dwarf' },
      35: { kind: 'black-hole', to: 15 },
      37: { kind: 'star', star: 'neutron-star' },
      39: { kind: 'black-hole', to: 10 },
      42: { kind: 'black-hole', to: 17 },
      44: { kind: 'wormhole', to: 69 },
      47: { kind: 'black-hole', to: 38 },
      49: { kind: 'wormhole', to: 63 },
      51: { kind: 'wormhole', to: 65 },
      53: { kind: 'gravity', gravity: 'heavy' },
      57: { kind: 'black-hole', to: 34 },
      61: { kind: 'black-hole', to: 48 },
      64: { kind: 'gate', twin: 82 },
      66: { kind: 'wormhole', to: 84 },
      68: { kind: 'wormhole', to: 96 },
      70: { kind: 'wormhole', to: 95 },
      73: { kind: 'mystery' },
      78: { kind: 'wormhole', to: 93 },
      80: { kind: 'black-hole', to: 55 },
      82: { kind: 'gate', twin: 64 },
      85: { kind: 'star', star: 'yellow-star' },
      87: { kind: 'star', star: 'matariki' },
      89: { kind: 'black-hole', to: 63 },
      91: { kind: 'gravity', gravity: 'low' },
      94: { kind: 'star', star: 'binary-star' },
      97: { kind: 'star', star: 'white-dwarf' },
    },
  },
  'deep-space': {
    id: 'deep-space',
    name: 'Deep Space',
    size: 100,
    missionRounds: 45,
    cosmicEvents: true,
    comet: { head: 33, length: 5, speed: 3 },
    squares: {
      4: { kind: 'wormhole', to: 32 },
      6: { kind: 'wormhole', to: 24 },
      9: { kind: 'wormhole', to: 30 },
      11: { kind: 'star', star: 'neutron-star' },
      13: { kind: 'star', star: 'binary-star' },
      16: { kind: 'wormhole', to: 32 },
      18: { kind: 'wormhole', to: 53 },
      21: { kind: 'black-hole', to: 7 },
      25: { kind: 'star', star: 'red-dwarf' },
      29: { kind: 'black-hole', to: 17 },
      31: { kind: 'star', star: 'red-dwarf' },
      33: { kind: 'wormhole', to: 69 },
      37: { kind: 'black-hole', to: 10 },
      44: { kind: 'wormhole', to: 68 },
      48: { kind: 'wormhole', to: 75 },
      51: { kind: 'black-hole', to: 26 },
      57: { kind: 'star', star: 'matariki' },
      59: { kind: 'mystery' },
      62: { kind: 'star', star: 'blue-giant' },
      64: { kind: 'star', star: 'pulsar' },
      66: { kind: 'gravity', gravity: 'low' },
      70: { kind: 'star', star: 'yellow-star' },
      72: { kind: 'black-hole', to: 43 },
      74: { kind: 'gravity', gravity: 'slingshot' },
      78: { kind: 'black-hole', to: 58 },
      80: { kind: 'star', star: 'white-dwarf' },
      82: { kind: 'gravity', gravity: 'heavy' },
      85: { kind: 'gravity', gravity: 'heavy' },
      87: { kind: 'gate', twin: 95 },
      90: { kind: 'black-hole', to: 61 },
      93: { kind: 'star', star: 'supernova' },
      95: { kind: 'gate', twin: 87 },
      99: { kind: 'black-hole', to: 84 },
    },
  },
  'asteroid-belt': {
    id: 'asteroid-belt',
    name: 'Asteroid Belt',
    size: 50,
    missionRounds: 25,
    cosmicEvents: false,
    comet: null,
    squares: {
      5: { kind: 'gravity', gravity: 'heavy' },
      7: { kind: 'wormhole', to: 14 },
      9: { kind: 'star', star: 'white-dwarf' },
      12: { kind: 'gravity', gravity: 'low' },
      15: { kind: 'wormhole', to: 23 },
      18: { kind: 'black-hole', to: 10 },
      21: { kind: 'black-hole', to: 11 },
      24: { kind: 'star', star: 'yellow-star' },
      27: { kind: 'black-hole', to: 19 },
      30: { kind: 'wormhole', to: 40 },
      33: { kind: 'gate', twin: 45 },
      35: { kind: 'wormhole', to: 46 },
      37: { kind: 'star', star: 'binary-star' },
      39: { kind: 'star', star: 'yellow-star' },
      42: { kind: 'star', star: 'red-dwarf' },
      45: { kind: 'gate', twin: 33 },
      48: { kind: 'black-hole', to: 38 },
    },
  },
};

export function isDesignedBoardId(value: unknown): value is DesignedBoardId {
  return DESIGNED_BOARD_IDS.includes(value as DesignedBoardId);
}

export function boardFor(choice: BoardChoice): Board {
  if ('id' in choice) {
    if (!isDesignedBoardId(choice.id)) throw new Error(`No board called "${choice.id}"`);
    return DESIGNED_BOARDS[choice.id];
  }
  return galaxyBoard(choice.galaxy, choice.size);
}
