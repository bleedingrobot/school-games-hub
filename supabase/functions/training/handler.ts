/**
 * The training server function: the website sends its queue of things to save (batches of
 * training answers, and the student's typing check times and settings), and this checks each
 * one and saves it. shared/training/save.ts has the checks.
 *
 * Items are handled in order and the reply says how many from the front are dealt with, so the
 * website can drop those from its queue and keep the rest for next time.
 */
import { TRAINING_CONFIG } from '../../../shared/training/config';
import { checkItem, MAX_ITEMS, type CheckedItem, type ItemResult } from '../../../shared/training/save';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/**
 * A database answer. 'refused': the database said no to this item (it's dropped). 'too-many'
 * (the daily limit) and 'busy' (couldn't reach it): stop and keep the rest for later.
 */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

type AnswersItem = Extract<CheckedItem, { type: 'answers' }>;
type StudentItem = Extract<CheckedItem, { type: 'student' }>;
type SessionItem = Extract<CheckedItem, { type: 'session' }>;

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Adds a batch of answers. 0 if this batch was counted before. */
  recordAnswers(player: string, item: AnswersItem): Promise<Outcome<number>>;
  recordStudent(player: string, item: StudentItem): Promise<Outcome<null>>;
  /** Counts a finished session (Training before games). Refused if its answers aren't saved. */
  recordSession(player: string, item: SessionItem): Promise<Outcome<unknown>>;
  /** Milliseconds since 1970. */
  now(): number;
}

/** Requests one student may make a minute. The website sends one every little while. */
export const MAX_REQUESTS_PER_MINUTE = 20;

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleTraining(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as { items?: unknown } | null;
    if (!body || !Array.isArray(body.items) || body.items.length > MAX_ITEMS) {
      return reply(400, { error: "That couldn't be read." });
    }

    const results: ItemResult[] = [];
    for (const raw of body.items) {
      const checked = checkItem(raw, services.now());
      if (!checked.ok) {
        // Logs say what was wrong, never who sent it. A bad item is dropped for good.
        console.warn(`training: refused an item (${checked.problem})`);
        results.push({ type: 'invalid', problem: checked.problem });
        continue;
      }
      const result = await save(player, checked.item, services);
      if (result === 'stop') break;
      results.push(result);
    }
    const stopped = results.length < body.items.length;
    if (stopped && results.length === 0) return reply(503, { error: "We couldn't save your training just now." });
    return reply(200, { handled: results.length, results });
  };
}

async function save(player: string, item: CheckedItem, services: Services): Promise<ItemResult | 'stop'> {
  const saved =
    item.type === 'answers'
      ? await services.recordAnswers(player, item)
      : item.type === 'student'
        ? await services.recordStudent(player, item)
        : await services.recordSession(player, item);
  if (!saved.ok) return saved.why === 'refused' ? { type: 'invalid', problem: 'refused' } : 'stop';
  return item.type === 'answers' ? { type: 'answers', added: saved.value as number } : { type: item.type };
}

/** How many saved answers a session needs before it counts as finished (the database checks). */
export const SESSION_MIN_ANSWERS = TRAINING_CONFIG.gate.minAnswers;

/** What the database function needs besides the answers: how many of each fact to keep, and the daily limit. */
export const SAVE_LIMITS = {
  keepPerFact: TRAINING_CONFIG.storage.answersPerFact,
  dailyLimit: TRAINING_CONFIG.storage.answersPerDay,
};
