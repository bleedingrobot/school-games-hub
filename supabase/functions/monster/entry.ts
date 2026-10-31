// Connects the monster handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { userIdFromToken } from '../_shared/signIn';
import { FLUENT_DAYS, QUICK_MS, TOP_BOX } from '../../../shared/maths/config';
import { makePlaceSyncer, type PlacePorts } from '../../../shared/maths/syncPlace';
import { countForFocuses } from '../_shared/focusResults';
import { makeHandler, type Outcome } from './handler';

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

/** Calls a database function. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<Outcome<T>> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return { ok: true, value: data as T };
  console.error(`monster: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code === '54000') return { ok: false, why: 'too-many' };
  // Bad data (22xxx) or a broken rule (23xxx): that item will never save, so it's dropped.
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

/** The database calls the ladder needs to keep the furthest place (the same as Gem Keep's; a placement is never made here). */
const placePorts: PlacePorts = {
  async loadContext(player) {
    const { data, error } = await admin.rpc('space_maths_context', { player });
    if (error) throw new Error(error.code ?? 'unknown');
    return (data as never) ?? null;
  },
  async savePlace(player, skill, rank) {
    const { error } = await admin.rpc('record_ladder_place', { player, skill, rank });
    if (error) throw new Error(error.code ?? 'unknown');
  },
  async savePlacementRow() {
    throw new Error('not here');
  },
};

Deno.serve(
  makeHandler({
    syncPlace: makePlaceSyncer(placePorts),
    now: () => Date.now(),
    userIdFor: userIdFromToken(admin.auth),
    async enabled(player) {
      // The settings that apply to this student: their class's, or their school's default.
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) return { ok: false, why: 'busy' };
      return { ok: true, value: (data as { monsters_enabled?: boolean }).monsters_enabled === true };
    },
    async loadSave(player) {
      const loaded = await call<{ world: never; version: number; clientAt: number } | null>('load_monster_save', { player });
      if (!loaded.ok) return loaded;
      return { ok: true, value: loaded.value ? { world: loaded.value.world, at: Number(loaded.value.clientAt), version: loaded.value.version } : null };
    },
    knownSaves: (player, ids) => call('known_monster_saves', { player, ids }),
    // The rules' numbers come from the shared maths settings, so they live in one place.
    recordAnswers: async (player, pack, batchId, answers) => {
      const saved = await call<number>('record_fact_answers', {
        player, pack, batch_id: batchId, answers, quick_ms: QUICK_MS, fluent_days: FLUENT_DAYS, top_box: TOP_BOX,
      });
      // Times tables, adding and division answers count for a running maths focus too (other topics aren't on the
      // ladder and are skipped). Only a batch the records took for the first time, so a retry never counts twice.
      if (saved.ok && saved.value > 0) await countForFocuses((name, args) => admin.rpc(name, args), player, pack, answers, 'monster');
      return saved;
    },
    recordSave: (player, save) => call('record_monster_save', { player, save }),
    recordRefusal: (player, reason, seq) => call('record_monster_refusal', { player, reason, seq }),
  }),
);
