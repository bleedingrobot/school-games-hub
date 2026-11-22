// Connects the circuit handler to Supabase. Edit handler.ts (or shared/circuit/game.ts) for the logic, then run
// `npm run build:functions -- circuit` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { racerById, type RoadProgress } from '../../../shared/circuit/game';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { isUnlimitedFor } from '../../../shared/unlimited';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
import { stamper } from '../_shared/stamp';
import { makeHandler, type SaveStatus, type StoredGo } from './handler';

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
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
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
      const row = data as { circuit_enabled?: boolean; unlimited_days?: unknown; circuit_maths?: unknown };
      return { enabled: row.circuit_enabled === true, unlimited: isUnlimitedFor(row.unlimited_days, 'circuit'), maths: parseMathsSwitch(row.circuit_maths) };
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`circuit: maths records failed (${error?.code ?? 'none'})`);
        return null;
      }
      const context = data as {
        facts: MathsContext['facts'];
        settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean };
        focus?: unknown;
      };
      const { enabledTables, division, missingFactor, multipleChoice } = context.settings ?? {};
      return {
        facts: context.facts ?? [],
        // Anything odd counts as no focus (auto).
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    async storeQuestions(player, seed, questions) {
      const { error } = await admin.rpc('circuit_store_questions', { player, seed, questions });
      if (error) console.error(`circuit: keeping the questions failed (${error.code ?? 'unknown'})`);
      return !error;
    },
    async loadQuestions(player, seed): Promise<StoredGo | null | 'busy'> {
      const { data, error } = await admin.rpc('circuit_load_questions', { player, seed });
      if (error) {
        console.error(`circuit: loading the questions failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      if (!data) return null;
      const row = data as { questions: Question[]; answered: StoredGo['answered'] | null };
      return { questions: row.questions, answered: row.answered ?? {} };
    },
    async claimAnswer(player, seed, slot, value, right) {
      const { data, error } = await admin.rpc('circuit_claim_answer', { player, seed, slot, value, right_answer: right });
      if (error) {
        console.error(`circuit: marking an answer failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      return data === true;
    },
    async recordAnswers(player, once, answers) {
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'circuit');
    },
    async load(player) {
      const saved = await call<{ roads: Record<string, RoadProgress> | null; today: number; racer?: string | null } | null>('circuit_load', { player });
      if (saved === 'busy') return 'busy';
      const racer = racerById(saved?.racer)?.id;
      return { roads: saved?.roads ?? {}, today: saved?.today ?? 0, ...(racer ? { racer } : {}) };
    },
    async setRacer(player, racer) {
      const done = await call<boolean>('circuit_set_racer', { player, racer });
      return done === 'busy' ? 'busy' : done === true;
    },
    async record(player, f) {
      const saved = await call<{ status: SaveStatus; today: number }>('record_circuit_finish', {
        player, road: f.road, needs: f.needs?.roads ?? null, need: f.needs?.count ?? 0, seed: f.seed, steps: f.steps, medal: f.medal,
        clean: f.clean, charged: f.charged, inputs: f.inputs, unlimited: f.unlimited, hard: f.hard,
      });
      return saved;
    },
  }),
);
