// Connects the circuit handler to Supabase. Edit handler.ts (or shared/circuit/game.ts) for the logic, then run
// `npm run build:functions -- circuit` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { RoadProgress } from '../../../shared/circuit/game';
import { isUnlimitedFor } from '../../../shared/unlimited';
import { userIdFromToken } from '../_shared/signIn';
import { stamper } from '../_shared/stamp';
import { makeHandler, type SaveStatus } from './handler';

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

const key = serverKey();
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T | 'busy'> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return data as T;
  console.error(`circuit: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    stamp: stamper(key, 'circuit-run'),
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      // The switches of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`circuit: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { circuit_enabled?: boolean; unlimited_days?: unknown };
      return { enabled: row.circuit_enabled === true, unlimited: isUnlimitedFor(row.unlimited_days, 'circuit') };
    },
    async load(player) {
      const saved = await call<{ roads: Record<string, RoadProgress> | null; today: number } | null>('circuit_load', { player });
      if (saved === 'busy') return 'busy';
      return { roads: saved?.roads ?? {}, today: saved?.today ?? 0 };
    },
    async record(player, f) {
      const saved = await call<{ status: SaveStatus; today: number }>('record_circuit_finish', {
        player, road: f.road, before_road: f.before, seed: f.seed, steps: f.steps, medal: f.medal, clean: f.clean, charged: f.charged,
        inputs: f.inputs, unlimited: f.unlimited,
      });
      return saved;
    },
  }),
);
