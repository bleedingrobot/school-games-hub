import { describe, expect, it } from 'vitest';
import { checkBoard, cometTail, expectedRolls, moveComet, squareXY, type Board } from './board';
import { boardFor, DESIGNED_BOARD_IDS, DESIGNED_BOARDS } from './boards';
import {
  galaxyBoard,
  galaxyCodeAt,
  galaxyOfTheDay,
  GALAXY_CODE_COUNT,
  nzDateKey,
  parseGalaxyCode,
  randomGalaxyCode,
  RANDOM_GALAXY,
} from './galaxy';
import { seededDice } from './random';

const plain = (squares: Board['squares'] = {}): Board => ({
  id: 't', name: 'T', size: 100, squares, comet: null, missionRounds: 40, cosmicEvents: false,
});

describe('the board grid', () => {
  it('goes back and forth in rows of 10 from the bottom left', () => {
    expect(squareXY(1, 100)).toEqual({ row: 9, col: 0 });
    expect(squareXY(10, 100)).toEqual({ row: 9, col: 9 });
    expect(squareXY(11, 100)).toEqual({ row: 8, col: 9 });
    expect(squareXY(20, 100)).toEqual({ row: 8, col: 0 });
    expect(squareXY(100, 100)).toEqual({ row: 0, col: 0 });
    expect(squareXY(1, 50)).toEqual({ row: 4, col: 0 });
    expect(squareXY(50, 50)).toEqual({ row: 0, col: 9 }); // 5 rows, so it ends top right
  });
});

describe('fairness rules', () => {
  it('pass a plain board', () => {
    expect(checkBoard(plain())).toEqual([]);
  });

  it('catch every kind of unfair square', () => {
    const problems = checkBoard(plain({
      1: { kind: 'star', star: 'red-dwarf' },
      4: { kind: 'black-hole', to: 2 },
      10: { kind: 'wormhole', to: 20 },
      20: { kind: 'black-hole', to: 12 },
      30: { kind: 'gate', twin: 40 },
      50: { kind: 'star', star: 'red-dwarf' },
      51: { kind: 'star', star: 'red-dwarf' },
      60: { kind: 'gate', twin: 90 },
      90: { kind: 'gate', twin: 60 },
      70: { kind: 'mystery' },
      80: { kind: 'mystery' },
    }));
    expect(problems).toEqual(expect.arrayContaining([
      "square 1 can't be special (only 2 to 99)",
      'black hole on square 4 (none on 1 to 5)',
      'wormhole 10 lands on another hole at 20',
      'gate 30 has no twin',
      'squares 50 and 51 are side by side',
      'gates 60 and 90 are too far apart',
      '2 mystery stations (at most 1)',
    ]));
  });

  it('can insist wormholes and black holes are balanced', () => {
    const board = plain({ 10: { kind: 'wormhole', to: 60 }, 70: { kind: 'black-hole', to: 65 } });
    expect(checkBoard(board)).toEqual([]);
    expect(checkBoard(board, { balanced: true })[0]).toContain('not balanced');
  });
});

describe('expected rolls', () => {
  it('is about 29 rolls on a plain 100 board, fewer with a big wormhole, more with a black hole', () => {
    const none = expectedRolls(plain());
    expect(none).toBeGreaterThan(28);
    expect(none).toBeLessThan(31);
    expect(expectedRolls(plain({ 5: { kind: 'wormhole', to: 80 } }))).toBeLessThan(none);
    expect(expectedRolls(plain({ 95: { kind: 'black-hole', to: 10 } }))).toBeGreaterThan(none);
  });
});

describe('the comet', () => {
  it('has a tail behind its head and wraps round without touching square 1 or the last square', () => {
    expect(cometTail({ head: 20, length: 5, speed: 3 })).toEqual([19, 18, 17, 16]);
    let comet = { head: 20, length: 5, speed: 3 };
    for (let i = 0; i < 200; i++) {
      comet = moveComet(comet, 100);
      expect(comet.head).toBeLessThanOrEqual(99);
      expect(Math.min(...cometTail(comet))).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('designed boards', () => {
  it.each(DESIGNED_BOARD_IDS)('%s passes the fairness rules', (id) => {
    const board = DESIGNED_BOARDS[id];
    expect(board.id).toBe(id);
    expect(checkBoard(board)).toEqual([]);
  });

  it('have their own feel', () => {
    const stars = (board: Board) => Object.values(board.squares).flatMap((s) => (s.kind === 'star' ? [s.star] : []));
    const inner = stars(DESIGNED_BOARDS['inner-solar-system']);
    expect(inner).not.toContain('neutron-star');
    expect(inner).not.toContain('pulsar');
    expect(inner).not.toContain('supernova');
    const deep = DESIGNED_BOARDS['deep-space'];
    expect(stars(deep)).toEqual(expect.arrayContaining(['pulsar', 'supernova']));
    expect(deep.comet).not.toBeNull();
    expect(deep.cosmicEvents).toBe(true);
    const nebula = Object.values(DESIGNED_BOARDS.nebula.squares).map((s) => s.kind);
    expect(nebula).toEqual(expect.arrayContaining(['gate', 'mystery']));
    expect(DESIGNED_BOARDS['asteroid-belt'].size).toBe(50);
    // Gentle to chaotic.
    const rolls = DESIGNED_BOARD_IDS.map((id) => expectedRolls(DESIGNED_BOARDS[id]));
    expect(rolls[0]).toBeLessThan(rolls[1]);
    expect(rolls[1]).toBeLessThan(rolls[2]);
  });

  it('boardFor finds designed boards and Random Galaxies', () => {
    expect(boardFor({ id: 'nebula' })).toBe(DESIGNED_BOARDS.nebula);
    expect(boardFor({ galaxy: 'comet kiwi 48', size: 50 }).size).toBe(50);
    expect(() => boardFor({ id: 'nope' as 'nebula' })).toThrow('No board');
  });
});

describe('galaxy codes', () => {
  it('turn numbers into three easy words, every one different', () => {
    expect(galaxyCodeAt(0)).toBe('Comet-Kiwi-10');
    const seen = new Set<string>();
    for (let i = 0; i < GALAXY_CODE_COUNT; i += 37) seen.add(galaxyCodeAt(i));
    expect(seen.size).toBe(Math.ceil(GALAXY_CODE_COUNT / 37));
    expect(galaxyCodeAt(GALAXY_CODE_COUNT)).toBe(galaxyCodeAt(0));
  });

  it('forgive capitals and spaces, and refuse anything else', () => {
    expect(parseGalaxyCode('comet kiwi 48')).toBe('Comet-Kiwi-48');
    expect(parseGalaxyCode('  ORBIT-tuatara-10 ')).toBe('Orbit-Tuatara-10');
    expect(parseGalaxyCode('Comet-Kiwi-9')).toBeNull();
    expect(parseGalaxyCode('Comet-Kiwi-100')).toBeNull();
    expect(parseGalaxyCode('Kiwi-Comet-48')).toBeNull();
    expect(parseGalaxyCode('Comet-Kiwi')).toBeNull();
    expect(parseGalaxyCode('<script>')).toBeNull();
  });

  it('every code parses back to itself', () => {
    const dice = seededDice('codes');
    for (let i = 0; i < 300; i++) {
      const code = randomGalaxyCode(dice);
      expect(parseGalaxyCode(code)).toBe(code);
    }
  });

  it('Galaxy of the day changes at New Zealand midnight, not UTC', () => {
    // 11:30 UTC on 14 Oct is 00:30 on 15 Oct in New Zealand (NZDT, UTC+13).
    expect(nzDateKey(new Date('2026-10-14T11:30:00Z'))).toBe('2026-10-15');
    expect(galaxyOfTheDay(new Date('2026-10-14T11:30:00Z'))).toBe(galaxyOfTheDay(new Date('2026-10-15T10:00:00Z')));
    expect(galaxyOfTheDay(new Date('2026-10-15T11:30:00Z'))).not.toBe(galaxyOfTheDay(new Date('2026-10-15T10:00:00Z')));
  });
});

describe('Random Galaxy', () => {
  it('the same code always makes the same board', () => {
    expect(galaxyBoard('Comet-Kiwi-48', 100)).toEqual(galaxyBoard('comet kiwi 48', 100));
    expect(galaxyBoard('Comet-Kiwi-48', 100)).not.toEqual(galaxyBoard('Comet-Kiwi-49', 100));
  });

  it.each([100, 50] as const)('every %i-square galaxy is fair, balanced and the right length', (size) => {
    const recipe = RANDOM_GALAXY[size];
    for (let i = 0; i < 250; i++) {
      const board = galaxyBoard(galaxyCodeAt(i * 367), size);
      expect(checkBoard(board, { balanced: true })).toEqual([]);
      const rolls = expectedRolls(board);
      expect(rolls).toBeGreaterThanOrEqual(recipe.rolls![0]);
      expect(rolls).toBeLessThanOrEqual(recipe.rolls![1]);
      const kinds = Object.values(board.squares).map((s) => s.kind);
      expect(kinds.filter((k) => k === 'wormhole')).toHaveLength(recipe.wormholes);
      expect(kinds.filter((k) => k === 'black-hole')).toHaveLength(recipe.blackHoles);
      expect(kinds.filter((k) => k === 'star')).toHaveLength(recipe.stars);
    }
  });

  it('refuses a code that isn’t one', () => {
    expect(() => galaxyBoard('hello', 100)).toThrow("isn't a galaxy code");
  });
});

describe('names other pages use', () => {
  it('match the boards and the rules', async () => {
    const { BOARD_NAMES, DESIGNED_BOARD_ORDER, MAX_ROCKETS, MIN_ROCKETS } = await import('./names');
    expect(DESIGNED_BOARD_ORDER).toEqual(DESIGNED_BOARD_IDS);
    const { MAX_PLAYERS, MIN_PLAYERS } = await import('./engine');
    for (const id of DESIGNED_BOARD_IDS) expect(BOARD_NAMES[id]).toBe(DESIGNED_BOARDS[id].name);
    expect([MIN_ROCKETS, MAX_ROCKETS]).toEqual([MIN_PLAYERS, MAX_PLAYERS]);
  });
});
