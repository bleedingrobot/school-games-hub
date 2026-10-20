/**
 * The bond-match server function: the website sends its queue of finished games, and this replays
 * each one with the same engine the website uses (shared/bond-match/save.ts), ignores any stars or
 * flip counts the browser claims, and saves it once per run id. Bond Match never writes to a
 * student's fact records: only the game, the bests, the stars and the small capped points.
 *
 * Items are handled in order and the reply says how many from the front are dealt with, so the
 * website can drop those from its queue and keep the rest for next time.
 */
import { checkItem, MAX_ITEMS, type GameMode, type SaveResponse, type SaveResult } from '../../../shared/bond-match/save';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/**
 * A database answer. 'refused': the database said no to this item (it's dropped). 'too-many'
 * (the daily limit) and 'busy' (couldn't reach it): stop and keep the rest for later.
 */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

/** What record_bond_match_game() takes: the game, with the server's own flip count and stars. */
export interface GameRow {
  runId: string;
  /** 'solo', or a two-player ('pass') or against-the-computer ('bot') game, which doesn't change bests. */
  mode: GameMode;
  bondId: string;
  size: string;
  seed: number;
  flips: number[];
  flipCount: number;
  seconds: number;
  stars: number;
}

export type Saved = Extract<SaveResult, { status: 'saved' | 'duplicate' }>;

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Is Bond Match switched on for this student's class? Null if the settings couldn't be read. */
  isOn(player: string): Promise<boolean | null>;
  recordGame(player: string, game: GameRow): Promise<Outcome<Saved>>;
}

/** Requests one student may make a minute. The website sends one when a game ends. */
export const MAX_REQUESTS_PER_MINUTE = 20;

export function makeHandler(services: Services, now: () => number = () => Date.now()) {
  const limiter = new RateLimiter(now);

  return async function handleBondMatch(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    // Switched off for their class: nothing is saved, and the website keeps its queue in case it's switched back on.
    const on = await services.isOn(player);
    if (on === null) return reply(503, { error: "We couldn't save your game just now." });
    if (!on) return reply(403, { error: 'Bond Match isn’t switched on for your class.' });

    const body = (await readJsonBody(request)) as { items?: unknown } | null;
    if (!body || !Array.isArray(body.items) || body.items.length > MAX_ITEMS) {
      return reply(400, { error: "That couldn't be read." });
    }

    const results: SaveResult[] = [];
    for (const raw of body.items) {
      const checked = checkItem(raw);
      if (!checked.ok) {
        // Logs say what was wrong, never who sent it. A bad item is dropped for good.
        console.warn(`bond-match: refused an item (${checked.problem})`);
        results.push({ status: 'invalid', problem: checked.problem });
        continue;
      }
      const { item, score } = checked;
      // The flip count and stars are the server's own, from its replay.
      const saved = await services.recordGame(player, { ...item, flipCount: score.flips, stars: score.stars });
      if (saved.ok) {
        results.push(saved.value);
      } else if (saved.why === 'refused') {
        results.push({ status: 'invalid', problem: 'refused' });
      } else {
        break;
      }
    }
    if (results.length < body.items.length && results.length === 0) {
      return reply(503, { error: "We couldn't save your game just now." });
    }
    const response: SaveResponse = { handled: results.length, results };
    return reply(200, response);
  };
}
