// Connects the training handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { makeHandler, SAVE_LIMITS, type Outcome } from './handler';

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
  console.error(`training: ${name} failed (${error.code ?? 'unknown'})`);
  if (error.code === '54000') return { ok: false, why: 'too-many' };
  // Bad data (22xxx) or a broken rule (23xxx): that item will never save, so it's dropped.
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
    recordAnswers: (player, item) =>
      call('record_training_answers', {
        player,
        batch_id: item.batchId,
        seed: item.seed,
        answers: item.answers,
        keep_per_fact: SAVE_LIMITS.keepPerFact,
        daily_limit: SAVE_LIMITS.dailyLimit,
      }),
    recordStudent: (player, item) =>
      call('record_training_student', {
        player,
        typing: item.typing,
        auto_submit: item.autoSubmit,
        sessions_done: item.sessionsDone,
      }),
  }),
);
