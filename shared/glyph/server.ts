/**
 * What the `glyph` server function does with a request from a signed-in pupil (docs/GLYPH-PLAN.md, stage 2). The function
 * (supabase/functions/glyph/handler.ts) checks the sign-in and the rate first; the preview calls this with services kept
 * in the browser (memoryServices.ts), so both run exactly the same rules.
 *
 *   load        { enabled, progress, today };
 *   start       a temple go: a fresh seed kept for this pupil (any other open go closes); sends the walls without answers;
 *   finish      replays the sent plays on the walls from the kept seed, saves the go once with the new progress, records
 *               one maths answer per wall played and gives points for the first finished goes of the NZ day;
 *   guide-seen  remembers the guided first wall was shown.
 *
 * Nothing that counts comes from the browser: the walls, the marks, the stars and the points are all the server's.
 */
import type { FactAnswer } from '../maths/leitner';
import { nzDate } from '../kit/dayArc';
import { FACT_KEY, POINTS_PASS, POINTS_TRY, POINT_GOES_A_DAY, WALLS_PER_TEMPLE } from './config';
import { emptyProgress, progressAfter, replayTemple, templeOpen, type Progress, type TempleResult, type WallPlay } from './play';
import { makeTemple, publicWall, type PublicWall } from './walls';

export interface Saved {
  progress: Progress;
  /** Goes up by one on every save; a save is kept only if it still matches (0: never played). */
  version: number;
}

export const unplayed = (): Saved => ({ progress: emptyProgress(), version: 0 });

export interface Settings {
  enabled: boolean;
}

/** A temple go as it's kept. */
export interface KeptGo {
  temple: number;
  open: boolean;
  /** Help level when it started. */
  help: number;
}

export interface GlyphServices {
  now(): number;
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** Keeps a new go (and closes the pupil's other open one). False if the pupil has used this seed before. */
  start(player: string, seed: string, temple: number, help: number): Promise<boolean | 'busy'>;
  /** One of this pupil's goes by its seed; null if it isn't theirs. */
  go(player: string, seed: string): Promise<KeptGo | null | 'busy'>;
  /** Finished (all nine walls) goes this pupil has on this NZ day. */
  finishedToday(player: string, day: string): Promise<number | 'busy'>;
  /** Closes an open go with its result and saves the progress, together. False if it was closed or the version moved on. */
  finish(player: string, seed: string, version: number, progress: Progress, result: TempleResult): Promise<boolean | 'busy'>;
  /** Saves the progress alone if the version still matches. */
  saveProgress(player: string, version: number, progress: Progress): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Points inside the hub's daily cap (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Achievements are checked again. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export interface StartReply {
  seed: string;
  temple: number;
  walls: PublicWall[];
  help: number;
}

const busy = (): Reply => ({ status: 503, body: { error: 'The server is busy. Try again in a moment.', code: 'busy' } });
const bad = (why = 'That couldn’t be read.'): Reply => ({ status: 400, body: { error: why, code: 'bad' } });

const isSeed = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{16,32}$/.test(v);
const newSeed = (): string => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function handleGlyph(services: GlyphServices, player: string, body: Record<string, unknown>): Promise<Reply> {
  const type = body.type;
  const today = nzDate(new Date(services.now()));
  if (type === 'load') {
    const [settings, saved] = await Promise.all([services.settings(player), services.load(player)]);
    if (!settings || saved === 'busy') return busy();
    return { status: 200, body: { enabled: settings.enabled, progress: saved.progress, today } };
  }

  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return { status: 403, body: { error: 'Glyph Gates isn’t switched on for your class yet.', code: 'off' } };

  if (type === 'guide-seen') {
    const saved = await services.load(player);
    if (saved === 'busy') return busy();
    if (saved.progress.guideSeen) return { status: 200, body: { progress: saved.progress } };
    const progress = { ...saved.progress, guideSeen: true };
    const ok = await services.saveProgress(player, saved.version, progress);
    if (ok === 'busy') return busy();
    if (!ok) return { status: 409, body: { error: 'Try that again.', code: 'moved' } };
    return { status: 200, body: { progress } };
  }

  if (type === 'start') {
    const temple = body.temple;
    if (typeof temple !== 'number' || !Number.isInteger(temple)) return bad();
    const saved = await services.load(player);
    if (saved === 'busy') return busy();
    if (!templeOpen(saved.progress, temple)) return { status: 403, body: { error: 'That temple isn’t open yet.', code: 'locked' } };
    const seed = newSeed();
    const help = saved.progress.help.level;
    const kept = await services.start(player, seed, temple, help);
    if (kept === 'busy') return busy();
    if (!kept) return busy();
    const reply: StartReply = { seed, temple, walls: makeTemple(seed, temple).map(publicWall), help };
    return { status: 200, body: reply as unknown as Record<string, unknown> };
  }

  if (type === 'finish') {
    const { seed, plays } = body;
    if (!isSeed(seed) || !Array.isArray(plays)) return bad();
    const [go, saved] = await Promise.all([services.go(player, seed), services.load(player)]);
    if (go === 'busy' || saved === 'busy') return busy();
    if (!go) return { status: 404, body: { error: 'That go isn’t yours.', code: 'not-yours' } };
    if (!go.open) return { status: 200, body: { already: true } };
    let result: TempleResult;
    try {
      result = replayTemple(makeTemple(seed, go.temple), plays as WallPlay[]);
    } catch {
      return bad('bad go');
    }
    const progress = progressAfter(saved.progress, go.temple, result);
    const day = await services.finishedToday(player, today);
    const done = await services.finish(player, seed, saved.version, progress, result);
    if (done === 'busy') return busy();
    if (!done) return { status: 200, body: { already: true } };
    const at = services.now();
    const answers: FactAnswer[] = result.walls.map((w) => ({ key: FACT_KEY, correct: w.recordRight, ms: w.ms, at }));
    if (answers.length) await services.recordAnswers(player, `glyph:${seed}`, answers);
    let points = 0;
    if (result.finished && result.walls.length === WALLS_PER_TEMPLE && (day === 'busy' ? POINT_GOES_A_DAY : day) < POINT_GOES_A_DAY) {
      points = result.passed ? POINTS_PASS : POINTS_TRY;
      await services.awardPoints(player, points, `glyph:${seed}`);
    }
    await services.progressChanged(player);
    return { status: 200, body: { result, progress, points } };
  }

  return bad();
}
