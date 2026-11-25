/**
 * Ghost Tag in memory: the database's classlive_ghost_move (`memoryGhostMove`) and a pretend pupil (`ghostBot`) for the
 * `?pretend=30` preview and the tests (docs/GHOST-PLAN.md).
 */
import { markQuestion } from '../maths/serverQuestions';
import { canAsk, isFrozen, LANTERN_R, pretendDir, speedOf, stepGhost, type GhostGame, type GhostMove } from './ghost';
import { memoryMove, type MemoryDb } from './memoryServices';
import { classLiveStep, type ClassLiveServices } from './server';

/** What a device gets back from saving its spot: am I a ghost, and every other spot with its kind (0 pupil, 1 ghost, 2 frozen ghost, 3 lantern-lit). */
export interface GhostSpots {
  me: { ghost: boolean };
  spots: [number, number, 0 | 1 | 2 | 3][];
}

/** Same rules as classlive_ghost_move in migration 20261125001300_classlive_ghost.sql. */
export function ghostSpotsOf(g: GhostGame, t: number, all: Record<string, { x: number; y: number }>, me: string): GhostSpots {
  const mine = g.mine[me];
  const lantern = !!mine?.ghost && mine.lanternTo > t;
  const at = all[me];
  const spots: GhostSpots['spots'] = [];
  for (const [id, p] of Object.entries(all)) {
    const m = g.mine[id];
    if (id === me || !m) continue;
    let kind: -1 | 0 | 1 | 2 | 3 = 0;
    if (m.ghost) kind = isFrozen(m, t) ? 2 : 1;
    else if (m.hideTo > t) kind = lantern && at && Math.hypot(p.x - at.x, p.y - at.y) < LANTERN_R ? 3 : -1;
    if (kind >= 0) spots.push([Math.round(p.x * 1e4) / 1e4, Math.round(p.y * 1e4) / 1e4, kind as 0 | 1 | 2 | 3]);
  }
  return { me: { ghost: !!mine?.ghost }, spots };
}

export function memoryGhostMove(db: MemoryDb, now: number, room: number, player: string, x: number, y: number): GhostSpots | null {
  const r = db.rooms.get(room);
  if (!r || r.session.game.kind !== 'ghost' || r.startedAt === null) return null;
  if (!memoryMove(db, now, room, player, x, y)) return null;
  return ghostSpotsOf(r.session.game, now - r.startedAt, db.spots.get(room) ?? {}, player);
}

/**
 * A pretend Ghost Tag pupil: runs away from the nearest ghost (or chases the nearest pupil as a ghost), grabs power-ups
 * on the way, and now and then answers a question (right at its own rate). Moves every 200 ms as a device.
 */
export function ghostBot(o: { db: MemoryDb; services: ClassLiveServices; later: (fn: () => void | Promise<void>, ms: number) => void; now: () => number; rand: () => number }, room: number, id: string, skill: number) {
  const { db, services, later, rand } = o;
  let m: GhostMove | null = null;
  let placedSeen = -1;
  let busy = false;
  let seen: GhostSpots | null = null;
  const think = async () => {
    const row = db.rooms.get(room);
    if (!row || row.session.state === 'over') return;
    const g = row.session.game;
    if (g.kind !== 'ghost' || row.startedAt === null) return;
    const mine = g.mine[id];
    if (!mine) return;
    const now = o.now();
    const t = now - row.startedAt;
    const r = g.round;
    if (!m || mine.placed !== placedSeen) {
      m = { p: { ...mine.spot }, v: { x: 0, y: 0 } };
      placedSeen = mine.placed;
    }
    if (r && !r.done) {
      const others = (seen?.spots ?? []).map(([x, y, k]) => ({ p: { x, y }, ghost: k === 1 || k === 2 }));
      const item = !mine.ghost ? r.items.find((x) => !x.by && Math.hypot(x.x - m!.p.x, x.y - m!.p.y) < 0.2) : undefined;
      let dir = item ? { x: item.x - m.p.x, y: item.y - m.p.y } : pretendDir(m.p, mine.ghost, others, rand);
      const len = Math.hypot(dir.x, dir.y);
      if (len > 1) dir = { x: dir.x / len, y: dir.y / len };
      if (rand() > skill + 0.15) dir = { x: dir.x * 0.5, y: dir.y * 0.5 };
      m = stepGhost(m, dir, 200, r, t, { ghost: mine.ghost, speed: speedOf(mine, t) });
      seen = memoryGhostMove(db, now, room, id, m.p.x, m.p.y) ?? seen;
      if (item && !busy && Math.hypot(item.x - m.p.x, item.y - m.p.y) < 0.08) {
        busy = true;
        await classLiveStep(services, id, { action: 'play', room, grab: item.id });
        busy = false;
      }
      if (!busy && canAsk(g, id, t) && t >= r.startAt && rand() < 0.04) {
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
    }
    later(think, 200);
  };
  later(think, 200 + rand() * 400);
}
