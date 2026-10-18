// Connects the clans handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { Result, ServerState } from '../../../shared/clans/actions';
import type { Sketch } from '../../../shared/clans/village';
import { FACT_PACK } from '../../../shared/clans/battleCry';
import { FLUENT_DAYS, QUICK_MS, TOP_BOX } from '../../../shared/maths/config';
import { batchIdFor, makeHandler, type Extras, type Loaded, type LoadedTarget, type Outcome, type SaveStatus } from './handler';

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
  console.error(`clans: ${name} failed (${error.code ?? 'unknown'})`);
  // Bad data (22xxx) or a broken rule (23xxx): that request will never save.
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    async userIdFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    extras: (player) => call<Extras>('clan_extras', { player }),
    async recordAnswers(player, batchKey, answers) {
      return call<number>('record_fact_answers', {
        player, pack: FACT_PACK, batch_id: await batchIdFor(batchKey), answers, quick_ms: QUICK_MS, fluent_days: FLUENT_DAYS, top_box: TOP_BOX,
      });
    },
    load: (player, requestId) => call<Loaded>('load_clan', { player, request_id: requestId }),
    save: (player, expectedVersion, requestId, action, state: ServerState, result: Result) =>
      call<SaveStatus>('save_clan', { player, expected_version: expectedVersion, request_id: requestId, action, state, result }),
    vote: (player, kind) => call<{ ok: boolean }>('clan_vote', { player, kind }),
    mates: (player) => call<Sketch[]>('clan_village_mates', { player }),
    target: (player, targetId) => call<LoadedTarget>('clan_raid_target', { player, target: targetId }),
    saveRaid: (player, expectedVersion, raid, requestId, state, result) =>
      call<SaveStatus>('save_raid', {
        player, expected_version: expectedVersion, target: raid.targetId, target_version: raid.targetVersion, request_id: requestId,
        state, defender_empire: raid.empire, result, news: raid.news, note: raid.note,
      }),
  }),
);
