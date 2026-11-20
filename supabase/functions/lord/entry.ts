// Connects the lord handler to Supabase. Edit handler.ts (and shared/lord/server.ts) for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { userIdFromToken } from '../_shared/signIn';
import { openCoinPouches } from '../_shared/coinPouch';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { ArenaCandidate, Outcome, Settings } from '../../../shared/lord/server';
import type { ClashRow } from '../../../shared/lord/clashServer';
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
    // The one approved way (docs/game-guide/4-maths.md rule 6): each pack's quick time, and the running focuses' results.
    // Batch ids are made as before, so an answer sent again after this change still counts once.
    async recordAnswers(player, _pack, batchKey, answers) {
      const r = await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, batchKey, 'lord', (once) => batchIdFor(once));
      return r.failed > 0 && r.saved === 0 ? { ok: false, why: 'busy' } : { ok: true, value: r.saved };
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
    openPouches: (player, version, perUnit) => openCoinPouches((name, args) => admin.rpc(name, args), player, 'dragon-maths', version, perUnit),
    dailyNews: (player, day, lines) => call('lord_daily_news', { player, news_day: day, lines }),
    // Live arena clashes (migration 20261117000200_lord_live_arena.sql).
    clashLoad: (clash) => call('lord_clash_load', { clash }),
    clashChallenge: (player, other, waitMs) => call('lord_clash_challenge', { player, other, wait_ms: waitMs }),
    clashAnswer: (player, clash, accept, roundMs) => call('lord_clash_answer', { player, clash, accept, round_ms: roundMs }),
    clashPick: (player, clash, round, move, right) => call('lord_clash_pick', { player, clash, round, move, is_right: right }),
    clashRoundPicks: (clash, round) => call('lord_clash_round_picks', { clash, round }),
    clashRound: (clash, version, rounds, missed, deadlineMs) => call<ClashRow | null>('lord_clash_round', { clash, version, rounds, missed, deadline_ms: deadlineMs }),
    clashEnd: (clash, version, status, ending, winner, leaver, rounds, want, paidPerDay) =>
      call<ClashRow | null>('lord_clash_end', { clash, version, status, ending, winner, leaver, rounds, want, paid_per_day: paidPerDay }),
  }),
);
