// Connects the gem-keep handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { FLUENT_DAYS, QUICK_MS, TOP_BOX } from '../../../shared/maths/config';
import { makePlaceSyncer, savePlacement, type PlacePorts } from '../../../shared/maths/syncPlace';
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
  console.error(`gem-keep: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code === '54000') return { ok: false, why: 'too-many' };
  // Bad data (22xxx) or a broken rule (23xxx): that item will never save, so it's dropped.
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

/** The database calls the ladder needs: the student's records and focus, their furthest place and their placement. */
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
  async savePlacementRow(player, skill, skipped) {
    const { data, error } = await admin.rpc('record_placement', { player, start_skill: skill, was_skipped: skipped });
    if (error) throw new Error(error.code ?? 'unknown');
    return data === true;
  },
};

Deno.serve(
  makeHandler({
    syncPlace: makePlaceSyncer(placePorts),
    savePlacement: (player, raw) => savePlacement(placePorts, player, raw),
    now: () => Date.now(),
    async userIdFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    recordRun: (player, run) => call('record_gem_keep_run', { player, run }),
    recordKey: (player, levelId, right) =>
      call('record_gem_keep_key', { player, level_id: levelId, right_answers: right }),
    recordFacts: (player, pack, facts) => call('record_gem_keep_facts', { player, pack, facts }),
    // The rules' numbers come from the shared maths settings, so they live in one place.
    recordAnswers: (player, pack, batchId, answers) =>
      call('record_fact_answers', {
        player, pack, batch_id: batchId, answers, quick_ms: QUICK_MS, fluent_days: FLUENT_DAYS, top_box: TOP_BOX,
      }),
    importProgress: (player, levels) => call('import_gem_keep_progress', { player, levels }),
  }),
);
