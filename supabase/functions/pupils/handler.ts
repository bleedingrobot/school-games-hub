/**
 * The "pupils" server function (docs/plans/badge-review/ADD-PUPILS.md): a teacher adds pupils who have never signed in.
 *
 * - `{ emails }`: makes a sign-in account for each school email that has none yet (the database says which may be made),
 *   so the pupil has a badge from day one. The page then puts them in the class with teacher_add_pupils_by_email. When the
 *   pupil later signs in with Google, the sign-in service joins that to the same account (same checked email).
 * - `{ link }`: reads the emails out of a Google Doc or Sheet the teacher shared as "anyone with the link can view".
 *
 * Only signed-in teachers get anything (the database checks the role and school); nothing here deletes anything.
 */
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { emailsIn, exportUrlFor } from '../../../shared/pupils/emails';
import { RateLimiter } from '../_shared/limits';

export { emailsIn, exportUrlFor };

export interface Services {
  now(): number;
  userIdFor(token: string): Promise<string | null>;
  /** Of these emails, the ones this teacher may make new pupil accounts for. Empty if they aren't a teacher. */
  mayCreate(teacher: string, emails: string[]): Promise<string[] | 'busy'>;
  /** Makes one pupil account (email checked, no password, nothing emailed). 'exists' if it was made a moment ago. */
  createAccount(email: string): Promise<'made' | 'exists' | 'failed'>;
  /** The text of a public Google Doc or Sheet export, or null if it can't be read. */
  fetchText(url: string): Promise<string | null>;
}

export const MAX_EMAILS = 100;
/** Requests one teacher may make a minute: plenty for pasting lists, too few to make accounts by the thousand. */
export const MAX_REQUESTS_PER_MINUTE = 10;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handlePupilsRequest(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const teacher = token ? await services.userIdFor(token) : null;
    if (!teacher) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(teacher, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'That’s a lot at once. Wait a minute and try again.' });

    const raw = (await readJsonBody(request)) as { emails?: unknown; link?: unknown } | null;

    if (typeof raw?.link === 'string') {
      const url = exportUrlFor(raw.link);
      if (!url) return reply(400, { error: 'That isn’t a Google Doc or Sheet link.' });
      const text = await services.fetchText(url);
      if (text === null) {
        return reply(422, {
          error: 'Couldn’t open that file. In Google, tap Share and set it to “Anyone with the link can view”, or copy the emails and paste them instead.',
        });
      }
      return reply(200, { emails: emailsIn(text).slice(0, 500) });
    }

    if (!Array.isArray(raw?.emails)) return reply(400, { error: 'Send a list of emails.' });
    const emails = emailsIn(raw.emails.filter((e): e is string => typeof e === 'string').join('\n'));
    if (emails.length > MAX_EMAILS) return reply(400, { error: `Add up to ${MAX_EMAILS} pupils at a time.` });
    if (!emails.length) return reply(200, { made: [], failed: [] });

    const allowed = await services.mayCreate(teacher, emails);
    if (allowed === 'busy') return reply(503, { error: 'The server is busy. Try again in a minute.' });
    const made: string[] = [];
    const failed: string[] = [];
    for (const email of allowed) {
      const result = await services.createAccount(email);
      (result === 'failed' ? failed : made).push(email);
    }
    return reply(200, { made, failed });
  };
}
