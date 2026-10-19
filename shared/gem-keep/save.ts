/**
 * Saving Gem Keep: what the website sends the gem-keep server function, and the checks the
 * function makes before saving any of it. Shared, so the website and the server agree.
 *
 * The browser keeps a queue of things to save and sends it whenever it can (end of a level,
 * after a Level Key, leaving the game, opening it again), so a dropped Wi-Fi connection never
 * loses a level. Every item can safely be sent twice: runs carry their own id, a Level Key
 * can only be passed once, and fact records only ever move forward.
 *
 * Gem Keep isn't replayed on the server (a 10-minute tower defence game is too much work for
 * a free server function), so these are plausibility checks: the level exists, the numbers
 * fit it, and nothing is impossibly fast. Points are small and capped, so a faked run gains little.
 */
import { sameAnswer } from '../maths/banded';
import { cleanParams, solveClaim, type ShownAnswer } from '../maths/claim';
import { FLUENT_DAYS, TOP_BOX } from '../maths/config';
import { parseFactKey } from '../maths/facts';
import { FOCUS_PACKS, isFocusKey, packIdOfKey, type FocusPackId } from '../maths/focus';
import type { FactAnswer, FactStats } from '../maths/leitner';
import { MATHS } from './config';
import type { LevelData } from './level';
import { CAMPAIGN, findLevel } from './levels';

export interface RunItem {
  type: 'run';
  /** Made when the level starts (a UUID), so the same run is only saved once. */
  runId: string;
  levelId: string;
  result: 'won' | 'lost';
  stars: number;
  /** Waves started. */
  waves: number;
  /** Seconds of play (game time). */
  gameSeconds: number;
  /** Maths questions asked during the level, and how many were right. */
  asked: number;
  right: number;
}

export interface KeyItem {
  type: 'key';
  levelId: string;
  right: number;
}

export interface FactsItem {
  type: 'facts';
  pack: 'times-tables';
  facts: FactStats[];
}

/**
 * Answers since the last save, oldest first. Each carries the question as it was shown and what the student gave, and the
 * server marks it itself (`solveClaim`): the browser's own "right" or "wrong" is never taken. The server adds each to the
 * student's records.
 */
export interface AnswersItem {
  type: 'answers';
  /**
   * The pack that keeps these records. Times tables unless a maths focus asked for early facts, adding or
   * division (every key in one item belongs to its pack, so a mixed batch is sent as one item for each pack).
   */
  pack: FocusPackId;
  /** Made by the browser, so the same answers are only counted once. */
  batchId: string;
  /** As sent: `ShownAnswer`s (older browsers sent plain `FactAnswer`s). After checking: the answers as marked here. */
  answers: FactAnswer[] | ShownAnswer[];
}

export interface ImportItem {
  type: 'import';
  levels: { levelId: string; stars: number; keyPassed: boolean }[];
}

/**
 * `facts` (whole records) is how Gem Keep saved before 17 Oct 2026, and answers without the question shown are how it saved
 * before 20 Oct 2026. Both are only accepted until `OLD_SAVES_UNTIL`, for saves still waiting on a device or a tab left open
 * with the old page: they take the browser's word, so after that they are refused.
 */
export type SaveItem = RunItem | KeyItem | FactsItem | AnswersItem | ImportItem;

export interface SaveRequest {
  items: SaveItem[];
}

/** What happened to each item, in order. */
export type ItemResult =
  | { type: 'run'; status: 'saved' | 'duplicate' | 'locked'; points: number | null }
  | { type: 'key'; status: 'passed' | 'already' | 'not-passed' | 'no-win' }
  | { type: 'facts'; changed: number }
  | { type: 'answers'; added: number }
  | { type: 'import'; status: 'imported' | 'skipped' }
  | { type: 'invalid'; problem: string };

export interface SaveResponse {
  /** How many items from the front of the queue are dealt with (saved or refused for good). */
  handled: number;
  results: ItemResult[];
}

/** Most items one request may carry. */
export const MAX_ITEMS = 40;
/** Fact records a request may carry (there are 78 times-table facts). */
export const MAX_FACTS = 200;
/** Answers a request may carry. */
export const MAX_ANSWERS = 500;
/** An average answer quicker than this, over a few answers, isn't a person typing. */
export const MIN_AVG_MS = 250;

/**
 * Old-style saves (see `SaveItem`) are accepted until this moment (by the server's clock), then refused. 15 Nov 2026, midnight
 * in New Zealand: a few weeks after the change goes live, long enough for every Chromebook to have reloaded the page.
 */
export const OLD_SAVES_UNTIL = Date.parse('2026-11-15T00:00:00+13:00');
/** The most parts a question is shown in (order of operations is the longest), and the longest part. */
const MAX_PARTS = 12;
const MAX_PART_LENGTH = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isInt = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/**
 * The shortest a won level can take, in game seconds: the time until each wave's last enemy
 * comes in, added up. Enemies still have to walk to the Keep, so real wins take longer.
 */
export function minWinSeconds(level: LevelData): number {
  return level.waves.reduce(
    (total, wave) => total + Math.max(0, ...wave.groups.map((g) => (g.delay ?? 0) + (g.count - 1) * g.gap)),
    0,
  );
}

/** The level before this one in the campaign (its Level Key opens this one), or null. */
export function levelBefore(levelId: string): string | null {
  const i = CAMPAIGN.findIndex((l) => l.id === levelId);
  return i > 0 ? CAMPAIGN[i - 1].id : null;
}

type Checked<T> = { ok: true; item: T } | { ok: false; problem: string };

function checkRun(x: Record<string, unknown>): Checked<RunItem> {
  if (typeof x.runId !== 'string' || !UUID.test(x.runId)) return { ok: false, problem: 'run-id' };
  const found = typeof x.levelId === 'string' ? findLevel(x.levelId) : null;
  if (!found) return { ok: false, problem: 'level' };
  const total = found.level.waves.length;
  if (x.result !== 'won' && x.result !== 'lost') return { ok: false, problem: 'result' };
  const won = x.result === 'won';
  if (!isInt(x.stars, won ? 1 : 0, won ? 3 : 0)) return { ok: false, problem: 'stars' };
  if (!isInt(x.waves, won ? total : 0, total)) return { ok: false, problem: 'waves' };
  if (!isInt(x.gameSeconds, 0, 10 * 3600)) return { ok: false, problem: 'time' };
  if (won && x.gameSeconds < minWinSeconds(found.level) * 0.9) return { ok: false, problem: 'too-quick' };
  if (!isInt(x.asked, 0, 2000) || !isInt(x.right, 0, x.asked)) return { ok: false, problem: 'answers' };
  return {
    ok: true,
    item: {
      type: 'run', runId: x.runId, levelId: found.level.id, result: x.result, stars: x.stars, waves: x.waves,
      gameSeconds: x.gameSeconds, asked: x.asked, right: x.right,
    },
  };
}

function checkKey(x: Record<string, unknown>): Checked<KeyItem> {
  const found = typeof x.levelId === 'string' ? findLevel(x.levelId) : null;
  if (!found) return { ok: false, problem: 'level' };
  if (!isInt(x.right, 0, MATHS.key.questions)) return { ok: false, problem: 'answers' };
  return { ok: true, item: { type: 'key', levelId: found.level.id, right: x.right } };
}

function checkFact(f: unknown, nowMs: number): FactStats | null {
  if (!f || typeof f !== 'object') return null;
  const s = f as Record<string, unknown>;
  if (typeof s.key !== 'string' || !parseFactKey(s.key)) return null;
  if (!isInt(s.attempts, 0, 100_000) || !isInt(s.correct, 0, s.attempts)) return null;
  if (!isInt(s.avgMs, 0, 3_600_000) || !isInt(s.box, 0, TOP_BOX)) return null;
  if (!isInt(s.lastSeen, 0, nowMs + 86_400_000)) return null;
  if (!Array.isArray(s.quickDays) || s.quickDays.length > FLUENT_DAYS) return null;
  if (!s.quickDays.every((d) => typeof d === 'string' && DAY.test(d) && !Number.isNaN(Date.parse(d)))) return null;
  // Impossibly fast over several answers: a script, not a student.
  if (s.attempts >= 3 && s.avgMs < MIN_AVG_MS) return null;
  return {
    key: s.key, attempts: s.attempts, correct: s.correct, avgMs: s.avgMs, box: s.box, lastSeen: s.lastSeen,
    quickDays: s.quickDays as string[],
  };
}

function checkFacts(x: Record<string, unknown>, nowMs: number): Checked<FactsItem> {
  if (nowMs >= OLD_SAVES_UNTIL) return { ok: false, problem: 'old-save' };
  if (x.pack !== 'times-tables') return { ok: false, problem: 'pack' };
  if (!Array.isArray(x.facts) || x.facts.length > MAX_FACTS) return { ok: false, problem: 'facts' };
  // A bad record is left out; the good ones still save.
  const seen = new Set<string>();
  const facts: FactStats[] = [];
  for (const raw of x.facts) {
    const fact = checkFact(raw, nowMs);
    if (fact && !seen.has(fact.key)) {
      seen.add(fact.key);
      facts.push(fact);
    }
  }
  return { ok: true, item: { type: 'facts', pack: 'times-tables', facts } };
}

function checkAnswers(x: Record<string, unknown>, nowMs: number): Checked<AnswersItem> {
  const pack = FOCUS_PACKS.find((p) => p === x.pack);
  if (!pack) return { ok: false, problem: 'pack' };
  if (typeof x.batchId !== 'string' || !UUID.test(x.batchId)) return { ok: false, problem: 'batch-id' };
  if (!Array.isArray(x.answers) || x.answers.length > MAX_ANSWERS) return { ok: false, problem: 'answers' };
  // A bad answer is left out (an impossibly quick one too, or one whose question doesn't hold up); the good ones still count.
  const answers: FactAnswer[] = [];
  for (const raw of x.answers) {
    const a = (raw ?? {}) as Record<string, unknown>;
    if (typeof a.key !== 'string' || !isFocusKey(a.key) || packIdOfKey(a.key) !== pack) continue;
    if (!isInt(a.ms, MIN_AVG_MS, 3_600_000) || !isInt(a.at, nowMs - 60 * 86_400_000, nowMs + 86_400_000)) continue;
    const correct = a.parts === undefined ? oldStyleCorrect(a, nowMs) : markShown(a, a.key);
    if (correct === null) continue;
    answers.push({ key: a.key, correct, ms: a.ms, at: a.at });
  }
  return { ok: true, item: { type: 'answers', pack, batchId: x.batchId, answers } };
}

/** Marks an answer from the question as it was shown: right, wrong, or null when that question can't be this record's. */
function markShown(a: Record<string, unknown>, key: string): boolean | null {
  const { parts, given, params } = a;
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_PARTS) return null;
  if (!parts.every((p) => typeof p === 'string' && p.length <= MAX_PART_LENGTH)) return null;
  if (typeof given !== 'number' || !Number.isFinite(given)) return null;
  if (params !== undefined && !cleanParams(params)) return null;
  const solved = solveClaim({ parts, key, params });
  if (!solved || !solved.keys.includes(key)) return null;
  return sameAnswer(given, solved.answer);
}

/** An answer from a browser older than 20 Oct 2026 (no question shown): its own word, until `OLD_SAVES_UNTIL`. */
function oldStyleCorrect(a: Record<string, unknown>, nowMs: number): boolean | null {
  return nowMs < OLD_SAVES_UNTIL && typeof a.correct === 'boolean' ? a.correct : null;
}

/** Trial progress: stars must be 0–3 and Level Keys only in campaign order, as the game allows. */
function checkImport(x: Record<string, unknown>): Checked<ImportItem> {
  if (!Array.isArray(x.levels) || x.levels.length > CAMPAIGN.length) return { ok: false, problem: 'levels' };
  const byId = new Map<string, { stars: number; keyPassed: boolean }>();
  for (const raw of x.levels) {
    const l = (raw ?? {}) as Record<string, unknown>;
    if (typeof l.levelId !== 'string' || !findLevel(l.levelId)) return { ok: false, problem: 'level' };
    if (!isInt(l.stars, 0, 3) || typeof l.keyPassed !== 'boolean') return { ok: false, problem: 'level' };
    byId.set(l.levelId, { stars: l.stars, keyPassed: l.keyPassed });
  }
  const levels: ImportItem['levels'] = [];
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const p = byId.get(CAMPAIGN[i].id);
    if (!p || p.stars === 0) continue;
    // Played a level that wasn't open, or a Key without a win: stop there.
    if (i > 0 && !byId.get(CAMPAIGN[i - 1].id)?.keyPassed) break;
    levels.push({ levelId: CAMPAIGN[i].id, stars: p.stars, keyPassed: p.keyPassed });
    if (!p.keyPassed) break;
  }
  return { ok: true, item: { type: 'import', levels } };
}

/** Checks one item from a save request. */
export function checkItem(raw: unknown, nowMs: number): Checked<SaveItem> {
  if (!raw || typeof raw !== 'object') return { ok: false, problem: 'item' };
  const x = raw as Record<string, unknown>;
  switch (x.type) {
    case 'run':
      return checkRun(x);
    case 'key':
      return checkKey(x);
    case 'facts':
      return checkFacts(x, nowMs);
    case 'answers':
      return checkAnswers(x, nowMs);
    case 'import':
      return checkImport(x);
    default:
      return { ok: false, problem: 'type' };
  }
}
