/**
 * The clans server function (Clan Quest, stage C.5 part A). The website sends one action at a time ("buy this",
 * "wake her", "do today's quest with this answer"); this loads the clan, runs the very same shared/clans rules the
 * screens use, and saves the result. The browser is never believed about gold, levels, days or prizes.
 *
 * Every request carries an id the browser made. If the same id arrives twice (a slow connection, a double tap)
 * the first answer is sent back and nothing is paid again. If two requests race, the database refuses the second
 * save (its copy was old), and this loads again and redoes the action.
 *
 * Not here yet: mine fights, the midnight job and raids on classmates (part B and stage C.6).
 */
import { applyAction, parseAction, type Result, type ServerState } from '../../../shared/clans/actions';
import { nzDayNumber } from '../../../shared/clans/clock';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalSettings } from '../../../shared/maths/practical';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** A database answer. 'refused': the database said no (bad data). 'busy': it couldn't be reached. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'refused' | 'busy' };

/** What load_clan() gives back. `state` is null until the student has made a clan. */
export interface Loaded {
  seed: number;
  version: number;
  state: ServerState | null;
  /** The answer kept for this request id, if it was already done. */
  replay: Result | null;
}

export type SaveStatus = { status: 'saved'; version: number } | { status: 'duplicate'; result: Result } | { status: 'stale' };

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  load(player: string, requestId: string): Promise<Outcome<Loaded>>;
  save(player: string, expectedVersion: number, requestId: string, action: string, state: ServerState, result: Result): Promise<Outcome<SaveStatus>>;
  /** Milliseconds since 1970. */
  now(): number;
  /** The teacher's maths settings. Until the Teacher page (stage C.6) this is the defaults. */
  settings?(): PracticalSettings;
}

/** Requests one student may make a minute. A busy minute in the shop is about ten. */
export const MAX_REQUESTS_PER_MINUTE = 40;
/** How many times a request is redone after another one saved first. */
export const MAX_TRIES = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the browser is told about a clan: everything it shows, nothing it could use to cheat. */
export function publicState(state: ServerState, settings: PracticalSettings) {
  const { clan, seed, day, fightsLeft, fightNo, raidNo, examined } = state;
  return { clan, seed, day, fightsLeft, fightNo, raidNo, examined, settings };
}

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleClans(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as { requestId?: unknown; action?: unknown } | null;
    const action = body ? parseAction(body.action) : null;
    if (!body || typeof body.requestId !== 'string' || !UUID.test(body.requestId) || !action) {
      // Logs say what was wrong, never who sent it.
      console.warn('clans: refused a request that could not be read');
      return reply(400, { error: "That couldn't be read." });
    }
    const requestId = body.requestId.toLowerCase();
    const settings = services.settings?.() ?? DEFAULT_PRACTICAL_SETTINGS;
    const today = nzDayNumber(services.now());

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const loaded = await services.load(player, requestId);
      if (!loaded.ok) return loaded.why === 'busy' ? reply(503, { error: "We couldn't reach your clan just now." }) : reply(400, { error: "That couldn't be read." });
      const { seed, version, state, replay } = loaded.value;

      // Done before: the same answer, and the clan as it is now.
      if (replay) return reply(200, { ok: true, replayed: true, seed, state: state && publicState(state, settings), result: replay });

      const applied = applyAction(state, action, { seed, today, settings });
      if (!applied.ok) {
        // Refused: nothing is saved. The browser is shown the clan as it should be (after the night's rest, if a new day began).
        const current = state && applyAction(state, { type: 'load' }, { seed, today, settings });
        return reply(200, { ok: false, why: applied.why, say: applied.say, seed, state: current && current.ok && current.state ? publicState(current.state, settings) : null });
      }
      if (!applied.changed || !applied.state) {
        return reply(200, { ok: true, replayed: false, seed, state: applied.state && publicState(applied.state, settings), result: applied.result });
      }

      const saved = await services.save(player, version, requestId, action.type, applied.state, applied.result);
      if (!saved.ok) return saved.why === 'busy' ? reply(503, { error: "We couldn't save your clan just now." }) : reply(400, { error: "That couldn't be saved." });
      if (saved.value.status === 'saved') {
        return reply(200, { ok: true, replayed: false, seed, state: publicState(applied.state, settings), result: applied.result });
      }
      // 'duplicate' or 'stale': another copy of this request, or another request, saved first. Load again.
    }
    return reply(409, { error: 'Your clan was busy. Please try that again.' });
  };
}
