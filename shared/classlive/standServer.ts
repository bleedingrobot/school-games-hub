/**
 * Stand Up If's part of the Class Live server (docs/STAND-PLAN.md). Every pupil plays on their own iPad (a class set).
 *
 * Steps: `ask` (this round's question and the pupil's own number), `answer {n, slot, answer, ms}` (marked here, once a
 * round), `play {n, stand}` (Stand or Sit, changeable until the countdown). The clock (advanceStand, in server.ts's
 * `mutate`) starts rounds and reveals them. server.ts hands in its helpers (JailKit), so this file only imports types.
 */
import { markQuestion, sameAnswer, seededRandom } from '../maths/serverQuestions';
import type { JailKit } from './jailServer';
import type { PlayerView, RoomRow, Session, StepReply } from './server';
import { readyCount, standAnswer, standChoose, standPhase, targetFor, type Sign, type StandGame, type StandLevel, type StandResult, type StandRound } from './stand';

/** What pupils of the class may read: the round, its sign and times, and counts. Nobody's answers. */
export interface StandPublic {
  kind: 'stand';
  level: StandLevel;
  think: number;
  round: StandRound | null;
  /** Pupils who tapped Stand or Sit this round. */
  ready: number;
}

/** A pupil's own part: their go this round, their last result and their streak. */
export interface StandPlayer {
  kind: 'stand';
  streak: number;
  best: number;
  spots: number;
  go: { n: number; slot: number; target: number; sign: Sign; right: boolean; answer: number; stand: boolean | null } | null;
  last: StandResult | null;
}

export const standPublic = (g: StandGame): StandPublic => ({ kind: 'stand', level: g.level, think: g.think, round: g.round, ready: readyCount(g) });

export function standPlayer(g: StandGame, id: string): StandPlayer {
  const m = g.mine[id];
  const r = g.round;
  const go = m?.go && r && m.go.n === r.n ? m.go : null;
  return {
    kind: 'stand', streak: m?.streak ?? 0, best: m?.best ?? 0, spots: m?.spots ?? 0,
    go: go ? { n: go.n, slot: go.slot, target: go.target, sign: r!.sign, right: go.right, answer: go.answer, stand: go.stand } : null,
    last: m?.last ?? null,
  };
}

/** The pupil's number for a question in a round: the same every time it is worked out. */
const targetOf = (s: Session, g: StandGame, who: string, n: number, slot: number, sign: Sign, answer: number) =>
  targetFor(answer, sign, g.level, seededRandom(`stand:${s.seed}:${who}:${n}:${slot}`));

const WORDS: Record<string, string> = {
  not_now: 'Wait for the next round!', answered: "You've answered this round.", no_go: 'Answer your question first.', too_soon: 'One at a time!', old_round: 'A new round has started!',
};

export async function standStep(k: JailKit & { playerView(s: Session, id: string): PlayerView }, cur: RoomRow, who: string, body: Record<string, unknown>, t: number): Promise<StepReply> {
  const { sv, mutate, ok, no, busy } = k;
  const room = cur.id;
  const s0 = cur.session;
  if (s0.game.kind !== 'stand') return no(400, 'This game has no rounds.');
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const g0 = s0.game;
  const reply = (s: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: k.roomView(s, startedAt, sv.now()), me: k.playerView(s, who), now: sv.now(), ...extra });

  if (body.action === 'ask') {
    const r = g0.round;
    if (!r || standPhase(r, t) !== 'think') return no(409, WORDS.not_now, 'not_now');
    if (g0.mine[who]?.go?.n === r.n) return reply(s0, cur.startedAt);
    const question = await k.nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    const kept = await sv.loadQuestion(room, who, question.slot);
    if (kept === 'busy') return busy();
    const marked = kept ? markQuestion(kept.question) : null;
    if (!marked) return no(503, "We couldn't make a question just now.");
    return reply(s0, cur.startedAt, { question, n: r.n, sign: r.sign, target: targetOf(s0, g0, who, r.n, question.slot, r.sign, marked.answer) });
  }

  if (body.action === 'play') {
    if (typeof body.stand !== 'boolean') return no(400, "That couldn't be read.");
    const stand = body.stand;
    const done = await mutate(sv, room, (s, tt) => {
      if (s.state !== 'live' || s.game.kind !== 'stand') return { refuse: no(409, 'This one has finished.', 'over') };
      if (body.n !== s.game.round?.n) return { refuse: no(409, WORDS.old_round, 'old_round') };
      const out = standChoose(s.game, who, stand, tt, s.order);
      if (!out.ok) return { refuse: no(409, WORDS[out.reason], out.reason) };
      return { reply: null, events: out.events, players: [who] };
    });
    if ('refuse' in done) return done.refuse;
    return reply(done.session, done.row.startedAt);
  }

  // answer
  const slot = body.slot;
  const value = body.answer;
  if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) return no(400, "That answer couldn't be read.");
  const kept = await sv.loadQuestion(room, who, slot as number);
  if (kept === 'busy') return busy();
  const marked = kept ? markQuestion(kept.question) : null;
  if (!kept || !marked) return no(400, "That answer couldn't be marked.");
  if (kept.answered) return no(409, "You've already answered that one.", 'answered');
  const right = sameAnswer(value, marked.answer);
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : k.maxAnswerMs, k.maxAnswerMs));
  const done = await mutate(sv, room, (s, tt) => {
    if (s.state !== 'live' || s.game.kind !== 'stand') return { refuse: no(409, 'This one has finished.', 'over') };
    const r = s.game.round;
    if (!r || body.n !== r.n) return { refuse: no(409, WORDS.old_round, 'old_round') };
    const target = targetOf(s, s.game, who, r.n, slot as number, r.sign, marked.answer);
    const out = standAnswer(s.game, who, { slot: slot as number, answer: marked.answer, target, right }, tt);
    if (!out.ok) return { refuse: no(409, WORDS[out.reason], out.reason) };
    return { reply: null, events: [], players: [who], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer });
}
