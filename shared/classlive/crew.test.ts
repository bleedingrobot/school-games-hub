import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import {
  advance, answered, callMeeting, castVote, countVotes, fakeWork, freshMine, glitchCount, grab, jam, JAM_DELAY, JAM_COOL, lightsOff, MACHINES, makeRound,
  meetingControl, newCrew, phaseOf, publicCrew, purposeAt, REVEAL_MS, ROLE_MS, TALK_MS, type CrewGame,
} from './crew';
import { crewSpotsOf } from './crewBot';

const by = (id: number) => ({ x: MACHINES[id].x + MACHINES[id].r + 0.04, y: MACHINES[id].y });

describe('Saboteur Crew', () => {
  it('delayed jams, fixing, jobs, the power bar, meetings, secret votes, drones and wins', () => {
    expect([glitchCount(2), glitchCount(3), glitchCount(8), glitchCount(12), glitchCount(25), glitchCount(40)]).toEqual([0, 1, 1, 2, 3, 4]);
    const g: CrewGame = newCrew();
    const order = ['p-anna', 'p-ben', 'p-cara', 'p-dan', 'p-eve', 'p-finn', 'p-gus', 'p-hana'];
    order.forEach((id, i) => { g.mine[id] = freshMine(i, order.length, rng(i + 1)); });
    expect(advance(g, 0, order, rng(1)).map((e) => e.type)).toEqual(['c_round']);
    const r = g.round!;
    expect(r.glitches.length).toBe(1);
    const [glitch] = r.glitches;
    const crew = order.filter((id) => id !== glitch);
    expect(phaseOf(r, ROLE_MS - 1)).toBe('roles');
    const t0 = r.startAt + 9000;
    // Glitches get no questions; Crew get a job question at a job machine.
    expect(purposeAt(g, glitch, by(0), t0)).toBeNull();
    const c1 = crew[0];
    const job = g.mine[c1].jobs[0];
    expect(purposeAt(g, c1, by(job), t0)).toEqual({ kind: 'job', machine: job });
    expect(purposeAt(g, c1, { x: 0.5, y: 0.5 }, t0)).toBeNull();
    // A right job answer fills the power bar.
    expect(answered(g, c1, true, { kind: 'job', machine: job }, t0, order, rng(2))).toMatchObject({ ok: true, gave: 'job' });
    expect(r.power).toBeGreaterThan(0);
    // A jam sparks JAM_DELAY later, and only then shows on pupils' devices; the Glitch waits before jamming again.
    expect(jam(g, glitch, 0, { x: 0.9, y: 0.9 }, t0)).toEqual({ ok: false, reason: 'far' });
    expect(jam(g, glitch, 0, by(0), t0)).toMatchObject({ ok: true });
    expect(jam(g, glitch, 1, by(1), t0 + 100)).toEqual({ ok: false, reason: 'wait' });
    expect(advance(g, t0 + 500, order, rng(3))).toEqual([]);
    expect(publicCrew(g, order).round!.machines[0].sparked).toBe(false);
    expect(JSON.stringify(publicCrew(g, order))).not.toContain(glitch);
    expect(advance(g, t0 + JAM_DELAY, order, rng(3)).map((e) => e.type)).toEqual(['c_spark']);
    const p1 = r.power;
    advance(g, t0 + JAM_DELAY + 10_000, order, rng(3));
    expect(r.power).toBeLessThan(p1);
    // The big machine needs 3 right answers (from anyone near); then it's mended.
    const fixAt = t0 + JAM_DELAY + 11_000;
    expect(purposeAt(g, crew[1], by(0), fixAt)).toEqual({ kind: 'fix', machine: 0 });
    answered(g, crew[1], true, { kind: 'fix', machine: 0 }, fixAt, order, rng(4));
    answered(g, crew[2], true, { kind: 'fix', machine: 0 }, fixAt, order, rng(4));
    expect(answered(g, crew[3], true, { kind: 'fix', machine: 0 }, fixAt, order, rng(4))).toMatchObject({ gave: 'mended' });
    expect(r.machines[0].sparked).toBe(false);
    expect(g.mine[crew[3]].mends).toBe(1);
    // A pretend job for the Glitch (no power).
    const fake = g.mine[glitch].jobs[0];
    const before = r.power;
    expect(fakeWork(g, glitch, fake, by(fake), fixAt + 1000, rng(5))).toEqual({ ok: true });
    expect([r.power, g.mine[glitch].fakeJobs]).toEqual([before, 1]);

    // The teacher's meeting: everyone to the Canteen, the clock stops, 40 s talk, then the secret vote.
    const mAt = fixAt + 2000;
    const endBefore = r.endAt;
    expect(callMeeting(g, mAt, order)).toMatchObject({ ok: true });
    expect(phaseOf(r, mAt + 1000)).toBe('talk');
    expect(castVote(g, c1, glitch, mAt + 1000, order)).toEqual({ ok: false, reason: 'not_now' });
    expect(meetingControl(g, mAt + 5000, 'vote')).toMatchObject({ ok: true });
    const vAt = mAt + 6000;
    expect(castVote(g, c1, c1, vAt, order)).toEqual({ ok: false, reason: 'bad' });
    for (const id of crew.slice(0, 5)) expect(castVote(g, id, glitch, vAt, order)).toEqual({ ok: true });
    castVote(g, crew[5], 'skip', vAt, order);
    castVote(g, crew[6], crew[0], vAt, order);
    castVote(g, glitch, crew[0], vAt, order);
    // Everyone voted: counted at once. The Glitch becomes a drone; the screen says what they were; voters who found them count it.
    expect(advance(g, vAt + 100, order, rng(6))).toEqual([{ type: 'c_out', t: vAt + 100, pupil: glitch, glitch: true }]);
    expect([g.mine[glitch].drone, g.mine[crew[0]].detects, g.mine[crew[5]].detects]).toEqual([true, 1, 0]);
    expect(publicCrew(g, order).round!.meeting).toMatchObject({ out: true, glitch: true, voted: 8 });
    // The last Glitch found: the Crew win the round.
    const ended = advance(g, vAt + 100 + REVEAL_MS, order, rng(7));
    expect(ended.map((e) => e.type)).toEqual(['c_end']);
    expect([r.done?.winner, r.done?.why, g.mine[c1].wins, g.mine[glitch].wins]).toEqual(['crew', 'found', 1, 0]);
    expect(endBefore).toBe(r.endAt);
    expect(countVotes({ a: 'x', b: 'y' }).out).toBeNull();
    expect(countVotes({ a: 'skip', b: 'skip', c: 'x' }).out).toBeNull();

    // Round 3: lights out; Crew only see close by unless they're a Glitch; two right answers at the panel switch them back on.
    const r3 = makeRound(g, 3, 100_000, order, rng(8));
    g.round = r3;
    const gl = r3.glitches[0];
    const cr = order.filter((id) => id !== gl);
    const lt = r3.startAt + 1000;
    expect(lightsOff(g, gl, lt)).toMatchObject({ ok: true });
    expect(lightsOff(g, gl, lt + 100)).toEqual({ ok: false });
    const spots = Object.fromEntries(order.map((id, i) => [id, { x: 0.1 + i * 0.1, y: 0.5 }]));
    expect(crewSpotsOf(g, lt + 10, spots, cr[0]).spots.length).toBeLessThan(order.length - 1);
    expect(crewSpotsOf(g, lt + 10, spots, gl).spots.length).toBe(order.length - 1);
    expect(purposeAt(g, cr[0], by(5), lt + 10)).toEqual({ kind: 'lights' });
    answered(g, cr[0], true, { kind: 'lights' }, lt + 10, order, rng(9));
    expect(answered(g, cr[1], true, { kind: 'lights' }, lt + 20, order, rng(9))).toMatchObject({ gave: 'lights_on' });
    // Power-ups (rounds with them): picked up by Crew only, switched on by the next right answer.
    if (r3.items.length) {
      const it = r3.items[0];
      expect(grab(g, gl, it.id, it, lt + 30)).toEqual({ ok: false, reason: 'not_now' });
      expect(grab(g, cr[2], it.id, it, lt + 30)).toMatchObject({ ok: true });
      expect(g.mine[cr[2]].held).toBe(it.power);
    }
    // Four machines sparking at once: the Glitches win.
    for (const id of [1, 2, 3, 4]) Object.assign(r3.machines[id], { jamAt: lt, sparkAt: lt + 50, sparked: false });
    expect(advance(g, lt + 2000, order, rng(10)).map((e) => e.type)).toEqual(['c_spark', 'c_spark', 'c_spark', 'c_spark', 'c_end']);
    expect([r3.done?.winner, r3.done?.why, g.mine[gl].glitchWins]).toEqual(['glitch', 'jammed', 1]);
    expect(JAM_COOL).toBeGreaterThan(JAM_DELAY);
    expect(TALK_MS).toBe(40_000);
  });

  it('a pretend class plays a whole game through the server: meetings, votes, rounds, pays once, keeps roles secret', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 16, seed: 9, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'crew', length: 5 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    pc.play(room);
    let meetings = 0;
    for (let s = 0; s < 5 * 60 + 30; s += 0.5) {
      await clock.run(clock.now() + 500);
      // The teacher calls a meeting about once a minute.
      if (s > 0 && s % 60 === 30) {
        const out = await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'crew', room, do: 'meeting' });
        if (out.status === 200) meetings++;
      }
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    }
    const done = pc.db.rooms.get(room)!;
    const g = done.session.game as CrewGame;
    expect(done.session.state).toBe('over');
    expect(meetings).toBeGreaterThan(0);
    const mines = Object.values(g.mine);
    expect(mines.some((m) => m.jobsDone > 0) && mines.some((m) => m.jams > 0) && mines.some((m) => m.wins > 0)).toBe(true);
    expect(done.screen.events.some((e) => e.type === 'c_end' || e.type === 'c_out' || e.type === 'c_job')).toBe(true);
    // Pupils' room copy has no ids; only a Glitch's own row names the other Glitches.
    expect(JSON.stringify(done.view)).not.toContain(pc.ids[0]);
    const look = await classLiveStep(pc.services, pc.ids[0], { action: 'look', room });
    expect((look.body.me as { game: { kind: string } }).game.kind).toBe('crew');
    // A pupil can't call a meeting.
    expect((await classLiveStep(pc.services, pc.ids[0], { action: 'crew', room, do: 'meeting' })).status).toBe(403);
    const paid = [...pc.db.paid.values()].find((p) => p.activity === 'crew')!;
    expect(paid.players.every((p) => p.points >= 1 && p.points <= 10 && p.extra && 'crew_mends' in p.extra)).toBe(true);
    expect(paid.players.some((p) => p.points >= 4)).toBe(true);
  });
});
