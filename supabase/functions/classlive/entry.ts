// Connects the Class Live handler to Supabase. Edit handler.ts or shared/classlive/server.ts for the logic, then run
// `npm run build:functions -- classlive` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { edgeFor, makeTicket, TICKET_MS, type EdgeServices } from '../../../shared/classlive/edge';
import { readOpenGames } from '../../../shared/classlive/limits';
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
  id: number; class_id: string | null; school_id: number; teacher: string | null; version: number; started_ms: number | null; show_names: boolean;
  session: RoomRow['session']; seq: number; events: RoomRow['events'] | null;
};
const rowOf = (raw: RawRow | null): RoomRow | null =>
  raw && {
    id: Number(raw.id), classId: raw.class_id, schoolId: Number(raw.school_id), teacher: raw.teacher, version: raw.version,
    startedAt: raw.started_ms === null ? null : Number(raw.started_ms), showNames: raw.show_names !== false, session: raw.session,
    seq: Number(raw.seq) || 0, events: Array.isArray(raw.events) ? raw.events : [],
  };

/**
 * Cloudflare's rooms for the Ghost Tag pilot (shared/classlive/edge.ts). The publish sets both secrets when it deploys the
 * Worker (.github/workflows/deploy.yml, "edge"); without them every game stays on the database.
 */
function edgeServices(): EdgeServices | undefined {
  const base = (Deno.env.get('CLASSLIVE_EDGE_URL') ?? '').replace(/\/+$/, '');
  const secret = Deno.env.get('CLASSLIVE_EDGE_SECRET') ?? '';
  if (!/^https:\/\//.test(base) || !secret) return undefined;
  const call = (room: number, what: string, init: RequestInit = {}) =>
    fetch(`${base}/room/${room}/${what}`, { ...init, signal: AbortSignal.timeout(3000), headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' } });
  return {
    allowed: edgeFor,
    async positions(room) {
      try {
        const res = await call(room, 'positions');
        if (!res.ok) return 'busy';
        const raw = (await res.json()) as Record<string, { x: number; y: number }>;
        const out: Record<string, { x: number; y: number }> = {};
        for (const [id, p] of Object.entries(raw ?? {})) if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[id] = { x: Number(p.x), y: Number(p.y) };
        return out;
      } catch {
        console.error('classlive: edge positions failed');
        return 'busy';
      }
    },
    async sync(room, sync) {
      const res = await call(room, 'sync', { method: 'POST', body: JSON.stringify(sync) });
      if (!res.ok) throw new Error(`edge sync ${res.status}`);
      await res.body?.cancel();
    },
    async clashBoard(room, round) {
      try {
        const res = await call(room, `board?round=${round}`);
        if (!res.ok) return 'busy';
        const b = (await res.json()) as { tiles?: unknown; painted?: unknown };
        if (typeof b.tiles !== 'string' || !b.painted || typeof b.painted !== 'object') return 'busy';
        const painted: Record<string, number> = {};
        for (const [id, n] of Object.entries(b.painted as Record<string, unknown>)) if (Number.isFinite(Number(n))) painted[id] = Number(n);
        return { tiles: b.tiles, painted };
      } catch {
        console.error('classlive: edge board failed');
        return 'busy';
      }
    },
    async clashBomb(room, round, team, player, tiles) {
      const res = await call(room, 'bomb', { method: 'POST', body: JSON.stringify({ round, team, player, tiles }) });
      if (!res.ok) throw new Error(`edge bomb ${res.status}`);
      await res.body?.cancel();
    },
    async ticket(room, who, kind) {
      return { url: `${base.replace(/^https:/, 'wss:')}/room/${room}/ws`, ticket: await makeTicket(secret, { r: room, u: who, k: kind, e: Date.now() + TICKET_MS }) };
    },
  };
}

const questionOf = (raw: StoredQuestion | null) => raw && { slot: raw.slot, question: raw.question, answered: raw.answered === true };

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    userIdFor: userIdFromToken(admin.auth),
    edge: edgeServices(),
    async saveStats(room, player, part, version, stats) {
      const { error } = await admin.from('classlive_netstats').upsert({ room, player, part, version, stats, at: new Date().toISOString() });
      if (error) throw new Error(`classlive_netstats failed (${error.code ?? 'unknown'})`);
    },
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
    async openGames() {
      const raw = await call<unknown>('classlive_open_games', {});
      return raw === 'busy' ? 'busy' : readOpenGames(raw);
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
    async clashBoard(room, round) {
      const raw = await call<{ tiles: string; painted: Record<string, number> } | null>('classlive_clash_count', { target: room, rnd: round });
      if (raw === 'busy') return 'busy';
      const painted: Record<string, number> = {};
      for (const [id, n] of Object.entries(raw?.painted ?? {})) if (Number.isFinite(Number(n))) painted[id] = Number(n);
      return { tiles: typeof raw?.tiles === 'string' ? raw.tiles : '', painted };
    },
    async clashBomb(room, round, team, player, tiles) {
      const out = await call<number>('classlive_clash_bomb', { target: room, rnd: round, tm: team, player, idxs: tiles });
      if (out === 'busy') throw new Error('classlive_clash_bomb failed');
    },
  }),
);
