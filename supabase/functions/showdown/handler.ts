/**
 * The Class Showdown server function (docs/SHOWDOWN-PLAN.md section 6). The steps themselves are in
 * shared/showdown/server.ts (so the tests and the `?pretend=30` preview run the same code); this checks sign-in, keeps a
 * request limit, reads the body and replies.
 *
 *   teacher: open, view, teams, start, tick (the projector, once a second), enrage, pause, end
 *   pupil:   join, choose, ask, answer
 *
 * Every step checks the teacher's switch (`showdown_enabled` through `settings_of`): while it is off nothing opens or counts.
 */
import { showdownStep, type ShowdownServices } from '../../../shared/showdown/server';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export interface Services extends ShowdownServices {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
}

/**
 * Requests one person may make a minute: the projector ticks once a second, and a pupil answers at most every 4 seconds
 * (plus a few asks and role picks), so this leaves room for both and stops a runaway page.
 */
export const MAX_REQUESTS_PER_MINUTE = 120;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleShowdown(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const who = token ? await services.userIdFor(token) : null;
    if (!who) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(who, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    try {
      const out = await showdownStep(services, who, body);
      return reply(out.status, out.body);
    } catch {
      // Logs say what failed, never who.
      console.error(`showdown: ${String(body.action).slice(0, 20)} failed`);
      return reply(500, { error: 'Something went wrong. Try again!' });
    }
  };
}
