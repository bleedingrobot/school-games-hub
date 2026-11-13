/**
 * What the `orderup` server function does with a request from a signed-in pupil (docs/ORDERUP-PLAN.md). The function
 * (supabase/functions/orderup/handler.ts) checks the sign-in and the rate first; the preview runs this with services that
 * keep everything in memory, so both run the same rules.
 *
 *   load   the pupil's place (levels passed, help per level), the levels they may open, the class's help setting, the
 *          worked examples seen;
 *   start  makes a set of bags for a level from a fresh seed (short ones first on full help) and keeps it;
 *   bag    replays one bag's picks and answers on the kept set, saves it, records it once for the maths records, and on
 *          the set's last bag moves the pupil's place on (passing a level gives its achievement);
 *   seen   marks a level's worked example as seen.
 *
 * Nothing that counts comes from the browser. Bags are saved in order, each once.
 */
import { readKinds, type SeenServices } from '../kit/seen';
import { nzDate } from '../kit/dayArc';
import type { FactAnswer } from '../maths/leitner';
import { seededRandom } from '../maths/serverQuestions';
import { ORDERUP } from './config';
import { makeSet, type SkillKey } from './levels';
import { replayBag, type BagEvent, type BagResult } from './play';
import { afterSet, helpFor, openUpTo, unplayed, type Help, type HelpSetting, type Progress } from './progress';

export { HELP_SETTINGS, type HelpSetting } from './progress';

/** The worked example kinds: one per level. */
export const KINDS = ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7'] as const;
export const MAX_SEED = 2147483647;

export interface Saved extends Progress {
  /** Goes up on every save; a save lands only if it still matches (0: never saved). */
  version: number;
}
export const unsaved = (): Saved => ({ ...unplayed(), version: 0 });

/** A set as the server kept it. */
export interface KeptSet {
  seed: number;
  level: number;
  help: Help;
  bags: { text: string; key: SkillKey | null }[];
}

export interface Settings {
  enabled: boolean;
  help: HelpSetting;
}

export interface OrderUpServices extends SeenServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** Keeps a new set and closes any other open one. False if the seed was used before. */
  start(player: string, set: KeptSet): Promise<boolean | 'busy'>;
  /** One of the pupil's sets: as kept, whether it is open, and how many bags are saved. Null: not theirs. */
  set(player: string, seed: number): Promise<{ open: boolean; done: number; good: number; set: KeptSet } | null | 'busy'>;
  /** Saves bag `slot` (only if it is the next one and the set is open), closing the set after the last. Null: not saved. */
  saveBag(player: string, seed: number, slot: number, events: BagEvent[], result: BagResult): Promise<{ done: number; good: number } | null | 'busy'>;
  /** Saves the pupil's place, only if the version still matches. */
  saveProgress(player: string, version: number, progress: Progress): Promise<boolean | 'busy'>;
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** The pupil passed a new level: the hub gives its achievement. */
  progressChanged(player: string): Promise<void>;
  random(): number;
  now(): number;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const TRIES = 4;
const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): Reply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The diner couldn’t be reached just now. Try again in a moment.');
const unreadable = () => no(400, 'That couldn’t be read.');
const isWhole = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

function readEvents(v: unknown): BagEvent[] | null {
  if (!Array.isArray(v) || v.length > ORDERUP.maxEvents) return null;
  const out: BagEvent[] = [];
  for (const e of v) {
    if (!e || typeof e !== 'object') return null;
    const { p, a, ms } = e as Record<string, unknown>;
    if (!isWhole(ms, ORDERUP.maxEventMs)) return null;
    if (Array.isArray(p) && (p.length === 1 || p.length === 2) && p.every((x) => isWhole(x, 999)) && a === undefined) out.push({ p: p as number[], ms });
    else if (isWhole(a, 1_000_000) && p === undefined) out.push({ a, ms });
    else return null;
  }
  return out;
}

export async function handleOrderUp(services: OrderUpServices, player: string, body: Record<string, unknown>): Promise<Reply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Order Up! is not switched on for your class.', { code: 'game-off' });

  if (body.action === 'load') {
    const [s, seen] = await Promise.all([services.load(player), services.seen(player)]);
    if (s === 'busy' || seen === 'busy') return busy();
    return ok({ passed: s.passed, open: openUpTo(s, ORDERUP.liveLevels), live: ORDERUP.liveLevels, levels: s.levels, helpSetting: settings.help, seen });
  }

  if (body.action === 'seen') {
    const kinds = readKinds(body.kinds, KINDS);
    if (!kinds) return unreadable();
    const seen = await services.markSeen(player, kinds);
    return seen === 'busy' ? busy() : ok({ seen });
  }

  if (body.action === 'start') {
    const s = await services.load(player);
    if (s === 'busy') return busy();
    const level = body.level;
    if (!isWhole(level, ORDERUP.levels) || level < 1 || level > openUpTo(s, ORDERUP.liveLevels)) return no(403, 'That level isn’t open yet.', { code: 'locked' });
    const help = helpFor(s, level, settings.help);
    for (let t = 0; t < TRIES; t++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const bags = makeSet(level, help === 'full', seededRandom(`orderup:${seed}`)).map((b) => ({ text: b.text, key: b.key }));
      const set: KeptSet = { seed, level, help, bags };
      const kept = await services.start(player, set);
      if (kept === 'busy') return busy();
      if (kept) return ok({ set });
    }
    return busy();
  }

  if (body.action === 'bag') {
    const { seed, slot } = body;
    const events = readEvents(body.events);
    if (!isWhole(seed, MAX_SEED) || !isWhole(slot, ORDERUP.setSize - 1) || !events) return unreadable();
    const kept = await services.set(player, seed);
    if (kept === 'busy') return busy();
    if (!kept) return no(409, 'That isn’t one of your orders.', { code: 'not-yours' });
    if (!kept.open || kept.done !== slot) return no(409, 'That bag is already done.', { code: 'ended' });
    let result: BagResult;
    try {
      result = replayBag(kept.set.bags[slot].text, events);
    } catch {
      return unreadable();
    }
    if (!result.done) return no(400, 'That bag isn’t finished yet.', { code: 'not-done' });
    const saved = await services.saveBag(player, seed, slot, events, result);
    if (saved === 'busy') return busy();
    if (!saved) return no(409, 'That bag is already done.', { code: 'ended' });
    const key = kept.set.bags[slot].key;
    if (key) {
      const at = services.now();
      const answer: FactAnswer = { key, correct: result.clean, ms: result.ms, at, ...(result.given.length ? { given: result.given[0] } : {}) };
      await services.recordAnswers(player, `orderup:${seed}:${slot}`, [answer]);
    }
    const reply: Record<string, unknown> = { bag: { good: result.good, clean: result.clean, wrongPicks: result.wrongPicks, wrongAnswers: result.wrongAnswers }, done: saved.done, good: saved.good };
    if (saved.done < ORDERUP.setSize) return ok(reply);
    // The last bag: move the pupil's place on.
    const today = nzDate(new Date(services.now()));
    for (let t = 0; t < TRIES; t++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      const after = afterSet(s, kept.set.level, saved.good, today);
      const ok2 = await services.saveProgress(player, s.version, after.progress);
      if (ok2 === 'busy') return busy();
      if (ok2) {
        if (after.newLevel) await services.progressChanged(player);
        return ok({ ...reply, passedSet: after.passedSet, newLevel: after.newLevel, passed: after.progress.passed, open: openUpTo(after.progress, ORDERUP.liveLevels) });
      }
    }
    return busy();
  }

  return unreadable();
}
