/**
 * How Class Showdown's screens talk to the server (docs/SHOWDOWN-PLAN.md section 6): one `send` for every step, and
 * live updates for the projector (the room row and the feed) and each iPad (its own row and the room row).
 * `liveLink.ts` is the school's server and Supabase Realtime; `pretendLink` below runs the real server steps in the page
 * on a database in memory, with a pretend class (`?pretend=30`), so a whole round can be played with no class.
 */
import { memoryServices, type MemoryDb } from '../../../shared/showdown/memoryServices';
import { pretendClass, PRETEND_CLASS, PRETEND_TEACHER, type Later } from '../../../shared/showdown/pretendClass';
import { showdownStep, type Change, type FeedEvent, type PlayerView, type RoomView } from '../../../shared/showdown/server';
import type { Mode } from '../../../shared/showdown/types';

export type Reply = { status: number; body: Record<string, unknown> };

export interface ShowdownLink {
  send(body: Record<string, unknown>): Promise<Reply>;
  /** The room row as it changes (pupils of the class and the projector). Returns the way to stop. */
  watchRoom(room: number, on: (view: RoomView) => void): () => void;
  /** The projector's feed: every event, the moment it is saved. */
  watchFeed(room: number, on: (event: FeedEvent) => void): () => void;
  /** One pupil's own row. */
  watchMe(room: number, me: string, on: (me: PlayerView) => void): () => void;
  /** How far the server's clock is ahead of this device's (ms). */
  clockOffset(): Promise<number>;
}

type Listener = { room: number; kind: 'room' | 'feed' | 'me'; me?: string; on: (x: never) => void };

/**
 * The real server steps on a pretend database, with `size` pretend pupils who join when the teacher opens a room and
 * answer at real speeds once it starts. `as` is who this page is: the pretend teacher (the projector), or `me`, a
 * pretend pupil in the class (the controller).
 */
export function pretendLink(opts: { size: number; mode: Mode; seed?: number; me?: { id: string; name: string } }): { teacher: ShowdownLink; pupil: ShowdownLink; db: MemoryDb; classId: string } {
  const listeners = new Set<Listener>();
  const emit = (room: number, change: Change) => {
    for (const l of listeners) {
      if (l.room !== room) continue;
      if (l.kind === 'room') (l.on as (v: RoomView) => void)(change.view);
      if (l.kind === 'feed') for (const e of change.events) (l.on as (e: FeedEvent) => void)(e);
      if (l.kind === 'me') for (const p of change.players) if (p.player === l.me) (l.on as (p: PlayerView) => void)(p);
    }
  };
  const later: Later = (fn, ms) => void setTimeout(() => void fn(), ms);
  const pc = pretendClass({ size: opts.size, mode: opts.mode, seed: opts.seed ?? Date.now() % 100000, clock: { now: () => Date.now() }, later, onChange: emit });
  if (opts.me) pc.db.pupils.set(opts.me.id, { ...opts.me, classId: PRETEND_CLASS });
  const services = memoryServices(pc.db, { now: () => Date.now() }, emit);
  const watch = (l: Listener) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  };
  const linkFor = (who: string, isTeacher: boolean): ShowdownLink => ({
    async send(body) {
      // A small delay, like the real server, so the screens are tried with replies that take a moment.
      await new Promise((r) => setTimeout(r, 40));
      const out = await showdownStep(services, who, body);
      if (isTeacher && body.action === 'open' && out.status === 200) {
        const room = out.body.room as number;
        void pc.joinAll(room).then(() => pc.play(room));
      }
      return out;
    },
    watchRoom: (room, on) => watch({ room, kind: 'room', on: on as (x: never) => void }),
    watchFeed: (room, on) => watch({ room, kind: 'feed', on: on as (x: never) => void }),
    watchMe: (room, me, on) => watch({ room, kind: 'me', me, on: on as (x: never) => void }),
    clockOffset: async () => 0,
  });
  return { teacher: linkFor(PRETEND_TEACHER, true), pupil: linkFor(opts.me?.id ?? 'nobody', false), db: pc.db, classId: PRETEND_CLASS };
}
