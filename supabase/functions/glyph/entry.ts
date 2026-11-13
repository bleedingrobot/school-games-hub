// Connects the glyph (Glyph Gates) handler to Supabase. Edit handler.ts (or shared/glyph/server.ts) for the logic, then run
// `npm run build:functions -- glyph` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { Progress, TempleResult } from '../../../shared/glyph/play';
import type { KeptGo, Saved } from '../../../shared/glyph/server';
import { unplayed } from '../../../shared/glyph/server';
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
  console.error(`glyph: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      // The switches of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`glyph: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return { enabled: (data as { glyph_enabled?: boolean }).glyph_enabled === true };
    },
    async load(player) {
      const saved = await call<Saved | null>('glyph_load', { player });
      return saved === 'busy' ? 'busy' : (saved ?? unplayed());
    },
    start: (player, seed, temple, help) => call<boolean>('glyph_start', { player, seed, temple, help }),
    go: (player, seed) => call<KeptGo | null>('glyph_go', { player, seed }),
    finishedToday: (player, day) => call<number>('glyph_finished_today', { player, day }),
    finish: (player, seed, version, progress: Progress, r: TempleResult) =>
      call<boolean>('glyph_finish', { player, seed, version, progress, result: r, first_goes: r.firstGoes, passed: r.passed, walls: r.walls.length }),
    saveProgress: (player, version, progress) => call<boolean>('glyph_save_progress', { player, version, progress }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'glyph');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'glyph', points, once });
      if (error) console.error(`glyph: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'glyph' });
      if (error) console.error(`glyph: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
