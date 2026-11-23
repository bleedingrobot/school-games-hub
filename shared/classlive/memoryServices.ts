/**
 * Class Live's database in memory, for the server tests and the `?pretend=30` preview: the real server steps
 * (`server.ts`) with no school server. Same rules as the migration: a save lands only at the version it was loaded at,
 * a class has one open room, and pupils' rows are written only by saves.
 */
import type { Change, ClassLiveServices, PlayerView, RoomRow, RoomView, ScreenView } from './server';

export interface MemoryDb {
  rooms: Map<number, RoomRow & { view: RoomView; screen: ScreenView; openedAt: number }>;
  players: Map<string, PlayerView>;
  pupils: Map<string, { id: string; name: string; classId: string }>;
  teachers: Map<string, string[]>;
  enabled: boolean;
  showNames: boolean;
}

export function memoryDb(opts: { pupils?: { id: string; name: string; classId: string }[]; teachers?: Record<string, string[]> } = {}): MemoryDb {
  return {
    rooms: new Map(), players: new Map(),
    pupils: new Map((opts.pupils ?? []).map((p) => [p.id, p])),
    teachers: new Map(Object.entries(opts.teachers ?? {})),
    enabled: true, showNames: true,
  };
}

const copy = <T>(v: T): T => structuredClone(v);

export function memoryServices(db: MemoryDb, clock: { now(): number; random?(): number }, onChange?: (room: number, change: Change) => void): ClassLiveServices {
  let nextRoom = 1;
  return {
    now: () => clock.now(),
    random: clock.random ?? Math.random,
    async teacherClass(teacher, classId) {
      return db.teachers.get(teacher)?.includes(classId) ? { enabled: db.enabled, showNames: db.showNames } : null;
    },
    async pupil(player) {
      const p = db.pupils.get(player);
      return p ? { classId: p.classId, name: p.name, enabled: db.enabled } : null;
    },
    async openRoom(classId, teacher, change) {
      for (const r of db.rooms.values()) if (r.classId === classId) r.session.state = 'over';
      const id = nextRoom++;
      db.rooms.set(id, {
        id, classId, teacher, version: 1, startedAt: null, showNames: change.screen.showNames, session: copy(change.session),
        seq: 0, events: [], view: copy(change.view), screen: copy(change.screen), openedAt: clock.now(),
      });
      onChange?.(id, change);
      return id;
    },
    async loadRoom(room) {
      const r = db.rooms.get(room);
      return r ? copy(r) : null;
    },
    async classRoom(classId) {
      const list = [...db.rooms.values()].filter((r) => r.classId === classId).sort((a, b) => b.id - a.id);
      return list[0] ? copy(list[0]) : null;
    },
    async save(room, version, change) {
      const r = db.rooms.get(room);
      if (!r) return 'busy';
      if (r.version !== version) return 'stale';
      r.version++;
      r.session = copy(change.session);
      r.view = copy(change.view);
      r.screen = copy(change.screen);
      r.startedAt = change.startedAt;
      r.seq = change.screen.seq;
      r.events = copy(change.screen.events);
      for (const p of change.players) db.players.set(`${room}:${p.player}`, copy(p));
      onChange?.(room, change);
      return 'ok';
    },
  };
}
