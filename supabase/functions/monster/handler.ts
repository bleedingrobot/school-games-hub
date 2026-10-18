/**
 * The monster server function (Maths Monsters). The website sends its queue of saves, oldest first,
 * and each one is checked against the last good save (shared/monsters/save/check.ts) and, if it
 * passes, stored. The answers in its battles go into the student's maths records as answer events
 * (the same records Gem Keep and Wormholes & Black Holes use), then the save itself.
 *
 * WHAT HAPPENS TO A BAD SAVE (James asked for this to be written down):
 *  - the save is refused as a whole, and the student's last good save stays exactly as it was;
 *  - the website is told "refused" (not why): it drops that save and everything queued after it (they
 *    follow the refused one, so none could be accepted), stops saving for the rest of the session and
 *    says nothing scary: "your team couldn't be saved this time, keep playing";
 *  - the next time that student opens the game, they carry on from the last good save;
 *  - a short code for the reason goes in the `monster_refusals` table (never the save itself), where
 *    the teacher page lists it, and in the function log (without who sent it).
 * A save that is merely out of date ("stale": made from an older copy, e.g. on another Chromebook) is
 * handled the same way. Nothing here ever deletes or changes a saved game.
 *
 * Items are handled in order and the reply says how many from the front are dealt with, so the
 * website can drop those from its queue and keep the rest for next time.
 */
import type { FactAnswer } from '../../../shared/maths/leitner';
import { checkSave, type SaveItem, type Stored, type SaveSummary } from '../../../shared/monsters/save/check';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/**
 * A database answer. 'refused': the database said no to this item. 'too-many' (the daily limit) and
 * 'busy' (couldn't reach it): stop and keep the rest for later.
 */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

/** What record_monster_save() takes. */
export interface SaveRow {
  saveId: string;
  seq: number;
  at: number;
  world: SaveItem['world'];
  battles: SaveItem['battles'];
  summary: SaveSummary;
}

export type SaveStatus = 'saved' | 'duplicate' | 'stale';

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Is the game switched on? */
  enabled(): Promise<Outcome<boolean>>;
  /** The last good save, or null for a student who has none. */
  loadSave(player: string): Promise<Outcome<(Stored & { version: number }) | null>>;
  /** Which of these save ids are already kept (a save whose reply was lost is sent again). */
  knownSaves(player: string, ids: string[]): Promise<Outcome<string[]>>;
  /** Adds answers to the records. 0 if this batch was counted before. */
  recordAnswers(player: string, pack: string, batchId: string, answers: FactAnswer[]): Promise<Outcome<number>>;
  recordSave(player: string, save: SaveRow): Promise<Outcome<{ status: SaveStatus; version: number; points: number | null }>>;
  recordRefusal(player: string, reason: string, seq: number | null): Promise<Outcome<null>>;
  /** Milliseconds since 1970. */
  now(): number;
}

/** Most saves one request may carry (each can be several KB; the body limit is 64 KB). */
export const MAX_ITEMS = 12;
/** Requests one student may make a minute. The website sends one every few minutes. */
export const MAX_REQUESTS_PER_MINUTE = 20;

export type ItemResult =
  | { type: 'save'; status: SaveStatus; version: number; points: number | null }
  | { type: 'refused'; problem: string };

export interface SaveResponse {
  handled: number;
  results: ItemResult[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A batch id for one topic of one save: the same save always gives the same ids, so a retry is never counted twice. */
export async function batchIdFor(saveId: string, topic: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`monster:${saveId}:${topic}`)));
  const h = hex(digest.slice(0, 16));
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleMonster(request: Request): Promise<Response> {
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
    if (!body || !Array.isArray(body.items) || body.items.length > MAX_ITEMS) return reply(400, { error: "That couldn't be read." });
    if (body.items.length === 0) return reply(200, { handled: 0, results: [] });

    // The game switch: nothing is saved while it is off (the website keeps its queue for when it is on).
    const on = await services.enabled();
    if (!on.ok) return reply(503, { error: "We couldn't save your game just now." });
    if (!on.value) return reply(503, { error: 'Maths Monsters is switched off.' });

    // What each save is checked against: the last good one, then each save in this request as it is accepted.
    const first = await services.loadSave(player);
    if (!first.ok) return reply(503, { error: "We couldn't save your game just now." });
    let prev: Stored | null = first.value;
    // Saves that already got through (the reply was lost) are told so, not checked against a newer save.
    const ids = body.items.flatMap((x) => (typeof (x as { saveId?: unknown } | null)?.saveId === 'string' && UUID.test((x as { saveId: string }).saveId) ? [(x as { saveId: string }).saveId] : []));
    const known = ids.length ? await services.knownSaves(player, ids) : ({ ok: true, value: [] } as Outcome<string[]>);
    if (!known.ok) return reply(503, { error: "We couldn't save your game just now." });
    const kept = new Set(known.value);

    const results: ItemResult[] = [];
    let refused: string | null = null;
    for (const raw of body.items) {
      if (refused) {
        // They all follow the refused one, so none of them could be accepted.
        results.push({ type: 'refused', problem: 'after-refusal' });
        continue;
      }
      if (kept.has((raw as { saveId?: string } | null)?.saveId ?? '')) {
        results.push({ type: 'save', status: 'duplicate', version: first.value?.version ?? 0, points: null });
        continue;
      }
      const checked = checkSave(prev, raw, services.now());
      if (!checked.ok) {
        refused = checked.problem;
        await refuse(player, checked.problem, raw, services);
        results.push({ type: 'refused', problem: checked.problem });
        continue;
      }
      const { item, summary, answers } = checked.save;
      // The answers go into the maths records first: each batch is only ever counted once, so a retry is safe.
      let stop = false;
      for (const [topic, list] of Object.entries(answers)) {
        if (!list?.length) continue;
        const recorded = await services.recordAnswers(player, topic, await batchIdFor(item.saveId, topic), list);
        if (recorded.ok) continue;
        if (recorded.why === 'refused') {
          refused = 'answers';
          await refuse(player, 'answers', raw, services);
          results.push({ type: 'refused', problem: 'answers' });
        } else stop = true;
        break;
      }
      if (refused) continue;
      if (stop) break;
      const saved = await services.recordSave(player, {
        saveId: item.saveId, seq: item.seq, at: item.at, world: item.world, battles: item.battles, summary,
      });
      if (!saved.ok) {
        if (saved.why === 'refused') {
          refused = 'database';
          await refuse(player, 'database', raw, services);
          results.push({ type: 'refused', problem: 'database' });
          continue;
        }
        break;
      }
      if (saved.value.status === 'stale') {
        refused = 'stale';
        await refuse(player, 'stale', raw, services);
        results.push({ type: 'refused', problem: 'stale' });
        continue;
      }
      results.push({ type: 'save', ...saved.value });
      prev = { world: item.world, at: item.at };
    }
    if (results.length === 0) return reply(503, { error: "We couldn't save your game just now." });
    return reply(200, { handled: results.length, results } satisfies SaveResponse);
  };
}

/** Logs what was wrong (a code, never who sent it) and leaves a note for the teacher page. */
async function refuse(player: string, problem: string, raw: unknown, services: Services) {
  console.warn(`monster: refused a save (${problem})`);
  const seq = (raw as { seq?: unknown } | null)?.seq;
  await services.recordRefusal(player, problem, typeof seq === 'number' && Number.isInteger(seq) ? seq : null);
}
