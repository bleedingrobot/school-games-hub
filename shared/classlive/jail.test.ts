import { describe, expect, it } from 'vitest';
import { markQuestion } from '../maths/serverQuestions';
import { classLiveStep, type RoomView } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import type { JailGame } from './jail';
import type { JailPublic } from './jailServer';
import { makeCall, seeded, SIZES, type MingleCall } from './mingle';

describe('Real-life Four Corners', () => {
  it('server: any pupil on the class list answers their way out at a station, their maths and points are theirs, the teacher can let them out', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 6, seed: 5, clock, later: clock.later });
    const [station, b, , , notJoined, kid] = pc.ids;
    const step = (who: string, body: Record<string, unknown>) => classLiveStep(pc.services, who, body);
    // Lobby games aren't allowed (the class list is the class's).
    expect((await step(PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'jail', where: 'lobby', host: 'Mr Riley' })).status).toBe(400);
    const room = (await step(PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'jail', need: 3, map: 'space' })).body.room as number;
    await step(station, { action: 'join' });
    await step(b, { action: 'join' });
    await step(PRETEND_TEACHER, { action: 'start', room });
    const game = () => pc.db.rooms.get(room)!.session.game as JailGame;
    expect([game().need, game().map, game().roster.length]).toEqual([3, 'space', 6]);

    // Every name is on the stations; no scores.
    const look = await step(station, { action: 'look', room });
    const pub = (look.body.view as RoomView).game as JailPublic;
    expect([pub.roster.length, pub.inJail]).toEqual([6, []]);
    expect(JSON.stringify(pub)).not.toMatch(/right|wrong/);

    // Not on the list, or a device that hasn't joined: no.
    expect((await step(station, { action: 'play', room, do: 'in', as: PRETEND_TEACHER })).status).toBe(400);
    expect((await step(notJoined, { action: 'play', room, do: 'in', as: notJoined })).status).toBe(409);

    // A pupil with no device taps their name on someone's station: in jail, in the room, a question for them.
    await clock.run(clock.now() + 1000);
    const went = await step(station, { action: 'play', room, do: 'in', as: kid });
    expect(went.status).toBe(200);
    expect(went.body.kid).toMatchObject({ id: kid, inJail: true, right: 0, need: 3 });
    expect(pc.db.rooms.get(room)!.session.order).toContain(kid);
    let q = went.body.question as { slot: number };
    const answerOf = (slot: number) => markQuestion(pc.db.questions.get(`${room}:${kid}`)!.find((x) => x.slot === slot)!.question)!.answer;
    // One wrong (not in a row is fine), then 3 right: back in.
    const replies = [];
    for (const right of [true, false, true, true]) {
      await clock.run(clock.now() + 1000);
      const r = await step(station, { action: 'answer', room, as: kid, slot: q.slot, answer: right ? answerOf(q.slot) : answerOf(q.slot) + 1, ms: 2000 });
      replies.push([r.status, r.body.right, r.body.back]);
      q = r.body.question as { slot: number };
    }
    expect(replies).toEqual([[200, true, false], [200, false, false], [200, true, false], [200, true, true]]);
    expect([game().mine[kid].inAt, game().mine[kid].backs, game().backs.length]).toEqual([null, 1, 1]);
    expect(pc.db.rooms.get(room)!.events.some((e) => e.type === 'jail_back' && (e as { pupil: string }).pupil === kid)).toBe(true);
    // The maths went to the pupil who answered, not the station's owner.
    expect(pc.db.answers.filter((a) => a.player === kid).length).toBe(4);
    expect(pc.db.answers.some((a) => a.player === station)).toBe(false);

    // "Not you?" takes the name off the list; the teacher can let someone out too.
    await step(station, { action: 'play', room, do: 'in', as: b });
    expect(game().mine[b].inAt).not.toBeNull();
    await step(station, { action: 'play', room, do: 'undo', as: b });
    expect(game().mine[b].inAt).toBeNull();
    await step(b, { action: 'play', room, do: 'in', as: station });
    expect((await step(PRETEND_TEACHER, { action: 'jailfree', room, pupil: station })).status).toBe(200);
    expect([game().mine[station].inAt, game().mine[station].backs]).toEqual([null, 0]);

    // Paid at the end: the pupil who answered gets the "did some maths" points and a comeback for the trophy.
    await step(PRETEND_TEACHER, { action: 'end', room });
    const paid = [...pc.db.paid.values()][0];
    const mine = paid.players.find((p) => p.player === kid)!;
    expect([mine.points, mine.extra]).toEqual([3, { jail_backs: 1 }]);
    expect(paid.players.find((p) => p.player === b)!.points).toBe(1);
  });

  it('Maths Mingle: the calls make the group size, climb each round, and left-over pupils use the same stations', async () => {
    // Every call's sum works out to its group size, within the level's sizes, never the same size twice running.
    const worth = (sum: string) => Function(`return (${sum.replace(/half of (\d+)/, '($1/2)').replace(/double (\d+)/, '(2*$1)').replace(/a quarter of (\d+)/, '($1/4)').replace(/(\d+)% of (\d+)/, '($1/100*$2)').replace(/√(\d+)/, 'Math.sqrt($1)').replace(/2³/, '8').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')})`)() as number;
    for (const level of ['junior', 'senior'] as const) {
      const r = seeded(level === 'junior' ? 3 : 4);
      let last: MingleCall | null = null;
      for (let round = 1; round <= 40; round++) {
        const c = makeCall(level, round, r, { last, twists: true, players: 28 });
        expect([SIZES[level].includes(c.size), c.size !== last?.size, worth(c.sum)]).toEqual([true, true, c.size]);
        expect(c.tier).toBe(round <= 3 ? 0 : round <= 6 ? 1 : 2);
        if (c.twist) expect(last?.twist ?? null).toBeNull();
        last = c;
      }
    }

    const clock = pretendClock();
    const pc = pretendClass({ size: 4, seed: 9, clock, later: clock.later });
    const [station, , , kid] = pc.ids;
    const step = (who: string, body: Record<string, unknown>) => classLiveStep(pc.services, who, body);
    const room = (await step(PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'mingle', need: 3, level: 'junior', twists: false })).body.room as number;
    await step(station, { action: 'join' });
    await step(PRETEND_TEACHER, { action: 'start', room });
    const game = () => pc.db.rooms.get(room)!.session.game as JailGame;
    expect([game().mode, game().level, game().twists, game().roster.length]).toEqual(['mingle', 'junior', false, 4]);
    const pub = (await step(station, { action: 'look', room })).body.view as RoomView;
    expect([pub.activity, (pub.game as JailPublic).mode]).toEqual(['mingle', 'mingle']);
    let q = (await step(station, { action: 'play', room, do: 'in', as: kid })).body.question as { slot: number };
    for (let i = 0; i < 3; i++) {
      await clock.run(clock.now() + 1000);
      const right = markQuestion(pc.db.questions.get(`${room}:${kid}`)!.find((x) => x.slot === q.slot)!.question)!.answer;
      q = (await step(station, { action: 'answer', room, as: kid, slot: q.slot, answer: right, ms: 2000 })).body.question as { slot: number };
    }
    expect(game().mine[kid].backs).toBe(1);
    await step(PRETEND_TEACHER, { action: 'end', room });
    expect([...pc.db.paid.values()][0].players.find((p) => p.player === kid)!.extra).toEqual({ mingle_backs: 1 });
  });
});
