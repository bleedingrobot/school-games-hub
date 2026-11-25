/**
 * What the `starweb` server function does with a request from a signed-in pupil (docs/STARWEB-PLAN.md "Server, data and
 * cost"). The function (supabase/functions/starweb/handler.ts) checks the sign-in and the rate first; the preview calls
 * this with services kept in the browser (memoryServices.ts), so both run exactly the same rules.
 *
 *   load        { enabled, progress, open (the sky left part-way, if any), today, pointsLeft };
 *   open        a sky: the open one again (Carry on), or a new one (`fresh`, or a different mode). A new Star Map sky's
 *               known fact comes from the pupil's own times-table records (pickAnchor); a Free sky's is the pupil's pick.
 *               An open sky with every arm lit is finished first, so its medal is never lost;
 *   save        the tries typed since the last save: the server re-reads, re-checks and re-links each one with the same
 *               rules (shared/starweb/sky.ts) and keeps only what holds, at most one new star a second (plus a burst);
 *   finish      the last tries, then the medal (every arm lit needed), the Star Map, points for the first 5 skies of
 *               the NZ day, achievements;
 *   guide-seen  remembers the guided first sky was shown.
 *
 * Nothing that counts comes from the browser: every star, the medal, the map and the points are the server's.
 */
import { anchorOf, type Anchor } from '../classlive/stars';
import type { FactStats } from '../maths/leitner';
import { nzDate } from '../kit/dayArc';
import { MAX_TRIES_PER_SAVE, POINTS, POINT_SKIES_A_DAY, STAR_BURST, type Medal } from './config';
import { emptyProgress, freeOpen, pickAnchor, progressAfter, withRecent, type Progress } from './map';
import { addTry, countedStars, medalOf, type SoloStar } from './sky';

export type Mode = 'map' | 'free';

export interface Saved {
  progress: Progress;
  /** Goes up by one on every save; a save is kept only if it still matches (0: never played). */
  version: number;
}

export const unplayed = (): Saved => ({ progress: emptyProgress(), version: 0 });

export interface Settings {
  enabled: boolean;
}

/** A sky as it's kept. */
export interface KeptSky {
  seed: string;
  mode: Mode;
  anchor: Anchor;
  stars: SoloStar[];
  /** Help shown so far (hint rungs and "Show me"). */
  hints: number;
  /** Goes up on every save of the sky. */
  version: number;
  open: boolean;
  /** When it was last saved (or opened), ms since 1970 by the server's clock. */
  savedAt: number;
}

/** What the browser gets of a sky (all of it is the pupil's own). */
export type PublicSky = Omit<KeptSky, 'open' | 'savedAt' | 'version'>;
export const publicSky = ({ seed, mode, anchor, stars, hints }: KeptSky): PublicSky => ({ seed, mode, anchor, stars, hints });

export interface MathsContext {
  facts: FactStats[];
  enabledTables?: number[];
}

export interface StarWebServices {
  now(): number;
  random(): number;
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** The pupil's open sky, or null. */
  openSky(player: string): Promise<KeptSky | null | 'busy'>;
  /** One of this pupil's skies by its seed; null if it isn't theirs. */
  sky(player: string, seed: string): Promise<KeptSky | null | 'busy'>;
  maths(player: string): Promise<MathsContext | 'busy'>;
  /** Keeps a new sky and closes the pupil's other open one. False if the seed was used before. */
  start(player: string, seed: string, mode: Mode, anchor: Anchor): Promise<boolean | 'busy'>;
  /** Saves an open sky's stars if its version still matches. */
  save(player: string, seed: string, version: number, stars: SoloStar[], hints: number): Promise<boolean | 'busy'>;
  /** Closes an open sky with its medal and points and saves the progress, together. False if either moved on. */
  finish(player: string, seed: string, skyVersion: number, stars: SoloStar[], hints: number, medal: Medal, points: number, version: number, progress: Progress): Promise<boolean | 'busy'>;
  /** Skies that earned points on this NZ day. */
  pointSkiesToday(player: string, day: string): Promise<number | 'busy'>;
  /** Saves the progress alone if the version still matches. */
  saveProgress(player: string, version: number, progress: Progress): Promise<boolean | 'busy'>;
  /** Points inside the hub's daily cap (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Achievements are checked again. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export interface FinishReply {
  medal: Medal;
  points: number;
  progress: Progress;
  stars: SoloStar[];
}

const busy = (): Reply => ({ status: 503, body: { error: 'The server is busy. Try again in a moment.', code: 'busy' } });
const bad = (why = 'That couldn’t be read.'): Reply => ({ status: 400, body: { error: why, code: 'bad' } });
const ok = (body: object): Reply => ({ status: 200, body: body as Record<string, unknown> });

const isSeed = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{16,32}$/.test(v);
const newSeed = (): string => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * The sky's stars after the sent tries, re-checked with the shared rules. At most one new star a second since the last
 * save (plus STAR_BURST): extra ones are dropped, and the browser takes the server's stars.
 */
export function replayTries(kept: KeptSky, tries: unknown, now: number): SoloStar[] | null {
  if (tries === undefined) return kept.stars;
  if (!Array.isArray(tries) || tries.length > MAX_TRIES_PER_SAVE || tries.some((t) => typeof t !== 'string' || t.length > 40)) return null;
  const allowed = STAR_BURST + Math.max(0, Math.floor((now - kept.savedAt) / 1000));
  let sky = { anchor: kept.anchor, stars: kept.stars };
  let added = 0;
  for (const t of tries) {
    if (added >= allowed) break;
    const next = addTry(sky, t);
    if (next.reply.result === 'new') added++;
    sky = next.sky;
  }
  return sky.stars;
}

const hintsOf = (kept: KeptSky, v: unknown) => Math.max(kept.hints, typeof v === 'number' && Number.isInteger(v) ? Math.min(99, Math.max(0, v)) : 0);

async function finishSky(services: StarWebServices, player: string, kept: KeptSky, stars: SoloStar[], hints: number, saved: Saved): Promise<Reply> {
  const medal = medalOf(stars);
  if (medal === 0) return { status: 409, body: { error: 'Light every arm first.', code: 'not-lit' } };
  const day = nzDate(new Date(services.now()));
  let points = 0;
  if (kept.mode === 'map') {
    const today = await services.pointSkiesToday(player, day);
    if (today === 'busy') return busy();
    if (today < POINT_SKIES_A_DAY) points = POINTS[medal];
  }
  const progress = withRecent(progressAfter(saved.progress, { anchor: kept.anchor, medal, counted: countedStars(stars), hints, mode: kept.mode }), kept.anchor);
  const done = await services.finish(player, kept.seed, kept.version, stars, hints, medal, points, saved.version, progress);
  if (done === 'busy') return busy();
  if (!done) return { status: 409, body: { error: 'Try that again.', code: 'moved' } };
  if (points) await services.awardPoints(player, points, `starweb:${kept.seed}`);
  await services.progressChanged(player);
  const reply: FinishReply = { medal, points, progress, stars };
  return ok(reply);
}

export async function handleStarWeb(services: StarWebServices, player: string, body: Record<string, unknown>): Promise<Reply> {
  const type = body.type;
  const today = nzDate(new Date(services.now()));
  if (type === 'load') {
    const [settings, saved, open, scored] = await Promise.all([services.settings(player), services.load(player), services.openSky(player), services.pointSkiesToday(player, today)]);
    if (!settings || saved === 'busy' || open === 'busy') return busy();
    return ok({
      enabled: settings.enabled, progress: saved.progress, open: open ? publicSky(open) : null, today,
      pointsLeft: Math.max(0, POINT_SKIES_A_DAY - (scored === 'busy' ? 0 : scored)),
    });
  }

  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return { status: 403, body: { error: 'Star Web isn’t switched on for your class yet.', code: 'off' } };

  if (type === 'guide-seen') {
    const saved = await services.load(player);
    if (saved === 'busy') return busy();
    if (saved.progress.guideSeen) return ok({ progress: saved.progress });
    const progress = { ...saved.progress, guideSeen: true };
    const done = await services.saveProgress(player, saved.version, progress);
    if (done === 'busy') return busy();
    if (!done) return { status: 409, body: { error: 'Try that again.', code: 'moved' } };
    return ok({ progress });
  }

  if (type === 'open') {
    const mode = body.mode;
    if (mode !== 'map' && mode !== 'free') return bad();
    let [saved, open] = await Promise.all([services.load(player), services.openSky(player)]);
    if (saved === 'busy' || open === 'busy') return busy();
    if (open && open.mode === mode && body.fresh !== true) return ok({ sky: publicSky(open) });
    if (open && medalOf(open.stars) > 0) {
      // Every arm lit: finish it first, so its medal goes on the map.
      const r = await finishSky(services, player, open, open.stars, open.hints, saved);
      if (r.status !== 200) return r;
      saved = { progress: (r.body as unknown as FinishReply).progress, version: saved.version + 1 };
    }
    let anchor: Anchor | null;
    if (mode === 'free') {
      if (!freeOpen(saved.progress)) return { status: 403, body: { error: 'Free sky opens after 5 lit skies.', code: 'locked' } };
      anchor = anchorOf(Number(body.x), Number(body.y));
      if (!anchor) return bad('Pick two different numbers from 2 to 12.');
    } else {
      const maths = await services.maths(player);
      if (maths === 'busy') return busy();
      anchor = pickAnchor(saved.progress, maths.facts, maths.enabledTables, () => services.random());
    }
    const seed = newSeed();
    const kept = await services.start(player, seed, mode, anchor);
    if (kept === 'busy' || !kept) return busy();
    const sky: PublicSky = { seed, mode, anchor, stars: [], hints: 0 };
    return ok({ sky, progress: saved.progress });
  }

  if (type === 'save' || type === 'finish') {
    const { seed } = body;
    if (!isSeed(seed)) return bad();
    const [kept, saved] = await Promise.all([services.sky(player, seed), services.load(player)]);
    if (kept === 'busy' || saved === 'busy') return busy();
    if (!kept) return { status: 404, body: { error: 'That sky isn’t yours.', code: 'not-yours' } };
    if (!kept.open) return ok({ already: true, stars: kept.stars });
    const stars = replayTries(kept, body.tries, services.now());
    if (!stars) return bad();
    const hints = hintsOf(kept, body.hints);
    if (type === 'finish') return finishSky(services, player, kept, stars, hints, saved);
    if (stars.length !== kept.stars.length || hints !== kept.hints) {
      const done = await services.save(player, seed, kept.version, stars, hints);
      if (done === 'busy') return busy();
      if (!done) return { status: 409, body: { error: 'Try that again.', code: 'moved' } };
    }
    return ok({ stars, medal: medalOf(stars) });
  }

  return bad();
}
