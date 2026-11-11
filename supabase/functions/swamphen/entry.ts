// Connects the swamphen (Swamp Hen’s Reed Rows) handler to Supabase. Edit handler.ts (or shared/swamphen/server.ts) for the logic, then run
// `npm run build:functions -- swamphen` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { FactStats } from '../../../shared/maths/leitner';
import type { HelpSetting, Round } from '../../../shared/swamphen/round';
import { HELP_SETTINGS, unplayed, type Saved } from '../../../shared/swamphen/server';
import { JUNIOR_MIN_THINK_MS, JUNIOR_QUICK_MS } from '../../../shared/juniorQuick';
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
  console.error(`swamphen: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      // The settings of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`swamphen: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { swamphen_enabled?: boolean; swamphen_help?: string };
      const help = HELP_SETTINGS.includes(row.swamphen_help as HelpSetting) ? (row.swamphen_help as HelpSetting) : 'fade';
      return { enabled: row.swamphen_enabled === true, help };
    },
    async load(player) {
      const saved = await call<Saved | null>('swamphen_load', { player });
      // A pupil who has never played has no garden yet.
      return saved ?? unplayed();
    },
    async facts(player) {
      // The same records every maths game reads; the times tables and counting by fives and tens set where a new pupil starts.
      const context = await call<{ facts?: FactStats[] } | null>('space_maths_context', { player });
      return context === 'busy' ? 'busy' : (context?.facts ?? []);
    },
    start: (player, round: Round) =>
      call<boolean>('swamphen_start', { player, seed: round.seed, round }),
    round: (player, seed) => call<{ open: boolean; round: Round } | null>('swamphen_round', { player, seed }),
    finish: (player, seed, version, progress, ending) =>
      call<boolean>('swamphen_finish', {
        player, seed, version, days_done: progress.daysDone, last_day: progress.lastDay, step: progress.step,
        level: progress.level, good_in_row: progress.goodInRow, good_at_step: progress.goodAtStep,
        taps: ending.taps, mistakes: ending.mistakes, first_right: ending.firstRight, slips: ending.slips,
        kind_levels: progress.kindLevels,
      }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'swamphen', undefined, JUNIOR_QUICK_MS, JUNIOR_MIN_THINK_MS);
    },
    async seen(player) {
      return call<string[] | null>('kit_seen_get', { player, game: 'swamphen' }).then((r) => (r === 'busy' ? r : (r ?? [])));
    },
    markSeen: (player, kinds) => call<string[]>('kit_seen_mark', { player, game: 'swamphen', kinds }),
    async progressChanged(player) {
      // A Golden Reed Garden: the hub gives its achievement (counted from the finished days).
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'swamphen' });
      if (error) console.error(`swamphen: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
