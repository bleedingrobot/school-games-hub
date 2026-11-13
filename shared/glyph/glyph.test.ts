import { describe, expect, it } from 'vitest';
import { CELLS, GLYPH_CHOICES, MAX_NUMBER, TEMPLES, WALLS_PER_TEMPLE } from './config';
import { arrowsBetween, equal, mistakeOf } from './fractions';
import { GLYPHS, sameCells } from './glyphs';
import { emptyProgress, judgeGo, progressAfter, replayTemple, rightCells, type WallPlay } from './play';
import { makeTemple, publicWall, type Wall } from './walls';

const rightGo = (w: Wall, ms = 4000) => ({ lit: [...w.right], pick: w.answer, ms });
const trapGo = (w: Wall, ms = 4000) => {
  const i = w.answer === 0 ? 1 : 0;
  return { lit: [...w.glyphs[i]], pick: i, ms };
};

describe('Glyph Gates walls', () => {
  it('every temple makes fair walls from many seeds', () => {
    for (const t of TEMPLES) {
      for (let s = 0; s < 40; s++) {
        const walls = makeTemple(`seed-${s}`, t.id);
        expect(walls).toHaveLength(WALLS_PER_TEMPLE);
        for (const w of walls) {
          expect(w.tiles).toHaveLength(CELLS);
          for (const f of w.tiles) {
            expect(f.n).toBeGreaterThanOrEqual(1);
            expect(f.n).toBeLessThan(f.d);
            expect(f.d).toBeLessThanOrEqual(MAX_NUMBER);
          }
          // The right cells are exactly the tiles equal to the gold stone, and they are the right glyph.
          expect(rightCells(publicWall(w))).toEqual([...w.right].sort((a, b) => a - b));
          expect(sameCells(w.glyphs[w.answer], w.right)).toBe(true);
          // Four different glyphs, all the same size, so counting gives nothing away.
          expect(w.glyphs).toHaveLength(GLYPH_CHOICES);
          expect(new Set(w.glyphs.map((g) => g.length)).size).toBe(1);
          for (let a = 0; a < w.glyphs.length; a++) for (let b = a + 1; b < w.glyphs.length; b++) expect(sameCells(w.glyphs[a], w.glyphs[b])).toBe(false);
          // No two trap tiles the same.
          const traps = w.tiles.filter((_, c) => !w.right.includes(c)).map((f) => `${f.n}/${f.d}`);
          expect(new Set(traps).size).toBe(traps.length);
        }
      }
    }
  });

  it('is the same wall from the same seed, and the right glyph is one of the drawn runes', () => {
    expect(makeTemple('abc', 3)).toEqual(makeTemple('abc', 3));
    for (const w of makeTemple('abc', 1)) expect(GLYPHS.some((g) => sameCells(g, w.right))).toBe(true);
  });

  it('reviews an earlier temple on walls 3, 6 and 9 from temple 2', () => {
    expect(makeTemple('x', 1).every((w) => w.kind === 1)).toBe(true);
    const kinds = makeTemple('x', 4).map((w) => w.kind);
    expect(kinds.filter((_, i) => (i + 1) % 3 !== 0).every((k) => k === 4)).toBe(true);
    expect(kinds.filter((_, i) => (i + 1) % 3 === 0).every((k) => k < 4)).toBe(true);
  });

  it('temple 4 has an unsimplified gold stone and its simplest form among the tiles', () => {
    for (const w of makeTemple('t4', 4).filter((w) => w.kind === 4)) {
      const g = w.gold;
      const simple = w.tiles.some((t, c) => w.right.includes(c) && t.d < g.d);
      expect(simple).toBe(true);
    }
  });
});

describe('Glyph Gates fractions', () => {
  it('names the mistakes from the plan', () => {
    const gold = { n: 5, d: 6 };
    expect(mistakeOf(gold, { n: 6, d: 7 })).toBe('add-same');
    expect(mistakeOf(gold, { n: 5, d: 12 })).toBe('bottom-only');
    expect(mistakeOf(gold, { n: 3, d: 6 })).toBe('same-bottom');
    expect(mistakeOf(gold, { n: 30, d: 37 })).toBe('near-miss');
    expect(mistakeOf(gold, { n: 10, d: 18 })).toBe('diff-mult');
    expect(() => mistakeOf(gold, { n: 25, d: 30 })).toThrow();
  });

  it('shows ×-arrows up and ÷-arrows down', () => {
    expect(arrowsBetween({ n: 5, d: 6 }, { n: 20, d: 24 })).toEqual({ way: 'times', top: 4, bottom: 4 });
    expect(arrowsBetween({ n: 20, d: 24 }, { n: 5, d: 6 })).toEqual({ way: 'divide', top: 4, bottom: 4 });
    expect(arrowsBetween({ n: 5, d: 6 }, { n: 30, d: 37 })).toEqual({ way: 'times', top: 6, bottom: null });
    expect(equal({ n: 5, d: 6 }, { n: 25, d: 30 })).toBe(true);
  });
});

describe('Glyph Gates goes', () => {
  const [w] = makeTemple('go', 2);
  const pub = publicWall(w);

  it('opens with the right tiles and glyph, shakes on a trap glyph, and says when nothing matches', () => {
    expect(judgeGo(pub, rightGo(w)).outcome).toBe('open');
    const trap = judgeGo(pub, trapGo(w));
    expect(trap.outcome).toBe('trap');
    expect(trap.mistakes).toContain('missed');
    const some = judgeGo(pub, { lit: w.right.slice(1), pick: null, ms: 3000 });
    expect(some.outcome).toBe('nomatch');
    expect(some.missed).toEqual([w.right[0]]);
  });

  it('refuses goes the screen cannot send', () => {
    expect(() => judgeGo(pub, { lit: [...w.right], pick: null, ms: 3000 })).toThrow();
    expect(() => judgeGo(pub, { lit: [...w.right], pick: (w.answer + 1) % 4, ms: 3000 })).toThrow();
    expect(() => judgeGo(pub, { lit: [0, 0], pick: null, ms: 3000 })).toThrow();
    expect(() => judgeGo(pub, { lit: [16], pick: null, ms: 3000 })).toThrow();
  });

  it('replays a temple: 7 first goes pass, help past the bar is not a right answer, and help fades', () => {
    const walls = makeTemple('pass', 1);
    const plays: WallPlay[] = walls.map((wall, i) => (i < 7 ? { goes: [rightGo(wall)], help: i === 0 ? 2 : 0 } : { goes: [trapGo(wall), rightGo(wall)], help: 3 }));
    const r = replayTemple(walls, plays);
    expect(r.finished).toBe(true);
    expect(r.firstGoes).toBe(7);
    expect(r.passed).toBe(true);
    expect(r.walls[0].recordRight).toBe(false);
    expect(r.walls[1].recordRight).toBe(true);
    const p = progressAfter(emptyProgress(), 1, r);
    expect(p.passed).toBe(1);
    expect(p.best['1']).toBe(7);

    const six = replayTemple(walls, plays.map((pl, i) => (i === 6 ? { goes: [trapGo(walls[i]), trapGo(walls[i])], help: 3 } : pl)));
    expect(six.passed).toBe(false);
    expect(progressAfter(emptyProgress(), 1, six).passed).toBe(0);

    let q = emptyProgress();
    const perfect = replayTemple(walls, walls.map((wall) => ({ goes: [rightGo(wall)], help: 0 })));
    q = progressAfter(q, 1, perfect);
    q = progressAfter(q, 1, perfect);
    expect(q.help.level).toBe(1);
  });

  it('refuses a replay with goes after the wall opened, too quick, or a skipped wall', () => {
    const walls = makeTemple('bad', 1);
    expect(() => replayTemple(walls, [{ goes: [rightGo(walls[0]), rightGo(walls[0])], help: 0 }])).toThrow();
    expect(() => replayTemple(walls, [{ goes: [rightGo(walls[0], 100)], help: 0 }])).toThrow();
    expect(() => replayTemple(walls, [{ goes: [trapGo(walls[0])], help: 0 }, { goes: [rightGo(walls[1])], help: 0 }])).toThrow();
    // A part go (left after 2 walls) counts what was played.
    const part = replayTemple(walls, [{ goes: [rightGo(walls[0])], help: 0 }, { goes: [rightGo(walls[1])], help: 0 }]);
    expect(part.finished).toBe(false);
    expect(part.passed).toBe(false);
  });
});
