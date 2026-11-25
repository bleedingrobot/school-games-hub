/**
 * A pretend Floor is Lava pupil (for `?pretend=30` and the tests): runs for a rock tile that won't sink (now and then too
 * slowly), grabs power-ups, answers for bricks and builds, switches on what it holds, and answers its way off the raft.
 * Moves every 200 ms as a device would.
 */
import { markQuestion } from '../maths/serverQuestions';
import { buildTarget, lavaBooted, lavaBoosted, lavaPretendDir, safeTarget, stepLava, type LavaMove, type Spot } from './lava';
import { memoryMove, type MemoryDb } from './memoryServices';
import { classLiveStep, type ClassLiveServices } from './server';

type Later = (fn: () => void | Promise<void>, ms: number) => void;

export function lavaBot(o: { db: MemoryDb; services: ClassLiveServices; later: Later; now: () => number; rand: () => number }, room: number, id: string, skill: number) {
  const { db, services, later, now, rand } = o;
  let m: LavaMove | null = null;
  let target: Spot | null = null;
  let roundSeen = -1;
  let placedSeen = -1;
  let busy = false;
  let dawdle = false;
  const think = async () => {
    const row = db.rooms.get(room);
    if (!row || row.session.state === 'over') return;
    const g = row.session.game;
    if (g.kind !== 'lava' || row.startedAt === null) return;
    const mine = g.mine[id];
    if (!mine) return;
    const at = now();
    const t = at - row.startedAt;
    const r = g.round;
    if (!m || mine.placed !== placedSeen) {
      m = { p: { ...mine.spot }, v: { x: 0, y: 0 } };
      placedSeen = mine.placed;
    }
    if (r && r.n !== roundSeen) {
      roundSeen = r.n;
      target = null;
      dawdle = rand() > skill;
    }
    if (mine.raftIn === null && r && r.fell === null && t < r.runEnd) {
      // Pick a safe tile once a moment has passed (pupils look first), and look again when the late cracks show.
      if (t > r.startAt + 600 && (!target || (r.late.length && t > r.runEnd - 3000 && rand() < 0.05))) target = safeTarget(g, r, m.p, rand, t > r.runEnd - 3000);
      const item = !mine.held ? r.items.find((x) => !x.by && Math.hypot(x.x - m!.p.x, x.y - m!.p.y) < 0.2) : undefined;
      const goal = item && t < r.runEnd - 3000 ? item : target;
      let dir = goal ? lavaPretendDir(m.p, goal, rand) : { x: 0, y: 0 };
      if (dawdle) dir = { x: dir.x * 0.35, y: dir.y * 0.35 };
      m = stepLava(m, dir, 200, g, t, { boost: lavaBoosted(mine, r.n), boots: lavaBooted(mine, r.n) });
      memoryMove(db, at, room, id, m.p.x, m.p.y);
      if (item && !busy && Math.hypot(item.x - m.p.x, item.y - m.p.y) < 0.08) {
        busy = true;
        await classLiveStep(services, id, { action: 'play', room, grab: item.id });
        busy = false;
      }
      // A brick in hand and lava beside you: build.
      const tile = mine.bricks > 0 ? buildTarget(g, r, m.p) : null;
      if (tile !== null && !busy && rand() < 0.05) {
        busy = true;
        await classLiveStep(services, id, { action: 'play', room, build: tile });
        busy = false;
      }
      if (mine.bricks >= 2 && !busy && rand() < 0.01) {
        busy = true;
        await classLiveStep(services, id, { action: 'play', room, rescue: true });
        busy = false;
      }
    }
    const between = !!r && r.fell !== null;
    const wantsQuestion = mine.raftIn !== null
      ? mine.raftRight < 3 && t - mine.lastAt > 3000 + rand() * 3000
      : !!r && (between || !!mine.held) && t - mine.lastAt > 2500 && rand() < 0.15;
    if (wantsQuestion && !busy) {
      busy = true;
      const asked = await classLiveStep(services, id, { action: 'ask', room });
      const q = asked.body.question as { slot: number } | undefined;
      if (q) {
        const kept = db.questions.get(`${room}:${id}`)?.find((k) => k.slot === q.slot);
        const right = markQuestion(kept?.question)?.answer ?? 0;
        await classLiveStep(services, id, { action: 'answer', room, slot: q.slot, answer: rand() < skill ? right : right + 1, ms: 2500 });
      }
      busy = false;
    }
    later(think, 200);
  };
  later(think, 200 + rand() * 400);
}
