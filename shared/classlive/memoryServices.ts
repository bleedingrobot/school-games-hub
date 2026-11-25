/**
 * Class Live's database in memory, for the server tests and the `?pretend=30` preview: the real server steps
 * (`server.ts`) with no school server. Same rules as the migration: a save lands only at the version it was loaded at,
 * a class has one open room, and pupils' rows are written only by saves.
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { FinishedSession } from './rewards';
import { clampMove } from './corners';
import type { Change, ClassLiveServices, PlayerView, RoomRow, RoomView, ScreenView, StoredQuestion } from './server';

export interface MemoryDb {
  rooms: Map<number, RoomRow & { view: RoomView; screen: ScreenView; openedAt: number }>;
  players: Map<string, PlayerView>;
  /** Mystery Mural's kept questions, by `${room}:${player}`. */
  questions: Map<string, StoredQuestion[]>;
  answers: { player: string; once: string; answers: FactAnswer[] }[];
  maths: MathsContext;
  /** Sessions paid, by `${room}:${seed}`. */
  paid: Map<string, FinishedSession>;
  pupils: Map<string, { id: string; name: string; classId: string; schoolId?: number }>;
  /** Each class's school (1 when not listed). */
  schools: Map<string, number>;
  teachers: Map<string, string[]>;
  enabled: boolean;
  showNames: boolean;
  /** Four Corners: each player's last saved spot, by room. */
  spots: Map<number, Record<string, { x: number; y: number; at: number }>>;
}

export function memoryDb(opts: { pupils?: { id: string; name: string; classId: string; schoolId?: number }[]; teachers?: Record<string, string[]>; schools?: Record<string, number> } = {}): MemoryDb {
  return {
    rooms: new Map(), players: new Map(), questions: new Map(), answers: [], maths: { facts: [], settings: {} }, paid: new Map(),
    pupils: new Map((opts.pupils ?? []).map((p) => [p.id, p])),
    teachers: new Map(Object.entries(opts.teachers ?? {})),
    schools: new Map(Object.entries(opts.schools ?? {})),
    enabled: true, showNames: true, spots: new Map(),
  };
}

const copy = <T>(v: T): T => structuredClone(v);

export function memoryServices(db: MemoryDb, clock: { now(): number; random?(): number }, onChange?: (room: number, change: Change) => void): ClassLiveServices {
  let nextRoom = 1;
  return {
    now: () => clock.now(),
    random: clock.random ?? Math.random,
    async teacherClass(teacher, classId) {
      return db.teachers.get(teacher)?.includes(classId) ? { enabled: db.enabled, showNames: db.showNames, schoolId: db.schools.get(classId) ?? 1 } : null;
    },
    async pupil(player) {
      const p = db.pupils.get(player);
      return p ? { classId: p.classId, schoolId: p.schoolId ?? db.schools.get(p.classId) ?? 1, name: p.name, enabled: db.enabled } : null;
    },
    async codeRoom(schoolId, code) {
      const r = [...db.rooms.values()].filter((x) => x.schoolId === schoolId && x.session.lobby?.code === code && x.session.state !== 'over' && clock.now() - x.openedAt < 3 * 3600_000).sort((a, b) => b.id - a.id)[0];
      return r ? copy(r) : null;
    },
    async openRoom(classId, teacher, change) {
      for (const r of db.rooms.values()) if (r.classId === classId) r.session.state = 'over';
      const id = nextRoom++;
      db.rooms.set(id, {
        id, classId, schoolId: db.schools.get(classId) ?? 1, teacher, version: 1, startedAt: null, showNames: change.screen.showNames, session: copy(change.session),
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
      if (change.claim) {
        const q = db.questions.get(`${room}:${change.claim.player}`)?.find((x) => x.slot === change.claim!.slot);
        if (!q || q.answered) return 'answered';
        q.answered = true;
      }
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
    async mathsContext() {
      return copy(db.maths);
    },
    async openQuestion(room, player) {
      const open = (db.questions.get(`${room}:${player}`) ?? []).filter((q) => !q.answered).sort((a, b) => b.slot - a.slot)[0];
      return open ? copy(open) : null;
    },
    async loadQuestion(room, player, slot) {
      const q = db.questions.get(`${room}:${player}`)?.find((x) => x.slot === slot);
      return q ? copy(q) : null;
    },
    async keepQuestion(room, player, question) {
      const list = db.questions.get(`${room}:${player}`) ?? [];
      db.questions.set(`${room}:${player}`, list);
      const open = list.find((q) => !q.answered);
      if (open) return copy(open);
      const kept: StoredQuestion = { slot: list.length, question: copy(question), answered: false };
      list.push(kept);
      return copy(kept);
    },
    async positions(room) {
      return Object.fromEntries(Object.entries(db.spots.get(room) ?? {}).map(([id, p]) => [id, { x: p.x, y: p.y }]));
    },
    async place(room, spots) {
      const all = db.spots.get(room) ?? {};
      for (const p of spots) all[p.player] = { x: p.x, y: p.y, at: clock.now() };
      db.spots.set(room, all);
    },
    async finishSession(room, done) {
      const key = `${room}:${done.seed}`;
      if (!db.paid.has(key)) db.paid.set(key, copy(done));
    },
    async recordAnswers(player, once, answers) {
      if (!db.answers.some((a) => a.player === player && a.once === once)) db.answers.push({ player, once, answers: copy(answers) });
    },
  };
}

/**
 * A pupil's device saving its spot (the database's classlive_move): clamped by `clampMove`, and answered with every
 * spot in the room (no names). Only players of a live Four Corners room.
 */
export function memoryMove(db: MemoryDb, now: number, room: number, player: string, x: number, y: number): { x: number; y: number }[] | null {
  const r = db.rooms.get(room);
  if (!r || r.session.state !== 'live' || r.session.game.kind !== 'corners' || !r.session.players[player]) return null;
  const all = db.spots.get(room) ?? {};
  const g = r.session.game;
  const p = clampMove(all[player], { x, y }, now, g.round?.teleports ?? []);
  all[player] = { ...p, at: now };
  db.spots.set(room, all);
  return Object.values(all).map((q) => ({ x: q.x, y: q.y }));
}

/**
 * A game opened at a set time, as the database's classlive_auto_open() makes it: no class, no teacher, a lobby code,
 * and the session with no game yet (the first step makes it). Returns the room.
 */
export function memoryAutoRoom(
  db: MemoryDb,
  now: number,
  o: { schoolId?: number; activity: 'serpent' | 'mural' | 'corners'; lengthMin: number; min: number; startsAt: number; code: string; host?: string; level?: string | null },
): number {
  const id = Math.max(1000, ...db.rooms.keys()) + 1;
  const lobby = { code: o.code, host: o.host ?? 'Games Hub' };
  const session = {
    seed: id, activity: o.activity, state: 'lobby', lengthMin: o.lengthMin, players: {}, order: [], game: null, lobby, padMusic: true,
    auto: { startsAt: o.startsAt, min: o.min, level: o.level ?? null },
  } as unknown as RoomRow['session'];
  db.rooms.set(id, {
    id, classId: null, schoolId: o.schoolId ?? 1, teacher: null, version: 1, startedAt: null, showNames: true, session, seq: 0, events: [],
    view: { state: 'lobby' } as RoomView, screen: { events: [] } as unknown as ScreenView, openedAt: now,
  });
  return id;
}
