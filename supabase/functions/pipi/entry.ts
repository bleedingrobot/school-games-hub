// Connects the pipi handler to Supabase. Edit handler.ts (or shared/pipi/server.ts) for the logic, then run
// `npm run build:functions -- pipi` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { FactStats } from '../../../shared/maths/leitner';
import type { Round } from '../../../shared/pipi/round';
import { unplayed, type Saved } from '../../../shared/pipi/server';
import { JUNIOR_QUICK_MS } from '../../../shared/juniorQuick';
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
  console.error(`pipi: ${name} failed (${error.code ?? 'unknown'})`);
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
        console.error(`pipi: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { pipi_enabled?: boolean; pipi_help?: boolean };
      return { enabled: row.pipi_enabled === true, help: row.pipi_help !== false };
    },
    async load(player) {
      const saved = await call<Saved | null>('pipi_load', { player });
      // A pupil who has never played has no beach yet.
      return saved ?? unplayed();
    },
    async seen(player) {
      const kinds = await call<string[] | null>('kit_seen_get', { player, game: 'pipi' });
      return kinds === 'busy' ? 'busy' : (kinds ?? []);
    },
    async markSeen(player, kinds) {
      const next = await call<string[] | null>('kit_seen_mark', { player, game: 'pipi', kinds });
      return next === 'busy' ? 'busy' : (next ?? []);
    },
    async facts(player) {
      // The same records every maths game reads; only the part-whole ones matter here.
      const context = await call<{ facts?: FactStats[] } | null>('space_maths_context', { player });
      return context === 'busy' ? 'busy' : (context?.facts ?? []);
    },
    start: (player, round: Round) =>
      call<boolean>('pipi_start', { player, seed: round.seed, level: round.level, colour: round.colour, goes: round.goes }),
    round: (player, seed) => call<{ open: boolean; round: Round } | null>('pipi_round', { player, seed }),
    finish: (player, seed, version, progress, ending) =>
      call<boolean>('pipi_finish', {
        player, seed, version, days_done: progress.daysDone, last_shell_day: progress.lastShellDay, reached: progress.reached,
        played: progress.played,
        taps: ending.taps, mistakes: ending.mistakes,
      }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'pipi', undefined, JUNIOR_QUICK_MS);
    },
    async progressChanged(player) {
      // A Golden Pearl: the hub gives its achievement (counted from the finished days).
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'pipi' });
      if (error) console.error(`pipi: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
