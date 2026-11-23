/**
 * The showdown function on the pretend database (shared/showdown/memoryServices.ts). Server tests 1 to 4 of the game's 12
 * (Stage 1 used 4 rules tests), and Stage 4's two (tests 11 and 12).
 */
import { expect, it } from 'vitest';
import { markQuestion } from '../../../shared/maths/serverQuestions';
import { memoryDb, memoryServices, type MemoryDb } from '../../../shared/showdown/memoryServices';
import { pretendClass, pretendClock, PRETEND_CLASS, PRETEND_TEACHER } from '../../../shared/showdown/pretendClass';
import { makeQuestion, type FeedEvent } from '../../../shared/showdown/server';
import { isUntimed } from '../../../shared/maths/untimed';
import { makeHandler } from './handler';

const T0 = 1_800_000_000_000;
const ROOM4 = '00000000-0000-4000-8000-0000000000c4';
const ROOM5 = '00000000-0000-4000-8000-0000000000c5';

function setup(db: MemoryDb = memoryDb({
  pupils: [{ id: 'ana', name: 'Ana', classId: ROOM4 }, { id: 'ben', name: 'Ben', classId: ROOM4 }, { id: 'cat', name: 'Cat', classId: ROOM5 }],
  teachers: { miss: [ROOM4], mr: [ROOM5] },
}), clock = { t: T0 }) {
  const services = { ...memoryServices(db, { now: () => clock.t, random: () => 0.5 }), userIdFor: async (token: string) => (token.startsWith('who:') ? token.slice(4) : null) };
  const handler = makeHandler(services);
  const send = async (body: object, who: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (who) headers.Authorization = `Bearer who:${who}`;
    const r = await handler(new Request('http://x/showdown', { method: 'POST', headers, body: JSON.stringify(body) }));
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  /** The right answer to a pupil's kept question (test only: pupils never see it). */
  const rightFor = (room: number, who: string, slot: number) => markQuestion(db.questions.get(`${room}:${who}`)?.find((q) => q.slot === slot)?.question)!.answer;
  return { db, send, clock, rightFor };
}

async function liveRoom(s: ReturnType<typeof setup>) {
  const opened = await s.send({ action: 'open', classId: ROOM4, mode: 'class', length: 5 }, 'miss');
  const room = opened.body.room as number;
  await s.send({ action: 'join' }, 'ana');
  await s.send({ action: 'join' }, 'ben');
  expect((await s.send({ action: 'start', room }, 'miss')).status).toBe(200);
  return room;
}

it('marks an answer on the server, wrong is wrong, and a question answered twice counts once', async () => {
  const s = setup();
  const room = await liveRoom(s);
  const asked = await s.send({ action: 'ask', room }, 'ana');
  const q = asked.body.question as { slot: number; parts: string[] };
  expect(q.parts.length).toBeGreaterThan(0);
  expect(JSON.stringify(asked.body)).not.toContain('factKey');
  // Asking again gives the same open question (a re-joining iPad).
  expect(((await s.send({ action: 'ask', room }, 'ana')).body.question as { slot: number }).slot).toBe(q.slot);

  const wrong = await s.send({ action: 'answer', room, slot: q.slot, answer: s.rightFor(room, 'ana', q.slot) + 1, ms: 3000 }, 'ana');
  expect(wrong.body).toMatchObject({ right: false, answer: s.rightFor(room, 'ana', q.slot) });
  expect((wrong.body.me as { wrong: number }).wrong).toBe(1);
  // Wrong answers never reach the projector's feed.
  expect(s.db.feed.some((f) => f.event.type === 'wrong')).toBe(false);
  s.clock.t += 10_000;
  expect((await s.send({ action: 'answer', room, slot: q.slot, answer: s.rightFor(room, 'ana', q.slot), ms: 3000 }, 'ana')).body.code).toBe('answered');
  expect(s.db.answers.filter((a) => a.player === 'ana')).toHaveLength(1);

  // The next question came with the reply; a right answer is a hit in the feed with Ana's name.
  const next = (wrong.body.question as { slot: number }).slot;
  const right = await s.send({ action: 'answer', room, slot: next, answer: s.rightFor(room, 'ana', next), ms: 2000 }, 'ana');
  expect(right.body.right).toBe(true);
  const hit = s.db.feed.find((f) => f.event.type === 'hit')!.event as FeedEvent & { pupil: string; points: number };
  expect(hit).toMatchObject({ pupil: 'ana', points: 10, names: { ana: 'Ana' } });
  expect(s.db.players.get(`${room}:ana`)).toMatchObject({ score: 10, correct: 1, wrong: 1 });
});

it("refuses another class's room, a pupil with no class, a teacher who doesn't teach the class, no sign-in, and a switched-off class", async () => {
  const s = setup();
  const room = await liveRoom(s);
  expect((await s.send({ action: 'ask', room }, null)).status).toBe(401);
  expect((await s.send({ action: 'ask', room }, 'cat')).body.code).toBe('not-yours');
  expect((await s.send({ action: 'join' }, 'cat')).body.code).toBe('none');
  expect((await s.send({ action: 'join' }, 'stranger')).body.code).toBe('no-class');
  expect((await s.send({ action: 'tick', room }, 'mr')).body.code).toBe('not-yours');
  expect((await s.send({ action: 'open', classId: ROOM4, mode: 'class' }, 'mr')).body.code).toBe('not-yours');
  expect((await s.send({ action: 'enrage', room }, 'ana')).body.code).toBe('not-yours');
  s.db.enabled = false;
  expect((await s.send({ action: 'ask', room }, 'ana')).body.code).toBe('off');
  expect((await s.send({ action: 'open', classId: ROOM4, mode: 'class' }, 'miss')).body.code).toBe('off');
});

it('refuses answers before the 4-second ring fills, while dazed and while paused, then lets them in', async () => {
  const s = setup();
  const room = await liveRoom(s);
  const send = async (who: string) => {
    const q = (await s.send({ action: 'ask', room }, who)).body.question as { slot: number };
    return s.send({ action: 'answer', room, slot: q.slot, answer: s.rightFor(room, who, q.slot), ms: 1000 }, who);
  };
  s.clock.t += 1000;
  expect((await send('ana')).body.right).toBe(true);
  s.clock.t += 2000;
  const soon = await send('ana');
  expect(soon.body).toMatchObject({ code: 'too_soon', nextAt: 5000 });
  s.clock.t += 2000;
  expect((await send('ana')).body.right).toBe(true);

  // Dazed: put Ben in stars (as a broken shield would) and his answer waits.
  const row = s.db.rooms.get(room)!;
  row.round.players.ben.dazedUntil = row.round.t + 5000;
  expect((await send('ben')).body.code).toBe('dazed');
  s.clock.t += 6000;
  expect((await send('ben')).body.right).toBe(true);

  // Paused: nothing counts and the clock stops; after the resume it carries on from the same time.
  expect((await s.send({ action: 'pause', room }, 'miss')).status).toBe(200);
  s.clock.t += 60_000;
  expect((await send('ana')).body.code).toBe('paused');
  const resumed = await s.send({ action: 'pause', room, resume: true }, 'miss');
  expect((resumed.body.view as { t: number }).t).toBeLessThan(15_000);
  expect((await send('ana')).body.right).toBe(true);
});

it('a pretend class of 30 plays a whole round through the server to a recap', async () => {
  const clock = pretendClock(T0);
  const pc = pretendClass({ size: 30, mode: 'teams2', seed: 3, clock, later: clock.later });
  const s = setup(pc.db, { get t() { return clock.now(); }, set t(v) { clock.set(v); } });
  const opened = await s.send({ action: 'open', classId: PRETEND_CLASS, mode: 'teams2', length: 5 }, PRETEND_TEACHER);
  const room = opened.body.room as number;
  await pc.joinAll(room);
  expect((await s.send({ action: 'teams', room, reshuffle: true }, PRETEND_TEACHER)).status).toBe(200);
  await s.send({ action: 'start', room }, PRETEND_TEACHER);
  pc.play(room);
  // The projector ticks once a second until the round is over.
  let view: { state: string } = { state: 'live' };
  for (let sec = 1; sec <= 330 && view.state !== 'over'; sec++) {
    await clock.run(T0 + sec * 1000);
    view = (await s.send({ action: 'tick', room }, PRETEND_TEACHER)).body.view as { state: string };
  }
  const end = await s.send({ action: 'view', room }, PRETEND_TEACHER);
  expect((end.body.view as { state: string }).state).toBe('over');
  const recap = end.body.recap as { awards: unknown[]; teams: unknown[] };
  expect(recap.awards.length).toBeGreaterThanOrEqual(6);
  expect(recap.teams).toHaveLength(2);
  expect(end.body.players as unknown[]).toHaveLength(30);
  const types = new Set(pc.db.feed.map((f) => f.event.type));
  for (const t of ['join', 'start', 'hit', 'streak', 'tug', 'recap']) expect(types).toContain(t);
  expect(types.has('boss_beaten') || types.has('time_up')).toBe(true);
  // Every right or wrong answer went to the pupil's maths records once.
  const marked = [...pc.db.questions.values()].flat().filter((q) => q.answered).length;
  expect(pc.db.answers).toHaveLength(marked);
  expect(marked).toBeGreaterThan(300);
});

it('the team picker moves a pupil, and in solo a pupil is only ever told "top 10", never a place', async () => {
  const s = setup();
  const opened = await s.send({ action: 'open', classId: ROOM4, mode: 'teams2', length: 5 }, 'miss');
  const room = opened.body.room as number;
  await s.send({ action: 'join' }, 'ana');
  await s.send({ action: 'join' }, 'ben');
  const from = s.db.players.get(`${room}:ana`)!.team;
  const to = from === 'red' ? 'blue' : 'red';
  expect((await s.send({ action: 'teams', room, pupil: 'ana', team: to }, 'miss')).status).toBe(200);
  expect(s.db.players.get(`${room}:ana`)!.team).toBe(to);
  expect((await s.send({ action: 'teams', room, pupil: 'ana', team: to }, 'ana')).status).toBe(403);

  await s.send({ action: 'end', room }, 'miss');
  const solo = (await s.send({ action: 'open', classId: ROOM4, mode: 'solo', length: 5 }, 'miss')).body.room as number;
  await s.send({ action: 'join' }, 'ana');
  await s.send({ action: 'join' }, 'ben');
  await s.send({ action: 'start', room: solo }, 'miss');
  const q = (await s.send({ action: 'ask', room: solo }, 'ana')).body.question as { slot: number };
  const before = (await s.send({ action: 'ask', room: solo }, 'ben')).body;
  expect(JSON.stringify(before)).not.toMatch(/rank|place/);
  const hit = await s.send({ action: 'answer', room: solo, slot: q.slot, answer: s.rightFor(solo, 'ana', q.slot), ms: 2000 }, 'ana');
  expect(hit.body.me).toMatchObject({ topTen: true });
  expect(JSON.stringify(hit.body.me)).not.toMatch(/rank|place/);
  // Ben has no points yet, so he isn't in the top 10.
  expect(s.db.players.get(`${solo}:ben`)).toMatchObject({ topTen: false });
});

it('leaves out the untimed ladder skills, even for a pupil whose focus is only untimed skills', () => {
  const focus = { source: 'teacher-class' as const, skills: ['bedmas', 'round-10-100'], onlyThese: true, endsAt: null, canChoose: false, own: null };
  for (let i = 0; i < 40; i++) {
    const q = makeQuestion({ facts: [], settings: {}, focus }, `seed-${i}`, i % 5 === 0)!;
    expect(q).not.toBeNull();
    expect(isUntimed(q.factKey)).toBe(false);
  }
});
