/**
 * The Sky Isles server function (docs/ISLES-PLAN.md, section 8). This file checks who is asking and how often; what
 * each action does is in shared/isles/server.ts, which the preview will run too.
 */
import { handleIsles, type IslesServices } from '../../../shared/isles/server';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export interface Services extends IslesServices {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
}

/** Requests one pupil may make a minute (a turn is a load, an answer and the turn; a race is up to five). */
export const MAX_REQUESTS_PER_MINUTE = 60;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleIslesRequest(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const raw = await readJsonBody(request);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reply(400, { error: "That couldn't be read." });
    const r = await handleIsles(services, player, raw as Record<string, unknown>);
    return reply(r.status, r.body);
  };
}
