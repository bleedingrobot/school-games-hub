/**
 * Saboteur Crew's pupil steps (docs/CREW-PLAN.md), beside the other Class Live steps in server.ts. `play` with `jam`,
 * `work` (a Glitch's pretend job), `lights` (lights out), `grab` (a power-up) or `vote` (the secret vote), all checked
 * against the saved spot; `ask` (a question when the spot allows one: a job, a sparking machine, the light switch) and
 * `answer` (marked here, claimed once, recorded). Glitches on the floor get no questions (James, 25 Nov 2026 NZ).
 */
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import { answered, canAsk, castVote, fakeWork, grab, jam, lightsOff, purposeAt, type CrewGame } from './crew';
import { busy, mutate, nextQuestion, no, ok, playerView, roomView, timeOf, type ClassLiveServices, type RoomRow, type Session, type StepReply } from './server';

const MAX_ANSWER_MS = 120_000;

export async function crewStep(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: roomView(session, startedAt, sv.now()), me: playerView(session, who), now: sv.now(), ...extra });
  const spotOf = async () => {
    const all = await sv.positions(room);
    return all === 'busy' ? 'busy' as const : all[who];
  };

  if (body.action === 'play') {
    const at = body.vote === undefined && body.lights === undefined ? await spotOf() : undefined;
    if (at === 'busy') return busy();
    const done = await mutate(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'crew') return { refuse: no(409, 'This one has finished.', 'over') };
      const g = s.game;
      const here = at ?? g.mine[who]?.spot;
      if (body.vote !== undefined) {
        const out = castVote(g, who, body.vote, t, s.order);
        if (!out.ok) return { refuse: no(409, out.reason === 'bad' ? 'Pick someone still on the floor.' : 'Voting is closed.', out.reason) };
        return { reply: null, events: [], players: [who] };
      }
      if (body.lights !== undefined) {
        const out = lightsOff(g, who, t);
        if (!out.ok) return { refuse: no(409, 'Not now.', 'not_now') };
        return { reply: null, events: out.events, players: s.order };
      }
      if (body.jam !== undefined) {
        const out = jam(g, who, body.jam, here, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'far' ? 'Get closer!' : out.reason === 'wait' ? 'Recharging…' : out.reason === 'busy' ? 'That one is already done for.' : 'Not now.', out.reason) };
        return { reply: null, events: out.events, players: [who] };
      }
      if (body.work !== undefined) {
        const out = fakeWork(g, who, body.work, here, t, () => sv.random());
        if (!out.ok) return { refuse: no(409, out.reason === 'far' ? 'Get closer!' : 'Not now.', out.reason) };
        return { reply: null, events: [], players: [who] };
      }
      if (body.grab !== undefined) {
        const out = grab(g, who, body.grab, here, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'far' ? 'Get closer!' : out.reason === 'full' ? 'You already have one!' : 'Too late!', out.reason) };
        return { reply: null, events: out.events, players: [who] };
      }
      return { refuse: no(400, "That couldn't be read.") };
    });
    if ('refuse' in done) return done.refuse;
    return reply(done.session, done.row.startedAt);
  }

  const g0 = s0.game as CrewGame;
  if (body.action === 'ask') {
    const at = await spotOf();
    if (at === 'busy') return busy();
    const purpose = canAsk(g0, who, at ?? g0.mine[who]?.spot, timeOf(cur, sv.now()));
    if (!purpose) return no(409, 'Go to a machine first!', 'not_now');
    const question = await nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, purpose, now: sv.now() });
  }

  const slot = body.slot;
  const value = body.answer;
  if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) return no(400, "That answer couldn't be read.");
  const kept = await sv.loadQuestion(room, who, slot as number);
  if (kept === 'busy') return busy();
  const marked = kept ? markQuestion(kept.question) : null;
  if (!kept || !marked) return no(400, "That answer couldn't be marked.");
  if (kept.answered) return no(409, "You've already answered that one.", 'answered');
  const right = sameAnswer(value, marked.answer);
  const at = await spotOf();
  if (at === 'busy') return busy();
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
  const done = await mutate(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'crew') return { refuse: no(409, 'This one has finished.', 'over') };
    // Where they are now (a little more slack: they may have drifted while answering).
    const purpose = purposeAt(s.game, who, at ?? s.game.mine[who]?.spot, t, 0.12);
    if (!purpose) return { refuse: no(409, 'Stay by the machine!', 'not_now') };
    const out = answered(s.game, who, right, purpose, t, s.order, () => sv.random());
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'No question right now.', out.reason) };
    return { reply: out.gave, events: out.events, players: [who], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, gave: done.reply });
}
