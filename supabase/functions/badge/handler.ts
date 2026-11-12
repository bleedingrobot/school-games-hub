/**
 * The QR badge sign-in function (docs/BADGE-SIGN-IN-PLAN.md). A young pupil scans the card their teacher printed; the page
 * sends the card's code here, and gets back a one-time sign-in key for that pupil's own account. Nobody is signed in yet,
 * so there's no session token to check: the long random code on the card is what proves who it is.
 */
import { corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export interface Services {
  now(): number;
  /** The email of the student whose badge has this code, or null (a wrong or replaced card), or 'busy'. */
  emailForBadge(code: string): Promise<string | null | 'busy'>;
  /** A one-time key that signs this account in (its hash, for verifyOtp), or 'busy'. */
  signInKeyFor(email: string): Promise<string | 'busy'>;
}

/**
 * Scans one internet address may make a minute. A whole school usually shares one address, and several classes may sign
 * in at once at 9 am, so this is generous. Guessing a code is hopeless anyway (122 random bits).
 */
export const MAX_SCANS_PER_MINUTE = 300;

/** Wrong codes one address may try a minute: a class scanning old cards by mistake stays well under this. */
export const MAX_WRONG_PER_MINUTE = 20;

export const BADGE_CODE = /^[0-9a-f]{32}$/;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());
  /** When each address last tried a wrong code, so a run of wrong codes can be slowed down. */
  const wrongAt = new Map<string, number[]>();
  const recentWrong = (from: string) => (wrongAt.get(from) ?? []).filter((t) => services.now() - t < 60_000);

  return async function handleBadgeRequest(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const from = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!limiter.allow(from, MAX_SCANS_PER_MINUTE)) return reply(429, { error: 'Too many scans. Wait a minute and try again.' });

    const raw = (await readJsonBody(request)) as { code?: unknown } | null;
    const code = typeof raw?.code === 'string' ? raw.code.trim().toLowerCase() : '';
    if (!BADGE_CODE.test(code)) return reply(400, { error: 'That isn’t a sign-in badge.' });

    if (recentWrong(from).length >= MAX_WRONG_PER_MINUTE) return reply(429, { error: 'Too many scans. Wait a minute and try again.' });
    const email = await services.emailForBadge(code);
    if (email === 'busy') return reply(503, { error: 'Sign-in is busy. Try again in a minute.' });
    if (!email) {
      if (wrongAt.size > 5000) wrongAt.clear();
      wrongAt.set(from, [...recentWrong(from), services.now()]);
      return reply(404, { error: 'That badge doesn’t work any more. Ask your teacher for a new one.' });
    }

    const key = await services.signInKeyFor(email);
    if (key === 'busy') return reply(503, { error: 'Sign-in is busy. Try again in a minute.' });
    return reply(200, { key });
  };
}
