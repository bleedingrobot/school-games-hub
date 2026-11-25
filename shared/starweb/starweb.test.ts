import { describe, expect, it } from 'vitest';
import { readFact, type Anchor } from '../classlive/stars';
import type { FactStats } from '../maths/leitner';
import { GOLD, SILVER } from './config';
import { emptyProgress, pickAnchor, progressAfter, tableMedal, tablesLit, withRecent } from './map';
import { GOLD_FACTS } from './pretend';
import { addTry, countedStars, judge, medalOf, nextStep, showMe, whyLine, workingFor, type SoloSky } from './sky';

// Star Web solo's rules (the server's fairness tests are in supabase/functions/starweb).

const K: Anchor = { x: 6, y: 7, p: 42 };
const play = (facts: string[], k = K): SoloSky => facts.reduce((s, f) => addTry(s, f).sky, { anchor: k, stars: [] } as SoloSky);

describe('a sky', () => {
  it('judges each try with the class rules: new, again, the known fact, unlinked, wrong, unreadable', () => {
    const sky = play(['7×6=42']);
    expect(judge({ anchor: K, stars: [] }, '12 x 7 = 84')).toMatchObject({ result: 'new', star: { a: 'double', t: '12 × 7 = 84' } });
    expect(judge(sky, '42=7×6').result).toBe('again');
    expect(judge(sky, '6×7=42').result).toBe('same');
    expect(judge(sky, '2+2=4').result).toBe('unlinked');
    expect(judge(sky, '6×8=49').result).toBe('wrong');
    expect(judge(sky, 'banana').result).toBe('unreadable');
    expect(sky.stars).toHaveLength(1);
  });

  it('gives bronze only with every arm lit, and caps Wild links for silver and gold', () => {
    const all = play(GOLD_FACTS);
    expect(all.stars).toHaveLength(31);
    expect(countedStars(all.stars)).toBe(GOLD); // the 6th Wild link shows but doesn't count
    expect(medalOf(all.stars)).toBe(3);
    const noTurn = play(GOLD_FACTS.slice(1));
    expect(medalOf(noTurn.stars)).toBe(0); // 29 stars, but Turn around isn't lit
    const farm = play(['7×6=42', '42÷6=7', '42÷7=6', '84÷6=14', '12×7=84', '6×14=84', '24×7=168', '3×7=21', '6×3.5=21', '3×14=42',
      '60×7=420', '6×70=420', '60×70=4200', '6×8=48', '6×6=36', '7×7=49', '42+1=43', '42+2=44', '42+3=45', '42+4=46', '42+5=47', '42+8=50', '42+9=51', '43−1=42']);
    expect(medalOf(farm.stars)).toBe(1); // lit, but Wild farming stops at the cap: 19 + 5 < 25
    expect(countedStars(farm.stars)).toBeLessThan(SILVER);
  });

  it('helps without giving this sky’s answers: the next step, Show me on another fact, why lines and the working', () => {
    for (let x = 2; x <= 12; x++) for (let y = 2; y <= 12; y++) {
      if (x === y) continue;
      const k = { x, y, p: x * y };
      expect(nextStep({ anchor: k, stars: [] })).not.toContain('=');
      for (const arm of ['turn', 'divide', 'double', 'halve', 'tens', 'near', 'wild'] as const) {
        expect(showMe(arm, k).join(' ')).not.toContain(`We know ${x} × ${y} =`);
      }
    }
    const f = (t: string) => readFact(t)!;
    expect(whyLine(f('12×14=84'), K)).toMatch(/4 times as big/);
    expect(whyLine(f('60×70=420'), K)).toMatch(/Each × 10/);
    expect(whyLine(f('6×8=49'), K)).toBe('6 × 8 is one more group of 6: 42 + 6.');
    expect(whyLine(f('3×7=22'), K)).toBe('Half of 42 is 21.');
    expect(workingFor(f('6×14=80'), K)).toBe('6 × 14 is double 6 × 7, so the answer is double 42.');
    expect(workingFor(f('2+2=5'), K)).toBeNull();
  });
});

describe('the Star Map', () => {
  const fact = (key: string, box: number): FactStats => ({ key, attempts: 6, correct: 6, avgMs: 2000, box, lastSeen: 0, quickDays: [] });

  it('starts with the guided 3 × 4, then picks from the pupil’s known facts in the class’s tables, never a recent one', () => {
    const random = () => 0.3;
    expect(pickAnchor(emptyProgress(), [], undefined, random)).toEqual({ x: 3, y: 4, p: 12 });
    const seen = { ...emptyProgress(), guideSeen: true };
    const facts = [fact('mul:6x7', 4), fact('mul:4x8', 3), fact('mul:3x9', 4), fact('mul:7x8', 1), fact('mul:5x5', 4), fact('mul:1x9', 4), fact('add:3+4', 4)];
    for (let i = 0; i < 20; i++) {
      const a = pickAnchor(seen, facts, undefined, () => (i * 0.137) % 1);
      expect(['6x7', '4x8', '3x9']).toContain(`${Math.min(a.x, a.y)}x${Math.max(a.x, a.y)}`); // not a learning fact, square or × 1
    }
    const recent = withRecent(withRecent(seen, { x: 6, y: 7, p: 42 }), { x: 8, y: 4, p: 32 });
    const a = pickAnchor(recent, facts, undefined, random);
    expect([a.x, a.y].sort((m, n) => m - n)).toEqual([3, 9]);
    // Only 4 × 8 has an on table: too few known facts, so the class game's easy list.
    const easy = pickAnchor(seen, facts, [8], random);
    expect([[3, 4], [4, 5], [5, 6], [3, 5], [2, 7], [4, 6]].map((p) => p.join())).toContain([Math.min(easy.x, easy.y), Math.max(easy.x, easy.y)].join());
  });

  it('lights both tables at their best medal; a free sky or an unlit one leaves the map alone', () => {
    let p = progressAfter(emptyProgress(), { anchor: K, medal: 2, counted: 26, hints: 0, mode: 'map' });
    expect([tableMedal(p, 6), tableMedal(p, 7), tablesLit(p), p.lit, p.nohint, p.stars]).toEqual([2, 2, 2, 1, 1, 26]);
    p = progressAfter(p, { anchor: { x: 7, y: 3, p: 21 }, medal: 1, counted: 19, hints: 2, mode: 'map' });
    expect([tableMedal(p, 7), tableMedal(p, 3), tablesLit(p), p.nohint]).toEqual([2, 1, 3, 1]);
    expect(progressAfter(p, { anchor: { x: 11, y: 12, p: 132 }, medal: 3, counted: 30, hints: 0, mode: 'free' }).tables).toEqual(p.tables);
    expect(progressAfter(p, { anchor: { x: 11, y: 12, p: 132 }, medal: 0, counted: 3, hints: 0, mode: 'map' }).lit).toBe(2);
  });
});
