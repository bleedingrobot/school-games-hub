/**
 * Ghost Tag's pupil steps (docs/GHOST-PLAN.md), beside the other Class Live steps in server.ts: `play` with `grab` (a
 * power-up, checked against the saved spot), `ask` (a question when one is allowed) and `answer` (marked here, claimed
 * once, recorded): a pupil's right answer makes them invisible, a ghost's gives a dash or a lantern.
 */
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import { answered, canAsk, grab, type GhostGame } from './ghost';
import { busy, mutate, nextQuestion, no, ok, playerView, roomView, timeOf, type ClassLiveServices, type RoomRow, type Session, type StepReply } from './server';

const MAX_ANSWER_MS = 120_000;

export async function ghostStep(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: roomView(session, startedAt, sv.now()), me: playerView(session, who), now: sv.now(), ...extra });

  if (body.action === 'play') {
    if (body.grab === undefined) return no(400, "That couldn't be read.");
    const all = await sv.positions(room);
    if (all === 'busy') return busy();
    const done = await mutate(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'ghost') return { refuse: no(409, 'This one has finished.', 'over') };
      const out = grab(s.game, who, body.grab, all[who] ?? s.game.mine[who]?.spot, t);
      if (!out.ok) return { refuse: no(409, out.reason === 'far' ? 'Get closer!' : 'Too late!', out.reason) };
      return { reply: null, events: out.events, players: [who] };
    });
    if ('refuse' in done) return done.refuse;
    return reply(done.session, done.row.startedAt);
  }

  const g0 = s0.game as GhostGame;
  if (body.action === 'ask') {
    if (!canAsk(g0, who, timeOf(cur, sv.now()))) return no(409, 'No question right now.', 'not_now');
    const question = await nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, now: sv.now() });
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
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
  const done = await mutate(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'ghost') return { refuse: no(409, 'This one has finished.', 'over') };
    const out = answered(s.game, who, right, t);
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
