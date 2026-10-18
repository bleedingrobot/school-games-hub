// Connects the marble handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import type { MathsContext } from '../../../shared/marble/questions';
import { FLUENT_DAYS, QUICK_MS, TOP_BOX } from '../../../shared/maths/config';
import { groupByPack, parseFocus } from '../../../shared/maths/focus';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { stamper } from '../_shared/stamp';
import { MARBLE_RUNS_PER_DAY, makeHandler, type MarbleSettings, type Outcome, type SaveResult, type StoredRun } from './handler';

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
  console.error(`marble: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code === '54000') return { ok: false, why: 'too-many' };
  if (error.code && /^2[23]/.test(error.code)) return { ok: false, why: 'refused' };
  return { ok: false, why: 'busy' };
}

/** The same text always gives the same ID, so an answer sent twice is only counted once. */
async function batchIdFor(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`marble-maths:${text}`)));
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    stamp: stamper(key, 'marble-run'),
    async userIdFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    async settings(player): Promise<MarbleSettings | null> {
      // The switches of this student's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`marble: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { marble_maths?: string; marble_rescue?: boolean };
      return { maths: parseMathsSwitch(row.marble_maths), rescue: row.marble_rescue !== false };
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`marble: maths records failed (${error?.code ?? 'none'})`);
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
    async storeRun(player, seed, rescue, questions) {
      const { error } = await admin.rpc('marble_store_run', { player, seed, rescue, questions });
      if (error) console.error(`marble: keeping the questions failed (${error.code ?? 'unknown'})`);
      return !error;
    },
    async loadRun(player, seed): Promise<StoredRun | null | 'busy'> {
      const { data, error } = await admin.rpc('marble_load_run', { player, seed });
      if (error) {
        console.error(`marble: loading the questions failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      if (!data) return null;
      const row = data as { rescue: boolean; questions: Question[]; answered: StoredRun['answered'] };
      return { rescue: row.rescue, questions: row.questions, answered: row.answered ?? {} };
    },
    async claimAnswer(player, seed, slot, value, right) {
      const { data, error } = await admin.rpc('marble_claim_answer', { player, seed, slot, value, right_answer: right });
      if (error) {
        console.error(`marble: marking an answer failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      return data === true;
    },
    async recordAnswers(player, once, answers: FactAnswer[]) {
      // The records are kept per pack; the same text always makes the same batch, so a repeat is counted once.
      for (const [pack, group] of groupByPack(answers)) {
        const { error } = await admin.rpc('record_fact_answers', {
          player,
          pack,
          batch_id: await batchIdFor(`${once}:${pack}`),
          answers: group,
          quick_ms: QUICK_MS,
          fluent_days: FLUENT_DAYS,
          top_box: TOP_BOX,
        });
        // The game goes on if the records can't be updated.
        if (error) console.error(`marble: record answers failed (${error.code ?? 'unknown'})`);
      }
    },
    record: (player, report, run, extra) =>
      call<SaveResult>('record_marble_run', {
        player,
        seed: report.seed,
        course: report.course,
        mode: report.mode,
        maths: extra.maths,
        doors: extra.doors,
        steps: run.steps,
        falls: run.falls,
        checkpoints: run.checkpoints,
        held: run.held,
        inputs: report.inputs,
        daily_limit: MARBLE_RUNS_PER_DAY,
      }),
  }),
);
