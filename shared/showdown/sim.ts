/**
 * Plays whole rounds with pretend pupils, for tuning boss health (`npm run showdown:sim`). Nothing here runs for pupils.
 */
import { botClass, type BotPupil } from './bots';
import { advance, answer, chooseRole, enrage, goldenNext, join, newRound, start } from './engine';
import { rng } from './schedule';
import { chooseSeam, diggersAt, GOLDRUSH, openSeamsOf } from './goldrush';
import type { Arena, Mode, Round, ShowdownEvent } from './types';

export interface SimResult {
  round: Round;
  beaten: boolean;
  /** All the damage the class did (with a boss that can't fall, this is what any boss would have faced). */
  damage: number;
  /** How many times the boss healed (each heal is 10% of its health). */
  heals: number;
  events: Record<string, number>;
}

/** Play one round. `bossHealth` fixes the boss; leave it out to use the tuned table. `teacherEnrage` presses it once. */
export function playRound(opts: { seed: number; size: number; lengthMin: number; mode: Mode; bossHealth?: number; teacherEnrage?: boolean; bots?: BotPupil[]; arena?: Arena }): SimResult {
  const r = newRound({ seed: opts.seed, mode: opts.mode, lengthMin: opts.lengthMin, bossHealth: opts.bossHealth });
  if (opts.arena && opts.arena !== 'boss') r.arena = opts.arena;
  const bots = opts.bots ?? botClass(opts.seed, opts.size, opts.mode);
  const rand = rng(opts.seed ^ 0xb075);
  const counts: Record<string, number> = {};
  const note = (evs: ShowdownEvent[]) => { for (const e of evs) counts[e.type] = (counts[e.type] ?? 0) + 1; };
  for (const b of bots) note(join(r, b).events);
  note(start(r).events);
  for (const b of bots) if (opts.mode !== 'solo') note(chooseRole(r, b.id, b.role, 0).events);

  const think = (b: BotPupil) => b.thinkMs[0] + rand() * (b.thinkMs[1] - b.thinkMs[0]);
  // Each bot's next try: when it has thought about its question (and the ring is full, and it isn't dazed).
  const nextTry = new Map(bots.map((b) => [b.id, think(b)]));
  const end = r.lengthMin * 60000;
  let enraged = !opts.teacherEnrage;
  while (r.state === 'live') {
    let id = '';
    let at = Infinity;
    for (const [k, v] of nextTry) if (v < at) { at = v; id = k; }
    if (!enraged && at > end / 2) { enraged = true; note(enrage(r, end / 2).events); continue; }
    if (at >= end) { note(advance(r, end)); break; }
    const b = bots.find((x) => x.id === id)!;
    const p = r.players[id];
    const wait = Math.max(p.nextAt, p.dazedUntil);
    if (at < wait) { nextTry.set(id, wait + 300 + rand() * 700); continue; }
    // Gold Rush: fast and steady pupils move to the seam with the most gold per digger now and then; others stay put.
    if (r.arena === 'goldrush' && (b.kind === 'fast' || b.kind === 'steady') && rand() < 0.25) {
      const scale = Math.max(1, Math.ceil(r.order.length / 12));
      const best = openSeamsOf(r)
        .map((x) => ({ x, v: GOLDRUSH.kinds[x.kind].times * Math.min(1, (GOLDRUSH.kinds[x.kind].room * scale) / (diggersAt(r, x.id).length + 1)) }))
        .sort((a, c) => c.v - a.v)[0];
      if (best) chooseSeam(r, id, best.x.id);
    }
    const golden = goldenNext(r, id, at);
    const right = rand() < (golden ? Math.min(0.97, b.right + 0.1) : b.right);
    const out = answer(r, id, right, at, { golden });
    note(out.events);
    // Dazed by a wind-up that ended just now: try again when the stars stop (or a Healer wakes them).
    nextTry.set(id, !out.ok && out.reason === 'dazed' ? p.dazedUntil + 300 + rand() * 700 : at + think(b));
  }
  const damage = r.order.reduce((s, k) => s + r.players[k].damage, 0);
  return { round: r, beaten: r.result === 'beaten', damage, heals: counts.boss_heals ?? 0, events: counts };
}

