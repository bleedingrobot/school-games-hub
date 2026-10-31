// Connects the kingdom handler to Supabase. Edit handler.ts (or shared/kingdom/server.ts) for the logic, then run
// `npm run build:functions -- kingdom` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { KingdomRecord, StoredReign } from '../../../shared/kingdom/reign';
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
  console.error(`kingdom: ${name} failed (${error.code ?? 'unknown'})`);
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
        console.error(`kingdom: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return (data as { kingdom_enabled?: boolean }).kingdom_enabled === true;
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`kingdom: maths records failed (${error?.code ?? 'none'})`);
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
      const r = await call<{ reign: (StoredReign & { id: number | string }) | null; record: KingdomRecord; finishedToday: number }>('kingdom_load', { player });
      if (r === 'busy') return r;
      // A bigint id comes back as a number (reigns will never get near 2^53).
      return { ...r, reign: r.reign ? { ...r.reign, id: Number(r.reign.id) } : null };
    },
    async start(player, seed, look, city, council) {
      const id = await call<number | string>('kingdom_start', { player, seed, look, city, council });
      return id === 'busy' ? id : Number(id);
    },
    answer: (player, reign, year, slot, value, right) =>
      call<boolean>('kingdom_answer', { player, reign, year, slot, value, right_answer: right }),
    turn: (player, reign, fromYear, turned, city, council, end) =>
      call<boolean>('kingdom_turn', { player, reign, from_year: fromYear, turned, city, council, rating: end?.rating ?? null, points: end?.points ?? 0 }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'kingdom');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'kingdom', points, once });
      if (error) console.error(`kingdom: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'kingdom' });
      if (error) console.error(`kingdom: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
