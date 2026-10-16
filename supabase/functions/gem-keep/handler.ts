/**
 * The gem-keep server function: the website sends its queue of things to save (finished
 * levels, Level Key rounds, times-table records, and once, the class-trial progress from the
 * device), and this checks each one and saves it. shared/gem-keep/save.ts has the checks.
 *
 * Items are handled in order and the reply says how many from the front are dealt with, so
 * the website can drop those from its queue and keep the rest for next time.
 */
import { checkItem, levelBefore, MAX_ITEMS, type ItemResult, type SaveItem } from '../../../shared/gem-keep/save';
import { findLevel } from '../../../shared/gem-keep/levels';
import type { FactStats } from '../../../shared/maths/leitner';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/**
 * A database answer. 'refused': the database said no to this item (it's dropped). 'too-many'
 * (the daily limit) and 'busy' (couldn't reach it): stop and keep the rest for later.
 */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  recordRun(player: string, run: RunRow): Promise<Outcome<{ status: 'saved' | 'duplicate' | 'locked'; points: number | null }>>;
  recordKey(player: string, levelId: string, right: number): Promise<Outcome<'passed' | 'already' | 'not-passed' | 'no-win'>>;
  recordFacts(player: string, pack: string, facts: FactStats[]): Promise<Outcome<number>>;
  importProgress(player: string, levels: { levelId: string; stars: number; keyPassed: boolean }[]): Promise<Outcome<'imported' | 'skipped'>>;
  /** Milliseconds since 1970. */
  now(): number;
}

/** What record_gem_keep_run() takes. */
export interface RunRow {
  runId: string;
  levelId: string;
  levelNumber: number;
  afterLevel: string | null;
  result: 'won' | 'lost';
  stars: number;
  waves: number;
  wavesTotal: number;
  gameSeconds: number;
  asked: number;
  right: number;
}

/** Requests one student may make a minute. The website sends one every few minutes. */
export const MAX_REQUESTS_PER_MINUTE = 20;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleGemKeep(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as { items?: unknown } | null;
    if (!body || !Array.isArray(body.items) || body.items.length > MAX_ITEMS) {
      return reply(400, { error: "That couldn't be read." });
    }

    const results: ItemResult[] = [];
    for (const raw of body.items) {
      const checked = checkItem(raw, services.now());
      if (!checked.ok) {
        // Logs say what was wrong, never who sent it. A bad item is dropped for good.
        console.warn(`gem-keep: refused an item (${checked.problem})`);
        results.push({ type: 'invalid', problem: checked.problem });
        continue;
      }
      const result = await save(player, checked.item, services);
      if (result === 'stop') break;
      results.push(result);
    }
    const stopped = results.length < body.items.length;
    if (stopped && results.length === 0) return reply(503, { error: "We couldn't save your Gem Keep progress just now." });
    return reply(200, { handled: results.length, results });
  };
}

function settle<T>(saved: Outcome<T>, ok: (value: T) => ItemResult): ItemResult | 'stop' {
  if (saved.ok) return ok(saved.value);
  if (saved.why === 'refused') return { type: 'invalid', problem: 'refused' };
  return 'stop';
}

async function save(player: string, item: SaveItem, services: Services): Promise<ItemResult | 'stop'> {
  switch (item.type) {
    case 'run': {
      const found = findLevel(item.levelId)!;
      const { type: _type, ...run } = item;
      const saved = await services.recordRun(player, {
        ...run,
        levelNumber: found.number,
        afterLevel: levelBefore(item.levelId),
        wavesTotal: found.level.waves.length,
      });
      return settle(saved, (value) => ({ type: 'run', ...value }));
    }
    case 'key': {
      const saved = await services.recordKey(player, item.levelId, item.right);
      return settle(saved, (status) => ({ type: 'key', status }));
    }
    case 'facts': {
      if (item.facts.length === 0) return { type: 'facts', changed: 0 };
      const saved = await services.recordFacts(player, item.pack, item.facts);
      return settle(saved, (changed) => ({ type: 'facts', changed }));
    }
    case 'import': {
      const saved = await services.importProgress(player, item.levels);
      return settle(saved, (status) => ({ type: 'import', status }));
    }
  }
}
