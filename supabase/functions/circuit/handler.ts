/**
 * The Circuit Racer server function (docs/CIRCUIT-PLAN.md, section 8). Three jobs:
 *
 *   load    the pupil's own roads (best time, medal, stars) and how many of today's 5 finishes are left;
 *   start   hands out a seed with a stamp (made for this pupil and road) for one go at an open road, unless today's 5
 *           finishes are used up;
 *   finish  checks the stamp, replays the recorded inputs itself (shared/circuit/game.ts `judgeFinish`) and saves only
 *           what the replay says: the time, medal and battery star. The 6th finish of a New Zealand day is refused
 *           unless the class has "Unlimited today" (the database counts and refuses, so two tabs can't sneak one in).
 *
 * Every job checks sign-in and the teacher's switch (`settings_of`): while it is off, nothing is handed out or saved.
 * Logic only, with the database passed in (`Services`), so handler.test.ts and the preview run it without Deno.
 */
import { finishesLeft, judgeFinish, makeSeed, parseFinish, roadBefore, roadById, roadOpen, seedProblem, stampText, type CircuitSave, type JudgedFinish, type RoadProgress } from '../../../shared/circuit/game';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export type SaveStatus = 'best' | 'saved' | 'duplicate' | 'done-today' | 'locked';

export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Signs some text (null if the server has no secret). */
  stamp(text: string): Promise<string | null>;
  /** The class's switch and "Unlimited today" for this pupil; null if they can't be read. */
  settings(player: string): Promise<{ enabled: boolean; unlimited: boolean } | null>;
  /** The pupil's roads and finishes today (NZ day). */
  load(player: string): Promise<{ roads: Record<string, RoadProgress>; today: number } | 'busy'>;
  /**
   * Saves a replayed finish in one locked step: refuses a 6th finish today unless `unlimited`, refuses a road whose road
   * before isn't finished, counts a seed once, keeps the best, and gives the hub points.
   */
  record(player: string, finish: { road: string; before: string | null; seed: string; inputs: string; unlimited: boolean } & JudgedFinish): Promise<{ status: SaveStatus; today: number } | 'busy'>;
  now(): number;
  randomHex(bytes: number): string;
}

/** Requests one pupil may make a minute (a road is a start and a finish). */
export const MAX_REQUESTS_PER_MINUTE = 40;
export const DONE_TODAY = 'All done for today. See you tomorrow!';
const OFF = 'Circuit Racer is switched off for your class.';

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleCircuit(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    const nowSeconds = Math.floor(services.now() / 1000);

    // The teacher's switch, checked on every request. If it can't be read nothing is handed out.
    const settings = await services.settings(player);
    if (!settings) return reply(503, { error: "We couldn't reach the circuit just now." });
    if (!settings.enabled) return reply(403, { error: OFF, code: 'off' });

    if (body.action === 'load') {
      const saved = await services.load(player);
      if (saved === 'busy') return reply(503, { error: "We couldn't load your roads just now." });
      const save: CircuitSave = { ...saved, left: finishesLeft(saved.today, settings.unlimited) };
      return reply(200, save);
    }

    if (body.action === 'start') {
      const roadId = typeof body.road === 'string' ? body.road : '';
      if (!roadById(roadId)) return reply(400, { error: "That road couldn't be found." });
      const saved = await services.load(player);
      if (saved === 'busy') return reply(503, { error: "We couldn't start the road just now." });
      if (!roadOpen(saved.roads, roadId)) return reply(409, { error: 'Finish the road before to open this one.', code: 'locked' });
      const left = finishesLeft(saved.today, settings.unlimited);
      if (left === 0) return reply(409, { error: DONE_TODAY, code: 'done-today' });
      const seed = makeSeed(nowSeconds, services.randomHex(12));
      const stamp = await services.stamp(stampText(player, roadId, seed));
      if (!stamp) return reply(500, { error: "The road couldn't start." });
      return reply(200, { seed, stamp, left });
    }

    if (body.action === 'finish') {
      const report = parseFinish(body);
      if (!report) return reply(400, { error: "That run couldn't be read." });
      const expected = await services.stamp(stampText(player, report.road, report.seed));
      const problem = seedProblem(report.seed, nowSeconds) ?? (expected && sameText(expected, report.stamp) ? null : 'bad stamp');
      if (problem) {
        // Logs say what was wrong, never who sent it.
        console.warn(`circuit: refused a finish (${problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const judged = judgeFinish(report, nowSeconds);
      if (!judged.ok) {
        console.warn(`circuit: refused a finish (${judged.problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const saved = await services.record(player, { road: report.road, before: roadBefore(report.road), seed: report.seed, inputs: report.inputs, unlimited: settings.unlimited, ...judged.run });
      if (saved === 'busy') return reply(503, { error: "We couldn't save your run just now." });
      if (saved.status === 'done-today') return reply(409, { error: DONE_TODAY, code: 'done-today' });
      if (saved.status === 'locked') return reply(409, { error: 'Finish the road before to open this one.', code: 'locked' });
      const { steps, medal, clean, charged, battery } = judged.run;
      return reply(200, { result: saved.status, steps, medal, clean, charged, battery, left: finishesLeft(saved.today, settings.unlimited) });
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
