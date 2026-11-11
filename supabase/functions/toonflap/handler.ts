/**
 * The Toon Flap server function (docs/TOON-FLAP-PLAN.md, stage F.3). This file checks who is asking and how often;
 * what each action does is in shared/toonflap/server.ts, which the preview runs too.
 */
import { handleToonFlap, type ToonFlapServices } from '../../../shared/toonflap/server';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export interface Services extends ToonFlapServices {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
}

/** Requests one pupil may make a minute (a level is a start, up to 4 checks and a finish: about 6). */
export const MAX_REQUESTS_PER_MINUTE = 40;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleToonFlapRequest(request: Request): Promise<Response> {
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
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reply(400, { error: 'That couldn’t be read.' });
    const r = await handleToonFlap(services, player, raw as Record<string, unknown>);
    return reply(r.status, r.body);
  };
}
