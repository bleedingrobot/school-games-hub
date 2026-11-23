// Connects the Class Showdown handler to Supabase. Edit handler.ts or shared/showdown/server.ts for the logic, then run
// `npm run build:functions -- showdown` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { PlayerView, RoomRow, StoredQuestion } from '../../../shared/showdown/server';
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

const key = serverKey();
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T | 'busy'> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return data as T;
  console.error(`showdown: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

type RawRow = { id: number; class_id: string; teacher: string; arena: 'boss'; version: number; started_ms: number | null; paused_ms: number | null; show_names: boolean; round: RoomRow['round'] };
const rowOf = (raw: RawRow | null): RoomRow | null =>
  raw && {
    id: Number(raw.id), classId: raw.class_id, teacher: raw.teacher, arena: raw.arena, version: raw.version,
    startedAt: raw.started_ms === null ? null : Number(raw.started_ms), pausedAt: raw.paused_ms === null ? null : Number(raw.paused_ms),
    showNames: raw.show_names !== false, round: raw.round,
  };
const questionOf = (raw: StoredQuestion | null) => raw && { slot: raw.slot, question: raw.question, golden: raw.golden === true, answered: raw.answered === true };

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    userIdFor: userIdFromToken(admin.auth),
    async teacherClass(teacher, classId) {
      const row = await call<{ enabled: boolean; show_names: boolean } | null>('showdown_teacher_class', { teacher, target_class: classId });
      if (row === 'busy') return 'busy';
      return row && { enabled: row.enabled === true, showNames: row.show_names !== false };
    },
    async pupil(player) {
      const row = await call<{ class_id: string; name: string | null; enabled: boolean } | null>('showdown_pupil', { player });
      if (row === 'busy') return 'busy';
      return row && { classId: row.class_id, name: (row.name ?? 'A player').slice(0, 40), enabled: row.enabled === true };
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`showdown: maths records failed (${error?.code ?? 'none'})`);
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
        // Anything odd counts as no focus (auto).
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    async openRoom(classId, teacher, arena, round, view) {
      const id = await call<number>('showdown_open', { target_class: classId, teacher, arena, round, view });
      return id === 'busy' ? 'busy' : Number(id);
    },
    async loadRoom(room) {
      const raw = await call<RawRow | null>('showdown_load', { target: room });
      return raw === 'busy' ? 'busy' : rowOf(raw);
    },
    async classRoom(classId) {
      const raw = await call<RawRow | null>('showdown_class_room', { target_class: classId });
      return raw === 'busy' ? 'busy' : rowOf(raw);
    },
    async save(room, version, c) {
      const out = await call<string>('showdown_save', {
        target: room, seen_version: version, round: c.round, view: c.view, started_ms: c.startedAt === null ? null : Math.round(c.startedAt),
        paused_ms: c.pausedAt === null ? null : Math.round(c.pausedAt), players: c.players, events: c.events, claim: c.claim ?? null,
      });
      return out === 'ok' || out === 'stale' || out === 'answered' ? out : 'busy';
    },
    async openQuestion(room, player) {
      const raw = await call<StoredQuestion | null>('showdown_open_question', { target: room, player });
      return raw === 'busy' ? 'busy' : questionOf(raw);
    },
    async loadQuestion(room, player, slot) {
      const raw = await call<StoredQuestion | null>('showdown_load_question', { target: room, player, slot });
      return raw === 'busy' ? 'busy' : questionOf(raw);
    },
    async keepQuestion(room, player, question, golden) {
      const raw = await call<StoredQuestion>('showdown_keep_question', { target: room, player, question, golden });
      return raw === 'busy' ? 'busy' : (questionOf(raw) as StoredQuestion);
    },
    async roomPlayers(room) {
      const list = await call<PlayerView[]>('showdown_room_players', { target: room });
      return list === 'busy' ? 'busy' : Array.isArray(list) ? list : [];
    },
    async recordAnswers(player, once, answers) {
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'showdown');
    },
  }),
);
