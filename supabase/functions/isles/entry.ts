// Connects the isles handler to Supabase. Edit handler.ts (or shared/isles/server.ts) for the logic, then run
// `npm run build:functions -- isles` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import type { QuestionSet, SavedIsland, StoredRace } from '../../../shared/isles/server';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
import { makeHandler } from './handler';

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

/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T | 'busy'> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return data as T;
  console.error(`isles: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

/** A race row as the database gives it (a bigint id comes back as a number or a string). */
const raceOf = (row: (StoredRace & { id: number | string }) | null): StoredRace | null => (row ? { ...row, id: Number(row.id) } : null);

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      // The switches of this pupil's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        console.error(`isles: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { isles_enabled?: boolean; isles_races?: boolean };
      return { enabled: row.isles_enabled === true, races: row.isles_races !== false };
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        console.error(`isles: maths records failed (${error?.code ?? 'none'})`);
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
        // Anything odd counts as no focus.
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      } as MathsContext;
    },
    async load(player) {
      const r = await call<{ saved: SavedIsland | null; classMiddle: number; openRace: (StoredRace & { id: number | string }) | null; racesThisSeason: number }>(
        'isles_load', { player });
      if (r === 'busy') return r;
      return { saved: r.saved, classMiddle: Number(r.classMiddle) || 0, openRace: raceOf(r.openRace), racesThisSeason: r.racesThisSeason };
    },
    start: (player, seed, island, day) => call<boolean>('record_isles_start', { player, seed, island, day }),
    saveTurn: (player, expectedVersion, island, day, turn) =>
      call<boolean>('record_isles_turn', {
        player, expected_version: expectedVersion, island, day, turn: turn.turn, windy: turn.windy, actions: turn.actions, report: turn.report,
      }),
    storeQuestions: (player, set) => call<QuestionSet>('record_isles_questions', { player, id: set.id, ref: set.ref, questions: set.questions }),
    questions: (player, by) =>
      call<QuestionSet | null>('isles_question_set', { player, id: 'id' in by ? by.id : null, ref: 'ref' in by ? by.ref : null }),
    claimAnswer: (player, setId, slot, value, right) =>
      call<boolean>('record_isles_answer', { player, id: setId, slot, value, right_answer: right }),
    async raceStart(player, race, day, turn) {
      const id = await call<number | string | null>('record_isles_race_start', {
        player, seed: race.seed, opponent: race.opponent, starter: race.starter, you: race.you, them: race.them, day, turn,
      });
      return id === 'busy' || id === null ? id : Number(id);
    },
    async race(player, id) {
      const r = await call<(StoredRace & { id: number | string }) | null>('isles_race', { player, race: id });
      return r === 'busy' ? r : raceOf(r);
    },
    raceFinish: (player, id, expectedVersion, island, day, result, prize) =>
      call<boolean>('record_isles_race_finish', { player, race: id, expected_version: expectedVersion, island, day, result, prize }),
    guideDone: (player) => call<boolean>('record_isles_guide_done', { player }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'isles');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'isles', points, once });
      if (error) console.error(`isles: points failed (${error.code ?? 'unknown'})`);
    },
  }),
);
