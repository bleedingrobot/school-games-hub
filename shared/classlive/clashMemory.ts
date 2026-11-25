/**
 * Colour Clash's database in memory (the tests and the `?pretend=30` preview), mirroring migration
 * 20261125001200_classlive_clash: tiles per room and round, the painter counts, painting on a saved move, bombs and
 * the count. Kept beside memoryServices.ts (not in it) so other games' changes there don't clash.
 */
import { lineTiles, inFountain, painting as _painting, pretendDir, stepMove, speedy, TILES, type ClashGame } from './clash';
import { memoryMove, type MemoryDb } from './memoryServices';
import type { ClassLiveServices } from './server';
import type { MoveState, Spot } from './corners';
import { markQuestion } from '../maths/serverQuestions';

interface Tile { team: number; painter: string; at: number }
interface Store { tiles: Map<string, Tile>; painted: Map<string, number> }

const stores = new WeakMap<MemoryDb, Map<number, Store>>();
function storeOf(db: MemoryDb, room: number): Store {
  let rooms = stores.get(db);
  if (!rooms) stores.set(db, (rooms = new Map()));
  let s = rooms.get(room);
  if (!s) rooms.set(room, (s = { tiles: new Map(), painted: new Map() }));
  return s;
}

function put(db: MemoryDb, room: number, round: number, team: number, who: string, idxs: number[], now: number): number {
  const s = storeOf(db, room);
  let changed = 0;
  for (const i of new Set(idxs)) {
    if (i < 0 || i >= TILES) continue;
    const key = `${round}:${i}`;
    const old = s.tiles.get(key);
    if (old && old.team === team) continue;
    s.tiles.set(key, { team, painter: who, at: now });
    changed++;
  }
  if (changed) s.painted.set(who, (s.painted.get(who) ?? 0) + changed);
  return changed;
}

function changes(db: MemoryDb, room: number, round: number, since: number | null): [number, number][] {
  const out: [number, number][] = [];
  for (const [key, t] of storeOf(db, room).tiles) {
    const [r, i] = key.split(':').map(Number);
    if (r === round && (since === null || t.at >= since)) out.push([i, t.team]);
  }
  return out;
}

const roundOf = (g: ClashGame) => g.round?.n ?? 0;

/** classlive_clash_paint: move (classlive_move), then paint the line from the last saved spot while painting is on. */
export function memoryClashPaint(db: MemoryDb, now: number, room: number, player: string, x: number, y: number, since: number | null) {
  const prev = db.spots.get(room)?.[player];
  const spots = memoryMove(db, now, room, player, x, y);
  if (!spots) return null;
  const g = db.rooms.get(room)!.session.game;
  if (g.kind !== 'clash') return { spots, round: 0, now, tiles: [] as [number, number][] };
  const n = roundOf(g);
  const cur = db.spots.get(room)![player];
  const r = g.round;
  if (r && n > 0 && g.zeroMs !== null && prev && cur.at === now && r.result === null) {
    const t = now - g.zeroMs;
    const m = g.mine[player];
    if (m && t >= r.paintFrom && t < r.paintTo) {
      const wide = m.brushTo !== null && t < m.brushTo;
      let from: Spot = prev;
      if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.6 * Math.min(5, Math.max(0, now - prev.at) / 1000) + 0.06) from = cur;
      const idxs = lineTiles(from, cur, wide).filter((i) => !(r.hole && inFountain(i)));
      put(db, room, n, m.team, player, idxs, now);
    }
  }
  return { spots, round: n, now, tiles: n > 0 ? changes(db, room, n, since) : [] };
}

/** classlive_clash_board (the projector). */
export function memoryClashBoard(db: MemoryDb, now: number, room: number, since: number | null) {
  const g = db.rooms.get(room)?.session.game;
  const n = g?.kind === 'clash' ? roundOf(g) : 0;
  return { round: n, now, tiles: n > 0 ? changes(db, room, n, since) : [] };
}

/** The two service calls (memoryServices.ts spreads these in). */
export function memoryClashServices(db: MemoryDb, clock: { now(): number }): Pick<ClassLiveServices, 'clashBoard' | 'clashBomb'> {
  return {
    async clashBoard(room, round) {
      const s = storeOf(db, room);
      const a = Array.from({ length: TILES }, (_, i) => String(s.tiles.get(`${round}:${i}`)?.team ?? 0));
      return { tiles: a.join(''), painted: Object.fromEntries(s.painted) };
    },
    async clashBomb(room, round, team, player, tiles) {
      put(db, room, round, team, player, tiles, clock.now());
    },
  };
}

type Step = (who: string, body: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>;

/**
 * A pretend Colour Clash pupil: wanders the board painting (towards blank or other teams' tiles), grabs power-ups on
 * the way, and now and then stops to answer a question (right at its own rate) to drop a bomb. Moves every 200 ms.
 */
export function clashBot(o: { db: MemoryDb; room: number; id: string; skill: number; rand: () => number; now(): number; later(fn: () => void | Promise<void>, ms: number): void; step: Step }) {
  const { db, room, id, skill, rand } = o;
  let m: MoveState | null = null;
  let placedSeen = -1;
  let target: Spot = { x: rand(), y: rand() };
  let busy = false;
  let frozenUntil = 0;
  const think = async () => {
    const row = db.rooms.get(room);
    if (!row || row.session.state === 'over') return;
    const g = row.session.game;
    if (g.kind !== 'clash' || row.startedAt === null) return;
    const mine = g.mine[id];
    if (!mine) return;
    const now = o.now();
    const t = now - row.startedAt;
    const r = g.round;
    if (!m || mine.placed !== placedSeen) {
      m = { p: { ...mine.spot }, v: { x: 0, y: 0 } };
      placedSeen = mine.placed;
    }
    if (r && _painting(r, t) && now >= frozenUntil) {
      if (Math.hypot(target.x - m.p.x, target.y - m.p.y) < 0.05 || rand() < 0.02) target = { x: 0.05 + rand() * 0.9, y: 0.05 + rand() * 0.9 };
      const item = !mine.held ? r.items.find((x) => !x.by && Math.hypot(x.x - m!.p.x, x.y - m!.p.y) < 0.25) : undefined;
      let dir = item ? { x: item.x - m.p.x, y: item.y - m.p.y } : pretendDir(m.p, target, rand);
      const len = Math.hypot(dir.x, dir.y);
      if (len > 1) dir = { x: dir.x / len, y: dir.y / len };
      m = stepMove(m, dir, 200, r, t, speedy(mine, t));
      memoryClashPaint(db, now, room, id, m.p.x, m.p.y, null);
      if (item && !busy && Math.hypot(item.x - m.p.x, item.y - m.p.y) < 0.08) {
        busy = true;
        await o.step(id, { action: 'play', room, grab: item.id });
        busy = false;
      }
      if (!busy && rand() < 0.03 + (mine.held ? 0.05 : 0)) {
        busy = true;
        frozenUntil = now + 2500 + rand() * 3000;
        const asked = await o.step(id, { action: 'ask', room });
        const q = asked.body.question as { slot: number } | undefined;
        if (q) {
          const kept = db.questions.get(`${room}:${id}`)?.find((k) => k.slot === q.slot);
          const right = markQuestion(kept?.question)?.answer ?? 0;
          const answer = rand() < skill ? right : right + 1;
          o.later(async () => {
            await o.step(id, { action: 'answer', room, slot: q.slot, answer, ms: 3000 });
            busy = false;
          }, frozenUntil - now);
        } else busy = false;
      }
    }
    o.later(think, 200);
  };
  o.later(think, 200 + rand() * 200);
}

