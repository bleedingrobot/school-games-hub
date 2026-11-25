import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import { advance, answered, CRYPT, freshMine, ghostCount, grab, HIDE_MS, makeRound, newGhost, READY_MS, RISE_MS, stepGhost, TAG_R, type GhostGame } from './ghost';
import { ghostSpotsOf } from './ghostBot';

describe('Ghost Tag', () => {
  it('tags by saved spots, invisibility and shields, rounds to the last one standing, pupils see roles, pays once', async () => {
    expect([ghostCount(1), ghostCount(2), ghostCount(10), ghostCount(11), ghostCount(25), ghostCount(40)]).toEqual([0, 1, 1, 2, 3, 4]);
    // A round: starters in the crypt, everyone else round the edge; ghosts can't leave the crypt before the hunt.
    const g: GhostGame = newGhost('graveyard');
    const order = ['a', 'b', 'c', 'd'];
    order.forEach((id, i) => { g.mine[id] = freshMine(i, 4); });
    expect(advance(g, 0, order, {}, rng(1)).map((e) => e.type)).toEqual(['g_round']);
    const r = g.round!;
    const [ghost] = r.starters;
    const [h1, h2, h3] = order.filter((id) => id !== ghost);
    const far = { x: 0.1, y: 0.9 };
    expect(Math.hypot(g.mine[ghost].spot.x - 0.5, g.mine[ghost].spot.y - 0.5)).toBeLessThan(CRYPT.r);
    const held = stepGhost({ p: { x: 0.5, y: 0.5 }, v: { x: 0, y: 0 } }, { x: 1, y: 0 }, 100, r, READY_MS - 500, { ghost: true, speed: 3 });
    expect(held.p.x - 0.5).toBeLessThan(CRYPT.r);
    // Pupils bump into stones; ghosts glide through.
    const st = r.stones[0];
    const into = { p: { x: st.x - st.r - 0.031, y: st.y }, v: { x: 0, y: 0 } };
    expect(stepGhost(into, { x: 1, y: 0 }, 100, r, r.startAt, { ghost: false, speed: 0.28 }).p.x).toBeLessThan(st.x - st.r);
    expect(stepGhost(into, { x: 1, y: 0 }, 100, r, r.startAt, { ghost: true, speed: 0.28 }).p.x).toBeGreaterThan(st.x - st.r - 0.01);

    // No tags before the hunt; then a ghost within TAG_R catches. Invisible pupils can't be caught (but a lantern finds them).
    const t = r.startAt + 100;
    const near = { x: 0.3, y: 0.3 };
    const close = { x: 0.3 + TAG_R * 0.8, y: 0.3 };
    expect(advance(g, r.startAt - 10, order, { [ghost]: near, [h1]: close }, rng(2))).toEqual([]);
    g.mine[h1].lastAt = -10_000;
    const right = answered(g, h1, true, t);
    expect(right).toMatchObject({ ok: true, gave: 'hide' });
    expect(g.mine[h1].hideTo).toBe(t + HIDE_MS);
    expect(advance(g, t + 50, order, { [ghost]: near, [h1]: close, [h2]: { x: 0.9, y: 0.9 }, [h3]: far }, rng(3))).toEqual([]);
    // The ghost's own pad: it can't see the invisible pupil, until its lantern (its second right answer) is lit.
    const spots = { [ghost]: near, [h1]: close, [h2]: { x: 0.9, y: 0.9 }, [h3]: far };
    expect(ghostSpotsOf(g, t + 60, spots, ghost).spots.map((s) => s[2])).toEqual([0, 0]);
    expect(answered(g, ghost, true, t + 100)).toMatchObject({ gave: 'dash' });
    expect(answered(g, ghost, true, t + 100 + 1600)).toMatchObject({ gave: 'lantern' });
    expect(ghostSpotsOf(g, t + 1800, spots, ghost).spots.map((s) => s[2]).sort()).toEqual([0, 0, 3]);
    expect(ghostSpotsOf(g, t + 1800, spots, h2).spots.filter((x) => x[2] === 1)).toEqual([[0.3, 0.3, 1]]);
    // Lantern lit: caught even while invisible; a new ghost rises before it can catch.
    expect(advance(g, t + 1900, order, spots, rng(4)).map((e) => e.type)).toEqual(['g_tag']);
    expect([g.mine[h1].ghost, g.mine[ghost].tags]).toEqual([true, 1]);
    // A garlic shield bounces one catch.
    g.mine[h2].shield = true;
    expect(advance(g, t + 2000, order, { ...spots, [h1]: { x: 0.8, y: 0.8 }, [h2]: { x: 0.31, y: 0.3 } }, rng(5)).map((e) => e.type)).toEqual(['g_bounce']);
    expect(g.mine[h2].shield).toBe(false);
    // The last one standing wins the round when the rest are caught; then a new round with new ghosts.
    const end = advance(g, t + 2000 + RISE_MS + 2500, order, { [ghost]: { x: 0.2, y: 0.2 }, [h1]: { x: 0.85, y: 0.85 }, [h2]: { x: 0.86, y: 0.85 }, [h3]: far }, rng(6));
    expect(end.map((e) => e.type)).toEqual(['g_tag', 'g_end']);
    expect([r.done?.why, r.done?.winners, g.mine[h3].crowns, g.mine[h3].last]).toEqual(['last', [h3], 1, 'last']);
    const r1 = g.round!;
    advance(g, r1.showEnd!, order, {}, rng(7));
    expect(g.round!.n).toBe(2);
    expect(order.every((id) => g.mine[id].ghost === g.round!.starters.includes(id))).toBe(true);
    expect(g.round!.starters).not.toContain(ghost);
    // Power-ups from round 2: a grab is checked against the saved spot; a frost bomb freezes ghosts near.
    const r2 = makeRound(g, 2, 0, order, rng(8));
    g.round = r2;
    const it2 = r2.items[0];
    const pupil = order.find((id) => !g.mine[id].ghost)!;
    expect(grab(g, pupil, it2.id, { x: it2.x + 0.4, y: it2.y }, 10)).toEqual({ ok: false, reason: 'far' });
    expect(grab(g, pupil, it2.id, { x: it2.x, y: it2.y }, 10)).toMatchObject({ ok: true });

    // A pretend class of 25 runs a 3 minute game; the big screen asks the server twice a second.
    const clock = pretendClock();
    const pc = pretendClass({ size: 25, seed: 5, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'ghost', map: 'ship', length: 3 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    pc.play(room);
    for (let s = 0; s < 3 * 60 + 20; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    }
    const done = pc.db.rooms.get(room)!;
    const gg = done.session.game as GhostGame;
    expect([done.session.state, gg.map, gg.round!.starters.length]).toEqual(['over', 'ship', 3]);
    const mines = Object.values(gg.mine);
    expect(mines.some((m) => m.tags > 0) && mines.some((m) => m.vanishes > 0) && mines.some((m) => m.crowns > 0)).toBe(true);
    expect(done.screen.events.some((e) => e.type === 'g_tag')).toBe(true);
    // Pupils' room copy has no ids; a pupil's own row says if they are a ghost.
    expect(JSON.stringify(done.view)).not.toContain(pc.ids[0]);
    const look = await classLiveStep(pc.services, pc.ids[0], { action: 'look', room });
    expect((look.body.me as { game: { kind: string; ghost: boolean } }).game.kind).toBe('ghost');
    const paid = [...pc.db.paid.values()].find((p) => p.activity === 'ghost')!;
    expect(paid.players.every((p) => p.points >= 1 && p.points <= 10 && p.extra && 'ghost_tags' in p.extra)).toBe(true);
  });
});
