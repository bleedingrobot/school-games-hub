// Connects the starweb (Star Web solo) handler to Supabase. Edit handler.ts (or shared/starweb/server.ts) for the logic, then
// run `npm run build:functions -- starweb` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { FactStats } from '../../../shared/maths/leitner';
import type { KeptSky, Saved } from '../../../shared/starweb/server';
import { unplayed } from '../../../shared/starweb/server';
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
  console.error(`starweb: ${name} failed (${error.code ?? 'unknown'})`);
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
        console.error(`starweb: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return { enabled: (data as { starweb_enabled?: boolean }).starweb_enabled === true };
    },
    async load(player) {
      const saved = await call<Saved | null>('starweb_load', { player });
      return saved === 'busy' ? 'busy' : (saved ?? unplayed());
    },
    openSky: (player) => call<KeptSky | null>('starweb_open_sky', { player }),
    sky: (player, seed) => call<KeptSky | null>('starweb_sky', { player, seed }),
    async maths(player) {
      // The pupil's own times-table records and the class's tables: the known fact is picked from these.
      const context = await call<{ facts: FactStats[]; settings?: { enabledTables?: number[] } } | null>('space_maths_context', { player });
      if (context === 'busy' || !context) return 'busy';
      return { facts: context.facts ?? [], enabledTables: context.settings?.enabledTables };
    },
    start: (player, seed, mode, anchor) => call<boolean>('starweb_start', { player, seed, mode, x: anchor.x, y: anchor.y }),
    save: (player, seed, version, stars, hints) => call<boolean>('starweb_save', { player, seed, sky_version: version, stars, hints }),
    finish: (player, seed, skyVersion, stars, hints, medal, points, version, progress) =>
      call<boolean>('starweb_finish', { player, seed, sky_version: skyVersion, stars, hints, medal, points, version, progress }),
    pointSkiesToday: (player, day) => call<number>('starweb_point_skies', { player, day }),
    saveProgress: (player, version, progress) => call<boolean>('starweb_save_progress', { player, version, progress }),
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'starweb', points, once });
      if (error) console.error(`starweb: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'starweb' });
      if (error) console.error(`starweb: achievements failed (${error.code ?? 'unknown'})`);
    },
  }),
);
