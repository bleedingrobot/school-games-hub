import { describe, expect, it } from 'vitest';
import { markQuestion } from '../maths/serverQuestions';
import { classLiveStep, type RoomView } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import { BOOST, SMALL_BOOST, type RocketGame } from './rocket';
import type { RocketPublic } from './rocketServer';

describe('Rocket Relay', () => {
  it('server: teams from the class list, the runner checks in at their team iPad, boosts, a second try, the Moon, points', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 6, seed: 7, clock, later: clock.later });
    const [station] = pc.ids;
    const step = (who: string, body: Record<string, unknown>) => classLiveStep(pc.services, who, body);
    expect((await step(PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'rocket', where: 'lobby', host: 'Mr Riley' })).status).toBe(400);
    const room = (await step(PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'rocket', teams: 2, perRun: 1 })).body.room as number;
    await step(station, { action: 'join' });
    await step(PRETEND_TEACHER, { action: 'start', room });
    const game = () => pc.db.rooms.get(room)!.session.game as RocketGame;
    // 6 pupils in 2 teams of 3; the Moon is 3 laps of 3 runners, a full boost each.
    expect([game().teams.map((t) => t.order.length), game().moon]).toEqual([[3, 3], 3 * 3 * BOOST]);
    const pub = (await step(station, { action: 'look', room })).body.view as RoomView;
    expect(JSON.stringify(pub.game)).not.toMatch(/rightAll|wrong/);

    const t0 = game().teams[0];
    const [first, second] = t0.order;
    // Only the runner whose turn it is can check in, on their own team.
    expect((await step(station, { action: 'play', room, team: 0, do: 'here', as: second })).status).toBe(409);
    expect((await step(station, { action: 'play', room, team: 1, do: 'here', as: first })).status).toBe(400);
    let r = await step(station, { action: 'play', room, team: 0, do: 'here', as: first });
    expect([r.status, (r.body.kid as { here: boolean }).here]).toEqual([200, true]);
    const answerOf = (who: string, slot: number) => markQuestion(pc.db.questions.get(`${room}:${who}`)!.find((x) => x.slot === slot)!.question)!.answer;
    const go = async (who: string, right: boolean) => {
      await clock.run(clock.now() + 1000);
      const q = r.body.question as { slot: number };
      r = await step(station, { action: 'answer', room, team: 0, as: who, slot: q.slot, answer: right ? answerOf(who, q.slot) : answerOf(who, q.slot) + 1, ms: 2000 });
      return [r.status, r.body.right, r.body.runOver, r.body.boost];
    };
    // Right first time: a full boost, run over, the next runner is up.
    expect(await go(first, true)).toEqual([200, true, true, BOOST]);
    expect([game().teams[0].height, game().teams[0].active, (pc.db.rooms.get(room)!.session.game as RocketGame).teams[0].turn]).toEqual([BOOST, null, 1]);
    // Wrong, then right on the second try: a smaller boost. Wrong twice: run over with nothing.
    r = await step(station, { action: 'play', room, team: 0, do: 'here', as: second });
    expect(await go(second, false)).toEqual([200, false, false, 0]);
    expect(await go(second, true)).toEqual([200, true, true, SMALL_BOOST]);
    const third = t0.order[2];
    r = await step(station, { action: 'play', room, team: 0, do: 'here', as: third });
    expect(await go(third, false)).toEqual([200, false, false, 0]);
    expect(await go(third, false)).toEqual([200, false, true, 0]);
    expect(game().teams[0].height).toBe(BOOST + SMALL_BOOST);
    // Skipping someone who isn't here today.
    await step(station, { action: 'play', room, team: 1, do: 'skip', as: game().teams[1].order[0] });
    expect(game().teams[1].turn).toBe(1);
    // The maths went to the runners, not the station's owner.
    expect(pc.db.answers.filter((a) => a.player === third).length).toBe(2);

    // To the Moon: team 0 wins, no more answers.
    game().teams[0].height = game().moon - BOOST;
    const next = game().teams[0].order[game().teams[0].turn % 3];
    r = await step(station, { action: 'play', room, team: 0, do: 'here', as: next });
    expect(await go(next, true)).toEqual([200, true, true, BOOST]);
    expect(game().winner).toBe(0);
    const view = (await step(station, { action: 'look', room })).body.view as RoomView;
    expect((view.game as RocketPublic).winner).toBe(0);

    await step(PRETEND_TEACHER, { action: 'end', room });
    const paid = [...pc.db.paid.values()][0];
    const of = (id: string) => paid.players.find((p) => p.player === id)!;
    // A right answer on the winning team (first also ran the Moon lap): 3 + 2; wrong twice on the winning team: joined only.
    expect([of(first).points, of(first).extra]).toEqual([5, { rocket_runs: 2, rocket_wins: 1 }]);
    expect(of(third).points).toBe(1);
  });
});
