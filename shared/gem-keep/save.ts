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
import { FLUENT_DAYS, TOP_BOX } from '../maths/config';
import { parseFactKey } from '../maths/facts';
import type { FactStats } from '../maths/leitner';
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

export interface ImportItem {
  type: 'import';
  levels: { levelId: string; stars: number; keyPassed: boolean }[];
}

export type SaveItem = RunItem | KeyItem | FactsItem | ImportItem;

export interface SaveRequest {
  items: SaveItem[];
}

/** What happened to each item, in order. */
export type ItemResult =
  | { type: 'run'; status: 'saved' | 'duplicate' | 'locked'; points: number | null }
  | { type: 'key'; status: 'passed' | 'already' | 'not-passed' | 'no-win' }
  | { type: 'facts'; changed: number }
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
/** An average answer quicker than this, over a few answers, isn't a person typing. */
export const MIN_AVG_MS = 250;

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
    case 'import':
      return checkImport(x);
    default:
      return { ok: false, problem: 'type' };
  }
}
