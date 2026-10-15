import { describe, expect, it } from 'vitest';
import type { BotLevel } from '../botGame';
import type { Board } from './board';
import { botAction } from './bot';
import { DESIGNED_BOARD_IDS, DESIGNED_BOARDS } from './boards';
import { DEFAULT_SETTINGS, KEEP_ITEMS, newGame, type SpaceState } from './engine';
import { galaxyBoard, galaxyCodeAt } from './galaxy';
import { simulate } from './sim';

const board = (squares: Board['squares']): Board => ({
  id: 't', name: 'T', size: 100, squares, comet: null, missionRounds: 40, cosmicEvents: false,
});
const never = () => 0.99;

function at(b: Board, positions: number[], items: SpaceState['rockets'][number]['items'] = []): SpaceState {
  const s = newGame(b, DEFAULT_SETTINGS, positions.length).state;
  positions.forEach((p, i) => (s.rockets[i].position = p));
  s.rockets[0].items = [...items];
  return s;
}

describe('bots play whole games by the rules', () => {
  const levels: BotLevel[] = ['very-easy', 'easy', 'medium'];

  it.each(DESIGNED_BOARD_IDS)('on %s, every game ends, cosmic and classic, 2–4 rockets', (id) => {
    for (const mode of ['cosmic', 'classic'] as const) {
      for (const players of [2, 3, 4]) {
        const report = simulate({
          board: DESIGNED_BOARDS[id],
          settings: { ...DEFAULT_SETTINGS, mode, cosmicEvents: true, rollAgainOnSix: players === 3, finish: players === 2 ? 'exact' : 'any' },
          levels: Array.from({ length: players }, (_, i) => levels[i % 3]),
          games: 40,
          seed: `test:${id}:${mode}:${players}`,
        });
        expect(report.games).toBe(40);
        expect(report.biggestEventsInOneMove).toBeLessThanOrEqual(3);
      }
    }
  });

  it('on Random Galaxies too', () => {
    for (let i = 0; i < 20; i++) {
      for (const size of [100, 50] as const) {
        simulate({ board: galaxyBoard(galaxyCodeAt(i * 4111), size), settings: { ...DEFAULT_SETTINGS, cosmicEvents: true }, levels: ['very-easy', 'medium', 'easy'], games: 5, seed: `g${i}` });
      }
    }
  });
});

describe('bot choices', () => {
  it('Pilot and Commander use a Booster; nobody uses an automatic item', () => {
    const s = at(board({}), [10, 20], ['booster', 'force-field']);
    expect(botAction(s, 'easy', never)).toEqual({ kind: 'use-item', item: 'booster' });
    expect(botAction(s, 'medium', never)).toEqual({ kind: 'use-item', item: 'booster' });
    const ff = at(board({}), [10, 20], ['force-field']);
    for (const level of ['very-easy', 'easy', 'medium'] as const) expect(botAction(ff, level, () => 0)).toEqual({ kind: 'roll' });
  });

  it('the Commander saves its Navigator for the finish', () => {
    const early = at(board({}), [10, 20], ['navigator']);
    expect(botAction(early, 'medium', never)).toEqual({ kind: 'roll' });
    const finish = at(board({}), [96, 20], ['navigator']);
    expect(botAction(finish, 'medium', never)).toEqual({ kind: 'use-item', item: 'navigator', value: 4 });
    // …or for a big wormhole.
    const wormhole = at(board({ 15: { kind: 'wormhole', to: 60 } }), [10, 20], ['navigator']);
    expect(botAction(wormhole, 'medium', never)).toEqual({ kind: 'use-item', item: 'navigator', value: 5 });
  });

  it('aims hinders at the leader', () => {
    const s = at(board({}), [30, 50, 70, 10], ['tractor-beam']);
    expect(botAction(s, 'medium', never)).toEqual({ kind: 'use-item', item: 'tractor-beam', target: 2 });
  });

  it('takes a gate up, stays at a gate down, keeps good items when pockets are full', () => {
    const up = at(board({}), [10, 1]);
    up.phase = 'choice';
    up.pending = { kind: 'gate', square: 10, twin: 25 };
    expect(botAction(up, 'easy', never)).toEqual({ kind: 'choose', option: 1 });
    up.pending = { kind: 'gate', square: 25, twin: 10 };
    expect(botAction(up, 'easy', never)).toEqual({ kind: 'choose', option: 0 });
    const full = at(board({}), [10, 1], ['navigator', 'space-mine', 'hyperdrive']);
    full.phase = 'choice';
    full.pending = { kind: 'inventory', item: 'booster' };
    expect(botAction(full, 'medium', never)).toEqual({ kind: 'choose', option: 1 });
    full.pending = { kind: 'inventory', item: 'repair-kit' };
    expect(botAction(full, 'medium', never)).toEqual({ kind: 'choose', option: KEEP_ITEMS });
  });

  it('picks the better binary die', () => {
    const s = at(board({ 13: { kind: 'wormhole', to: 50 } }), [10, 1]);
    s.phase = 'choice';
    s.pending = { kind: 'binary', dice: [6, 3] };
    expect(botAction(s, 'easy', never)).toEqual({ kind: 'choose', option: 1 });
  });
});
