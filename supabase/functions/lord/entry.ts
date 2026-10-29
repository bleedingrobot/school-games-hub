// Connects the lord handler to Supabase. Edit handler.ts (and shared/lord/server.ts) for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { userIdFromToken } from '../_shared/signIn';
import { FLUENT_DAYS, TOP_BOX, quickMsForPack } from '../../../shared/maths/config';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { ArenaCandidate, Outcome, Settings } from '../../../shared/lord/server';
import { batchIdFor, makeHandler } from './handler';

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
  console.error(`lord: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code === '54000') return { ok: false, why: 'too-many' };
  // Bad data (22xxx) or a broken rule (23xxx): that request will never save, so it's refused.
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    seed: () => crypto.getRandomValues(new Uint32Array(1))[0],
    newId: () => crypto.randomUUID(),
    userIdFor: userIdFromToken(admin.auth),
    async isTeacher(player) {
      const { data, error } = await admin.from('profiles').select('role').eq('id', player).maybeSingle();
      if (error || !data) return { ok: false, why: 'busy' };
      return { ok: true, value: data.role === 'teacher' };
    },
    settings: (player) => call<Settings>('lord_server_settings', { player }),
    load: (player, requestId) => call('load_lord', { player, request_id: requestId ?? null }),
    commit: (player, commit) => call('lord_commit', { player, change: commit }),
    async recordAnswers(player, pack, batchKey, answers) {
      return call('record_fact_answers', {
        player, pack, batch_id: await batchIdFor(`${batchKey}`), answers, quick_ms: quickMsForPack(pack), fluent_days: FLUENT_DAYS, top_box: TOP_BOX,
      });
    },
    async mathsContext(player): Promise<Outcome<MathsContext>> {
      const r = await call<{ facts: MathsContext['facts']; settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean }; focus?: unknown } | null>('space_maths_context', { player });
      if (!r.ok) return r;
      if (!r.value) return { ok: false, why: 'busy' };
      const { enabledTables, division, missingFactor, multipleChoice } = r.value.settings ?? {};
      return {
        ok: true,
        value: {
          facts: r.value.facts ?? [],
          // Anything odd counts as no focus.
          focus: parseFocus(r.value.focus),
          settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
        } as MathsContext,
      };
    },
    recordRefusal: (player, reason, action) => call('record_lord_refusal', { player, reason, action }),
    arenaCandidates: (player, season, level) => call<ArenaCandidate[]>('lord_arena_candidates', { player, season, lvl: level }),
    dailyNews: (player, day, lines) => call('lord_daily_news', { player, news_day: day, lines }),
  }),
);
