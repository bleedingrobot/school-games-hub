// Connects the toonflap (Toon Flap) handler to Supabase. Edit handler.ts (or shared/toonflap/server.ts) for the logic, then run
// `npm run build:functions -- toonflap` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { FactStats } from '../../../shared/maths/leitner';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { unplayed, type KeptRun, type Saved } from '../../../shared/toonflap/server';
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
  console.error(`toonflap: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      // The switches of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`toonflap: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { toonflap_enabled?: boolean; toonflap_maths?: string; toonflap_read_time?: boolean };
      return { enabled: row.toonflap_enabled === true, maths: parseMathsSwitch(row.toonflap_maths) !== 'off', readTime: row.toonflap_read_time !== false };
    },
    async load(player) {
      const saved = await call<Saved | null>('toonflap_load', { player });
      return saved === 'busy' ? 'busy' : (saved ?? unplayed());
    },
    async maths(player) {
      const context = await call<{ facts: FactStats[]; settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean }; focus?: unknown } | null>('space_maths_context', { player });
      if (context === 'busy' || !context) return 'busy';
      const { enabledTables, division, missingFactor, multipleChoice } = context.settings ?? {};
      return {
        facts: context.facts ?? [],
        // Anything odd counts as no focus: the questions are then the times-table step.
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    runsToday: (player, day) => call<{ started: number; finished: number }>('toonflap_runs_today', { player, day }),
    start: (player, seed, run) =>
      call<boolean>('toonflap_start', { player, seed, level: run.level, gentle: run.gentle, maths: run.maths, questions: run.questions, labels: run.labels }),
    run: (player, seed) => call<KeptRun | null>('toonflap_run', { player, seed }),
    claim: (player, seed, slot, right) => call<boolean>('toonflap_claim', { player, seed, slot, right_answer: right }),
    finish: (player, seed, version, progress, r) =>
      call<boolean>('toonflap_finish', {
        player, seed, version, progress, flaps: r.flaps, seconds: r.seconds, medal: r.medal, bumps: r.bumps,
        checks_right: r.checksRight, gaps_right: r.gapsRight, potion: r.potion,
      }),
    savePicks: (player, picks) => call<boolean>('toonflap_save_picks', { player, picks }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'toonflap');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'toonflap', points, once });
      if (error) console.error(`toonflap: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'toonflap' });
      if (error) console.error(`toonflap: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
