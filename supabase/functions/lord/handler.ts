/**
 * The lord server function (Dragon Maths, docs/LORD-PLAN.md stage L.4). The server is the boss: it hands out
 * every fight, replays the actions the pupil played before paying anything, marks every maths answer itself and
 * keeps the hero. The rules live in shared/lord/server.ts (the same code the browser trial runs); this file is
 * the front door: who is asking, how often, and what a request may look like.
 *
 * WHAT HAPPENS TO A REQUEST THE CHECKS DON'T LIKE (written down, as for Maths Monsters):
 *  - nothing about the hero changes, and the reply says `ok: false` with a short reason and the current state;
 *  - the website carries on from that state without scary words ("that fight couldn't be saved, you can play it
 *    again from the start");
 *  - a short code goes in `lord_refusals` for the teacher page (never the request itself), and in the function
 *    log without who sent it;
 *  - an old version or a repeated request id is not a fault: it is told "already done" or "out of date" and handed
 *    the current state.
 */
import { runLord, type Services } from '../../../shared/lord/server';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export type HandlerServices = Services & {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
};

/** Requests one student may make a minute. A fight is two requests; the number game up to eight. */
export const MAX_REQUESTS_PER_MINUTE = 60;

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A batch id for the answers of one request and pack: the same request always gives the same id, so a retry is never counted twice. */
export async function batchIdFor(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lord:${key}`)));
  const h = hex(digest.slice(0, 16));
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function makeHandler(services: HandlerServices) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleLord(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = await readJsonBody(request);
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });

    const out = await runLord(services, player, body);
    if (out.body && 'ok' in out.body && !out.body.ok && ['tampered', 'not-allowed', 'bad-request'].includes(out.body.reason)) {
      console.warn(`lord: turned a request down (${out.body.reason})`);
    }
    return reply(out.status, out.body);
  };
}
