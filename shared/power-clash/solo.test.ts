import { describe, expect, it } from 'vitest';
import {
  applyStudent, botLoadoutFor, encodeStudentAction, isBotTurn, matchIsOver, parseStudentAction, playOneBot, replaySolo,
  startSolo, type SoloSetup,
} from './solo';
import { playWholeMatch } from './testing';

const setup = (over: Partial<SoloSetup> = {}): SoloSetup => ({
  seed: 's1-1792000000-abcdefabcdefabcdefabcdef', level: 'easy', side: 'X', loadout: ['double-trouble', 'body-swap', 'freeze-ray'], ...over,
});

describe('a bot game', () => {
  it('is fixed by its seed: the bot brings the same powers every time', () => {
    expect(botLoadoutFor('seed-a', 'easy')).toEqual(botLoadoutFor('seed-a', 'easy'));
    const sets = new Set(Array.from({ length: 30 }, (_, i) => botLoadoutFor(`seed-${i}`, 'easy').join()));
    expect(sets.size).toBeGreaterThan(2);
  });

  it('lets the bot start when the student is O, and only the student when X', () => {
    expect(isBotTurn(startSolo(setup({ side: 'X' })))).toBe(false);
    expect(isBotTurn(startSolo(setup({ side: 'O' })))).toBe(true);
  });

  it('rejects a move on the bot’s turn, a bad move, and a round that is not over', () => {
    const solo = startSolo(setup({ side: 'O' }));
    expect(() => applyStudent(solo, 'place:4')).toThrow(/not your turn/);
    playOneBot(solo);
    expect(() => applyStudent(solo, 'next')).toThrow(/not over/);
    expect(() => applyStudent(solo, 'banana')).toThrow();
    const taken = solo.match.state.board.findIndex((c) => c !== null);
    expect(() => applyStudent(solo, `place:${taken}`)).toThrow();
  });

  it('writes actions as short text and reads them back', () => {
    for (const text of ['place:4', 'skip', 'next', 'power:double-trouble', 'power:freeze-ray:3', 'power:body-swap:0,8']) {
      expect(encodeStudentAction(parseStudentAction(text)!)).toBe(text);
    }
    for (const bad of ['place:9', 'power:laser:1', 'power:body-swap:0,1,2', 'place:', '', 'PLACE:1']) expect(parseStudentAction(bad)).toBeNull();
  });
});

describe('replaying', () => {
  it.each(['very-easy', 'easy', 'medium'] as const)('replays a whole %s match to the same result', (level) => {
    for (const side of ['X', 'O'] as const) {
      const s = setup({ level, side, seed: `s1-1792000000-${level.replace('-', '').padEnd(24, 'a').slice(0, 24)}` });
      const { solo, actions } = playWholeMatch(s, 'easy');
      expect(matchIsOver(solo)).toBe(true);
      const again = replaySolo(s, actions);
      expect(again.ok && again.finished).toBe(true);
      if (!again.ok) return;
      expect(again.solo.match.score).toEqual(solo.match.score);
      expect(again.solo.match.winner).toBe(solo.match.winner);
      expect(again.solo.stats).toEqual(solo.stats);
      expect(again.solo.studentMoves).toBe(solo.studentMoves);
    }
  });

  it('refuses a changed action, an extra action, and an action for the wrong turn', () => {
    const s = setup();
    const { actions } = playWholeMatch(s, 'easy');
    expect(replaySolo(s, actions).ok).toBe(true);
    expect(replaySolo(s, [...actions, 'place:0']).ok).toBe(false);
    expect(replaySolo(s, ['next', ...actions]).ok).toBe(false);
    expect(replaySolo(s, actions.map((a, i) => (i === 1 ? 'place:99' : a))).ok).toBe(false);
    expect(replaySolo({ ...s, loadout: ['double-trouble', 'double-trouble', 'freeze-ray'] }, actions).ok).toBe(false);
  });

  it('counts the student’s powers, Body Swap wins and a win without powers', () => {
    // Over many seeds the stats always agree with what was played.
    for (let i = 0; i < 12; i++) {
      const s = setup({ seed: `s1-1792000000-${String(i).padStart(24, '0')}`, level: 'very-easy', side: i % 2 ? 'X' : 'O' });
      const { solo, actions } = playWholeMatch(s, 'easy');
      const used = actions.filter((a) => a.startsWith('power:')).length;
      expect(solo.stats.powersUsed).toBe(used);
      expect(solo.stats.roundsWon + solo.stats.roundsLost + solo.stats.roundsDrawn).toBe(solo.match.round);
      expect(solo.stats.noPowerWin).toBe(solo.match.winner === s.side && used === 0);
      expect(solo.stats.roundsWon).toBe(solo.match.score[s.side]);
    }
  });
});
