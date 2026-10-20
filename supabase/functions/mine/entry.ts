// Connects the mine handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions -- mine` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { Question } from '../../../shared/maths/skillPack';
import type { MathsContext } from '../../../shared/mine/maths';
import { MINE_RUNS_PER_DAY } from '../../../shared/mine/save';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
import { stamper } from '../_shared/stamp';
import { makeHandler, type Outcome, type SaveResult, type StoredRun } from './handler';

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

/** Calls a database function. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<Outcome<T>> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return { ok: true, value: data as T };
  console.error(`mine: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code === '54000') return { ok: false, why: 'too-many' };
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    stamp: stamper(key, 'mine-run'),
    userIdFor: userIdFromToken(admin.auth),
    async mathsSwitch(player) {
      // The switch of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`mine: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      return parseMathsSwitch((data as { mine_maths?: string }).mine_maths);
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`mine: maths records failed (${error?.code ?? 'none'})`);
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
    async runsToday(player) {
      const { data, error } = await admin.rpc('mine_runs_today', { player });
      if (error || typeof data !== 'number') {
        console.error(`mine: counting runs failed (${error?.code ?? 'none'})`);
        return 'busy';
      }
      return data;
    },
    async storeRun(player, seed, level, questions: Question[]) {
      const { error } = await admin.rpc('mine_store_run', { player, seed, level, questions });
      if (error) console.error(`mine: keeping the questions failed (${error.code ?? 'unknown'})`);
      return !error;
    },
    async loadRun(player, seed): Promise<StoredRun | null | 'busy'> {
      const { data, error } = await admin.rpc('mine_load_run', { player, seed });
      if (error) {
        console.error(`mine: loading the questions failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      if (!data) return null;
      const row = data as { level: string; questions: Question[]; answered: StoredRun['answered'] };
      return { level: row.level, questions: row.questions, answered: row.answered ?? {} };
    },
    async claimAnswer(player, seed, slot, value, right) {
      const { data, error } = await admin.rpc('mine_claim_answer', { player, seed, slot, value, right_answer: right });
      if (error) {
        console.error(`mine: marking an answer failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      return data === true;
    },
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'mine');
    },
    record: (player, report, run) =>
      call<SaveResult>('record_mine_run', {
        player,
        seed: report.seed,
        level: report.level,
        mode: report.mode,
        maths: report.maths,
        steps: run.steps,
        grants: run.grants.length,
        wrong: run.penalties,
        inputs: report.inputs,
        daily_limit: MINE_RUNS_PER_DAY,
      }),
  }),
);
