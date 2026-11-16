/**
 * The clash database (migration 20261117000200_lord_live_arena.sql) kept in memory, for the server tests: the same
 * answers the SQL functions give, for a handful of pupils in one class.
 */
import type { ClashPick } from './clash';
import type { ClashRow, ClashServices } from './clashServer';

type SavedPick = { move: string; right: boolean };

export interface ClashPupil {
  name: string;
  classId: string;
  level: number;
  heroClass?: string;
  here?: boolean;
  live?: boolean;
  gold?: number;
}

export interface ClashMemory {
  pupils: Map<string, ClashPupil>;
  clashes: Map<number, ClashRow>;
  picks: Map<string, SavedPick>;
  services: Pick<ClashServices, 'clashLoad' | 'clashChallenge' | 'clashAnswer' | 'clashPick' | 'clashRoundPicks' | 'clashRound' | 'clashEnd'>;
}

const ok = <T>(value: T) => ({ ok: true as const, value });

export function clashMemory(now: () => number, nzDay: (ms: number) => string = (ms) => new Date(ms).toISOString().slice(0, 10)): ClashMemory {
  const pupils = new Map<string, ClashPupil>();
  const clashes = new Map<number, ClashRow>();
  const picks = new Map<string, SavedPick>();
  let nextId = 1;
  const key = (clash: number, seat: number, round: number) => `${clash}:${seat}:${round}`;
  const iso = (ms: number) => new Date(ms).toISOString();
  const live = (p: string) => pupils.get(p)?.live !== false;
  const busy = (p: string) => [...clashes.values()].some((c) => c.status === 'playing' && (c.seat_a === p || c.seat_b === p));
  const bump = (c: ClashRow, patch: Partial<ClashRow>) => {
    const next = { ...c, ...patch, version: c.version + 1 };
    clashes.set(c.id, next);
    return next;
  };
  const roundPicks = (clash: number, round: number): [ClashPick | null, ClashPick | null] =>
    [0, 1].map((seat) => (picks.get(key(clash, seat, round)) as ClashPick | undefined) ?? null) as [ClashPick | null, ClashPick | null];

  function close(c: ClashRow, status: ClashRow['status'], patch: Partial<ClashRow>, want: [number, number] | null, perDay: number): ClashRow {
    const paid: [number, number] = [0, 0];
    const today = nzDay(now());
    for (const i of [0, 1] as const) {
      if (!want || want[i] <= 0) continue;
      const who = i === 0 ? c.seat_a : c.seat_b;
      const count = [...clashes.values()].filter((x) => x.status === 'done' && x.finished_at && nzDay(Date.parse(x.finished_at)) === today
        && ((x.seat_a === who && x.gold[0] > 0) || (x.seat_b === who && x.gold[1] > 0))).length;
      if (count >= perDay) continue;
      const p = pupils.get(who);
      if (p) {
        p.gold = (p.gold ?? 0) + want[i];
        paid[i] = want[i];
      }
    }
    for (const k of [...picks.keys()]) if (k.startsWith(`${c.id}:`)) picks.delete(k);
    return bump(c, { ...patch, status, gold: paid, finished_at: iso(now()) });
  }

  const services: ClashMemory['services'] = {
    async clashLoad(clash) {
      const c = clashes.get(clash);
      return ok(c ? { clash: c, on: [live(c.seat_a), live(c.seat_b)] as [boolean, boolean] } : null);
    },
    async clashChallenge(player, other, waitMs) {
      const me = pupils.get(player);
      const them = pupils.get(other);
      let result: 'ok' | 'away' | 'class' | 'busy' | 'off' | 'no-hero' = 'ok';
      if (!me) throw new Error('No such player');
      if (!them || other === player || !them.here) result = 'away';
      else if (them.classId !== me.classId) result = 'class';
      else if (!live(player) || !live(other)) result = 'off';
      else if (busy(player) || busy(other)) result = 'busy';
      if (result !== 'ok' || !them) return ok({ result, clash: null });
      for (const old of clashes.values()) if (old.seat_a === player && old.status === 'asked') close(old, 'cancelled', {}, null, 0);
      const id = nextId++;
      const hero = (p: ClashPupil) => ({ heroClass: p.heroClass ?? 'knight', look: null, level: p.level });
      clashes.set(id, {
        id, seat_a: player, seat_b: other, name_a: me.name, name_b: them.name, heroes: [hero(me), hero(them)], status: 'asked', rounds: [],
        missed: [0, 0], deadline: iso(now() + waitMs), winner: null, ending: null, leaver: null, gold: [0, 0], cheers: [null, null],
        version: 0, created_at: iso(now()), finished_at: null,
      });
      return ok({ result, clash: id });
    },
    async clashAnswer(player, clash, accept, roundMs) {
      const c = clashes.get(clash);
      if (!c || c.seat_b !== player) return ok({ result: 'not-yours' as const });
      if (c.status !== 'asked' || Date.parse(c.deadline) <= now()) return ok({ result: 'late' as const, clash: c });
      if (!accept) return ok({ result: 'ok' as const, clash: close(c, 'declined', {}, null, 0) });
      if (busy(c.seat_a) || busy(c.seat_b)) return ok({ result: 'busy' as const, clash: c });
      return ok({ result: 'ok' as const, clash: bump(c, { status: 'playing', deadline: iso(now() + roundMs) }) });
    },
    async clashPick(player, clash, round, move, right) {
      const c = clashes.get(clash);
      const seat = !c ? -1 : c.seat_a === player ? 0 : c.seat_b === player ? 1 : -1;
      if (!c || seat < 0) return ok({ result: 'not-yours' as const });
      if (c.status !== 'playing') return ok({ result: 'over' as const, clash: c });
      if (round !== c.rounds.length) return ok({ result: 'round' as const, clash: c });
      if (Date.parse(c.deadline) < now() - 2000) return ok({ result: 'late' as const, clash: c });
      const k = key(clash, seat, round);
      const fresh = !picks.has(k);
      if (fresh) picks.set(k, { move, right });
      return ok({ result: fresh ? ('ok' as const) : ('already' as const), clash: c, picks: roundPicks(clash, round) });
    },
    async clashRoundPicks(clash, round) {
      return ok(roundPicks(clash, round));
    },
    async clashRound(clash, version, rounds, missed, deadlineMs) {
      const c = clashes.get(clash);
      if (!c || c.version !== version || c.status !== 'playing') return ok(null);
      for (const k of [...picks.keys()]) if (k.startsWith(`${c.id}:`)) picks.delete(k);
      return ok(bump(c, { rounds, missed, deadline: iso(deadlineMs) }));
    },
    async clashEnd(clash, version, status, ending, winner, leaver, rounds, want, perDay) {
      const c = clashes.get(clash);
      if (!c || c.version !== version || (c.status !== 'asked' && c.status !== 'playing')) return ok(null);
      return ok(close(c, status, { ending, winner, leaver, ...(rounds ? { rounds } : {}) }, want, perDay));
    },
  };
  return { pupils, clashes, picks, services };
}
