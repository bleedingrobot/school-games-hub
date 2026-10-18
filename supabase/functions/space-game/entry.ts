// Connects the space-game handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { FLUENT_DAYS, QUICK_MS, TOP_BOX } from '../../../shared/maths/config';
import type { FactStats } from '../../../shared/maths/leitner';
import { packIdOfKey, parseFocus } from '../../../shared/maths/focus';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { spaceGameHandler, type SpaceGameRow } from './handler';

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

const games = () => admin.from('space_games');

/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step: string, code: string | undefined) {
  console.error(`space-game: ${step} failed (${code ?? 'unknown'})`);
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** The same text always gives the same ID, so an answer sent twice is only counted once. */
async function batchIdFor(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`space-maths:${text}`)));
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

Deno.serve(
  spaceGameHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    async userIdFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    async playerStatus(player, others = []) {
      const { data, error } = await admin.rpc('space_player_status', { player, others }).maybeSingle();
      if (error || !data) {
        if (error) logProblem('player check', error.code);
        return null;
      }
      const row = data as {
        school: boolean;
        hidden: boolean;
        multiplayer_enabled: boolean;
        reactions_enabled: boolean;
        created_last_hour: number;
        school_id: number | null;
        gone: string[] | null;
      };
      return {
        school: row.school,
        hidden: row.hidden,
        multiplayerEnabled: row.multiplayer_enabled,
        reactionsEnabled: row.reactions_enabled,
        createdLastHour: row.created_last_hour,
        schoolId: row.school_id ?? null,
        gone: row.gone ?? [],
      };
    },
    async loadGame(id) {
      if (!isUuid(id)) return null;
      const { data, error } = await games().select('*').eq('id', id).maybeSingle();
      if (error) logProblem('load', error.code);
      return (data as SpaceGameRow | null) ?? null;
    },
    async findWaitingByCode(code) {
      const { data, error } = await games().select('*').eq('code', code).eq('status', 'waiting').maybeSingle();
      if (error) logProblem('find code', error.code);
      return (data as SpaceGameRow | null) ?? null;
    },
    async friendCodeTaken(code) {
      const { count, error } = await admin
        .from('mp_games')
        .select('id', { count: 'exact', head: true })
        .eq('code', code)
        .eq('status', 'waiting');
      if (error) logProblem('check code', error.code);
      return (count ?? 0) > 0;
    },
    async findWaitingHostedBy(player) {
      const { data, error } = await games().select('*').eq('host', player).eq('status', 'waiting').maybeSingle();
      if (error) logProblem('find waiting', error.code);
      return (data as SpaceGameRow | null) ?? null;
    },
    async insertGame(row) {
      const { data, error } = await games().insert(row).select('*').single();
      if (!error) return data as SpaceGameRow;
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
      return (data as SpaceGameRow | null) ?? null;
    },
    async addReaction(id, seat, emoji) {
      const { data, error } = await admin.rpc('space_add_reaction', { game_id: id, seat, emoji });
      if (error) {
        logProblem('reaction', error.code);
        return 'not-allowed';
      }
      return data as 'ok' | 'too-soon' | 'too-many' | 'not-playing' | 'not-allowed';
    },
    async mathsSwitch(player) {
      // The switch of this student's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error) logProblem('maths switch', error.code);
      // If it can't be read, maths stays off rather than switching on by accident.
      return parseMathsSwitch((data as { space_maths?: string } | null)?.space_maths);
    },
    async loadMathsContext(player) {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        logProblem('maths records', error?.code);
        return null;
      }
      const context = data as {
        facts: FactStats[];
        settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null; multipleChoice?: boolean };
        focus?: unknown;
      };
      const { enabledTables, division, missingFactor, multipleChoice } = context.settings;
      return {
        facts: context.facts,
        // Anything odd counts as no focus: the questions are then the times-table step, as before.
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    async loadQuestion(game, seat, kind) {
      const { data, error } = await admin
        .from('space_game_questions')
        .select('stamp, question, asked_at, answered')
        .eq('game', game)
        .eq('seat', seat)
        .eq('kind', kind)
        .maybeSingle();
      if (error) logProblem('load question', error.code);
      if (!data) return null;
      return { stamp: data.stamp, question: data.question, askedAt: Date.parse(data.asked_at), answered: data.answered };
    },
    async saveQuestion(game, seat, kind, stamp, question) {
      const { error } = await admin
        .from('space_game_questions')
        .upsert({ game, seat, kind, stamp, question, asked_at: new Date().toISOString(), answered: false });
      if (error) logProblem('save question', error.code);
    },
    async claimQuestion(game, seat, kind) {
      // "Only if it isn't answered yet": the database checks and changes in one step.
      const { data, error } = await admin
        .from('space_game_questions')
        .update({ answered: true })
        .eq('game', game)
        .eq('seat', seat)
        .eq('kind', kind)
        .eq('answered', false)
        .select('seat');
      if (error) logProblem('claim question', error.code);
      return (data?.length ?? 0) > 0;
    },
    async dropQuestion(game, seat, kind) {
      const { error } = await admin.from('space_game_questions').delete().eq('game', game).eq('seat', seat).eq('kind', kind);
      if (error) logProblem('drop question', error.code);
    },
    async recordAnswer(player, once, answer) {
      const { error } = await admin.rpc('record_fact_answers', {
        player,
        pack: packIdOfKey(answer.key) ?? 'times-tables',
        batch_id: await batchIdFor(once),
        answers: [answer],
        quick_ms: QUICK_MS,
        fluent_days: FLUENT_DAYS,
        top_box: TOP_BOX,
      });
      // The game goes on if the records can't be updated.
      if (error) logProblem('record answer', error.code);
    },
  }),
);
