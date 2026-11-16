/**
 * Live Clan Duels, the server's side (rules in duel.ts; database in migration 20261117000400_clans_live_duels.sql). The same
 * pattern as Dragon Maths' arena clashes (shared/lord/clashServer.ts): the browser only asks ("duel the Brave Owls", "yes",
 * "Charge", "the clock ran out", "I'm leaving"); this works out who is asking from their sign-in, keeps each pick hidden in
 * the database until both are in, and plays the round with the shared rules, saving "only if nothing changed since it looked".
 *
 *   duel-challenge  {other}               sends a challenge (same class only; `other` is the clan's hidden public id);
 *   duel-answer     {duel, accept}        the classmate says yes (round 1 starts) or no;
 *   duel-pick       {duel, round, move}   this round's order. Its maths is the clan's waiting `ask` for 'duel', marked by
 *                                         `askCheck` already; each question powers one round only;
 *   duel-times-up   {duel}                the round's time ran out (the server checks its own clock);
 *   duel-leave      {duel}                calls off a challenge, or gives up (the other side wins, no prizes).
 *
 * Prizes only for a duel played to the end, for each pupil's first PAID_DUELS_PER_DAY a day: gold and Banners to both sides.
 * Nobody ever loses gold, heroes, troops or buildings. Every reply carries the duel as it now is.
 */
import { MAX_DUEL_ROUNDS, PAID_DUELS_PER_DAY, duelPrize, playDuelRound, readDuelMove, replayDuel, type DuelPick, type DuelSide, type DuelVillage } from './duel';
import type { Look } from './looks';

export const DUEL_CHALLENGE_MS = 30_000;
export const DUEL_ROUND_MS = 60_000;
export const DUEL_ROUND_GRACE_MS = 1_500;
export const DUEL_MAX_MISSED = 2;

export type DuelStatus = 'asked' | 'playing' | 'done' | 'declined' | 'expired' | 'cancelled';
export type DuelEnding = 'finished' | 'left' | 'timeouts' | 'switched-off' | 'idle';

/** One clan as the duel shows it: its heroes' looks (race and class, never names) and its village bonuses. */
export interface DuelClan {
  heroes: { race: string; cls: string; look?: Look | null }[];
  village: DuelVillage;
}

/** A row of clan_duels, as the database and Realtime send it. Names are clan names, never a pupil's. */
export interface DuelRow {
  id: number;
  seat_a: string;
  seat_b: string;
  name_a: string;
  name_b: string;
  clans: [DuelClan, DuelClan];
  status: DuelStatus;
  rounds: [DuelPick, DuelPick][];
  missed: [number, number];
  deadline: string;
  winner: DuelSide | null;
  ending: DuelEnding | null;
  leaver: DuelSide | null;
  gold: [number, number];
  banners: [number, number];
  cheers: [string | null, string | null];
  version: number;
  created_at: string;
  finished_at: string | null;
}

export const duelOpen = (d: Pick<DuelRow, 'status'>) => d.status === 'asked' || d.status === 'playing';
export const duelSeat = (d: Pick<DuelRow, 'seat_a' | 'seat_b'>, player: string): DuelSide | -1 => (d.seat_a === player ? 0 : d.seat_b === player ? 1 : -1);
export const duelVillages = (d: Pick<DuelRow, 'clans'>): [DuelVillage, DuelVillage] => [d.clans[0].village, d.clans[1].village];

type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'refused' | 'busy' };
type Picks = [DuelPick | null, DuelPick | null];

export interface DuelServices {
  now(): number;
  /** The clan's waiting 'duel' question: was it answered right, and its number (null when there is none). */
  duelMaths(player: string): Promise<{ right: boolean; askNo: number | null }>;
  duelLoad(duel: number): Promise<Outcome<{ duel: DuelRow; on: [boolean, boolean] } | null>>;
  duelChallenge(player: string, other: string, waitMs: number): Promise<Outcome<{ result: 'ok' | 'away' | 'class' | 'busy' | 'off' | 'no-clan'; duel: number | null }>>;
  duelAnswer(player: string, duel: number, accept: boolean, roundMs: number): Promise<Outcome<{ result: 'ok' | 'late' | 'busy' | 'not-yours'; duel?: DuelRow }>>;
  duelPick(player: string, duel: number, round: number, move: string, right: boolean, askNo: number | null): Promise<Outcome<{ result: 'ok' | 'already' | 'late' | 'over' | 'round' | 'not-yours'; duel?: DuelRow; picks?: Picks }>>;
  duelRoundPicks(duel: number, round: number): Promise<Outcome<Picks>>;
  duelRound(duel: number, version: number, rounds: [DuelPick, DuelPick][], missed: [number, number], deadlineMs: number): Promise<Outcome<DuelRow | null>>;
  duelEnd(duel: number, version: number, status: 'done' | 'declined' | 'cancelled', ending: DuelEnding | null, winner: DuelSide | null, leaver: DuelSide | null,
    rounds: [DuelPick, DuelPick][] | null, gold: [number, number] | null, banners: [number, number] | null, paidPerDay: number): Promise<Outcome<DuelRow | null>>;
}

export type DuelAction = 'duel-challenge' | 'duel-answer' | 'duel-pick' | 'duel-times-up' | 'duel-leave';
export const DUEL_ACTIONS: readonly DuelAction[] = ['duel-challenge', 'duel-answer', 'duel-pick', 'duel-times-up', 'duel-leave'];

export interface DuelReply {
  status: number;
  body: Record<string, unknown>;
}

export const DUEL_SAY = {
  bad: "That couldn't be read.",
  busy: "That couldn't be done just now. Try again in a moment.",
  notYours: "That isn't your duel.",
  away: "That clan isn't in Clan Quest right now.",
  otherClass: 'You can only duel clans in your own class.',
  inDuel: "One of you is already in a duel. Try again when it's over.",
  off: 'Live duels are switched off for now. You can still practise against a computer clan!',
  noClan: 'You both need a clan first.',
  late: 'That challenge has run out.',
  notStarted: "The duel hasn't started yet.",
  over: 'This duel has already ended.',
  changed: 'The duel changed just then. Have another look.',
  round: "That round's already been played.",
  notYet: "There's still time on the clock.",
  stopped: 'Your teacher has switched live duels off, so this duel has stopped.',
} as const;

const ok = (body: Record<string, unknown>): DuelReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): DuelReply => ({ status, body: { error, ...extra } });
const failed = (o: { why: string }) => (o.why === 'refused' ? no(400, DUEL_SAY.bad) : no(503, DUEL_SAY.busy));
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1;

async function afterRound(s: DuelServices, d: DuelRow, picks: [DuelPick, DuelPick], missed: [number, number]): Promise<DuelReply> {
  const villages = duelVillages(d);
  let state;
  try {
    state = playDuelRound(replayDuel(d.rounds, villages), picks, villages);
  } catch {
    return no(409, DUEL_SAY.over, { code: 'over', duel: d });
  }
  const rounds = [...d.rounds, picks];
  if (!state.over) {
    const saved = await s.duelRound(d.id, d.version, rounds, missed, s.now() + DUEL_ROUND_MS);
    if (!saved.ok) return failed(saved);
    if (!saved.value) return no(409, DUEL_SAY.changed, { code: 'changed' });
    return ok({ duel: saved.value });
  }
  const prize = duelPrize(state.winner, villages);
  const ended = await s.duelEnd(d.id, d.version, 'done', 'finished', state.winner, null, rounds, prize.gold, prize.banners, PAID_DUELS_PER_DAY);
  if (!ended.ok) return failed(ended);
  if (!ended.value) return no(409, DUEL_SAY.changed, { code: 'changed' });
  return ok({ duel: ended.value });
}

export async function handleDuel(s: DuelServices, player: string, action: DuelAction, body: Record<string, unknown>): Promise<DuelReply> {
  if (action === 'duel-challenge') {
    if (!isUuid(body.other)) return no(400, DUEL_SAY.bad);
    const r = await s.duelChallenge(player, body.other, DUEL_CHALLENGE_MS);
    if (!r.ok) return failed(r);
    const why = r.value.result;
    if (why !== 'ok' || r.value.duel === null) {
      const words = why === 'away' ? DUEL_SAY.away : why === 'class' ? DUEL_SAY.otherClass : why === 'busy' ? DUEL_SAY.inDuel : why === 'off' ? DUEL_SAY.off : why === 'no-clan' ? DUEL_SAY.noClan : DUEL_SAY.bad;
      return no(409, words, { code: why });
    }
    const loaded = await s.duelLoad(r.value.duel);
    if (!loaded.ok || !loaded.value) return no(503, DUEL_SAY.busy);
    return ok({ duel: loaded.value.duel });
  }

  if (!isId(body.duel)) return no(400, DUEL_SAY.bad);
  const loaded = await s.duelLoad(body.duel);
  if (!loaded.ok) return failed(loaded);
  const seat = loaded.value ? duelSeat(loaded.value.duel, player) : -1;
  if (!loaded.value || seat < 0) return no(403, DUEL_SAY.notYours);
  const d = loaded.value.duel;
  const me = seat as DuelSide;
  const other = (1 - me) as DuelSide;

  // Switched off for either class: an open duel ends with no prizes.
  if ((!loaded.value.on[0] || !loaded.value.on[1]) && duelOpen(d)) {
    const playing = d.status === 'playing';
    const ended = await s.duelEnd(d.id, d.version, playing ? 'done' : 'cancelled', playing ? 'switched-off' : null, null, null, null, null, null, PAID_DUELS_PER_DAY);
    if (!ended.ok) return failed(ended);
    return no(403, DUEL_SAY.stopped, { code: 'off', duel: ended.value ?? d });
  }

  if (action === 'duel-answer') {
    if (typeof body.accept !== 'boolean') return no(400, DUEL_SAY.bad);
    const r = await s.duelAnswer(player, d.id, body.accept, DUEL_ROUND_MS);
    if (!r.ok) return failed(r);
    const { result, duel } = r.value;
    if (result === 'not-yours') return no(403, DUEL_SAY.notYours);
    if (result === 'late') return no(409, DUEL_SAY.late, { code: 'late', duel });
    if (result === 'busy') return no(409, DUEL_SAY.inDuel, { code: 'busy', duel });
    return ok({ duel });
  }

  if (action === 'duel-leave') {
    if (!duelOpen(d)) return ok({ duel: d });
    const playing = d.status === 'playing';
    const ended = playing
      ? await s.duelEnd(d.id, d.version, 'done', 'left', other, me, null, null, null, PAID_DUELS_PER_DAY)
      : await s.duelEnd(d.id, d.version, me === 1 ? 'declined' : 'cancelled', null, null, null, null, null, null, PAID_DUELS_PER_DAY);
    if (!ended.ok) return failed(ended);
    if (!ended.value) return no(409, DUEL_SAY.changed, { code: 'changed' });
    return ok({ duel: ended.value });
  }

  if (d.status === 'asked') return no(409, DUEL_SAY.notStarted, { code: 'not-started', duel: d });
  if (d.status !== 'playing') return no(409, DUEL_SAY.over, { code: 'over', duel: d });
  const round = d.rounds.length;
  if (round >= MAX_DUEL_ROUNDS) return no(409, DUEL_SAY.over, { code: 'over', duel: d });

  if (action === 'duel-pick') {
    const move = readDuelMove(body.move);
    if (!move || body.round !== round) {
      if (Number.isInteger(body.round) && (body.round as number) < round) return no(409, DUEL_SAY.round, { code: 'round', duel: d });
      return no(400, DUEL_SAY.bad);
    }
    // The maths was marked (and kept in the pupil's records) by askCheck; the database makes sure each question powers one round.
    const maths = await s.duelMaths(player);
    const r = await s.duelPick(player, d.id, round, move, maths.right, maths.askNo);
    if (!r.ok) return failed(r);
    const { result, picks } = r.value;
    const now = r.value.duel ?? d;
    if (result === 'not-yours') return no(403, DUEL_SAY.notYours);
    if (result === 'over') return no(409, DUEL_SAY.over, { code: 'over', duel: now });
    if (result === 'round') return no(409, DUEL_SAY.round, { code: 'round', duel: now });
    if (result === 'late') return no(409, DUEL_SAY.late, { code: 'late', duel: now });
    if (result === 'ok' && picks?.[0] && picks[1]) return afterRound(s, now, [picks[0], picks[1]], [0, 0]);
    return ok({ duel: now, picked: true });
  }

  // duel-times-up: anyone in the duel can ask; the server checks its own clock.
  const left = Date.parse(d.deadline) + DUEL_ROUND_GRACE_MS - s.now();
  if (!(left <= 0)) return no(409, DUEL_SAY.notYet, { code: 'not-yet', secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1000) : 60, duel: d });
  const got = await s.duelRoundPicks(d.id, round);
  if (!got.ok) return failed(got);
  const picks: [DuelPick, DuelPick] = [got.value[0] ?? { move: null, right: false }, got.value[1] ?? { move: null, right: false }];
  const missed: [number, number] = [got.value[0] ? 0 : d.missed[0] + 1, got.value[1] ? 0 : d.missed[1] + 1];
  const gone = ([0, 1] as const).filter((i) => missed[i] >= DUEL_MAX_MISSED);
  if (gone.length > 0) {
    const winner = gone.length === 1 ? ((1 - gone[0]) as DuelSide) : null;
    const ended = await s.duelEnd(d.id, d.version, 'done', 'timeouts', winner, gone.length === 1 ? gone[0] : null, [...d.rounds, picks], null, null, PAID_DUELS_PER_DAY);
    if (!ended.ok) return failed(ended);
    if (!ended.value) return no(409, DUEL_SAY.changed, { code: 'changed' });
    return ok({ duel: ended.value });
  }
  return afterRound(s, d, picks, missed);
}
