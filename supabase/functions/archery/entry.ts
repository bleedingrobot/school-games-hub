// Connects the archery handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions -- archery` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/archery/speed';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
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
  console.error(`archery: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

/** Like `call`, for reads that give null when there's nothing: 'busy' if the database couldn't be reached. */
async function read<T>(name: string, args: Record<string, unknown>): Promise<T | null | 'busy'> {
  const r = await call<T | null>(name, args);
  return r.ok ? r.value : 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    userIdFor: userIdFromToken(admin.auth),
    async enabled(player) {
      // The switch of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`archery: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return (data as { archery_enabled?: boolean }).archery_enabled === true;
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`archery: maths records failed (${error?.code ?? 'none'})`);
        return null;
      }
      const context = data as {
        facts: MathsContext['facts'];
        settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean };
        focus?: unknown;
      };
      const { enabledTables, division, missingFactor, multipleChoice } = context.settings;
      return {
        facts: context.facts,
        // Anything odd counts as no focus: the questions are then the times-table step.
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    state: (player) => call('archery_state', { player }),
    shop: (player, request, action, kind, item, price, qty, needSpent, carry) =>
      call('archery_shop', { player, request_id: request, action, kind, item, price, qty, need_spent: needSpent, carry }),
    async roundStart(player, seed, questions, earns, servedMs) {
      const r = await call('archery_round_start', { player, seed, questions, earns, served_ms: servedMs });
      return r.ok;
    },
    roundLoad: (player, seed) => read('archery_round_load', { player, seed }),
    async roundAnswer(player, seed, slot, value, right, coins, nextMs) {
      const r = await call<{ claimed: boolean; coins?: number }>('archery_round_answer', {
        player, seed, slot, value, right_answer: right, coins, next_ms: nextMs,
      });
      return r.ok ? r.value : 'busy';
    },
    fightStart: (player, request, seed, world, opponent, pack) =>
      call('archery_fight_start', { player, request_id: request, seed, world, opponent, pack }),
    async fightLoad(player, fight) {
      const r = await read<{ seed: number | string } & Record<string, unknown>>('archery_fight_load', { player, fight });
      if (r === 'busy' || r === null) return r;
      // A bigint comes back as a number (it always fits: seeds are 32-bit).
      return { ...r, seed: Number(r.seed) } as never;
    },
    fightEnd: (player, fight, status, back, score, won) => call('archery_fight_end', { player, fight, status, back, score, won }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'archery');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'archery', points, once });
      if (error) console.error(`archery: points failed (${error.code ?? 'unknown'})`);
    },
  }),
);
