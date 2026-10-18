// Connects the card-game handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { secureDice } from '../../../shared/card101/random';
import { cardGameHandler, type CardGameRow } from './handler';

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

const games = () => admin.from('card_games');

/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step: string, code: string | undefined) {
  console.error(`card-game: ${step} failed (${code ?? 'unknown'})`);
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

Deno.serve(
  cardGameHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    dice: secureDice,
    newId: () => crypto.randomUUID(),
    async userIdFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    async playerStatus(player, others = []) {
      const { data, error } = await admin.rpc('card_player_status', { player, others }).maybeSingle();
      if (error || !data) {
        if (error) logProblem('player check', error.code);
        return null;
      }
      const row = data as { school: boolean; hidden: boolean; multiplayer_enabled: boolean; created_last_hour: number; school_id: number | null; gone: string[] | null };
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
      return (data as CardGameRow | null) ?? null;
    },
    async findWaitingByCode(code) {
      const { data, error } = await games().select('*').eq('code', code).eq('status', 'waiting').maybeSingle();
      if (error) logProblem('find code', error.code);
      return (data as CardGameRow | null) ?? null;
    },
    async codeTaken(code) {
      const { data, error } = await admin.rpc('waiting_code_taken', { code });
      if (error) logProblem('check code', error.code);
      return data === true;
    },
    async findWaitingHostedBy(player) {
      const { data, error } = await games().select('*').eq('host', player).eq('status', 'waiting').maybeSingle();
      if (error) logProblem('find waiting', error.code);
      return (data as CardGameRow | null) ?? null;
    },
    async write(expected, row, seats) {
      // The game and every seat row in one step; "only if it's still at this version".
      const { data, error } = await admin
        .rpc('card_game_write', { expected_version: expected, game_row: row, seats })
        .maybeSingle();
      if (error) {
        if (error.code === '23505') return error.message.includes('one_waiting_each') ? 'already-waiting' : 'code-taken';
        logProblem('save', error.code);
        return 'failed';
      }
      return (data as CardGameRow | null) ?? 'changed';
    },
  }),
);
