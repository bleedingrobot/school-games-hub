/**
 * A pretend class for Class Showdown (`?pretend=30`): pretend pupils (shared/showdown/bots.ts, at real speeds: fast,
 * steady, slow and wobbly) who join, pick roles and answer through the REAL server steps (`showdownStep`) on a database
 * in memory. The tests drive it with a pretend clock; the preview page drives it with real timers.
 */
import { botClass, type BotPupil } from './bots';
import { markQuestion } from '../maths/serverQuestions';
import { memoryDb, memoryServices, type MemoryDb } from './memoryServices';
import { rng } from './schedule';
import { showdownStep, type Change, type ShowdownServices } from './server';
import type { Mode } from './types';

export const PRETEND_TEACHER = '00000000-0000-4000-8000-00000000feed';
export const PRETEND_CLASS = '00000000-0000-4000-8000-00000000c1a5';
const botId = (i: number) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;

/** Something that runs `fn` after `ms` (real timers in the browser, a pretend clock in the tests). */
export type Later = (fn: () => void | Promise<void>, ms: number) => void;

export interface PretendClass {
  db: MemoryDb;
  services: ShowdownServices;
  bots: BotPupil[];
  /** Every bot joins now (pupils who join late are fine too: call `joinBot`). */
  joinAll(room: number): Promise<void>;
  /** Bots start answering once the round is live, until it's over. */
  play(room: number): void;
}

export function pretendClass(opts: { size: number; mode: Mode; seed: number; clock: { now(): number }; later: Later; onChange?: (room: number, change: Change) => void }): PretendClass {
  const bots = botClass(opts.seed, opts.size, opts.mode).map((b, i) => ({ ...b, id: botId(i) }));
  const db = memoryDb({
    pupils: bots.map((b) => ({ id: b.id, name: b.name, classId: PRETEND_CLASS })),
    teachers: { [PRETEND_TEACHER]: [PRETEND_CLASS] },
  });
  const rand = rng(opts.seed ^ 0x9e37);
  const services = memoryServices(db, { now: opts.clock.now, random: rand }, opts.onChange);
  const think = (b: BotPupil) => b.thinkMs[0] + rand() * (b.thinkMs[1] - b.thinkMs[0]);

  const answerLoop = (room: number, b: BotPupil) => {
    const go = async () => {
      const row = db.rooms.get(room);
      if (!row || row.round.state === 'over') return;
      if (row.round.state === 'lobby' || row.pausedAt !== null) return opts.later(go, 1000);
      const asked = await showdownStep(services, b.id, { action: 'ask', room });
      const q = asked.body.question as { slot: number; golden: boolean; choices?: number[] } | undefined;
      if (!q) return opts.later(go, 1500);
      // A pretend pupil "knows" the answer by peeking at the kept question (pretend only), and gets it right at its own rate.
      const kept = db.questions.get(`${room}:${b.id}`)?.find((k) => k.slot === q.slot);
      const right = markQuestion(kept?.question)?.answer ?? 0;
      const correct = rand() < (q.golden ? Math.min(0.97, b.right + 0.1) : b.right);
      const wrongValue = q.choices?.find((c) => c !== right) ?? right + 1 + Math.floor(rand() * 3);
      const out = await showdownStep(services, b.id, { action: 'answer', room, slot: q.slot, answer: correct ? right : wrongValue, ms: Math.round(think(b)) });
      const me = db.rooms.get(room);
      if (!me || me.round.state === 'over') return;
      // Refused (ring not full, dazed, paused): try again when it's allowed.
      const p = me.round.players[b.id];
      const t = me.startedAt === null ? 0 : (me.pausedAt ?? opts.clock.now()) - me.startedAt;
      const wait = out.status === 200 ? think(b) : Math.max(p.nextAt, p.dazedUntil) - t + 300 + rand() * 700;
      opts.later(go, Math.max(300, wait));
    };
    opts.later(go, think(b));
  };

  return {
    db,
    services,
    bots,
    async joinAll(room) {
      for (const b of bots) {
        await showdownStep(services, b.id, { action: 'join' });
        if (opts.mode !== 'solo') await showdownStep(services, b.id, { action: 'choose', room, role: b.role });
      }
    },
    play(room) {
      for (const b of bots) answerLoop(room, b);
    },
  };
}

/** A pretend clock for the tests: `later` queues, `run` plays everything due up to a time, in order. */
export function pretendClock(start = 1_800_000_000_000) {
  let now = start;
  const queue: { at: number; fn: () => void | Promise<void>; n: number }[] = [];
  let n = 0;
  return {
    now: () => now,
    later: ((fn, ms) => void queue.push({ at: now + ms, fn, n: n++ })) as Later,
    async run(until: number) {
      for (;;) {
        queue.sort((a, b) => a.at - b.at || a.n - b.n);
        const next = queue[0];
        if (!next || next.at > until) break;
        queue.shift();
        now = Math.max(now, next.at);
        await next.fn();
      }
      now = Math.max(now, until);
    },
    set: (t: number) => void (now = t),
  };
}
