/**
 * How Class Live's screens talk to the server (docs/CLASSLIVE-PLAN.md section 5): one `send` for every step, and live
 * updates: the projector listens to its screen row, each device to the room row and its own row. `liveLink.ts` is the
 * school's server and Supabase Realtime; `pretendLink` below runs the real server steps in the page on a database in
 * memory with a pretend class (`?pretend=30`), so a whole session can be tried with no class.
 */
import { memoryMove, memoryServices } from '../../../shared/classlive/memoryServices';
import { memoryClashBoard, memoryClashPaint } from '../../../shared/classlive/clashMemory';
import { memoryGhostMove, type GhostSpots } from '../../../shared/classlive/ghostBot';
import { randomAvatar } from '../../avatar/avatarParts';
import { rng } from '../../../shared/classlive/pretendClass';
import { pretendClass, PRETEND_CLASS, PRETEND_TEACHER } from '../../../shared/classlive/pretendClass';
import { classLiveStep, type Change, type PlayerView, type RoomView, type ScreenView } from '../../../shared/classlive/server';

export type Reply = { status: number; body: Record<string, unknown> };

export interface ClassLiveLink {
  send(body: Record<string, unknown>): Promise<Reply>;
  /** The projector's screen as it changes (teachers only). Returns the way to stop. */
  watchScreen(room: number, on: (screen: ScreenView) => void): () => void;
  /** The room row as it changes (every device in the class). */
  watchRoom(room: number, on: (view: RoomView) => void): () => void;
  /** One pupil's own row. */
  watchMe(room: number, me: string, on: (me: PlayerView) => void): () => void;
  /** Four Corners: a pupil's device saves its spot; every spot in the room comes back (no names), or null. */
  move(room: number, x: number, y: number): Promise<{ x: number; y: number }[] | null>;
  /** Four Corners: the projector reads every spot (teachers only), or null. */
  positions(room: number): Promise<Record<string, { x: number; y: number }> | null>;
  /** Four Corners: the projector reads everyone's hub avatar (teachers only), or null. */
  avatars(room: number): Promise<Record<string, unknown> | null>;
  /** Colour Clash: save the spot and paint on the way (classlive_clash_paint); tiles changed since `since` come back. */
  clashPaint(room: number, x: number, y: number, since: number | null): Promise<ClashPaint | null>;
  /** Colour Clash: the projector reads tiles changed since `since` (teachers only). */
  clashBoard(room: number, since: number | null): Promise<Omit<ClashPaint, 'spots'> | null>;
  /** Ghost Tag: saves the spot like `move`; back come the other spots with who is a ghost (no names), or null. Optional so other links needn't have it. */
  ghostMove?(room: number, x: number, y: number): Promise<GhostSpots | null>;
}

/** What a Colour Clash paint call answers: every spot (no names), the round, the database's time, changed tiles [idx, team]. */
export interface ClashPaint { spots: { x: number; y: number }[]; round: number; now: number; tiles: [number, number][] }

type Listener = { room: number; kind: 'screen' | 'room' | 'me'; me?: string; on: (x: never) => void };

/** The real server steps on a pretend database, with `size` pretend pupils who join when the teacher opens a room. */
export function pretendLink(opts: { size: number; seed?: number; me?: { id: string; name: string } }): { teacher: ClassLiveLink; pupil: ClassLiveLink; classId: string } {
  const listeners = new Set<Listener>();
  const emit = (room: number, change: Change) => {
    for (const l of listeners) {
      if (l.room !== room) continue;
      if (l.kind === 'screen') (l.on as (v: ScreenView) => void)(change.screen);
      if (l.kind === 'room') (l.on as (v: RoomView) => void)(change.view);
      if (l.kind === 'me') for (const p of change.players) if (p.player === l.me) (l.on as (p: PlayerView) => void)(p);
    }
  };
  const later = (fn: () => void | Promise<void>, ms: number) => void setTimeout(() => void fn(), ms);
  const pc = pretendClass({ size: opts.size, seed: opts.seed ?? Date.now() % 100000, clock: { now: () => Date.now() }, later, onChange: emit });
  if (opts.me) pc.db.pupils.set(opts.me.id, { ...opts.me, classId: PRETEND_CLASS });
  const services = memoryServices(pc.db, { now: () => Date.now() }, emit);
  const watch = (l: Listener) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  };
  const linkFor = (who: string, isTeacher: boolean): ClassLiveLink => ({
    async send(body) {
      await new Promise((r) => setTimeout(r, 40));
      const out = await classLiveStep(services, who, body);
      if (isTeacher && body.action === 'open' && out.status === 200) {
        const room = out.body.room as number;
        void pc.joinAll().then(() => pc.play(room));
      }
      return out;
    },
    watchScreen: (room, on) => watch({ room, kind: 'screen', on: on as (x: never) => void }),
    watchRoom: (room, on) => watch({ room, kind: 'room', on: on as (x: never) => void }),
    watchMe: (room, me, on) => watch({ room, kind: 'me', me, on: on as (x: never) => void }),
    move: async (room, x, y) => memoryMove(pc.db, Date.now(), room, who, x, y),
    clashPaint: async (room, x, y, since) => {
      const out = memoryClashPaint(pc.db, Date.now(), room, who, x, y, since);
      return out ? { ...out, spots: out.spots.map((q) => ({ x: q.x, y: q.y })) } : null;
    },
    clashBoard: async (room, since) => (isTeacher ? memoryClashBoard(pc.db, Date.now(), room, since) : null),
    ghostMove: async (room, x, y) => memoryGhostMove(pc.db, Date.now(), room, who, x, y),
    positions: async (room) => (isTeacher ? Object.fromEntries(Object.entries(pc.db.spots.get(room) ?? {}).map(([id, p]) => [id, { x: p.x, y: p.y }])) : null),
    avatars: async (room) => {
      if (!isTeacher) return null;
      const r = pc.db.rooms.get(room);
      // Pretend pupils get a made-up avatar each (the same one every time).
      return r ? Object.fromEntries(r.session.order.map((id) => [id, randomAvatar(rng(parseInt(id.slice(-6), 16) || 1))])) : null;
    },
  });
  return { teacher: linkFor(PRETEND_TEACHER, true), pupil: linkFor(opts.me?.id ?? 'nobody', false), classId: PRETEND_CLASS };
}
