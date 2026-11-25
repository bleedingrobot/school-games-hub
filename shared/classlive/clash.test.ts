import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import { bombTiles, lineTiles, scoreTiles, standings, teamFor, freshMine, newClash, GRID, type ClashGame } from './clash';
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
});
