import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import { encodeFlaps } from '../toonflap/engine';
import { WALL_WIDTH } from '../toonflap/config';
import {
  advanceRelay, flyStep, flyTurn, freshRelayMine, newFly, newRelay, PERK_COST, perkCost, READY_MS, relayAnswered, relayCourse, relaySpend, replayTurn,
  SEND_COOL_MS, startSpot, teamCourse, teamsFor, TROUBLE_COST, TURN_STEPS, type Effect, type RelayGame,
} from './relay';
import { relayAim } from './relayBot';

/** Flies a turn with the bot's aim rule, `steps` steps of flying. */
function flyBot(g: RelayGame, team: number, steps: number): number[] {
  const tm = g.teams[team];
  const course = teamCourse(relayCourse(g.race!.n, g.race!.seed), tm.effects);
  const s = newFly(tm.turn!);
  const flaps: number[] = [];
  while (s.t < steps && s.mode !== 'done') {
    const flap = s.mode === 'hover' || relayAim(course, tm.effects, s);
    if (flap) flaps.push(s.t);
    flyStep(course, tm.effects, s, flap);
  }
  return flaps;
}

describe('Toon Flap Relay', () => {
  it('teams, turns from where the last flyer got to, effects laid ahead, fair troubles, sparks and costs', () => {
    expect([1, 2, 5, 6, 9, 10, 23, 30, 40].map(teamsFor)).toEqual([1, 2, 2, 2, 2, 2, 5, 6, 6]);
    // The course is the same on every device; a new turn's bird never starts inside a wall.
    const c = relayCourse(1, 42);
    expect(relayCourse(1, 42)).toBe(c);
    expect(JSON.stringify(relayCourse(1, 42).walls)).toBe(JSON.stringify(c.walls));
    const w = c.walls[3];
    const inWall = startSpot(c, w.x + 0.3);
    expect(inWall.x).toBeLessThan(w.x);
    expect(inWall.w).toBe(3);

    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const g = newRelay(3);
    order.forEach((id) => { g.mine[id] = freshRelayMine(); });
    expect(advanceRelay(g, 0, order, rng(1), false).events.map((e) => e.type)).toEqual(['relay_race']);
    expect(g.teams.map((tm) => tm.members.length)).toEqual([5, 5]);
    const go = advanceRelay(g, READY_MS, order, rng(2), false).events.map((e) => e.type);
    expect(go).toEqual(['relay_go', 'relay_turn', 'relay_turn']);
    const [red, blue] = g.teams;
    const flyer = red.turn!.flyer;

    // Flaps can't run ahead of the clock, and a list that doesn't add up is refused.
    const flaps = flyBot(g, 0, 600);
    expect(flyTurn(g, flyer, red.turn!.n, [5, 3], '', 10, READY_MS + 10_000)).toEqual({ ok: false, reason: 'bad' });
    expect(flyTurn(g, 'b' === flyer ? 'c' : 'b', 1, flaps, '', 600, READY_MS + 10_000)).toMatchObject({ ok: false });
    flyTurn(g, flyer, red.turn!.n, flaps, encodeFlaps(flaps), 600, READY_MS + 1000);
    expect(red.turn!.at).toBeLessThan(120);
    expect(flyTurn(g, flyer, red.turn!.n, flaps, encodeFlaps(flaps), 600, READY_MS + 10_000)).toMatchObject({ ok: true, done: false });
    const x10 = red.x;
    expect(x10).toBeGreaterThan(red.turn!.x0 + 10);

    // Sparks: one per right answer (not while flying); a perk lands two walls ahead of the bird.
    const helper = red.members.find((id) => id !== flyer)!;
    expect(relayAnswered(g, flyer, true, READY_MS + 11_000)).toEqual({ ok: false, reason: 'not_now' });
    for (let k = 0; k < 4; k++) relayAnswered(g, helper, true, READY_MS + 11_000 + k * 1000);
    expect(g.mine[helper].sparks).toBe(4);
    const t = READY_MS + 15_000;
    expect(relaySpend(g, helper, 'ghost', t, rng(3))).toEqual({ ok: false, reason: 'locked' });
    expect(relaySpend(g, helper, 'wide', t, rng(3))).toMatchObject({ ok: true, to: 0 });
    const wide = red.effects[0];
    const rc = teamCourse(c, red.effects);
    expect(wide.x0).toBeGreaterThan(red.x);
    const widened = rc.walls.find((wl) => wl.x > wide.x0)!;
    expect(widened.gaps[0].h).toBeGreaterThan(relayCourse(1, g.race!.seed).walls[widened.i].gaps[0].h);
    // One send every 10 s; troubles go to a random free team (never your own), which is then safe for a while.
    expect(relaySpend(g, helper, 'shield', t + 1000, rng(4))).toEqual({ ok: false, reason: 'cool' });
    const blueHelper = blue.members.find((id) => id !== blue.turn!.flyer)!;
    g.mine[blueHelper].sparks = 6;
    expect(relaySpend(g, blueHelper, 'wind', t, rng(5))).toMatchObject({ ok: true, to: 0 });
    expect(g.mine[blueHelper].sparks).toBe(6 - TROUBLE_COST);
    g.mine[blueHelper].sendAt = -SEND_COOL_MS;
    expect(relaySpend(g, blueHelper, 'fog', t + 100, rng(6))).toEqual({ ok: false, reason: 'busy_teams' });
    // Catch-up: the leader's perks cost one more, the last team's one less.
    expect([perkCost(g, 0), perkCost(g, 1)]).toEqual([PERK_COST + 1, PERK_COST - 1]);

    // Effects in the physics: a shield takes one bump, ghost wings fly through a wall, an extra wall is fair.
    const plain = relayCourse(2, 7);
    const wall = plain.walls[2];
    const crash = { x0: wall.x - 2, y0: 0.4, w0: 2 };
    const sink = (fx: Effect[]) => {
      const s = newFly(crash);
      const out: string[] = [];
      flyStep(teamCourse(plain, fx), fx, s, true);
      for (let k = 0; k < 400 && s.mode === 'fly'; k++) {
        const e = flyStep(teamCourse(plain, fx), fx, s, false);
        if (e) out.push(e);
      }
      return { out, s };
    };
    expect(sink([]).out).toEqual(['bump']);
    const fx = (kind: Effect['kind'], x0: number, x1: number, extra: Partial<Effect> = {}): Effect => ({ id: 1, kind, x0, x1, by: 'a', from: 0, to: 0, at: 0, ...extra });
    expect(sink([fx('shield', 0, 999)]).out[0]).toBe('shield');
    const ghostWings = { x0: wall.x - 1.5, y0: wall.gaps[0].y, w0: 2 };
    const through = newFly(ghostWings);
    const gfx = [fx('ghost', wall.x - 3, wall.x + WALL_WIDTH + 1)];
    for (let k = 0; k < 200; k++) {
      const e = flyStep(teamCourse(plain, gfx), gfx, through, k % 9 === 0 && through.y < 2);
      expect(e === 'bump' && through.x < wall.x + WALL_WIDTH).toBe(false);
    }
    const extra = teamCourse(plain, [fx('wall', wall.x + 3, wall.x + 3 + WALL_WIDTH, { gapY: 5, gapH: 3 })]);
    expect(extra.walls.length).toBe(plain.walls.length + 1);
    expect(extra.walls.map((x) => x.i)).toEqual(extra.walls.map((_, i) => i));

    // A turn ends after 30 s of flying, and the next teammate carries on from there.
    const all = flyBot(g, 0, TURN_STEPS + 10);
    const end = flyTurn(g, flyer, red.turn!.n, all, encodeFlaps(all), TURN_STEPS, READY_MS + 40_000);
    expect(end).toMatchObject({ ok: true, done: true });
    expect(red.turn!.flyer).not.toBe(flyer);
    expect(red.turn!.x0).toBeGreaterThan(x10);
    expect(g.mine[flyer].flights).toBe(1);
    // Replays are exact: the same flaps, the same place.
    const again = replayTurn(teamCourse(c, red.effects), red.effects, red.turn!, [], 0);
    expect(again.state.x).toBe(red.turn!.x0);
  });

  it('a pretend class of 23 races three times: everyone flies, sparks are spent, a team wins, pays once', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 23, seed: 9, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'relay', races: 3, length: 15 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    pc.play(room);
    for (let s = 0; s < 15 * 60 && pc.db.rooms.get(room)!.session.state !== 'over'; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    }
    const done = pc.db.rooms.get(room)!;
    const g = done.session.game as RelayGame;
    expect([done.session.state, g.race!.n, g.teams.length]).toEqual(['over', 3, 5]);
    expect(g.teams.every((tm) => tm.members.length >= 4 && tm.members.length <= 5)).toBe(true);
    const mines = Object.values(g.mine);
    expect(mines.every((m) => m.flights > 0)).toBe(true);
    expect(mines.some((m) => m.perks > 0) && mines.some((m) => m.troubles > 0)).toBe(true);
    expect(g.wins.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2);
    expect(done.screen.events.some((e) => e.type === 'relay_end')).toBe(true);
    // Pupils' room copy has no ids; a flyer's own row has their turn.
    expect(JSON.stringify(done.view)).not.toContain(pc.ids[0]);
    const look = await classLiveStep(pc.services, pc.ids[0], { action: 'look', room });
    expect((look.body.me as { game: { kind: string } }).game.kind).toBe('relay');
    const paid = [...pc.db.paid.values()].find((p) => p.activity === 'relay')!;
    expect(paid.players.every((p) => p.points >= 1 && p.points <= 10 && p.extra && 'relay_wins' in p.extra)).toBe(true);
  });
});
