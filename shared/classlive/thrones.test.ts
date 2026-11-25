import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import { advance, APPEAR_GAP, bite, answered, freshMine, layThrones, makeRound, newThrones, sit, thronesFor, type ThronesGame } from './thrones';

describe('Musical Thrones', () => {
  it('rules: fewer thrones every round, sitting first, steals and shields, the courtyard, crowns', () => {
    // Fewer thrones every round, never more than last round, always fewer than players.
    expect([thronesFor(1, 30, null), thronesFor(5, 30, 20), thronesFor(20, 30, 11), thronesFor(1, 2, null), thronesFor(3, 1, 5)]).toEqual([27, 19, 10, 1, 1]);
    const spots = layThrones(36, rng(1));
    expect(spots.length).toBe(36);
    let near = 9;
    for (const a of spots) for (const b of spots) if (a !== b) near = Math.min(near, Math.hypot(a.x - b.x, a.y - b.y));
    expect(near).toBeGreaterThan(0.08);
    const g: ThronesGame = newThrones('castle');
    for (const [i, id] of ['a', 'b', 'c'].entries()) g.mine[id] = freshMine(i);
    const order = ['a', 'b', 'c'];
    advance(g, 4000, order, {}, rng(2));
    const r = g.round!;
    expect([r.n, r.thrones.length, r.musicEnd - r.startAt]).toEqual([1, 2, 9000]);
    const [t0, t1] = r.thrones;
    // No sitting while the music plays.
    expect(sit(g, 'a', t0.id, t0, r.musicEnd - 10)).toEqual({ ok: false, reason: 'not_now' });
    // The music stops: b is on a dance tile (+1 crown).
    const tile = r.tiles[0];
    advance(g, r.musicEnd, order, { a: { x: 0.5, y: 0.5 }, b: { x: tile.x, y: tile.y }, c: { x: 0.5, y: 0.5 } }, rng(3));
    expect([r.dancers, r.mimics]).toEqual([['b'], []]);
    // The thrones only appear now, away from everyone, so nobody could wait on one.
    const where = [{ x: 0.5, y: 0.5 }, tile];
    expect(r.thrones.every((th) => where.every((p) => Math.hypot(th.x - p.x, th.y - p.y) >= APPEAR_GAP))).toBe(true);
    expect(sit(g, 'a', t0.id, { x: t0.x + 0.3, y: t0.y }, r.musicEnd + 100)).toEqual({ ok: false, reason: 'far' });
    expect(sit(g, 'a', t0.id, t0, r.musicEnd + 100)).toMatchObject({ ok: true });
    expect(sit(g, 'b', t0.id, t0, r.musicEnd + 200)).toEqual({ ok: false, reason: 'taken' });
    expect(sit(g, 'b', t1.id, t1, r.musicEnd + 300)).toMatchObject({ ok: true });
    // c is left standing: courtyard, then 3 right in a row comes back with a Crown thief scroll.
    advance(g, r.scrambleEnd, order, {}, rng(4));
    expect([r.standing, g.mine.a.crowns, g.mine.b.crowns, g.mine.c.courtIn]).toEqual([['c'], 1, 2, 1]);
    for (let i = 0; i < 3; i++) answered(g, 'c', true, 'court', r.scrambleEnd + 2000 * (i + 1));
    expect([g.mine.c.courtRight, g.mine.c.held]).toEqual([3, 'steal']);
    // Round 2: c sits it out (one throne for a and b); round 3: c is back.
    advance(g, r.showEnd, order, {}, rng(5));
    expect([g.round!.n, g.round!.thrones.length, g.mine.c.courtIn]).toEqual([2, 1, 1]);
    const r2 = g.round!;
    advance(g, r2.musicEnd, order, {}, rng(6));
    sit(g, 'a', r2.thrones[0].id, r2.thrones[0], r2.musicEnd + 100);
    advance(g, r2.scrambleEnd, order, {}, rng(7));
    advance(g, r2.showEnd, order, {}, rng(8));
    const r3 = g.round!;
    expect([r3.n, g.mine.c.courtIn, g.mine.c.escapes]).toEqual([3, null, 1]);
    // A switched-on Crown thief knocks a sitter off (and takes a crown); a Royal shield stops it.
    answered(g, 'c', true, 'power', r3.startAt + 100);
    advance(g, r3.musicEnd, order, {}, rng(9));
    g.mine.a.crowns = 2;
    const th = r3.thrones[0];
    sit(g, 'a', th.id, th, r3.musicEnd + 50);
    expect(sit(g, 'c', th.id, th, r3.musicEnd + 100)).toMatchObject({ ok: true, bumped: 'a' });
    expect([th.by, g.mine.a.seat, g.mine.a.crowns, g.mine.c.steals]).toEqual(['c', null, 1, 1]);
    const g2: ThronesGame = { ...newThrones('ice'), mine: { a: freshMine(0), b: freshMine(1) } };
    g2.round = makeRound(g2, 4, 0, rng(1), 2);
    g2.mine.a.shieldIn = 4;
    g2.mine.b.stealIn = 4;
    g2.round.stopped = true;
    const th2 = g2.round.thrones[0];
    sit(g2, 'a', th2.id, th2, g2.round.musicEnd + 10);
    expect(sit(g2, 'b', th2.id, th2, g2.round.musicEnd + 20)).toEqual({ ok: false, reason: 'taken' });
    // A mimic (a throne with eyes, from round 2) eats whoever touches it: off to the courtyard.
    const mm = g2.round.mimics![0];
    expect(bite(g2, 'b', mm.id, { x: mm.x + 0.3, y: mm.y }, g2.round.musicEnd + 30)).toEqual({ ok: false, reason: 'far' });
    expect(bite(g2, 'a', mm.id, mm, g2.round.musicEnd + 30)).toEqual({ ok: false, reason: 'seated' });
    expect(bite(g2, 'b', mm.id, mm, g2.round.musicEnd + 40)).toMatchObject({ ok: true });
    expect([g2.round.mimics!.length, g2.mine.b.courtIn, g2.mine.b.eaten, mm.ate]).toEqual([1, 4, 1, ['b']]);
  });

  it('server: a pretend class of 24 plays a 3 minute game on the clock, the music hides nothing it shouldn\'t, and is paid', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 24, seed: 21, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'thrones', hall: 'pirate', length: 3 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    pc.play(room);
    const game = () => pc.db.rooms.get(room)!.session.game as ThronesGame;
    const counts: number[] = [];
    for (let s = 0; s < 3 * 60 + 40; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
      const n = game().round?.thrones.length;
      if (n !== undefined && counts[counts.length - 1] !== n) counts.push(n);
    }
    const done = pc.db.rooms.get(room)!;
    expect(done.session.state).toBe('over');
    const g = game();
    expect(g.hall).toBe('pirate');
    expect(g.round!.n).toBeGreaterThan(6);
    // Fewer thrones as the game goes on.
    expect(counts[counts.length - 1]).toBeLessThan(counts[0]);
    const mines = Object.values(g.mine);
    expect(mines.some((m) => m.sat > 0) && mines.some((m) => m.stood > 0) && mines.some((m) => m.escapes > 0)).toBe(true);
    expect(mines.some((m) => m.grabs > 0) && mines.some((m) => m.dances > 0)).toBe(true);
    // Pupils see which thrones are taken, never by whom.
    const look = await classLiveStep(pc.services, pc.ids[0], { action: 'look', room });
    expect(JSON.stringify(look.body.view)).not.toContain(pc.ids[1]);
    expect(done.screen.events.some((e) => e.type === 'seated')).toBe(true);
    const paid = [...pc.db.paid.values()].find((p) => p.activity === 'thrones')!;
    expect(paid.players.some((p) => (p.extra?.thrones_wins ?? 0) === 1)).toBe(true);
    expect(paid.players.every((p) => p.points >= 1 && p.points <= 10 && (p.extra?.thrones_crowns ?? -1) >= 0)).toBe(true);
  });
});
