// Connects the power-clash handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { userIdFromToken } from '../_shared/signIn';
import { powerClashHandler, type PowerGameRow } from './handler';

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

const games = () => admin.from('power_games');

/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step: string, code: string | undefined) {
  console.error(`power-clash: ${step} failed (${code ?? 'unknown'})`);
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

Deno.serve(
  powerClashHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    userIdFor: userIdFromToken(admin.auth),
    async playerStatus(player, others = []) {
      const { data, error } = await admin.rpc('power_player_status', { player, others }).maybeSingle();
      if (error || !data) {
        if (error) logProblem('player check', error.code);
        return null;
      }
      const row = data as {
        school: boolean;
        hidden: boolean;
        multiplayer_enabled: boolean;
        created_last_hour: number;
        school_id: number | null;
        gone: string[] | null;
      };
      return {
        school: row.school,
        hidden: row.hidden,
        multiplayerEnabled: row.multiplayer_enabled,
        createdLastHour: row.created_last_hour,
        schoolId: row.school_id ?? null,
        gone: row.gone ?? [],
      };
    },
    async loadGame(id) {
      if (!isUuid(id)) return null;
      const { data, error } = await games().select('*').eq('id', id).maybeSingle();
      if (error) logProblem('load', error.code);
      return (data as PowerGameRow | null) ?? null;
    },
    async findWaitingByCode(code) {
      const { data, error } = await games().select('*').eq('code', code).eq('status', 'waiting').maybeSingle();
      if (error) logProblem('find code', error.code);
      return (data as PowerGameRow | null) ?? null;
    },
    async codeTaken(code) {
      const { data, error } = await admin.rpc('waiting_code_taken', { code });
      if (error) logProblem('check code', error.code);
      return data === true;
    },
    async findWaitingHostedBy(player) {
      const { data, error } = await games().select('*').eq('host', player).eq('status', 'waiting').maybeSingle();
      if (error) logProblem('find waiting', error.code);
      return (data as PowerGameRow | null) ?? null;
    },
    async insertGame(row) {
      const { data, error } = await games().insert(row).select('*').single();
      if (!error) return data as PowerGameRow;
      if (error.code === '23505') {
        return error.message.includes('one_waiting_each') ? 'already-waiting' : 'code-taken';
      }
      logProblem('create', error.code);
      return 'failed';
    },
    async updateGame(id, version, patch) {
      // "Only if it's still at this version": the database checks and changes in one step.
      const { data, error } = await games().update(patch).eq('id', id).eq('version', version).select('*').maybeSingle();
      if (error) logProblem('save', error.code);
      return (data as PowerGameRow | null) ?? null;
    },
  }),
);
