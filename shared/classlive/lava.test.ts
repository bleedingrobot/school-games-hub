import { describe, expect, it } from 'vitest';
import { buildTarget, freshLavaMine, isLava, lavaAnswered, lavaBuild, lavaRescue, makeLavaRound, newLava, sinking, stepLava, tileAt, tileCentre, TILES, type LavaGame } from './lava';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import { classLiveStep } from './server';

describe('Floor is Lava', () => {
  it('glows and sinks tiles, walls off lava, bricks rebuild and rescue, and a pretend class plays a timed game to the end', async () => {
    // Rules: the floor glows a share, always leaves room, sunk tiles are walls and cool back after two rounds.
    const g: LavaGame = newLava('volcano', 6);
    const r1 = makeLavaRound(g, 1, 0, rng(1), 25);
    expect(r1.runEnd).toBe(6000);
    expect(r1.glow.length).toBeGreaterThan(5);
    expect(TILES - sinking(r1).length).toBeGreaterThanOrEqual(17);
    for (const i of sinking(r1)) g.sunk[i] = 3;
    g.round = { ...r1, n: 2 };
    const lava = sinking(r1)[0];
    const c = tileCentre(lava);
    // Walking from a rock tile next to it into the lava is blocked (unless Fire boots).
    const side = [1, -1].map((d) => lava + d).find((i) => i >= 0 && i < TILES && !isLava(g, i, 2) && Math.floor(i / 8) === Math.floor(lava / 8));
    if (side !== undefined) {
      const from = tileCentre(side);
      const dir = { x: Math.sign(c.x - from.x), y: 0 };
      let m = { p: from, v: { x: 0, y: 0 } };
      for (let k = 0; k < 8; k++) m = stepLava(m, dir, 50, g, 0, { boost: false, boots: false });
      expect(tileAt(m.p)).not.toBe(lava);
      let b = { p: from, v: { x: 0, y: 0 } };
      for (let k = 0; k < 8; k++) b = stepLava(b, dir, 50, g, 0, { boost: false, boots: true });
      expect(tileAt(b.p)).toBe(lava);
    }
    expect([isLava(g, lava, 3), isLava(g, lava, 4)]).toEqual([true, false]);
    // A right answer earns a brick; a brick rebuilds lava within reach; two bricks pull a friend off the raft.
    g.mine.a = freshLavaMine(0);
    g.mine.b = { ...freshLavaMine(1), raftIn: 1 };
    g.mine.a.spot = c;
    expect(lavaAnswered(g, 'a', true, ['a', 'b'], 100)).toMatchObject({ ok: true, purpose: 'brick' });
    expect(lavaAnswered(g, 'a', true, ['a', 'b'], 200)).toEqual({ ok: false, reason: 'too_soon' });
    expect(buildTarget(g, g.round, c)).toBe(lava);
    expect(lavaBuild(g, 'a', lava, { x: c.x + 0.5, y: c.y }, 300)).toEqual({ ok: false, reason: 'far' });
    expect(lavaBuild(g, 'a', lava, c, 300)).toMatchObject({ ok: true });
    expect(isLava(g, lava, 2)).toBe(false);
    g.mine.a.bricks = 2;
    expect(lavaRescue(g, 'a', ['a', 'b'], 400)).toMatchObject({ ok: true, friend: 'b' });
    expect(g.mine.b.raftRight).toBe(5);

    // A pretend class of 20 plays 3 minutes; the projector asks every half second.
    const clock = pretendClock();
    const pc = pretendClass({ size: 20, seed: 5, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'lava', map: 'forge', length: 3, run: 7 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    pc.play(room);
    for (let s = 0; s < 3 * 60 + 30; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    }
    const done = pc.db.rooms.get(room)!;
    expect(done.session.state).toBe('over');
    const lg = done.session.game as LavaGame;
    expect([lg.map, lg.runS]).toEqual(['forge', 7]);
    expect(lg.round!.n).toBeGreaterThan(10);
    const mines = Object.values(lg.mine);
    expect(mines.some((m) => m.up > 0) && mines.some((m) => m.falls > 0) && mines.some((m) => m.climbs > 0)).toBe(true);
    expect(lg.builtAll).toBeGreaterThan(0);
    const paid = [...pc.db.paid.values()].find((p) => p.activity === 'lava')!;
    expect(paid.players.every((p) => p.points >= 1 && p.points <= 10)).toBe(true);
    expect(paid.players.some((p) => (p.extra?.lava_rounds ?? 0) > 0)).toBe(true);
    expect(paid.players.filter((p) => p.champion).length).toBeGreaterThan(0);
  }, 60_000);
});
