/**
 * A pretend class for Class Live (`?pretend=30`): pretend pupils who join and play through the REAL server steps
 * (`classLiveStep`) on a database in memory. The tests drive it with a pretend clock; the preview with real timers.
 */
import { ghostBot } from './ghostBot';
import { memoryDb, memoryMove, memoryServices, type MemoryDb } from './memoryServices';
import { boosted, CORNERS, cornerOf, ghostly, pretendDir, stepMove, type Corner, type MoveState } from './corners';
import { bayRound, isShark, quarterOf, sharkMove, sharkPretendDir, spinAt } from './shark';
import { classLiveStep, type Change, type ClassLiveServices } from './server';
import { markQuestion } from '../maths/serverQuestions';
import { ANSWER_GAP_MS, canGuess } from './mural';
import { pretendAnswer } from './serpent';
import { pretendFacts } from './stars';
import { lavaBot } from './lavaPretend';
import { clashBot } from './clashMemory';

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
      if (g.kind === 'corners') return cornersBot(room, id, skill);
      if (g.kind === 'lava') return lavaBot({ db, services, later: opts.later, now: opts.clock.now, rand }, room, id, skill);
      if (g.kind === 'clash') return clashBot({ db, room, id, skill, rand, now: opts.clock.now, later: opts.later, step: (who, body) => classLiveStep(services, who, body) });
      if (g.kind === 'ghost') return ghostBot({ db, services, later: opts.later, now: opts.clock.now, rand }, room, id, skill);
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

  /**
   * A pretend Four Corners pupil: runs for a corner each round (now and then changing its mind, or dawdling), grabs items
   * on the way, answers to switch them on in a corner, and answers its way out of jail. Moves every 200 ms as a device.
   */
  const cornersBot = (room: number, id: string, skill: number) => {
    let m: MoveState | null = null;
    let target: Corner = CORNERS[Math.floor(rand() * 4)];
    let roundSeen = -1;
    let placedSeen = -1;
    let busy = false;
    const think = async () => {
      const row = db.rooms.get(room);
      if (!row || row.session.state === 'over') return;
      const g = row.session.game;
      if (g.kind !== 'corners' || row.startedAt === null) return;
      const mine = g.mine[id];
      if (!mine) return;
      const now = opts.clock.now();
      const t = now - row.startedAt;
      const r = g.round;
      if (!m || mine.placed !== placedSeen) {
        m = { p: { ...mine.spot }, v: { x: 0, y: 0 } };
        placedSeen = mine.placed;
      }
      if (r && r.n !== roundSeen) {
        roundSeen = r.n;
        target = CORNERS[Math.floor(rand() * 4)];
        // Second half: most remember to change corners.
        if (r.swap && target === mine.lastCorner && rand() < skill) target = ((target + 1 + Math.floor(rand() * 3)) % 4) as Corner;
      }
      if (mine.jailedIn === null && r && r.caught === null && t < r.runEnd) {
        // Now and then change corner halfway; a few dawdle.
        if (rand() < 0.01) target = CORNERS[Math.floor(rand() * 4)];
        const item = !mine.held ? r.items.find((x) => !x.by && Math.hypot(x.x - m!.p.x, x.y - m!.p.y) < 0.25) : undefined;
        // Shark Bay: swim with the spinning quarter, and a few make for a boat.
        const bay = isShark(g) ? bayRound(r) : null;
        let dir = item ? { x: item.x - m.p.x, y: item.y - m.p.y } : bay ? sharkPretendDir(m.p, target, bay, t, (id.charCodeAt(id.length - 1) + r.n) % 3 === 0, rand) : pretendDir(m.p, target, rand);
        const len = Math.hypot(dir.x, dir.y);
        if (len > 1) dir = { x: dir.x / len, y: dir.y / len };
        if (!bay && cornerOf(m.p) === target && !item) dir = { x: 0, y: 0 };
        if (rand() > skill + 0.1) dir = { x: dir.x * 0.4, y: dir.y * 0.4 };
        m = (bay ? sharkMove : stepMove)(m, dir, 200, r, t, { boost: boosted(mine, r.n), ghost: ghostly(mine, r.n) });
        memoryMove(db, now, room, id, m.p.x, m.p.y);
        if (item && !busy && Math.hypot(item.x - m.p.x, item.y - m.p.y) < 0.08) {
          busy = true;
          await classLiveStep(services, id, { action: 'play', room, grab: item.id });
          busy = false;
        }
      }
      const wantsQuestion = mine.jailedIn !== null ? mine.jailRight < 3 && t - mine.lastAt > 4000 + rand() * 3000 : !!mine.held && !!r && (isShark(g) && bayRound(r) ? quarterOf(m.p, spinAt(bayRound(r)!, t)) !== null : cornerOf(m.p) !== null) && t < (r?.runEnd ?? 0) && rand() < 0.1;
      if (wantsQuestion && !busy) {
        busy = true;
        const asked = await classLiveStep(services, id, { action: 'ask', room });
        const q = asked.body.question as { slot: number } | undefined;
        if (q) {
          const kept = db.questions.get(`${room}:${id}`)?.find((k) => k.slot === q.slot);
          const right = markQuestion(kept?.question)?.answer ?? 0;
          await classLiveStep(services, id, { action: 'answer', room, slot: q.slot, answer: rand() < skill ? right : right + 1, ms: 3000 });
        }
        busy = false;
      }
      opts.later(think, 200);
    };
    opts.later(think, 200 + rand() * 400);
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
