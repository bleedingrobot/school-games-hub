/**
 * Playing a wall and replaying a temple go (docs/GLYPH-PLAN.md, "How a wall works"). The browser judges each go at once
 * with `judgeGo` so the wall can open or shake; the server re-runs every go with `replayTemple` on the walls it makes
 * from its own seed, so nothing that counts comes from the browser.
 */
import { GOES_PER_WALL, HELP_RULES, HELP_TOP, MIN_GO_MS, PASS_FIRST_GO, RIGHT_MAX_HELP, TOP_TEMPLE, WALLS_PER_TEMPLE, type TrapKind } from './config';
import { equal, mistakeOf } from './fractions';
import { sameCells } from './glyphs';
import type { PublicWall, Wall } from './walls';
import { fadeAfter, type Fade } from '../kit/help';

/** The right cells of a wall, worked out from its tiles (the browser has no answer, only the tiles). */
export const rightCells = (wall: PublicWall): number[] => wall.tiles.flatMap((t, c) => (equal(t, wall.gold) ? [c] : []));

/** Which glyph the lit cells make, or -1 if none. */
export const glyphOfLit = (wall: PublicWall, lit: readonly number[]): number => wall.glyphs.findIndex((g) => sameCells(g, lit));

/** One go at a wall: the lit cells, the glyph picked (null: "none of them match"), and the time from the wall showing. */
export interface Go {
  lit: number[];
  pick: number | null;
  ms: number;
}

export type Outcome = 'open' | 'trap' | 'nomatch';
export type Mistake = TrapKind | 'missed';

export interface Judged {
  outcome: Outcome;
  /** Lit cells that aren't equal to the gold stone. */
  wrong: number[];
  /** Right cells that weren't lit. */
  missed: number[];
  /** The named mistakes this go shows (one per wrong tile, then 'missed'). */
  mistakes: Mistake[];
}

/**
 * Judges one go. Throws on a go the screen can't send: a cell off the grid or twice, a pick that doesn't match the lit
 * cells, or "none match" when one does.
 */
export function judgeGo(wall: PublicWall, go: Go): Judged {
  const lit = go.lit;
  if (!Array.isArray(lit) || lit.some((c) => !Number.isInteger(c) || c < 0 || c >= wall.tiles.length)) throw new Error('bad cells');
  if (new Set(lit).size !== lit.length) throw new Error('a cell twice');
  const made = glyphOfLit(wall, lit);
  if (go.pick === null) {
    if (made !== -1) throw new Error('a glyph matches');
  } else if (go.pick !== made) throw new Error('the glyph picked does not match the lit tiles');
  const right = rightCells(wall);
  const wrong = lit.filter((c) => !right.includes(c));
  const missed = right.filter((c) => !lit.includes(c));
  const mistakes: Mistake[] = wrong.map((c) => mistakeOf(wall.gold, wall.tiles[c]));
  if (missed.length) mistakes.push('missed');
  const outcome: Outcome = !wrong.length && !missed.length ? 'open' : made === -1 ? 'nomatch' : 'trap';
  return { outcome, wrong, missed, mistakes };
}

/** What the browser sends for one wall: its goes, and the most help shown on it (0 to 3, see HELP_TOP). */
export interface WallPlay {
  goes: Go[];
  help: number;
}

export interface WallResult {
  /** Opened at the first go (the temple pass counts these). */
  firstGo: boolean;
  /** Counts as right for the maths records: first go, no lens or arrows. */
  recordRight: boolean;
  /** Opened by the pupil (at either go); otherwise it opened with the answer shown. */
  opened: boolean;
  goes: number;
  help: number;
  mistakes: Mistake[];
  /** Time to the first go. */
  ms: number;
  /** The first go's lit cells, for the teacher (what was lit when it was wrong). */
  firstLit: number[];
}

export interface TempleResult {
  walls: WallResult[];
  /** Every wall was played to the end. */
  finished: boolean;
  firstGoes: number;
  passed: boolean;
}

/**
 * Replays a temple go on the server's walls. A wall's goes stop at the one that opens it or after GOES_PER_WALL; walls
 * are played in order, and a temple left part way counts the walls played. Throws on anything the screen can't send.
 */
export function replayTemple(walls: readonly Wall[], plays: readonly WallPlay[]): TempleResult {
  if (!Array.isArray(plays) || plays.length > walls.length) throw new Error('too many walls');
  const results: WallResult[] = plays.map((play, i) => {
    const goes = play?.goes;
    if (!Array.isArray(goes) || goes.length < 1 || goes.length > GOES_PER_WALL) throw new Error('bad goes');
    const help = Number.isInteger(play.help) ? Math.min(HELP_TOP, Math.max(0, play.help)) : HELP_TOP;
    const judged = goes.map((g) => {
      if (!Number.isFinite(g?.ms) || g.ms < MIN_GO_MS) throw new Error('too quick');
      return judgeGo(walls[i], g);
    });
    const openAt = judged.findIndex((j) => j.outcome === 'open');
    if (openAt !== -1 && openAt !== judged.length - 1) throw new Error('goes after the wall opened');
    if (openAt === -1 && judged.length < GOES_PER_WALL && i < plays.length - 1) throw new Error('wall left unfinished');
    const firstGo = openAt === 0;
    return {
      firstGo,
      recordRight: firstGo && help <= RIGHT_MAX_HELP,
      opened: openAt !== -1,
      goes: judged.length,
      help,
      mistakes: judged[0].mistakes,
      ms: Math.round(goes[0].ms),
      firstLit: [...goes[0].lit].sort((a, b) => a - b),
    };
  });
  const last = plays.length ? results[results.length - 1] : null;
  const finished = plays.length === WALLS_PER_TEMPLE && !!last && (last.opened || last.goes === GOES_PER_WALL);
  const firstGoes = results.filter((w) => w.firstGo).length;
  return { walls: results, finished, firstGoes, passed: finished && firstGoes >= PASS_FIRST_GO };
}

/** A pupil's saved place: temples passed, best first goes per temple, help, guide seen. */
export interface Progress {
  /** The highest temple passed (0: none). Temple `passed + 1` is open; every temple up to it can be replayed. */
  passed: number;
  /** Best first goes in one go at each temple, by temple id. */
  best: Record<string, number>;
  help: Fade;
  walls: number;
  guideSeen: boolean;
}

export const emptyProgress = (): Progress => ({ passed: 0, best: {}, help: { level: 2, goodInRow: 0 }, walls: 0, guideSeen: false });

export const templeOpen = (p: Progress, temple: number): boolean => temple >= 1 && temple <= Math.min(TOP_TEMPLE, p.passed + 1);

/** The progress after a finished (or part) temple go. Help fades or comes back only on a finished go. */
export function progressAfter(p: Progress, temple: number, result: TempleResult): Progress {
  const best = { ...p.best };
  if (result.finished) best[temple] = Math.max(best[temple] ?? 0, result.firstGoes);
  const passed = result.passed && temple === p.passed + 1 ? temple : p.passed;
  const help = result.finished ? fadeAfter(p.help, result.firstGoes, HELP_RULES) : p.help;
  return { passed, best, help: { level: help.level, goodInRow: help.goodInRow }, walls: p.walls + result.walls.filter((w) => w.opened).length, guideSeen: true };
}
