import { describe, expect, it } from 'vitest';
import { markQuestion } from '../maths/serverQuestions';
import { classLiveStep, type PlayerView, type RoomView } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import { FIRST_MS, holds, REVEAL_MS, STAND_MS, targetFor, type StandGame } from './stand';
import type { StandPlayer } from './standServer';

describe('Stand Up If', () => {
  it('server: own question and number, Stand or Sit, everyone in starts the countdown, the reveal, streaks, points', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 4, seed: 3, clock, later: clock.later });
    const [ana, ben, cat, dan] = pc.ids;
    const step = (who: string, body: Record<string, unknown>) => classLiveStep(pc.services, who, body);
    const room = (await step(PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'stand', level: 'junior', think: 20, length: 5 })).body.room as number;
    for (const id of [ana, ben, cat]) await step(id, { action: 'join', room });
    await step(PRETEND_TEACHER, { action: 'start', room });
    const game = () => pc.db.rooms.get(room)!.session.game as StandGame;
    const start = clock.now();
    await clock.run(start + FIRST_MS + 1600);
    await step(ana, { action: 'look', room });
    const r1 = game().round!;
    expect([r1.n, ['>', '<'].includes(r1.sign)]).toEqual([1, true]);

    const answerOf = (who: string, slot: number) => markQuestion(pc.db.questions.get(`${room}:${who}`)!.find((x) => x.slot === slot)!.question)!.answer;
    /** Ask, answer (right or not), then tap: the right choice for the real answer, or the wrong one. */
    const play = async (who: string, right: boolean, choice: 'truth' | 'wrong') => {
      await clock.run(clock.now() + 700);
      const a = await step(who, { action: 'ask', room });
      const q = a.body.question as { slot: number };
      const n = a.body.n as number;
      const truth = holds(answerOf(who, q.slot), a.body.sign as '>', a.body.target as number);
      const out = await step(who, { action: 'answer', room, n, slot: q.slot, answer: right ? answerOf(who, q.slot) : answerOf(who, q.slot) + 1, ms: 3000 });
      expect([out.status, out.body.right]).toEqual([200, right]);
      // Only once a round.
      expect((await step(who, { action: 'answer', room, n, slot: q.slot, answer: 1, ms: 3000 })).status).toBe(409);
      expect((await step(who, { action: 'play', room, n, stand: choice === 'truth' ? truth : !truth })).status).toBe(200);
    };
    const mine = async (who: string) => ((await step(who, { action: 'look', room })).body.me as PlayerView).game as StandPlayer;

    // The public room never carries anyone's answers or numbers.
    const pub = (await step(ana, { action: 'look', room })).body.view as RoomView;
    expect(JSON.stringify(pub.game)).not.toMatch(/target|answer|mine/);

    await play(ana, true, 'truth');
    await play(ben, true, 'wrong');
    // Cat hasn't tapped: the countdown waits for the clock. Then Cat answers wrong; everyone is in, so it starts soon.
    expect(game().round!.standAt).toBe(r1.from + 20_000);
    await play(cat, false, 'truth');
    const standAt = game().round!.standAt;
    expect(standAt).toBeLessThan(r1.from + 20_000);
    // Dan joins late, during the round: no go, no broken streak. Too late to tap once the countdown starts.
    await step(dan, { action: 'join', room });
    await clock.run(start + standAt + 10);
    expect((await step(dan, { action: 'ask', room })).status).toBe(409);

    await clock.run(start + standAt + STAND_MS + 1600);
    expect([(await mine(ana)).last?.spot, (await mine(ana)).streak, (await mine(ben)).last?.spot, (await mine(cat)).last?.spot]).toEqual([true, 1, false, false]);
    expect([game().round!.spot, game().round!.took]).toEqual([1, 3]);

    // Round 2: Ana right again (streak 2); Ben doesn't answer at all (streak stays 0); the teacher's Go starts the countdown.
    await clock.run(start + standAt + STAND_MS + REVEAL_MS + 1600);
    await step(ana, { action: 'look', room });
    expect(game().round!.n).toBe(2);
    await play(ana, true, 'truth');
    await play(dan, true, 'truth');
    await step(PRETEND_TEACHER, { action: 'standgo', room });
    const s2 = game().round!.standAt;
    await clock.run(start + s2 + STAND_MS + 1600);
    expect([(await mine(ana)).streak, (await mine(ana)).best, (await mine(dan)).streak, (await mine(ben)).streak]).toEqual([2, 2, 1, 0]);
    // The maths went into each pupil's records.
    expect(pc.db.answers.filter((a) => a.player === ana).length).toBe(2);

    await step(PRETEND_TEACHER, { action: 'end', room });
    const paid = [...pc.db.paid.values()][0];
    const of = (id: string) => paid.players.find((p) => p.player === id)!;
    // A round right: 3. No streak of 3 yet, so no bonus. Never right: joined only.
    expect([of(ana).points, of(ana).extra, of(cat).points]).toEqual([3, { stand_spots: 2, stand_streaks: 0 }, 1]);

    // Juniors' numbers: near the answer, never equal, never below zero. Seniors sometimes get the answer itself.
    const rand = (() => { let x = 0.1; return () => (x = (x * 9301 + 0.49297) % 1); })();
    const js = Array.from({ length: 200 }, () => targetFor(6, '>', 'junior', rand));
    expect(js.every((v) => v !== 6 && v >= 0 && Math.abs(v - 6) <= 3)).toBe(true);
    expect(Array.from({ length: 200 }, () => targetFor(4.5, '≥', 'senior', rand)).some((v) => v === 4.5)).toBe(true);
  });
});
