/**
 * Toon Flap Relay's part of the Class Live server (docs/RELAY-PLAN.md): what pupils see of the game, and the pupil steps:
 * `play` with `fly` (the flyer's flap list, replayed here) or `spend` (a perk or a trouble), `ask` and `answer`.
 */
import { decodeFlaps } from '../toonflap/engine';
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import {
  ANSWER_GAP_MS, fxRandom, flyTurn, flyingTeam, PERK_UNLOCK, PERKS, perkCost, relayAnswered, relayCanAsk, relayPodium, relaySpend, SEND_COOL_MS,
  TROUBLE_COST, troubleTargets, type Effect, type RelayGame, type RelayRace, type Turn,
} from './relay';
import { busy, mutate, nextQuestion, no, ok, playerView, roomView, timeOf, type ClassLiveServices, type RoomRow, type Session, type StepReply } from './server';

/** An effect as anyone may see it (not who sent it). */
export type PublicEffect = Omit<Effect, 'by'>;

export interface RelayPublic {
  kind: 'relay';
  races: 1 | 3 | 5;
  race: RelayRace | null;
  teams: { colour: number; size: number; x: number; wall: number; finishT: number | null; flying: boolean; turnN: number; effects: PublicEffect[]; calmAt: number }[];
  wins: number[];
}

export interface RelayPlayer {
  kind: 'relay';
  team: number;
  colour: number;
  sparks: number;
  right: number;
  wrong: number;
  flights: number;
  flown: number;
  perks: number;
  troubles: number;
  wins: number;
  /** Their turn, while they're flying (with their own team's effects). */
  flying: { turn: Turn; effects: PublicEffect[] } | null;
  /** Turns before theirs (0: they're next), or null when not in a team yet. */
  upNext: number | null;
  perkCost: number;
  troubleCost: number;
  /** Session time they may send again; and the next question. */
  coolUntil: number;
  nextAt: number;
  /** Perks open this race. */
  perksOpen: string[];
  /** Some other team can take a trouble now. */
  canTrouble: boolean;
  place: 1 | 2 | 3 | null;
}

const strip = (e: Effect): PublicEffect => {
  const { by: _by, ...rest } = e;
  return rest;
};

export function relayPublic(g: RelayGame): RelayPublic {
  return {
    kind: 'relay', races: g.races, race: g.race, wins: g.wins,
    teams: g.teams.map((tm) => ({
      colour: tm.colour, size: tm.members.length, x: tm.x, wall: tm.wall, finishT: tm.finishT, flying: !!tm.turn, turnN: tm.turn?.n ?? 0,
      effects: tm.effects.map(strip), calmAt: tm.calmAt,
    })),
  };
}

export function relayPlayer(s: Session, g: RelayGame, id: string): RelayPlayer {
  const t = g.lastT ?? 0;
  const m = g.mine[id];
  const ti = m?.team ?? 0;
  const team = g.teams[ti];
  const flying = team?.turn?.flyer === id ? { turn: team.turn, effects: team.effects.map(strip) } : null;
  let upNext: number | null = null;
  if (team && team.members.includes(id) && !flying) {
    const at = team.members.indexOf(id);
    upNext = (at - team.next + team.members.length) % team.members.length;
  }
  const n = g.race?.n ?? 1;
  return {
    kind: 'relay', team: ti, colour: team?.colour ?? 0, sparks: m?.sparks ?? 0, right: m?.right ?? 0, wrong: m?.wrong ?? 0, flights: m?.flights ?? 0,
    flown: Math.round(m?.flown ?? 0), perks: m?.perks ?? 0, troubles: m?.troubles ?? 0, wins: m?.wins ?? 0, flying, upNext,
    perkCost: team ? perkCost(g, ti) : 2, troubleCost: TROUBLE_COST, coolUntil: (m?.sendAt ?? -SEND_COOL_MS) + SEND_COOL_MS,
    nextAt: (m?.lastAt ?? 0) + ANSWER_GAP_MS, perksOpen: PERKS.filter((p) => PERK_UNLOCK[p] <= n), canTrouble: troubleTargets(g, ti, t).length > 0,
    place: s.state === 'over' ? (relayPodium(g, s.order).find((x) => x.player === id)?.place ?? null) : null,
  };
}

const MAX_ANSWER_MS = 120_000;

const SPEND_WORDS: Record<string, string> = {
  not_now: 'Not right now!', unknown: "That couldn't be read.", locked: 'That one opens in a later race.', sparks: 'Answer more questions for sparks!',
  cool: 'Wait a moment before sending another.', stack: 'Your flyer has enough perks for now.', busy_teams: 'Every other team is busy. Try again soon!', no_room: 'Too close to the nest!',
};

export async function relayStep(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: roomView(session, startedAt, sv.now()), me: playerView(session, who), now: sv.now(), ...extra });

  if (body.action === 'play') {
    if (typeof body.fly === 'string') {
      const flaps = decodeFlaps(body.fly);
      const turnN = body.turn;
      const at = body.at;
      if (!flaps || !Number.isInteger(turnN) || !Number.isInteger(at) || (at as number) < 0) return no(400, "That couldn't be read.");
      const done = await mutate(sv, room, (s, t) => {
        if (s.state !== 'live' || s.game.kind !== 'relay') return { refuse: no(409, 'This one has finished.', 'over') };
        const out = flyTurn(s.game, who, turnN as number, flaps, body.fly as string, at as number, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'bad' ? "Those flaps didn't add up." : 'Not your turn now.', out.reason) };
        const g = s.game;
        const players = [who];
        // A new turn or the race's end changes teammates' rows too.
        for (const e of out.events) {
          if (e.type === 'relay_turn') players.push(...g.teams[e.team].members);
          if (e.type === 'relay_end') players.push(...s.order);
        }
        return { reply: out.done, events: out.events, players };
      });
      if ('refuse' in done) return done.refuse;
      return reply(done.session, done.row.startedAt, { done: done.reply });
    }
    if (body.spend !== undefined) {
      const done = await mutate(sv, room, (s, t) => {
        if (s.state !== 'live' || s.game.kind !== 'relay') return { refuse: no(409, 'This one has finished.', 'over') };
        const g = s.game;
        const out = relaySpend(g, who, body.spend, t, fxRandom(g, s.seed));
        if (!out.ok) return { refuse: no(409, SPEND_WORDS[out.reason] ?? 'Not right now!', out.reason) };
        const flyer = g.teams[out.to]?.turn?.flyer;
        return { reply: out.to, events: out.events, players: flyer ? [who, flyer] : [who] };
      });
      if ('refuse' in done) return done.refuse;
      return reply(done.session, done.row.startedAt, { to: done.reply });
    }
    return no(400, "That couldn't be read.");
  }

  const g0 = s0.game as RelayGame;
  if (body.action === 'ask') {
    if (!relayCanAsk(g0, who)) return no(409, flyingTeam(g0, who) >= 0 ? "You're flying!" : 'No question right now.', 'not_now');
    const question = await nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, now: sv.now(), t: timeOf(cur, sv.now()) });
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
    if (s.state !== 'live' || s.game.kind !== 'relay') return { refuse: no(409, 'This one has finished.', 'over') };
    const out = relayAnswered(s.game, who, right, t, typeof body.ms === 'number' ? ms : undefined);
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'No question right now.', out.reason) };
    return { reply: null, events: out.events, players: [who], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer });
}
