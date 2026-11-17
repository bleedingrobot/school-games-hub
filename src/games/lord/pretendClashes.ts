/**
 * Pretend classmates for the Dragon Maths preview (preview/lord?clash=1): live arena clashes against the REAL server
 * rules (shared/lord/clashServer.ts) and an in-memory copy of the database (clashMemory), with a classmate played by the
 * computer. Bea says yes to a challenge after a moment and picks each round after a few seconds; with ?clash=ask she
 * challenges you soon after the game opens. Only the preview uses this.
 */
import { computerPick } from '../../../shared/lord/clash';
import { clashMemory } from '../../../shared/lord/clashMemory';
import { handleClash, type ClashRow, type ClashServices } from '../../../shared/lord/clashServer';
import type { ClashApi, ClashRequest, ClashResult } from '../../data/lordClash';

const BEA = '00000000-0000-4000-8000-0000000000be';
const MOE = '00000000-0000-4000-8000-0000000000e0';

export function pretendClashApi(me: string, options: { askMe?: boolean } = {}): ClashApi {
  const mem = clashMemory(() => Date.now());
  mem.pupils.set(me, { name: 'Brave Kiwi', classId: 'room', level: 3, here: true });
  mem.pupils.set(BEA, { name: 'Bea', classId: 'room', level: 4, heroClass: 'mage', here: true });
  mem.pupils.set(MOE, { name: 'Moe', classId: 'room', level: 2, heroClass: 'trickster', here: true });
  const services: ClashServices = {
    ...mem.services,
    now: () => Date.now(),
    load: async (p) => ({ ok: true, value: { row: { hero: { level: mem.pupils.get(p)?.level ?? 1 } } as never, openFight: null, seen: false } }),
    settings: async () => ({ ok: true, value: { enabled: true, forestPerDay: 10, seasonStart: null } }),
    recordAnswers: async () => ({ ok: true, value: 0 }),
  };
  const listeners = new Set<(row: ClashRow) => void>();
  const tell = (row: ClashRow | null | undefined) => { if (row) for (const l of listeners) l(row); };
  const run = async (who: string, body: Record<string, unknown>): Promise<ClashResult> => {
    const out = await handleClash(services, who, body.action as never, body);
    const clash = (out.body.clash as ClashRow | undefined) ?? null;
    tell(clash);
    return out.status === 200 ? { ok: true, clash } : { ok: false, message: String(out.body.error), code: out.body.code as string | undefined, clash: clash ?? undefined };
  };
  const later = (ms: number, f: () => void) => window.setTimeout(f, ms);

  // The computer classmate: answers a challenge, then picks every round.
  const botRounds = new Set<string>();
  function botPlays(row: ClashRow) {
    const bot = row.seat_a === me ? row.seat_b : row.seat_a;
    if (row.status !== 'playing') return;
    const key = `${row.id}:${row.rounds.length}`;
    if (botRounds.has(key)) return;
    botRounds.add(key);
    const p = computerPick(Math.random);
    later(2500 + Math.random() * 4000, () => void run(bot, { action: 'clash-pick', clash: row.id, round: row.rounds.length, move: p.move, proof: null }));
  }
  listeners.add((row) => {
    if (row.status === 'asked' && row.seat_b !== me) later(2500, () => void run(row.seat_b, { action: 'clash-answer', clash: row.id, accept: true }));
    botPlays(row);
  });
  if (options.askMe) later(6000, () => void run(BEA, { action: 'clash-challenge', other: me }));

  return {
    async here() {
      const online = [BEA, MOE].map((id) => ({ id, name: mem.pupils.get(id)!.name, avatar: null, busy: [...mem.clashes.values()].some((c) => c.status === 'playing' && (c.seat_a === id || c.seat_b === id) && c.seat_a !== me && c.seat_b !== me) }));
      const asks = [...mem.clashes.values()].filter((c) => c.seat_b === me && c.status === 'asked').map((c) => ({ clash: c.id, from: c.name_a, deadline: c.deadline }));
      const clash = [...mem.clashes.values()].reverse().find((c) => (c.status === 'playing' && (c.seat_a === me || c.seat_b === me)) || (c.status === 'asked' && c.seat_a === me)) ?? null;
      return { off: false, online, asks, clash };
    },
    send: (request: ClashRequest) => run(me, request as unknown as Record<string, unknown>),
    async cheer(id, cheer) {
      const c = mem.clashes.get(id);
      if (!c) return null;
      const seat = c.seat_a === me ? 0 : 1;
      const next = { ...c, cheers: c.cheers.map((x, i) => (i === seat ? cheer : x)) as ClashRow['cheers'], version: c.version + 1 };
      mem.clashes.set(id, next);
      tell(next);
      // The classmate cheers back.
      later(1500, () => {
        const now = mem.clashes.get(id)!;
        const back = { ...now, cheers: now.cheers.map((x, i) => (i === 1 - seat ? 'good-fight' : x)) as ClashRow['cheers'], version: now.version + 1 };
        mem.clashes.set(id, back);
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
