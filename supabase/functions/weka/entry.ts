// Connects the weka (Weka’s Stepping Stones) handler to Supabase. Edit handler.ts (or shared/weka/server.ts) for the logic, then run
// `npm run build:functions -- weka` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { FactStats } from '../../../shared/maths/leitner';
import type { Round } from '../../../shared/weka/round';
import { HELP_SETTINGS, unplayed, type HelpSetting, type Saved } from '../../../shared/weka/server';
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
  console.error(`weka: ${name} failed (${error.code ?? 'unknown'})`);
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
        console.error(`weka: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { weka_enabled?: boolean; weka_help?: string };
      const help = HELP_SETTINGS.includes(row.weka_help as HelpSetting) ? (row.weka_help as HelpSetting) : 'fade';
      return { enabled: row.weka_enabled === true, help };
    },
    async load(player) {
      const saved = await call<Saved | null>('weka_load', { player });
      // A pupil who has never played has no stream yet.
      return saved ?? unplayed();
    },
    async facts(player) {
      // The same records every maths game reads; only the adding facts to 20 matter here.
      const context = await call<{ facts?: FactStats[] } | null>('space_maths_context', { player });
      return context === 'busy' ? 'busy' : (context?.facts ?? []);
    },
    async seen(player) {
      const kinds = await call<string[] | null>('kit_seen_get', { player, game: 'weka' });
      return kinds === 'busy' ? 'busy' : (kinds ?? []);
    },
    async markSeen(player, kinds) {
      const next = await call<string[] | null>('kit_seen_mark', { player, game: 'weka', kinds });
      return next === 'busy' ? 'busy' : (next ?? []);
    },
    start: (player, round: Round) =>
      call<boolean>('weka_start', { player, seed: round.seed, level: round.level, day: round.day, goes: round.goes }),
    round: (player, seed) => call<{ open: boolean; round: Round } | null>('weka_round', { player, seed }),
    finish: (player, seed, version, progress, ending) =>
      call<boolean>('weka_finish', {
        player, seed, version, days_done: progress.daysDone, last_stone_day: progress.lastStoneDay, reached: progress.reached,
        taps: ending.taps, mistakes: ending.mistakes,
      }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'weka', undefined, JUNIOR_QUICK_MS, JUNIOR_MIN_THINK_MS);
    },
    async progressChanged(player) {
      // A Golden Picnic Basket: the hub gives its achievement (counted from the finished days in Stage 4's migration).
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'weka' });
      if (error) console.error(`weka: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
