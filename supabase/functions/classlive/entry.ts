// Connects the Class Live handler to Supabase. Edit handler.ts or shared/classlive/server.ts for the logic, then run
// `npm run build:functions -- classlive` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { RoomRow } from '../../../shared/classlive/server';
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
  id: number; class_id: string; teacher: string; version: number; started_ms: number | null; show_names: boolean;
  session: RoomRow['session']; seq: number; events: RoomRow['events'] | null;
};
const rowOf = (raw: RawRow | null): RoomRow | null =>
  raw && {
    id: Number(raw.id), classId: raw.class_id, teacher: raw.teacher, version: raw.version,
    startedAt: raw.started_ms === null ? null : Number(raw.started_ms), showNames: raw.show_names !== false, session: raw.session,
    seq: Number(raw.seq) || 0, events: Array.isArray(raw.events) ? raw.events : [],
  };

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    userIdFor: userIdFromToken(admin.auth),
    async teacherClass(teacher, classId) {
      const row = await call<{ enabled: boolean; show_names: boolean } | null>('classlive_teacher_class', { teacher, target_class: classId });
      if (row === 'busy') return 'busy';
      return row && { enabled: row.enabled === true, showNames: row.show_names !== false };
    },
    async pupil(player) {
      const row = await call<{ class_id: string; name: string | null; enabled: boolean } | null>('classlive_pupil', { player });
      if (row === 'busy') return 'busy';
      return row && { classId: row.class_id, name: (row.name ?? 'A player').slice(0, 40), enabled: row.enabled === true };
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
        started_ms: c.startedAt === null ? null : Math.round(c.startedAt), players: c.players,
      });
      return out === 'ok' || out === 'stale' ? out : 'busy';
    },
  }),
);
