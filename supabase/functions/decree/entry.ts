// Connects the decree handler to Supabase. Edit handler.ts (or shared/decree/server.ts) for the logic, then run
// `npm run build:functions -- decree` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { Album, StoredReign } from '../../../shared/decree/server';
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
  console.error(`decree: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    userIdFor: userIdFromToken(admin.auth),
    async enabled(player) {
      // The switch of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`decree: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return (data as { decree_enabled?: boolean }).decree_enabled === true;
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`decree: maths records failed (${error?.code ?? 'none'})`);
        return null;
      }
      const context = data as {
        facts: MathsContext['facts'];
        settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean };
        focus?: unknown;
      };
      const { enabledTables, division, missingFactor, multipleChoice } = context.settings;
      return {
        facts: context.facts,
        // Anything odd counts as no focus.
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      } as MathsContext;
    },
    async load(player) {
      const r = await call<{ reign: (StoredReign & { id: number | string }) | null; album: Album; finishedToday: number | string }>('decree_load', { player });
      if (r === 'busy') return r;
      // A bigint id comes back as a number (reigns will never get near 2^53); counts may arrive as numbers or strings.
      const a = r.album;
      const album: Album = { ...a, reigns: Number(a.reigns), full: Number(a.full), best: Number(a.best) };
      return { reign: r.reign ? { ...r.reign, id: Number(r.reign.id) } : null, album, finishedToday: Number(r.finishedToday) };
    },
    async start(player, look, reign, questions) {
      const id = await call<number | string>('decree_start', { player, look, reign, questions });
      return id === 'busy' ? id : Number(id);
    },
    answer: (player, id, slot, value, right) => call<boolean>('decree_answer', { player, reign: id, slot, value, right_answer: right }),
    save: (player, id, fromTurn, reign, moves, end) =>
      call<boolean>('decree_save', { player, reign: id, from_turn: fromTurn, state: reign, new_moves: moves, points: end ? end.points : null }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'decree');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'decree', points, once });
      if (error) console.error(`decree: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'decree' });
      if (error) console.error(`decree: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
