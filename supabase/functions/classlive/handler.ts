/**
 * The Class Live server function (docs/CLASSLIVE-PLAN.md section 5). The steps themselves are in
 * shared/classlive/server.ts (so the tests and the `?pretend=30` preview run the same code); this checks sign-in, keeps a
 * request limit, reads the body and replies.
 *
 *   teacher: open, view, start, spotlight, end
 *   pupil:   join, play
 *
 * Every step checks the teacher's switch (`classlive_enabled` through `settings_of`): while it is off nothing opens or counts.
 */
import { classLiveStep, type ClassLiveServices } from '../../../shared/classlive/server';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export interface Services extends ClassLiveServices {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
}

/** Requests one person may make a minute: a pupil tries a fact at most every 1.5 seconds, so this stops a runaway page. */
export const MAX_REQUESTS_PER_MINUTE = 60;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleClassLive(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const who = token ? await services.userIdFor(token) : null;
    if (!who) return reply(401, { error: 'Please sign in again.' });
    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    // A Real-life Four Corners jail station answers for many pupils in turn (`as`): each pupil there gets the usual
    // allowance, and the station four times it in all (docs/JAIL-PLAN.md).
    const as = body && typeof body === 'object' && typeof body.as === 'string' ? body.as.slice(0, 40) : null;
    if (as ? !limiter.allow(`${who}:as:${as}`, MAX_REQUESTS_PER_MINUTE) || !limiter.allow(`${who}:station`, MAX_REQUESTS_PER_MINUTE * 4) : !limiter.allow(who, MAX_REQUESTS_PER_MINUTE)) {
      return reply(429, { error: 'Slow down a little!' });
    }
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    try {
      const out = await classLiveStep(services, who, body);
      return reply(out.status, out.body);
    } catch {
      // Logs say what failed, never who.
      console.error(`classlive: ${String(body.action).slice(0, 20)} failed`);
      return reply(500, { error: 'Something went wrong. Try again!' });
    }
  };
}
