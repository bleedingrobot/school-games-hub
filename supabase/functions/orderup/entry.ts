// Connects the orderup (Order Up!) handler to Supabase. Edit handler.ts (or shared/orderup/server.ts) for the logic, then run
// `npm run build:functions -- orderup` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { HELP_SETTINGS, unsaved, type HelpSetting, type KeptSet, type Saved } from '../../../shared/orderup/server';
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
  console.error(`orderup: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`orderup: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { orderup_enabled?: boolean; orderup_help?: string };
      const help = HELP_SETTINGS.includes(row.orderup_help as HelpSetting) ? (row.orderup_help as HelpSetting) : 'fade';
      return { enabled: row.orderup_enabled === true, help };
    },
    async load(player) {
      const saved = await call<Saved | null>('orderup_load', { player });
      return saved === 'busy' ? 'busy' : (saved ?? unsaved());
    },
    async seen(player) {
      const kinds = await call<string[] | null>('kit_seen_get', { player, game: 'orderup' });
      return kinds === 'busy' ? 'busy' : (kinds ?? []);
    },
    async markSeen(player, kinds) {
      const next = await call<string[] | null>('kit_seen_mark', { player, game: 'orderup', kinds });
      return next === 'busy' ? 'busy' : (next ?? []);
    },
    start: (player, set: KeptSet) => call<boolean>('orderup_start', { player, seed: set.seed, level: set.level, set }),
    set: (player, seed) => call<{ open: boolean; done: number; good: number; set: KeptSet } | null>('orderup_set', { player, seed }),
    saveBag: (player, seed, slot, events, result) =>
      call<{ done: number; good: number } | null>('orderup_bag', {
        player, seed, slot, events, good: result.good, clean: result.clean, wrong_picks: result.wrongPicks,
        wrong_answers: result.wrongAnswers, most_wrong: result.mostWrongOnAStep, mistakes: result.mistakes, ms: Math.min(result.ms, 2_000_000_000),
      }),
    saveProgress: (player, version, progress) =>
      call<boolean>('orderup_save', { player, version, passed: progress.passed, levels: progress.levels }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'orderup');
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'orderup' });
      if (error) console.error(`orderup: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
