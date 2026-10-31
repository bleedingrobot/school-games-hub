// Connects the trader handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions -- trader` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import type { MathsContext } from '../../../shared/trader/questions';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { MARKET_DEPTH_DAYS } from '../../../shared/trader/config';
import { MARKET_RULES, type SchoolView } from '../../../shared/trader/schoolMarket';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
import { makeHandler, type ClassSettings, type Saved, type StoredDay } from './handler';

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

/** Logs say which database function failed and the error code, never who. */
const fail = (name: string, code: string | undefined) => console.error(`trader: ${name} failed (${code ?? 'unknown'})`);

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
    randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join(''),
    userIdFor: userIdFromToken(admin.auth),
    async settings(player): Promise<ClassSettings | null> {
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error || !data) {
        fail('settings', error?.code);
        return null;
      }
      const row = data as { trader_enabled?: boolean; trader_jumps?: number; trader_loans?: boolean; trader_maths?: string };
      return {
        enabled: row.trader_enabled === true,
        jumpsPerDay: Number.isInteger(row.trader_jumps) ? (row.trader_jumps as number) : 10,
        loans: row.trader_loans !== false,
        // 'choose' counts as on until pupils get a switch of their own (stage T.5).
        maths: parseMathsSwitch(row.trader_maths) !== 'off',
      };
    },
    async schoolSeed(player) {
      const { data, error } = await admin.rpc('trader_school_seed', { player });
      if (error || !data) {
        fail('trader_school_seed', error?.code);
        return null;
      }
      const row = data as { seed: string; season: number };
      return { seed: row.seed, season: row.season };
    },
    async loadGame(player): Promise<Saved | null | 'busy'> {
      const { data, error } = await admin.rpc('trader_load', { player });
      if (error) {
        fail('trader_load', error.code);
        return 'busy';
      }
      if (!data) return null;
      const row = data as { game: Saved['game']; version: number; season: number };
      return { game: row.game, version: row.version, season: row.season };
    },
    async request(player, requestId) {
      const { data, error } = await admin.rpc('trader_request', { player, request_id: requestId });
      if (error) {
        fail('trader_request', error.code);
        return 'busy';
      }
      return data ?? null;
    },
    async loadDay(player, day): Promise<StoredDay | null | 'busy'> {
      const { data, error } = await admin.rpc('trader_load_day', { player, day });
      if (error) {
        fail('trader_load_day', error.code);
        return 'busy';
      }
      if (!data) return null;
      const row = data as { questions: Question[]; answered: StoredDay['answered'] };
      return { questions: row.questions, answered: row.answered ?? {} };
    },
    async storeDay(player, day, questions) {
      const { error } = await admin.rpc('trader_store_day', { player, day, questions });
      if (error) fail('trader_store_day', error.code);
      return !error;
    },
    async mathsContext(player): Promise<MathsContext | null> {
      const { data, error } = await admin.rpc('space_maths_context', { player });
      if (error || !data) {
        fail('space_maths_context', error?.code);
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
        focus: parseFocus(context.focus),
        settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    async market(player, day): Promise<SchoolView | null> {
      const { data, error } = await admin.rpc('trader_market', { player, today: day, keep_pct: MARKET_RULES.keep });
      if (error || !data) {
        fail('trader_market', error?.code);
        return null;
      }
      const row = data as Partial<SchoolView>;
      return { pushes: Array.isArray(row.pushes) ? row.pushes : [], news: Array.isArray(row.news) ? row.news : [] };
    },
    async save(player, a) {
      const { data, error } = await admin.rpc('trader_save', {
        player,
        expected_version: a.expectedVersion,
        new_game: a.game,
        new_day: a.day,
        new_net_worth: Math.max(-2_000_000_000, Math.min(2_000_000_000, Math.round(a.netWorth))),
        new_moon: a.game.t.moon,
        new_season: a.season,
        request_id: a.requestId,
        reply: a.reply,
        claims: a.claims,
        market: a.market.length ? { pushes: a.market, ...MARKET_RULES, days: MARKET_DEPTH_DAYS } : null,
      });
      if (error) {
        fail('trader_save', error.code);
        return 'busy';
      }
      return typeof data === 'number' ? data : null;
    },
    async recordAnswers(player, once, answers: FactAnswer[]) {
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'trader');
    },
  }),
);
