/**
 * Class Showdown's database in memory: for the server tests and the `?pretend=30` preview, which run the real server
 * steps (`server.ts`) with no school server. It keeps the same rules the migration does: a save lands only at the
 * version it was loaded at, a question is answered once, a class has one open room, and pupils' rows are written only
 * by saves.
 */
import type { OpenGame } from '../classlive/limits';
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { BossId } from './bosses';
import type { Change, FeedEvent, FinishedRound, PlayerView, RoomRow, ShowdownServices, StoredQuestion } from './server';

export interface MemoryPupil {
  id: string;
  name: string;
  classId: string;
}

export interface MemoryDb {
  rooms: Map<number, RoomRow & { view: Change['view'] }>;
  /** Games running in other classes (shared/classlive/limits.ts); none unless a test sets some. */
  openGames?: OpenGame[];
  questions: Map<string, StoredQuestion[]>;
  players: Map<string, PlayerView>;
  feed: { room: number; seq: number; event: FeedEvent }[];
  answers: { player: string; once: string; answers: FactAnswer[] }[];
  pupils: Map<string, MemoryPupil>;
  teachers: Map<string, string[]>;
  enabled: boolean;
  showNames: boolean;
  maths: MathsContext;
  /** Bosses beaten per class, with the best time (ms). */
  roster: Map<string, Partial<Record<BossId, number>>>;
  /** Rounds paid out (room:seed), with what was paid. */
  finished: Map<string, FinishedRound>;
}

export function memoryDb(opts: { pupils?: MemoryPupil[]; teachers?: Record<string, string[]>; enabled?: boolean; maths?: MathsContext } = {}): MemoryDb {
  return {
    rooms: new Map(), questions: new Map(), players: new Map(), feed: [], answers: [],
    pupils: new Map((opts.pupils ?? []).map((p) => [p.id, p])),
    teachers: new Map(Object.entries(opts.teachers ?? {})),
    enabled: opts.enabled ?? true,
    showNames: true,
    maths: opts.maths ?? { facts: [], settings: {} },
    roster: new Map(), finished: new Map(),
  };
}

const copy = <T>(v: T): T => structuredClone(v);

export function memoryServices(db: MemoryDb, clock: { now(): number; random?(): number }, onChange?: (room: number, change: Change) => void): ShowdownServices {
  let nextRoom = 1;
  let seq = 0;
  const qKey = (room: number, player: string) => `${room}:${player}`;
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
    async mathsContext() {
      return copy(db.maths);
    },
    async openGames() {
      return copy(db.openGames ?? []);
    },
    async openRoom(classId, teacher, arena, round, view) {
      for (const r of db.rooms.values()) {
        if (r.classId === classId && r.round.state !== 'over') r.round.state = 'over';
      }
      const id = nextRoom++;
      db.rooms.set(id, { id, classId, teacher, arena, version: 1, startedAt: null, pausedAt: null, showNames: view.showNames, round: copy(round), view: copy(view) });
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
        const q = db.questions.get(qKey(room, change.claim.player))?.find((x) => x.slot === change.claim!.slot);
        if (!q || q.answered) return 'answered';
        q.answered = true;
      }
      r.version++;
      r.round = copy(change.round);
      r.view = copy(change.view);
      r.startedAt = change.startedAt;
      r.pausedAt = change.pausedAt;
      for (const p of change.players) db.players.set(qKey(room, p.player), copy(p));
      for (const event of change.events) db.feed.push({ room, seq: ++seq, event: copy(event) });
      onChange?.(room, change);
      return 'ok';
    },
    async openQuestion(room, player) {
      const list = db.questions.get(qKey(room, player)) ?? [];
      const open = list.filter((q) => !q.answered).sort((a, b) => b.slot - a.slot)[0];
      return open ? copy(open) : null;
    },
    async loadQuestion(room, player, slot) {
      const q = db.questions.get(qKey(room, player))?.find((x) => x.slot === slot);
      return q ? copy(q) : null;
    },
    async keepQuestion(room, player, question, golden) {
      const list = db.questions.get(qKey(room, player)) ?? [];
      db.questions.set(qKey(room, player), list);
      const open = list.find((q) => !q.answered);
      if (open) return copy(open);
      const kept: StoredQuestion = { slot: list.length, question: copy(question), golden, answered: false };
      list.push(kept);
      return copy(kept);
    },
    async recordAnswers(player, once, answers) {
      if (!db.answers.some((a) => a.player === player && a.once === once)) db.answers.push({ player, once, answers: copy(answers) });
    },
    async roomPlayers(room) {
      return [...db.players.entries()].filter(([k]) => k.startsWith(`${room}:`)).map(([, v]) => copy(v));
    },
    async classRoster(classId) {
      return copy(db.roster.get(classId) ?? {});
    },
    async chestGames(players) {
      return Object.fromEntries(players.map((p) => [p, 'archery' as const]));
    },
    async finishRound(room, done) {
      const key = `${room}:${done.seed}`;
      if (db.finished.has(key)) return;
      db.finished.set(key, copy(done));
      if (done.beaten && done.roster !== false) {
        const r = db.roster.get(done.classId) ?? {};
        r[done.boss] = Math.min(r[done.boss] ?? Infinity, done.ms);
        db.roster.set(done.classId, r);
      }
    },
  };
}
