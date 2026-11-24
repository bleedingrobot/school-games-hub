// Connects the Class Live handler to Supabase. Edit handler.ts or shared/classlive/server.ts for the logic, then run
// `npm run build:functions -- classlive` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { RoomRow, StoredQuestion } from '../../../shared/classlive/server';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
import { makeHandler } from './handler';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

/** The server's own key. Supabase provides it automatically; it never leaves the server. */
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  return keys.default ?? Object.values(keys)[0] ?? '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T | 'busy'> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return data as T;
  console.error(`classlive: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

type RawRow = {
  id: number; class_id: string; school_id: number; teacher: string; version: number; started_ms: number | null; show_names: boolean;
  session: RoomRow['session']; seq: number; events: RoomRow['events'] | null;
};
const rowOf = (raw: RawRow | null): RoomRow | null =>
  raw && {
    id: Number(raw.id), classId: raw.class_id, schoolId: Number(raw.school_id), teacher: raw.teacher, version: raw.version,
    startedAt: raw.started_ms === null ? null : Number(raw.started_ms), showNames: raw.show_names !== false, session: raw.session,
    seq: Number(raw.seq) || 0, events: Array.isArray(raw.events) ? raw.events : [],
  };

const questionOf = (raw: StoredQuestion | null) => raw && { slot: raw.slot, question: raw.question, answered: raw.answered === true };

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    userIdFor: userIdFromToken(admin.auth),
    async teacherClass(teacher, classId) {
      const row = await call<{ enabled: boolean; show_names: boolean; school_id: number } | null>('classlive_teacher_class', { teacher, target_class: classId });
      if (row === 'busy') return 'busy';
      return row && { enabled: row.enabled === true, showNames: row.show_names !== false, schoolId: Number(row.school_id) };
    },
    async pupil(player) {
      const row = await call<{ class_id: string; school_id: number; name: string | null; enabled: boolean } | null>('classlive_pupil', { player });
      if (row === 'busy') return 'busy';
      return row && { classId: row.class_id, schoolId: Number(row.school_id), name: (row.name ?? 'A player').slice(0, 40), enabled: row.enabled === true };
    },
    async codeRoom(schoolId, code) {
      const raw = await call<RawRow | null>('classlive_code_room', { target_school: schoolId, join_code: code });
      return raw === 'busy' ? 'busy' : rowOf(raw);
    },
    async openRoom(classId, teacher, c) {
      const id = await call<number>('classlive_open', { target_class: classId, teacher, activity: c.session.activity, session: c.session, view: c.view, screen: c.screen });
      return id === 'busy' ? 'busy' : Number(id);
    },
    async loadRoom(room) {
      const raw = await call<RawRow | null>('classlive_load', { target: room });
      return raw === 'busy' ? 'busy' : rowOf(raw);
    },
    async classRoom(classId) {
      const raw = await call<RawRow | null>('classlive_class_room', { target_class: classId });
      return raw === 'busy' ? 'busy' : rowOf(raw);
    },
    async save(room, version, c) {
      const out = await call<string>('classlive_save', {
        target: room, seen_version: version, session: c.session, view: c.view, screen: c.screen,
        started_ms: c.startedAt === null ? null : Math.round(c.startedAt), players: c.players, claim: c.claim ?? null,
      });
      return out === 'ok' || out === 'stale' || out === 'answered' ? out : 'busy';
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`classlive: maths records failed (${error?.code ?? 'none'})`);
        return null;
      }
      const context = data as {
        facts: MathsContext['facts'];
        settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean };
        focus?: unknown;
      };
      const { enabledTables, division, missingFactor, multipleChoice } = context.settings ?? {};
      return {
        facts: context.facts ?? [],
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    async openQuestion(room, player) {
      const raw = await call<StoredQuestion | null>('classlive_open_question', { target: room, player });
      return raw === 'busy' ? 'busy' : questionOf(raw);
    },
    async loadQuestion(room, player, slot) {
      const raw = await call<StoredQuestion | null>('classlive_load_question', { target: room, player, slot });
      return raw === 'busy' ? 'busy' : questionOf(raw);
    },
    async keepQuestion(room, player, question) {
      const raw = await call<StoredQuestion>('classlive_keep_question', { target: room, player, question });
      return raw === 'busy' ? 'busy' : (questionOf(raw) as StoredQuestion);
    },
    async positions(room) {
      const raw = await call<Record<string, { x: number; y: number }> | null>('classlive_room_positions', { target: room });
      if (raw === 'busy') return 'busy';
      const out: Record<string, { x: number; y: number }> = {};
      for (const [id, p] of Object.entries(raw ?? {})) if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[id] = { x: Number(p.x), y: Number(p.y) };
      return out;
    },
    async place(room, spots) {
      const out = await call<string>('classlive_place', { target: room, spots });
      if (out === 'busy') throw new Error('classlive_place failed');
    },
    async finishSession(room, done) {
      const out = await call<string>('classlive_finish', { target: room, done });
      if (out === 'busy') throw new Error('classlive_finish failed');
    },
    async recordAnswers(player, once, answers) {
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'classlive');
    },
  }),
);
