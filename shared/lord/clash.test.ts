import { describe, expect, it } from 'vitest';
import { CLASH_HP, MAX_CLASH_ROUNDS, clashGold, clashLine, clashOf, clashPrize, hitFor, playRound, replayClash, type ClashPick } from './clash';

const p = (move: ClashPick['move'], right = true): ClashPick => ({ move, right });

describe('arena clashes', () => {
  it('Hammer smashes Sword, Sword cuts Net, Net tangles Hammer; winner hits double, loser half; ends and pays as agreed', () => {
    expect(clashOf('hammer', 'sword')).toBe(0);
    expect(clashOf('sword', 'net')).toBe(0);
    expect(clashOf('net', 'hammer')).toBe(0);
    expect(clashOf('sword', 'hammer')).toBe(1);
    expect(clashOf('net', 'net')).toBe('tie');
    expect(clashOf(null, 'net')).toBe(1);
    expect(clashLine('net', 'hammer')).toBe('Net tangles Hammer!');
    expect(clashLine('hammer', 'net')).toBe('Net tangles Hammer!');

    expect(hitFor(p('sword'), 'win')).toBe(20);
    expect(hitFor(p('sword', false), 'win')).toBe(8);
    expect(hitFor(p('sword'), 'lose')).toBe(5);
    expect(hitFor(p('sword', false), 'lose')).toBe(2);
    expect(hitFor(p('sword'), 'tie')).toBe(10);
    expect(hitFor(p(null), 'lose')).toBe(0);
    const s = playRound(replayClash([]), [p('hammer'), p('sword')]);
    expect(s.rounds[0].hits).toEqual([20, 5]);
    expect(s.hp).toEqual([CLASH_HP - 5, CLASH_HP - 20]);

    const ko = replayClash([[p('hammer'), p('sword')], [p('hammer'), p('sword')], [p('hammer'), p('sword')]]);
    expect(ko).toMatchObject({ over: true, winner: 0, hp: [35, 0] });
    expect(() => playRound(ko, [p('net'), p('net')])).toThrow();
    const four = [...Array(4)].map(() => [p('net', false), p('net', false)] as [ClashPick, ClashPick]);
    expect(replayClash(four).over).toBe(false);
    const five = replayClash([...four, [p('net', false), p('net')]]);
    expect(five).toMatchObject({ over: true, winner: 1, hp: [24, 30] });
    const level = replayClash([...Array(MAX_CLASH_ROUNDS)].map(() => [p('net', false), p('net', false)] as [ClashPick, ClashPick]));
    expect(level).toMatchObject({ over: true, winner: null });

    const [a, b] = clashPrize(0, [4, 9]);
    expect(a).toBe(clashGold(4));
    expect(b).toBe(Math.round(clashGold(4) / 2));
    expect(clashPrize(1, [4, 9])[1]).toBe(clashGold(9));
  });
});
