/**
 * Fights against classmates, in the Archery Challenge server function (docs/ARCHERY-PLAN.md, section 7, Stage 6). The
 * same pattern as Power Clash: the browser only ever asks ("challenge Mia in the Snow", "yes", "here's my quiver",
 * "shoot at 52° and 67", "the clock ran out", "I'm leaving"); this works out who's asking from their sign-in, checks it's
 * their turn, plays the shot with the game's own engine and saves "only if nothing has changed since it looked".
 *
 *   duel-challenge  {request, other, world}   sends a challenge (same school and class only);
 *   duel-answer     {duel, accept}            the classmate says yes (both pack) or no;
 *   duel-pack       {duel, pack}              packs a quiver (the gear comes out of the bag); both packed = the fight starts;
 *   shot            {duel, version, shot}     a shot on your own turn;
 *   times-up        {duel}                    the turn's time ran out (the server checks its own clock): the turn is used up;
 *   leave           {duel}                    gives up (the other player wins, nobody gets points) or calls off a challenge.
 *
 * One round (James, 22 Oct 2026). Finishing earns DUEL_POINTS, or DUEL_WIN_POINTS for the winner; a fight someone left,
 * or that the timer ended, gives nobody points. Every reply carries the fight as it now is.
 *
 * Two teacher switches matter (Stage 7): the game's own, and "Classmate fights" (on to start). While either is off for
 * either player's class, nothing can be challenged, answered or packed, and a fight that's open ends fairly the next
 * time either player asks anything (gear back to both, nobody gets points). Achievement counts for a fight played to
 * the finish go to both players through `note` (shared/archery/stats.ts).
 */
import { CHALLENGE_MS, DUEL_GRACE_MS, DUEL_TURN_MS, PACK_MS } from '../../../shared/archery/config';
import {
  PASS, duelOpen, duelSetup, readShot, replayDuel, seatOf, timeoutsAfter, tooManyTimeouts,
  type DuelEnding, type DuelRow,
} from '../../../shared/archery/duel';
import { takeShot, type FightRun } from '../../../shared/archery/fight';
import { DUEL_POINTS, DUEL_WIN_POINTS } from '../../../shared/archery/points';
import { readPack, type Armory } from '../../../shared/archery/shop';
import { duelStats, type StatsAdd } from '../../../shared/archery/stats';
import { WORLD_IDS, type PlayerSetup, type Shot, type WorldId } from '../../../shared/archery/types';
import type { ArmoryState, Outcome } from './handler';

export interface DuelServices {
  /** The fight, whether the game is on for each player's class and whether classmate fights are, or null if there's no such fight. */
  duelLoad(duel: number): Promise<{ duel: DuelRow; on: [boolean, boolean]; duels: [boolean, boolean] } | null | 'busy'>;
  duelChallenge(player: string, request: string, other: string, world: WorldId, seed: number, waitMs: number): Promise<Outcome<{ result: 'ok' | 'away' | 'class' | 'busy' | 'off'; duel: number | null }>>;
  duelAnswer(player: string, duel: number, accept: boolean, packMs: number): Promise<Outcome<{ result: 'ok' | 'late' | 'busy' | 'not-yours'; duel?: DuelRow }>>;
  duelPack(player: string, duel: number, pack: PlayerSetup, turnMs: number): Promise<Outcome<{ result: 'ok' | 'already' | 'gear' | 'late' | 'not-yours'; duel?: DuelRow; state?: ArmoryState }>>;
  /** Saves a played turn only if the fight is still at `version`; null if it had changed. */
  duelMove(duel: number, version: number, turns: Shot[], used: DuelRow['used'], timeouts: [number, number], deadlineMs: number, real: boolean): Promise<DuelRow | null | 'busy'>;
  /** Ends the fight (gear back to both) only if it's still at `version`; null if it had changed. */
  duelEnd(duel: number, version: number, status: 'done' | 'declined' | 'expired' | 'cancelled', ending: DuelEnding | null, winner: 0 | 1 | null, leaver: 0 | 1 | null, turns: Shot[] | null, used: DuelRow['used'] | null, timeouts: [number, number] | null): Promise<DuelRow | null | 'busy'>;
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Adds to a pupil's achievement counts, once per `once`, and checks their achievements. A failure is only logged. */
  note(player: string, once: string, add: StatsAdd): Promise<void>;
  now(): number;
  randomHex(bytes: number): string;
}

export type DuelAction = 'duel-challenge' | 'duel-answer' | 'duel-pack' | 'shot' | 'times-up' | 'leave';
export const DUEL_ACTIONS: readonly DuelAction[] = ['duel-challenge', 'duel-answer', 'duel-pack', 'shot', 'times-up', 'leave'];

/** What a request came to: an HTTP status and the reply's body. */
export interface DuelReply {
  status: number;
  body: Record<string, unknown>;
}

/** Words pupils see. Kind, short, nothing technical. */
const SAY = {
  bad: "That couldn't be read.",
  busy: "That couldn't be done just now. Try again in a moment.",
  notYours: "That isn't your fight.",
  away: "That classmate isn't in Archery Challenge right now.",
  otherClass: 'You can only challenge classmates in your own class.',
  inFight: "One of you is already in a fight. Try again when it's over.",
  theirsOff: "Archery Challenge isn't switched on for their class.",
  late: 'That challenge has run out.',
  notStarted: "The fight hasn't started yet.",
  over: 'This fight has already ended.',
  changed: 'The fight changed just then. Have another look.',
  notYourTurn: "It's not your turn yet.",
  notYet: "There's still time on the clock.",
  gear: "You don't have all of that in your bag.",
  switchedOff: "Your teacher has switched Archery Challenge off, so this fight has stopped. Any arrows you didn't use are back in your bag.",
  duelsOff: 'Your teacher has switched classmate fights off for now. You can still fight the bots!',
  duelsStopped: "Your teacher has switched classmate fights off, so this fight has stopped. Any arrows you didn't use are back in your bag.",
} as const;

/** The teacher's switches for the player asking: the game, and classmate fights (only on while the game is). */
export interface DuelSwitches {
  on: boolean;
  duels: boolean;
}

const isRequestId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(v);
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const isDuelId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1;

const ok = (body: Record<string, unknown>): DuelReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): DuelReply => ({ status, body: { error, ...extra } });

/** Plays the fight's turns so far. Null if they don't replay (which would be a bug: each was checked when played). */
function replay(d: DuelRow): FightRun | null {
  if (!d.packs[0] || !d.packs[1]) return null;
  const { run, problem } = replayDuel(d.seed, duelSetup(d.world, [d.packs[0], d.packs[1]]), d.turns);
  if (problem) {
    console.error(`archery: a classmate fight does not replay (${problem})`);
    return null;
  }
  return run;
}

const sameShot = (a: Shot | undefined, b: Shot) => !!a && !a.pass && a.angle === b.angle && a.power === b.power && a.arrow === b.arrow && !!a.apple === !!b.apple;

/**
 * Handles one classmate-fight request from `player`. `switches` are their own class's (the handler has read them):
 * while either is off they can only end a fight, never play one.
 */
export async function handleDuel(services: DuelServices, player: string, action: DuelAction, body: Record<string, unknown>, switches: DuelSwitches, everything: Armory): Promise<DuelReply> {
  if (action === 'duel-challenge') {
    // Same class only (the database checks), so the classmate has the same switches.
    if (!switches.duels) return no(403, SAY.duelsOff, { code: 'duels-off' });
    const { other, world, request } = body;
    if (!isUuid(other) || !WORLD_IDS.includes(world as WorldId) || !isRequestId(request)) return no(400, SAY.bad);
    const seed = parseInt(services.randomHex(4), 16) >>> 0;
    const r = await services.duelChallenge(player, request, other, world as WorldId, seed, CHALLENGE_MS);
    if (!r.ok) return r.why === 'refused' ? no(400, SAY.bad) : no(503, SAY.busy);
    const why = r.value.result;
    if (why !== 'ok' || r.value.duel === null) {
      const words = why === 'away' ? SAY.away : why === 'class' ? SAY.otherClass : why === 'busy' ? SAY.inFight : why === 'off' ? SAY.theirsOff : SAY.bad;
      return no(409, words, { code: why });
    }
    const loaded = await services.duelLoad(r.value.duel);
    if (loaded === 'busy' || !loaded) return no(503, SAY.busy);
    return ok({ duel: loaded.duel });
  }

  if (!isDuelId(body.duel)) return no(400, SAY.bad);
  const id = body.duel;

  const loaded = await services.duelLoad(id);
  if (loaded === 'busy') return no(503, SAY.busy);
  const seat = loaded ? seatOf(loaded.duel, player) : -1;
  if (!loaded || seat < 0) return no(403, SAY.notYours);
  const d = loaded.duel;

  // A teacher switched the game, or classmate fights, off for either class: the fight ends fairly (gear back to both,
  // nobody gets points).
  const gameOff = !switches.on || !loaded.on[0] || !loaded.on[1];
  const duelsOff = !switches.duels || !loaded.duels[0] || !loaded.duels[1];
  if ((gameOff || duelsOff) && duelOpen(d)) {
    const run = d.status === 'playing' ? replay(d) : null;
    const playing = d.status === 'playing';
    const ended = await services.duelEnd(d.id, d.version, playing ? 'done' : 'cancelled', playing ? (gameOff ? 'switched-off' : 'duels-off') : null, null, null, null, run ? run.used : null, null);
    if (ended === 'busy') return no(503, SAY.busy);
    if (!ended) return no(409, SAY.changed, { code: 'changed' });
    return gameOff ? no(403, SAY.switchedOff, { code: 'game-off', duel: ended }) : no(403, SAY.duelsStopped, { code: 'duels-off', duel: ended });
  }
  if (!switches.on) return no(403, SAY.switchedOff, { code: 'game-off', duel: d });
  if (duelsOff && (action === 'duel-answer' || action === 'duel-pack')) return no(403, SAY.duelsOff, { code: 'duels-off', duel: d });

  if (action === 'duel-answer') {
    if (typeof body.accept !== 'boolean') return no(400, SAY.bad);
    const r = await services.duelAnswer(player, id, body.accept, PACK_MS);
    if (!r.ok) return r.why === 'refused' ? no(400, SAY.bad) : no(503, SAY.busy);
    const { result, duel } = r.value;
    if (result === 'not-yours') return no(403, SAY.notYours);
    if (result === 'late') return no(409, SAY.late, { code: 'late', duel });
    if (result === 'busy') return no(409, SAY.inFight, { code: 'busy', duel });
    return ok({ duel });
  }

  if (action === 'duel-pack') {
    const packed = readPack(body.pack, everything);
    if ('problem' in packed) return no(400, SAY.gear, { code: 'gear' });
    const r = await services.duelPack(player, id, packed.pack, DUEL_TURN_MS);
    if (!r.ok) return r.why === 'refused' ? no(400, SAY.bad) : no(503, SAY.busy);
    const { result, duel, state } = r.value;
    if (result === 'not-yours') return no(403, SAY.notYours);
    if (result === 'gear') return no(400, SAY.gear, { code: 'gear', duel, state });
    if (result === 'late') return no(409, duel?.status === 'packing' ? SAY.late : SAY.over, { code: 'late', duel, state });
    return ok({ duel, state });
  }

  // shot, times-up and leave: on a fight the player is in.
  if (action === 'leave') {
    if (!duelOpen(d)) return ok({ duel: d });
    if (d.status !== 'playing') {
      // Calling off a challenge (or saying no to it), or leaving while packing: any packed gear comes back.
      const status = d.status === 'asked' && seat === 1 ? 'declined' : 'cancelled';
      const ended = await services.duelEnd(d.id, d.version, status, null, null, null, null, null, null);
      if (ended === 'busy') return no(503, SAY.busy);
      if (!ended) return no(409, SAY.changed, { code: 'changed' });
      return ok({ duel: ended });
    }
    const run = replay(d);
    if (!run) return no(500, SAY.busy);
    // Leaving part-way: the other player wins, nobody gets points (James, 22 Oct 2026), unused gear back to both.
    const ended = await services.duelEnd(d.id, d.version, 'done', 'left', (1 - seat) as 0 | 1, seat as 0 | 1, null, run.used, null);
    if (ended === 'busy') return no(503, SAY.busy);
    if (!ended) return no(409, SAY.changed, { code: 'changed' });
    return ok({ duel: ended });
  }

  if (d.status === 'asked' || d.status === 'packing') return no(409, SAY.notStarted, { code: 'not-started', duel: d });
  if (d.status !== 'playing') {
    // A shot sent twice whose first reply was lost: the fight already has it (maybe as its winning shot).
    if (action === 'shot' && body.version === d.version - 1 && isLastMine(d, seat, body.shot)) return ok({ duel: d });
    return no(409, SAY.over, { code: 'over', duel: d });
  }

  if (action === 'shot') {
    const shot = readShot(body.shot);
    if (!shot || !Number.isInteger(body.version)) return no(400, SAY.bad);
    if (body.version !== d.version) {
      if (body.version === d.version - 1 && isLastMine(d, seat, shot)) return ok({ duel: d });
      return no(409, SAY.changed, { code: 'changed', duel: d });
    }
    const run = replay(d);
    if (!run) return no(500, SAY.busy);
    if (run.round.turn !== seat) return no(409, SAY.notYourTurn, { code: 'not-your-turn', duel: d });
    const taken = takeShot(run, shot);
    if (taken.problem) return no(400, `That shot can't be played: ${taken.problem}.`, { code: 'illegal', duel: d });
    return afterTurn(services, d, run, [...d.turns, shot], timeoutsAfter(d.timeouts, seat, false), true);
  }

  // times-up: anyone in the fight can ask (a server function can't wake itself up); the server checks its own clock,
  // so nobody can hurry anyone.
  const left = Date.parse(d.deadline) + DUEL_GRACE_MS - services.now();
  if (!(left <= 0)) return no(409, SAY.notYet, { code: 'not-yet', secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1000) : 45, duel: d });
  const run = replay(d);
  if (!run) return no(500, SAY.busy);
  const turnSeat = run.round.turn;
  takeShot(run, PASS);
  const timeouts = timeoutsAfter(d.timeouts, turnSeat, true);
  if (tooManyTimeouts(timeouts) && run.winner === null) {
    // Three turns in a row used up: the fight ends with nobody winning and no points; unused gear back to both.
    const ended = await services.duelEnd(d.id, d.version, 'done', 'timeouts', null, turnSeat as 0 | 1, [...d.turns, PASS], run.used, timeouts);
    if (ended === 'busy') return no(503, SAY.busy);
    if (!ended) return no(409, SAY.changed, { code: 'changed' });
    return ok({ duel: ended });
  }
  return afterTurn(services, d, run, [...d.turns, PASS], timeouts, false);
}

/** Was this player's shot the last turn played (so the same shot sent again is the same request)? */
function isLastMine(d: DuelRow, seat: number, raw: unknown): boolean {
  const shot = readShot(raw);
  if (!shot || d.turns.length === 0) return false;
  // Seat 0 plays turns 0, 2, 4 … (one round, seat 0 first).
  const last = d.turns.length - 1;
  return last % 2 === seat && sameShot(d.turns[last], shot);
}

/** Saves the turn just played: the fight goes on (the next player's 45 seconds start) or it's over (points to both). */
async function afterTurn(services: DuelServices, d: DuelRow, run: FightRun, turns: Shot[], timeouts: [number, number], real: boolean): Promise<DuelReply> {
  if (run.winner === null) {
    const saved = await services.duelMove(d.id, d.version, turns, run.used, timeouts, services.now() + DUEL_TURN_MS, real);
    if (saved === 'busy') return no(503, SAY.busy);
    if (!saved) return no(409, SAY.changed, { code: 'changed' });
    return ok({ duel: saved });
  }
  const winner = run.winner === 'draw' ? null : (run.winner as 0 | 1);
  const ended = await services.duelEnd(d.id, d.version, 'done', 'finished', winner, null, turns, run.used, timeouts);
  if (ended === 'busy') return no(503, SAY.busy);
  if (!ended) return no(409, SAY.changed, { code: 'changed' });
  // Achievement counts, then points, once per fight per player (the fight ends once; the `once` keys make sure).
  const points: [number, number] = [winner === 0 ? DUEL_WIN_POINTS : DUEL_POINTS, winner === 1 ? DUEL_WIN_POINTS : DUEL_POINTS];
  for (const i of [0, 1] as const) {
    const who = i === 0 ? d.seat_a : d.seat_b;
    try {
      await services.note(who, `stats:duel:${d.id}:${i}`, duelStats(d.world, winner === i, run.used[i]));
      await services.awardPoints(who, points[i], `archery-duel:${d.id}:${i}`);
    } catch {
      console.error('archery: classmate fight points could not be given');
    }
  }
  return ok({ duel: ended, points });
}
