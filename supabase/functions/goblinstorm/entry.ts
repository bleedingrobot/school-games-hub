// Connects the goblinstorm handler to Supabase. Edit handler.ts (or shared/goblinstorm/server.ts) for the logic, then run
// `npm run build:functions -- goblinstorm` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import { freshSave, nzDay, type KeptRun, type Save } from '../../../shared/goblinstorm/server';
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
  console.error(`goblinstorm: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

/** The pupil's class settings (the switch and Unlimited today), or null if they can't be read. */
async function settings(player: string): Promise<{ goblinstorm_enabled?: boolean; unlimited_days?: unknown } | null> {
  const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
  if (error || !data) {
    console.error(`goblinstorm: settings failed (${error?.code ?? 'none'})`);
    return null;
  }
  return data as { goblinstorm_enabled?: boolean; unlimited_days?: unknown };
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    userIdFor: userIdFromToken(admin.auth),
    async enabled(player) {
      const s = await settings(player);
      return s ? s.goblinstorm_enabled === true : null;
    },
    async unlimited(player) {
      // "Unlimited today" is on while the class's unlimited_days names today's NZ date for this game.
      const days = (await settings(player))?.unlimited_days;
      return !!days && typeof days === 'object' && (days as Record<string, unknown>).goblinstorm === nzDay(Date.now());
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`goblinstorm: maths records failed (${error?.code ?? 'none'})`);
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
      const saved = await call<Save | null>('goblinstorm_load', { player });
      if (saved === 'busy') return 'busy';
      // A pupil who has never played has nothing unlocked yet.
      return saved ?? freshSave();
    },
    runsOn: (player, day) => call<number>('goblinstorm_runs_on', { player, day }),
    start: (player, run) =>
      call<boolean>('goblinstorm_store_questions', {
        player, seed: run.seed, hero: run.hero, map: run.map, day: run.day, extra: run.extra, questions: run.questions, shop: run.shop,
      }),
    async run(player, seed) {
      const r = await call<(Omit<KeptRun, 'startedAt'> & { startedAt: string }) | null>('goblinstorm_load_questions', { player, seed });
      if (r === 'busy' || r === null) return r;
      return { ...r, startedAt: Date.parse(r.startedAt) };
    },
    claim: (player, seed, slot, a) =>
      call<boolean>('goblinstorm_claim_answer', { player, seed, slot, value: a.value, ms: a.ms, mark: a.mark }),
    finish: (player, seed, f) =>
      call<boolean>('record_goblinstorm_run', { player, seed, steering: f.steering, picks: f.picks, summary: f.summary }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'goblinstorm');
    },
  }),
);
