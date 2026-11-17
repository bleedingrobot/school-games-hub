/**
 * Dragon Maths: live arena clashes between classmates, the server's side (rules in clash.ts; database in migration
 * 20261117000200_lord_live_arena.sql). The same pattern as Archery's classmate fights: the browser only ever asks
 * ("challenge Mia", "yes", "Hammer, and here's my answer", "the clock ran out", "I'm leaving"); this works out who's
 * asking from their sign-in, marks the maths answer itself, keeps each pick hidden in the database until both are in, and
 * plays the round with the shared rules. It saves "only if nothing has changed since it looked".
 *
 *   clash-challenge  {other}                         sends a challenge (same school and class only);
 *   clash-answer     {clash, accept}                 the classmate says yes (round 1 starts) or no;
 *   clash-pick       {clash, round, move, proof}     this round's attack, and which ladder question powers it (asked with the
 *                                                    game's own `ask` during this round and marked by `ask-check`);
 *   clash-times-up   {clash}                         the round's time ran out (the server checks its own clock);
 *   clash-leave      {clash}                         calls off a challenge, or gives up (the other side wins, no gold).
 *
 * Gold only for a clash played to the end: the winner about a forest fight's worth at their level, the other side half of
 * that (a draw: half each), for each pupil's first PAID_CLASHES_PER_DAY a day. Every reply carries the clash as it now is.
 */
import { MAX_CLASH_ROUNDS, PAID_CLASHES_PER_DAY, clashPrize, playRound, readMove, replayClash, type ClashPick, type ClashSide } from './clash';
import { readExtra, type Outcome, type Services } from './server';

/** How long a challenge waits for an answer, and each round's time to pick and answer. */
export const CHALLENGE_MS = 30_000;
export const ROUND_MS = 60_000;
/** Extra time before "the clock ran out" is believed (the network). */
export const ROUND_GRACE_MS = 1_500;
/** Rounds in a row a side can let the clock take before the clash ends. */
export const MAX_MISSED = 2;

export type ClashStatus = 'asked' | 'playing' | 'done' | 'declined' | 'expired' | 'cancelled';
export type ClashEnding = 'finished' | 'left' | 'timeouts' | 'switched-off' | 'idle';

/** A row of lord_clashes, as the database and Realtime send it. */
export interface ClashRow {
  id: number;
  seat_a: string;
  seat_b: string;
  name_a: string;
  name_b: string;
  heroes: [{ heroClass: string; look?: string | null; level: number }, { heroClass: string; look?: string | null; level: number }];
  status: ClashStatus;
  rounds: [ClashPick, ClashPick][];
  missed: [number, number];
  deadline: string;
  winner: ClashSide | null;
  ending: ClashEnding | null;
  leaver: ClashSide | null;
  gold: [number, number];
  cheers: [string | null, string | null];
  version: number;
  created_at: string;
  finished_at: string | null;
}

export const clashOpen = (c: Pick<ClashRow, 'status'>) => c.status === 'asked' || c.status === 'playing';
export const seatIn = (c: Pick<ClashRow, 'seat_a' | 'seat_b'>, player: string): ClashSide | -1 => (c.seat_a === player ? 0 : c.seat_b === player ? 1 : -1);

type Picks = [ClashPick | null, ClashPick | null];

export interface ClashServices extends Pick<Services, 'now' | 'load' | 'settings'> {
  clashLoad(clash: number): Promise<Outcome<{ clash: ClashRow; on: [boolean, boolean] } | null>>;
  clashChallenge(player: string, other: string, waitMs: number): Promise<Outcome<{ result: 'ok' | 'away' | 'class' | 'busy' | 'off' | 'no-hero'; clash: number | null }>>;
  clashAnswer(player: string, clash: number, accept: boolean, roundMs: number): Promise<Outcome<{ result: 'ok' | 'late' | 'busy' | 'not-yours'; clash?: ClashRow }>>;
  clashPick(player: string, clash: number, round: number, move: string, right: boolean): Promise<Outcome<{ result: 'ok' | 'already' | 'late' | 'over' | 'round' | 'not-yours'; clash?: ClashRow; picks?: Picks }>>;
  clashRoundPicks(clash: number, round: number): Promise<Outcome<Picks>>;
  /** Saves a played round only if the clash is still at `version`; null if it had changed. */
  clashRound(clash: number, version: number, rounds: [ClashPick, ClashPick][], missed: [number, number], deadlineMs: number): Promise<Outcome<ClashRow | null>>;
  /** Ends the clash (paying `want`, within the daily limit) only if it's still at `version`; null if it had changed. */
  clashEnd(clash: number, version: number, status: 'done' | 'declined' | 'cancelled', ending: ClashEnding | null, winner: ClashSide | null, leaver: ClashSide | null, rounds: [ClashPick, ClashPick][] | null, want: [number, number] | null, paidPerDay: number): Promise<Outcome<ClashRow | null>>;
}

export type ClashAction = 'clash-challenge' | 'clash-answer' | 'clash-pick' | 'clash-times-up' | 'clash-leave';
export const CLASH_ACTIONS: readonly ClashAction[] = ['clash-challenge', 'clash-answer', 'clash-pick', 'clash-times-up', 'clash-leave'];

export interface ClashReply {
  status: number;
  body: Record<string, unknown>;
}

/** Words pupils see. Kind, short, nothing technical. */
export const CLASH_SAY = {
  bad: "That couldn't be read.",
  busy: "That couldn't be done just now. Try again in a moment.",
  notYours: "That isn't your clash.",
  away: "That classmate isn't in Dragon Maths right now.",
  otherClass: 'You can only challenge classmates in your own class.',
  inClash: "One of you is already in a clash. Try again when it's over.",
  off: 'Classmate clashes are switched off for now. You can still practise against a computer hero!',
  noHero: 'You both need a hero first.',
  late: 'That challenge has run out.',
  notStarted: "The clash hasn't started yet.",
  over: 'This clash has already ended.',
  changed: 'The clash changed just then. Have another look.',
  round: "That round's already been played.",
  notYet: "There's still time on the clock.",
  stopped: 'Your teacher has switched classmate clashes off, so this clash has stopped.',
} as const;

const ok = (body: Record<string, unknown>): ClashReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): ClashReply => ({ status, body: { error, ...extra } });
const failed = (o: { why: string }) => (o.why === 'refused' ? no(400, CLASH_SAY.bad) : no(503, CLASH_SAY.busy));

const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1;

/** The clash after a round: saved as the next round, or ended (with gold) if that round finished it. */
async function afterRound(s: ClashServices, c: ClashRow, picks: [ClashPick, ClashPick], missed: [number, number]): Promise<ClashReply> {
  let state;
  try {
    state = playRound(replayClash(c.rounds), picks);
  } catch {
    return no(409, CLASH_SAY.over, { code: 'over', clash: c });
  }
  const rounds = [...c.rounds, picks];
  if (!state.over) {
    const saved = await s.clashRound(c.id, c.version, rounds, missed, s.now() + ROUND_MS);
    if (!saved.ok) return failed(saved);
    if (!saved.value) return no(409, CLASH_SAY.changed, { code: 'changed' });
    return ok({ clash: saved.value });
  }
  const want = clashPrize(state.winner, [c.heroes[0]?.level ?? 1, c.heroes[1]?.level ?? 1]);
  const ended = await s.clashEnd(c.id, c.version, 'done', 'finished', state.winner, null, rounds, want, PAID_CLASHES_PER_DAY);
  if (!ended.ok) return failed(ended);
  if (!ended.value) return no(409, CLASH_SAY.changed, { code: 'changed' });
  return ok({ clash: ended.value });
}

/**
 * Was the ladder question a pick names answered right? It must be the pupil's last `ask` for the arena, asked during this
 * round (so one right answer can't power two rounds) and already marked by `ask-check`, which recorded it in their maths.
 * Anything else counts as wrong (never an error the pupil sees).
 */
async function markAnswer(s: ClashServices, player: string, raw: unknown, roundStart: number): Promise<boolean> {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as Record<string, unknown>;
  const loaded = await s.load(player);
  const set = loaded.ok && loaded.value.row ? readExtra(loaded.value.row.extra).ask : null;
  if (!set || set.moment !== 'arena' || t.no !== set.no || set.at < roundStart || typeof t.slot !== 'number') return false;
  return set.marks[t.slot]?.correct === true;
}

export async function handleClash(s: ClashServices, player: string, action: ClashAction, body: Record<string, unknown>): Promise<ClashReply> {
  if (action === 'clash-challenge') {
    if (!isUuid(body.other)) return no(400, CLASH_SAY.bad);
    const r = await s.clashChallenge(player, body.other, CHALLENGE_MS);
    if (!r.ok) return failed(r);
    const why = r.value.result;
    if (why !== 'ok' || r.value.clash === null) {
      const words = why === 'away' ? CLASH_SAY.away : why === 'class' ? CLASH_SAY.otherClass : why === 'busy' ? CLASH_SAY.inClash : why === 'off' ? CLASH_SAY.off : why === 'no-hero' ? CLASH_SAY.noHero : CLASH_SAY.bad;
      return no(409, words, { code: why });
    }
    const loaded = await s.clashLoad(r.value.clash);
    if (!loaded.ok || !loaded.value) return no(503, CLASH_SAY.busy);
    return ok({ clash: loaded.value.clash });
  }

  if (!isId(body.clash)) return no(400, CLASH_SAY.bad);
  const loaded = await s.clashLoad(body.clash);
  if (!loaded.ok) return failed(loaded);
  const seat = loaded.value ? seatIn(loaded.value.clash, player) : -1;
  if (!loaded.value || seat < 0) return no(403, CLASH_SAY.notYours);
  const c = loaded.value.clash;
  const me = seat as ClashSide;
  const other = (1 - me) as ClashSide;

  // Switched off for either class: an open clash ends with no gold.
  if ((!loaded.value.on[0] || !loaded.value.on[1]) && clashOpen(c)) {
    const playing = c.status === 'playing';
    const ended = await s.clashEnd(c.id, c.version, playing ? 'done' : 'cancelled', playing ? 'switched-off' : null, null, null, null, null, PAID_CLASHES_PER_DAY);
    if (!ended.ok) return failed(ended);
    return no(403, CLASH_SAY.stopped, { code: 'off', clash: ended.value ?? c });
  }

  if (action === 'clash-answer') {
    if (typeof body.accept !== 'boolean') return no(400, CLASH_SAY.bad);
    const r = await s.clashAnswer(player, c.id, body.accept, ROUND_MS);
    if (!r.ok) return failed(r);
    const { result, clash } = r.value;
    if (result === 'not-yours') return no(403, CLASH_SAY.notYours);
    if (result === 'late') return no(409, CLASH_SAY.late, { code: 'late', clash });
    if (result === 'busy') return no(409, CLASH_SAY.inClash, { code: 'busy', clash });
    return ok({ clash });
  }

  if (action === 'clash-leave') {
    if (!clashOpen(c)) return ok({ clash: c });
    const playing = c.status === 'playing';
    // Calling off a challenge (or saying no); or giving up part-way: the other side wins, nobody gets gold.
    const ended = playing
      ? await s.clashEnd(c.id, c.version, 'done', 'left', other, me, null, null, PAID_CLASHES_PER_DAY)
      : await s.clashEnd(c.id, c.version, me === 1 ? 'declined' : 'cancelled', null, null, null, null, null, PAID_CLASHES_PER_DAY);
    if (!ended.ok) return failed(ended);
    if (!ended.value) return no(409, CLASH_SAY.changed, { code: 'changed' });
    return ok({ clash: ended.value });
  }

  if (c.status === 'asked') return no(409, CLASH_SAY.notStarted, { code: 'not-started', clash: c });
  if (c.status !== 'playing') return no(409, CLASH_SAY.over, { code: 'over', clash: c });
  const round = c.rounds.length;
  if (round >= MAX_CLASH_ROUNDS) return no(409, CLASH_SAY.over, { code: 'over', clash: c });

  if (action === 'clash-pick') {
    const move = readMove(body.move);
    if (!move || body.round !== round) {
      if (Number.isInteger(body.round) && (body.round as number) < round) return no(409, CLASH_SAY.round, { code: 'round', clash: c });
      return no(400, CLASH_SAY.bad);
    }
    const right = await markAnswer(s, player, body.proof, Date.parse(c.deadline) - ROUND_MS - ROUND_GRACE_MS);
    const r = await s.clashPick(player, c.id, round, move, right);
    if (!r.ok) return failed(r);
    const { result, picks } = r.value;
    const now = r.value.clash ?? c;
    if (result === 'not-yours') return no(403, CLASH_SAY.notYours);
    if (result === 'over') return no(409, CLASH_SAY.over, { code: 'over', clash: now });
    if (result === 'round') return no(409, CLASH_SAY.round, { code: 'round', clash: now });
    if (result === 'late') return no(409, CLASH_SAY.late, { code: 'late', clash: now });
    // Both in: whoever's pick came second plays the round. Otherwise wait for the other side.
    if (result === 'ok' && picks?.[0] && picks[1]) return afterRound(s, now, [picks[0], picks[1]], [0, 0]);
    return ok({ clash: now, picked: true });
  }

  // clash-times-up: anyone in the clash can ask (a server function can't wake itself up); the server checks its own clock.
  const left = Date.parse(c.deadline) + ROUND_GRACE_MS - s.now();
  if (!(left <= 0)) return no(409, CLASH_SAY.notYet, { code: 'not-yet', secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1000) : 60, clash: c });
  const got = await s.clashRoundPicks(c.id, round);
  if (!got.ok) return failed(got);
  const picks: [ClashPick, ClashPick] = [got.value[0] ?? { move: null, right: false }, got.value[1] ?? { move: null, right: false }];
  const missed: [number, number] = [got.value[0] ? 0 : c.missed[0] + 1, got.value[1] ? 0 : c.missed[1] + 1];
  const gone = ([0, 1] as const).filter((i) => missed[i] >= MAX_MISSED);
  if (gone.length > 0) {
    // Someone has walked away: the clash ends with no gold. The one still playing wins it.
    const winner = gone.length === 1 ? ((1 - gone[0]) as ClashSide) : null;
    const ended = await s.clashEnd(c.id, c.version, 'done', 'timeouts', winner, gone.length === 1 ? gone[0] : null, [...c.rounds, picks], null, PAID_CLASHES_PER_DAY);
    if (!ended.ok) return failed(ended);
    if (!ended.value) return no(409, CLASH_SAY.changed, { code: 'changed' });
    return ok({ clash: ended.value });
  }
  return afterRound(s, c, picks, missed);
}
