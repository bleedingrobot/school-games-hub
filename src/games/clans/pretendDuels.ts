/**
 * Pretend classmates for the Clan Quest test page: Live Clan Duels against the REAL server rules (shared/clans/duelServer.ts)
 * with an in-memory copy of the database, and classmates' clans played by the computer. They say yes to a challenge after a
 * moment and pick each round after a few seconds; one challenges you soon after the page opens. Nothing is saved anywhere.
 */
import { computerDuelPick, villageOf, type DuelPick } from '../../../shared/clans/duel';
import { handleDuel, type DuelClan, type DuelRow, type DuelServices } from '../../../shared/clans/duelServer';
import { empireOf } from '../../../shared/clans/empire';
import { lookOf } from '../../../shared/clans/looks';
import type { Clan } from '../../../shared/clans/types';
import type { DuelApi, DuelRequest, DuelResult } from '../../data/clanDuel';

const ME = '00000000-0000-4000-8000-00000000c1a0';
const BOTS: { id: string; name: string; clan: DuelClan }[] = [
  {
    id: '00000000-0000-4000-8000-0000000000b1', name: 'Brave Owls',
    clan: { heroes: [{ race: 'Dwarf', cls: 'Knight' }, { race: 'Human', cls: 'Healer' }, { race: 'Half-Elf', cls: 'Sorcerer' }, { race: 'Human', cls: 'Pirate' }], village: villageOf({ forge: 2, walls: 3, barracks: 2, tower: 1, church: 1 }) },
  },
  {
    id: '00000000-0000-4000-8000-0000000000b2', name: 'Iron Wolves',
    clan: { heroes: [{ race: 'Orc', cls: 'Barbarian' }, { race: 'Minotaur', cls: 'Warrior' }, { race: 'Muya', cls: 'Necromancer' }, { race: 'Orc', cls: 'Samurai' }], village: villageOf({ forge: 4, walls: 1, barracks: 4, tower: 3, church: 2 }) },
  },
];

export function pretendDuelApi(myClan: () => Clan | null, options: { askMe?: boolean } = {}): DuelApi {
  const duels = new Map<number, DuelRow & { used: [number, number] }>();
  const picks = new Map<string, [DuelPick | null, DuelPick | null]>();
  const names = new Map<string, string>(BOTS.map((b) => [b.id, b.name]));
  const clanOf = (who: string): DuelClan => {
    const bot = BOTS.find((b) => b.id === who);
    if (bot) return bot.clan;
    const c = myClan();
    return { heroes: (c?.members ?? []).map((m) => ({ race: m.race, cls: m.cls, look: lookOf(m) })), village: villageOf(c ? empireOf(c).levels : null) };
  };
  const nameOf = (who: string) => (who === ME ? myClan()?.name ?? 'Your clan' : names.get(who) ?? 'A clan');
  const bump = (d: DuelRow & { used: [number, number] }) => ({ ...structuredClone(d), version: d.version + 1 });
  const busy = (who: string) => [...duels.values()].some((d) => d.status === 'playing' && (d.seat_a === who || d.seat_b === who));
  let nextId = 1;

  const services: DuelServices = {
    now: () => Date.now(),
    // Practice maths on the test page: every order counts as a right answer.
    duelMaths: async () => ({ right: true, askNo: Date.now() }),
    async duelLoad(id) {
      const d = duels.get(id);
      return { ok: true, value: d ? { duel: structuredClone(d), on: [true, true] } : null };
    },
    async duelChallenge(player, other) {
      if (player === other || !(other === ME || names.has(other))) return { ok: true, value: { result: 'away', duel: null } };
      if (busy(player) || busy(other)) return { ok: true, value: { result: 'busy', duel: null } };
      const id = nextId++;
      duels.set(id, {
        id, seat_a: player, seat_b: other, name_a: nameOf(player), name_b: nameOf(other), clans: [clanOf(player), clanOf(other)], status: 'asked', rounds: [],
        missed: [0, 0], deadline: new Date(Date.now() + 30_000).toISOString(), winner: null, ending: null, leaver: null, gold: [0, 0], banners: [0, 0],
        cheers: [null, null], version: 0, created_at: new Date().toISOString(), finished_at: null, used: [0, 0],
      });
      return { ok: true, value: { result: 'ok', duel: id } };
    },
    async duelAnswer(player, id, accept, roundMs) {
      const d = duels.get(id);
      if (!d || d.seat_b !== player) return { ok: true, value: { result: 'not-yours' } };
      if (d.status !== 'asked') return { ok: true, value: { result: 'late', duel: structuredClone(d) } };
      const next = { ...bump(d), status: accept ? 'playing' as const : 'declined' as const, deadline: new Date(Date.now() + roundMs).toISOString() };
      duels.set(id, next);
      return { ok: true, value: { result: 'ok', duel: structuredClone(next) } };
    },
    async duelPick(player, id, round, move, right) {
      const d = duels.get(id);
      if (!d) return { ok: true, value: { result: 'not-yours' } };
      if (d.status !== 'playing') return { ok: true, value: { result: 'over', duel: structuredClone(d) } };
      if (round !== d.rounds.length) return { ok: true, value: { result: 'round', duel: structuredClone(d) } };
      const seat = d.seat_a === player ? 0 : 1;
      const key = `${id}:${round}`;
      const now = picks.get(key) ?? [null, null];
      if (now[seat]) return { ok: true, value: { result: 'already', duel: structuredClone(d), picks: now } };
      now[seat] = { move: move as DuelPick['move'], right };
      picks.set(key, now);
      return { ok: true, value: { result: 'ok', duel: structuredClone(d), picks: structuredClone(now) } };
    },
    async duelRoundPicks(id, round) {
      return { ok: true, value: picks.get(`${id}:${round}`) ?? [null, null] };
    },
    async duelRound(id, version, rounds, missed, deadlineMs) {
      const d = duels.get(id)!;
      if (d.version !== version) return { ok: true, value: null };
      const next = { ...bump(d), rounds: structuredClone(rounds), missed, deadline: new Date(deadlineMs).toISOString() };
      duels.set(id, next);
      return { ok: true, value: structuredClone(next) };
    },
    async duelEnd(id, version, status, ending, winner, leaver, rounds, gold, banners) {
      const d = duels.get(id)!;
      if (d.version !== version) return { ok: true, value: null };
      const next = {
        ...bump(d), status, ending, winner, leaver, rounds: rounds ? structuredClone(rounds) : d.rounds,
        gold: gold ?? [0, 0] as [number, number], banners: banners ?? [0, 0] as [number, number], finished_at: new Date().toISOString(),
      };
      duels.set(id, next);
      return { ok: true, value: structuredClone(next) };
    },
  };

  const listeners = new Set<(row: DuelRow) => void>();
  const tell = (row: DuelRow | null | undefined) => { if (row) for (const l of listeners) l(row); };
  const run = async (who: string, body: Record<string, unknown>): Promise<DuelResult> => {
    const out = await handleDuel(services, who, body.action as never, body);
    const duel = (out.body.duel as DuelRow | undefined) ?? null;
    tell(duel);
    return out.status === 200 ? { ok: true, duel } : { ok: false, message: String(out.body.error), code: out.body.code as string | undefined, duel: duel ?? undefined };
  };
  const later = (ms: number, f: () => void) => window.setTimeout(f, ms);
  const botRounds = new Set<string>();
  listeners.add((row) => {
    if (row.status === 'asked' && row.seat_b !== ME) later(2500, () => void run(row.seat_b, { action: 'duel-answer', duel: row.id, accept: true }));
    if (row.status !== 'playing') return;
    const bot = row.seat_a === ME ? row.seat_b : row.seat_a;
    const key = `${row.id}:${row.rounds.length}`;
    if (botRounds.has(key)) return;
    botRounds.add(key);
    const p = computerDuelPick(Math.random);
    later(2500 + Math.random() * 3500, () => void run(bot, { action: 'duel-pick', duel: row.id, round: row.rounds.length, move: p.move }));
  });
  if (options.askMe) later(8000, () => { if (myClan()) void run(BOTS[0].id, { action: 'duel-challenge', other: ME }); });

  return {
    me: ME,
    async here() {
      const online = BOTS.map((b) => ({ id: b.id, name: b.name, busy: [...duels.values()].some((d) => d.status === 'playing' && (d.seat_a === b.id || d.seat_b === b.id) && d.seat_a !== ME && d.seat_b !== ME) }));
      const asks = [...duels.values()].filter((d) => d.seat_b === ME && d.status === 'asked').map((d) => ({ duel: d.id, from: d.name_a, deadline: d.deadline }));
      const duel = [...duels.values()].reverse().find((d) => (d.status === 'playing' && (d.seat_a === ME || d.seat_b === ME)) || (d.status === 'asked' && d.seat_a === ME)) ?? null;
      return { off: false, online, asks, duel };
    },
    send: (request: DuelRequest) => run(ME, request as unknown as Record<string, unknown>),
    async cheer(id, cheer) {
      const d = duels.get(id);
      if (!d) return null;
      const seat = d.seat_a === ME ? 0 : 1;
      const next = { ...bump(d), cheers: d.cheers.map((x, i) => (i === seat ? cheer : x)) as DuelRow['cheers'] };
      duels.set(id, next);
      tell(next);
      later(1500, () => {
        const now = duels.get(id)!;
        const back = { ...bump(now), cheers: now.cheers.map((x, i) => (i === 1 - seat ? 'good-fight' : x)) as DuelRow['cheers'] };
        duels.set(id, back);
        tell(back);
      });
      return next;
    },
    watch(_me, onRow, onLive) {
      listeners.add(onRow);
      onLive('live');
      return () => void listeners.delete(onRow);
    },
    clockOffset: async () => 0,
  };
}
