/**
 * The Marble Rush server function. Two jobs:
 *
 *   start  hands out a seed with a stamp (made for this student, course and mode);
 *   save   checks the stamp, replays the recorded inputs itself, and saves the run.
 *
 * The time is never taken from the browser: shared/marble/save.ts replays the inputs and
 * refuses a run that did not finish, or that is faster than the real time since the seed was
 * handed out. The same seed can only be saved once.
 */
import { courseById } from '../../../shared/marble/courses';
import {
  judgeRun,
  makeMarbleSeed,
  marbleSeedProblem,
  marbleStampText,
  MARBLE_RUNS_PER_DAY,
  parseMarbleReport,
  type JudgedRun,
  type MarbleRunReport,
} from '../../../shared/marble/save';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** 'too-many' (the daily limit), 'refused' (the database said no) and 'busy' (couldn't reach it). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

export type SaveResult = 'best' | 'saved' | 'duplicate';

export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Signs some text (null if the server has no secret). */
  stamp(text: string): Promise<string | null>;
  /** Saves a replayed run. */
  record(player: string, report: MarbleRunReport, run: JudgedRun): Promise<Outcome<SaveResult>>;
  /** Milliseconds since 1970. */
  now(): number;
  /** Random bytes as hex text. */
  randomHex(bytes: number): string;
}

/** Requests one student may make a minute (a run is one start and one save). */
export const MAX_REQUESTS_PER_MINUTE = 20;
const TOO_MANY = "That's a lot of rolling today! Have a break and come back tomorrow.";

export { MARBLE_RUNS_PER_DAY };

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleMarble(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    const nowSeconds = Math.floor(services.now() / 1000);

    if (body.action === 'start') {
      const mode = body.mode;
      if (typeof body.course !== 'string' || !courseById(body.course) || (mode !== 'up' && mode !== 'down')) {
        return reply(400, { error: "That course couldn't be found." });
      }
      const seed = makeMarbleSeed(nowSeconds, services.randomHex(12));
      const stamp = await services.stamp(marbleStampText(player, body.course, mode, seed));
      if (!stamp) return reply(500, { error: "The run couldn't start." });
      return reply(200, { seed, stamp });
    }

    if (body.action === 'save') {
      const report = parseMarbleReport(body);
      if (!report) return reply(400, { error: "That run couldn't be read." });
      const expected = await services.stamp(marbleStampText(player, report.course, report.mode, report.seed));
      const problem = marbleSeedProblem(report.seed, nowSeconds) ?? (expected && sameText(expected, report.stamp) ? null : 'bad stamp');
      if (problem) {
        // Logs say what was wrong, never who sent it.
        console.warn(`marble: refused a run (${problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const judged = judgeRun(report, nowSeconds);
      if (!judged.ok) {
        console.warn(`marble: refused a run (${judged.problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const saved = await services.record(player, report, judged.run);
      if (!saved.ok) {
        if (saved.why === 'too-many') return reply(429, { error: TOO_MANY });
        return saved.why === 'refused' ? reply(400, { error: "That run couldn't be saved." }) : reply(503, { error: "We couldn't save your run just now." });
      }
      return reply(200, { result: saved.value, steps: judged.run.steps, falls: judged.run.falls });
    }

    return reply(400, { error: "That couldn't be read." });
  };
}

/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
