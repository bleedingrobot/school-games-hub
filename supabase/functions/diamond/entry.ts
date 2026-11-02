// Connects the diamond handler to Supabase. Edit handler.ts (or shared/diamond/server.ts) for the logic, then run
// `npm run build:functions -- diamond` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import { unplayed, type OpenLevel, type Saved } from '../../../shared/diamond/server';
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
  console.error(`diamond: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    userIdFor: userIdFromToken(admin.auth),
    async enabled(player) {
      // The switch of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`diamond: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return (data as { diamond_enabled?: boolean }).diamond_enabled === true;
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`diamond: maths records failed (${error?.code ?? 'none'})`);
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
      const saved = await call<Saved | null>('diamond_load', { player });
      // A pupil who has never played starts at level 1.
      return saved ?? unplayed();
    },
    start: (player, version, state, level) =>
      call<boolean>('diamond_start', {
        player, version, state, seed: level.seed, level: level.level, boosts: level.boosts, starter: level.starter, questions: level.questions,
      }),
    level: (player, seed) => call<OpenLevel | null>('diamond_level', { player, seed }),
    answer: (player, seed, slot, right) => call<boolean>('diamond_answer', { player, seed, slot, right_answer: right }),
    end: (player, seed, version, state, ending) =>
      call<boolean>('diamond_end', { player, seed, version, state, drops: ending.drops, finish: ending.finish, result: ending.result }),
    save: (player, version, state) => call<boolean>('diamond_save', { player, version, state }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'diamond');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'diamond', points, once });
      if (error) console.error(`diamond: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'diamond' });
      if (error) console.error(`diamond: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
