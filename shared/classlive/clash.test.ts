import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import { bombTiles, lineTiles, scoreTiles, standings, teamFor, freshMine, newClash, makeRound, startSpot, stepMove, colsOf, tileCount, tileOf, tileCentre, inFountain, crossTiles, CLASH_W, GRID, type ClashGame } from './clash';
import { memoryClashBoard, memoryClashPaint } from './clashMemory';
import { rewardsOf } from './rewards';

describe('Colour Clash', () => {
  it('teams balance, moves paint tiles in the database, bombs splat, rounds count and the best team wins', async () => {
    // Rules: lines, bombs, scores, balanced teams.
    expect(lineTiles({ x: 0.01, y: 0.01 }, { x: 0.2, y: 0.01 }, false)).toEqual([0, 1, 2, 3, 4]);
    expect(lineTiles({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, true)).toHaveLength(9);
    expect(bombTiles({ x: 0.5, y: 0.5 }, 2.2).length).toBeGreaterThan(12);
    expect(scoreTiles('1'.repeat(10) + '2'.repeat(5) + '0'.repeat(GRID * GRID - 15), [10], false).score.slice(1, 3)).toEqual([10, 7]);
    const g0 = newClash('park', 3);
    for (let i = 0; i < 7; i++) g0.mine[`p${i}`] = freshMine(teamFor(g0));
    expect(Object.values(g0.mine).map((m) => m.team)).toEqual([1, 2, 3, 1, 2, 3, 1]);

    const clock = pretendClock();
    const pc = pretendClass({ size: 16, seed: 5, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'clash', map: 'beach', teams: 2, paint: 45, length: 3 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    const game = () => pc.db.rooms.get(room)!.session.game as ClashGame;
    expect(game()).toMatchObject({ map: 'beach', teams: 2, paintS: 45 });
    // Nobody paints before the paint starts.
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    const me = pc.ids[0];
    memoryClashPaint(pc.db, clock.now(), room, me, 0.2, 0.5, null);
    await clock.run(clock.now() + 400);
    expect(memoryClashPaint(pc.db, clock.now(), room, me, 0.25, 0.5, null)!.tiles).toEqual([]);
    expect((await classLiveStep(pc.services, me, { action: 'ask', room })).status).toBe(409);
    pc.play(room);
    let bombs = 0;
    for (let s = 0; s < 3 * 60 + 60; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
      bombs = Math.max(bombs, Object.values(game().mine).reduce((a, m) => a + m.bombs, 0));
      if (s === 30) expect(memoryClashBoard(pc.db, clock.now(), room, null).tiles.length).toBeGreaterThan(40);
    }
    const done = pc.db.rooms.get(room)!;
    expect(done.session.state).toBe('over');
    const g = game();
    expect(g.history.length).toBeGreaterThanOrEqual(3);
    expect(bombs).toBeGreaterThan(5);
    expect(g.history.every((h) => h.score[1] + h.score[2] > 50)).toBe(true);
    const top = standings(g)[0];
    const paid = [...pc.db.paid.values()][0];
    const winner = paid.players.find((p) => g.mine[p.player].team === top.team)!;
    expect(winner.extra).toMatchObject({ clash_wins: 1, clash_games: 1 });
    expect(winner.extra!.clash_tiles).toBeGreaterThan(0);
    expect(rewardsOf(done.session).players.every((p) => p.points >= 1 && p.points <= 10)).toBe(true);
    // Pupils' own rows say their team and its place.
    const view = (await classLiveStep(pc.services, winner.player, { action: 'look', room })).body.me as { game: { kind: string; place: number } };
    expect(view.game).toMatchObject({ kind: 'clash', place: 1 });
  });

  it('a new game is wide: more columns, the same rows, and everything stays inside 0 to w', () => {
    const g = newClash('park', 4);
    expect(g.w).toBe(CLASH_W);
    expect(colsOf(g.w)).toBe(38);
    expect(tileCount(g.w)).toBe(38 * GRID);
    // A game started before the wide board has no w and stays 24 x 24.
    expect(tileCount(undefined)).toBe(GRID * GRID);
    const w = CLASH_W;
    // Tile maths on the wide grid: the far column and the middle.
    expect(tileOf({ x: w - 0.001, y: 0.999 }, w)).toBe(38 * GRID - 1);
    expect(tileCentre(tileOf({ x: w / 2, y: 0.5 }, w), w).x).toBeCloseTo(w / 2, 1);
    expect(lineTiles({ x: 0.5, y: 0.01 }, { x: 1.5, y: 0.01 }, false, w).every((i) => i < 38)).toBe(true);
    expect(crossTiles({ x: 1, y: 0.5 }, w)).toHaveLength(38 + GRID - 1);
    expect(bombTiles({ x: 1.5, y: 0.5 }, 2.2, w).length).toBeGreaterThan(12);
    expect(inFountain(tileOf({ x: w / 2, y: 0.5 }, w), w)).toBe(true);
    expect(inFountain(tileOf({ x: 0.5, y: 0.5 }, w), w)).toBe(false);
    // Everything a round places is on the board, and a wide board gets more of it than a square one.
    const wide = { items: 0, storms: 0 };
    const square = { items: 0, storms: 0 };
    for (let n = 1; n <= 10; n++) {
      let seed = n * 7919;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const sq = { ...newClash('park', 4), w: undefined };
      const r = makeRound(g, n, 0, random, 30);
      const r1 = makeRound(sq, n, 0, random, 30);
      wide.items += r.items.length; wide.storms += r.storms.length + r.ice.length;
      square.items += r1.items.length; square.storms += r1.storms.length + r1.ice.length;
      expect(r.w).toBe(w);
      expect(r1.w).toBeUndefined();
      for (const p of [...r.items, ...r.storms, ...r.ice, ...r.teleports.flatMap((t) => [t.a, t.b])]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(w);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
      for (const p of [...r1.items, ...r1.storms, ...r1.ice]) expect(p.x).toBeLessThanOrEqual(1);
      expect(r.golden.every((i) => i >= 0 && i < tileCount(w))).toBe(true);
      if (r.roller) expect(r.roller.span).toBe(w);
    }
    expect(wide.items).toBeGreaterThan(square.items);
    expect(wide.storms).toBeGreaterThan(square.storms);
    // Team start spots are on the wide board, spread across it; avatars can walk the whole width.
    for (const team of [1, 2, 3, 4] as const) for (let i = 0; i < 9; i++) {
      const sp = startSpot(team, 4, i, w);
      expect(sp.x).toBeGreaterThan(0);
      expect(sp.x).toBeLessThan(w);
    }
    expect(startSpot(2, 2, 0, w).x).toBeGreaterThan(1.2);
    const round = makeRound(g, 1, 0, () => 0.5, 10);
    let m = { p: { x: 1.4, y: 0.5 }, v: { x: 0, y: 0 } };
    for (let i = 0; i < 40; i++) m = stepMove(m, { x: 1, y: 0 }, 50, round, 5000, false);
    expect(m.p.x).toBeGreaterThan(1.5);
    expect(m.p.x).toBeLessThanOrEqual(w);
  });
});
