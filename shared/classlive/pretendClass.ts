/**
 * A pretend class for Class Live (`?pretend=30`): pretend pupils who join and play through the REAL server steps
 * (`classLiveStep`) on a database in memory. The tests drive it with a pretend clock; the preview with real timers.
 */
import { memoryDb, memoryServices, type MemoryDb } from './memoryServices';
import { classLiveStep, type Change, type ClassLiveServices } from './server';
import { markQuestion } from '../maths/serverQuestions';
import { ANSWER_GAP_MS, canGuess } from './mural';
import { pretendAnswer } from './serpent';
import { pretendFacts } from './stars';

export const PRETEND_TEACHER = '00000000-0000-4000-8000-00000000feed';
export const PRETEND_CLASS = '00000000-0000-4000-8000-00000000c1a5';
const botId = (i: number) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;

const NAMES = ['Aroha', 'Leo', 'Mia', 'Nikau', 'Ava', 'Kai', 'Isla', 'Tama', 'Ruby', 'Finn', 'Maia', 'Oscar', 'Hana', 'Eli', 'Zoe', 'Wiremu',
  'Lily', 'Max', 'Anika', 'Noah', 'Ella', 'Rawiri', 'Grace', 'Sam', 'Mere', 'Jack', 'Olive', 'Ari', 'Sofia', 'Ben', 'Tia', 'Hugo'];

export type Later = (fn: () => void | Promise<void>, ms: number) => void;

/** A small seeded random (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PretendClass {
  db: MemoryDb;
  services: ClassLiveServices;
  ids: string[];
  joinAll(): Promise<void>;
  play(room: number): void;
}

export function pretendClass(opts: { size: number; seed: number; clock: { now(): number }; later: Later; onChange?: (room: number, change: Change) => void }): PretendClass {
  const ids = Array.from({ length: Math.min(opts.size, NAMES.length) }, (_, i) => botId(i));
  const db = memoryDb({ pupils: ids.map((id, i) => ({ id, name: NAMES[i], classId: PRETEND_CLASS })), teachers: { [PRETEND_TEACHER]: [PRETEND_CLASS] } });
  const rand = rng(opts.seed ^ 0x9e37);
  const services = memoryServices(db, { now: opts.clock.now, random: rand }, opts.onChange);

  const loop = (room: number, id: string, speed: number, skill: number) => {
    const go = async () => {
      const row = db.rooms.get(room);
      if (!row || row.session.state === 'over') return;
      if (row.session.state === 'lobby') return opts.later(go, 1000);
      const g = row.session.game;
      if (g.kind === 'mural') {
        if (g.revealed) return;
        // In the guessing, take a few seconds to read the riddles, then pick (better pupils are right more often);
        // before it, answer (a right answer flips a tile).
        if (g.phase === 'guess') {
          if (!canGuess(g, id)) return opts.later(go, 2000);
          const share = g.tiles.filter(Boolean).length / g.tiles.length;
          const pick = rand() < Math.min(0.95, 0.3 + share * skill) ? g.picture : g.choices[Math.floor(rand() * g.choices.length)];
          return opts.later(async () => { await classLiveStep(services, id, { action: 'play', room, guess: pick }); }, 3000 + rand() * 20_000);
        }
        const asked = await classLiveStep(services, id, { action: 'ask', room });
        const q = asked.body.question as { slot: number } | undefined;
        if (!q) return opts.later(go, 1500);
        // A pretend pupil "knows" the answer by peeking at the kept question (pretend only), and is right at its own rate.
        const kept = db.questions.get(`${room}:${id}`)?.find((k) => k.slot === q.slot);
        const right = markQuestion(kept?.question)?.answer ?? 0;
        const answer = rand() < skill ? right : right + 1 + Math.floor(rand() * 3);
        await classLiveStep(services, id, { action: 'answer', room, slot: q.slot, answer, ms: 3000 });
        return opts.later(go, Math.max(ANSWER_GAP_MS + 200, (speed / 3) * (0.6 + rand() * 0.8)));
      }
      if (g.kind === 'serpent') {
        const move = pretendAnswer(g, id, rand, skill);
        if (!move) return;
        await classLiveStep(services, id, { action: 'play', room, ...move });
        return opts.later(go, (speed / 2) * (0.6 + rand() * 0.8));
      }
      const list = pretendFacts(g.anchor);
      const fact = list[Math.floor(rand() * list.length)];
      await classLiveStep(services, id, { action: 'play', room, fact });
      opts.later(go, speed * (0.6 + rand() * 0.8));
    };
    opts.later(go, speed * rand());
  };

  return {
    db,
    services,
    ids,
    async joinAll() {
      for (const id of ids) await classLiveStep(services, id, { action: 'join' });
    },
    play(room) {
      for (const id of ids) loop(room, id, 6000 + rand() * 14000, 0.6 + rand() * 0.35);
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
  };
}
