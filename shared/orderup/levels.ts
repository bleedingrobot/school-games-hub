/**
 * The seven levels and their problem makers (docs/ORDERUP-PLAN.md, "Steps"). Each level is a list of patterns (letters are
 * numbers); a bag fills a pattern with random numbers until every step makes a whole number from 0 to the level's top.
 * The same seed makes the same bags, so the server can make them again to mark.
 */
import { ORDERUP } from "./config";
import {
  applyStep,
  blanksIn,
  format,
  isNum,
  nextStep,
  parse,
  stepValue,
  type Node,
} from "./expr";

/** The order-of-operations skill a bag counts for on the Skill map (shared/maths/skillPacks/bedmas.ts), or null for none yet. */
export type SkillKey =
  | "bedmas:left-to-right"
  | "bedmas:mul-first"
  | "bedmas:div-first"
  | "bedmas:brackets-first"
  | "bedmas:brackets-div"
  | "bedmas:mixed"
  | "bedmas:mixed-brackets";

interface Pattern {
  src: string;
  key: SkillKey | null;
  /** Fewer steps: given first to a child on full help. */
  short: boolean;
  /** Only + and −: allow bigger numbers. */
  big?: boolean;
}

const p = (
  key: SkillKey | null,
  short: boolean,
  big: boolean,
  ...srcs: string[]
): Pattern[] => srcs.map((src) => ({ src, key, short, big }));

export const LEVELS: { level: number; name: string; patterns: Pattern[] }[] = [
  {
    level: 1,
    name: "Left to right",
    patterns: [
      ...p(
        "bedmas:left-to-right",
        true,
        true,
        "a − b + c",
        "a + b − c",
        "a − b − c",
      ),
      ...p("bedmas:left-to-right", true, false, "a × b ÷ c", "a ÷ b × c"),
      ...p(
        "bedmas:left-to-right",
        false,
        true,
        "a − b + c − d",
        "a + b − c + d",
        "a − b − c + d",
      ),
      ...p(
        "bedmas:left-to-right",
        false,
        false,
        "a ÷ b × c ÷ d",
        "a × b ÷ c × d",
      ),
    ],
  },
  {
    level: 2,
    name: "× ÷ before + −",
    patterns: [
      ...p(
        "bedmas:mul-first",
        true,
        false,
        "a + b × c",
        "a − b × c",
        "a × b + c",
        "a × b − c",
      ),
      ...p(
        "bedmas:div-first",
        true,
        false,
        "a + b ÷ c",
        "a − b ÷ c",
        "a ÷ b + c",
        "a ÷ b − c",
      ),
      ...p(
        "bedmas:mixed",
        false,
        false,
        "a + b × c − d",
        "a × b + c × d",
        "a × b − c × d",
        "a − b ÷ c + d",
        "a + b × c ÷ d",
      ),
    ],
  },
  {
    level: 3,
    name: "Brackets",
    patterns: [
      ...p(
        "bedmas:brackets-first",
        true,
        false,
        "(a + b) × c",
        "(a − b) × c",
        "a × (b + c)",
        "a × (b − c)",
      ),
      ...p(
        "bedmas:brackets-div",
        true,
        false,
        "(a + b) ÷ c",
        "(a − b) ÷ c",
        "a ÷ (b + c)",
        "a ÷ (b − c)",
      ),
      ...p(
        "bedmas:mixed-brackets",
        false,
        false,
        "(a + b) × c − d",
        "a + b × (c − d)",
        "(a − b) × c + d",
        "(a + b) × (c − d)",
        "(a + b) ÷ (c − d)",
        "a × (b + c) − d",
      ),
    ],
  },
  {
    level: 4,
    name: "Exponents",
    patterns: [
      ...p(
        null,
        true,
        false,
        "a² + b",
        "a × b²",
        "a³ − b",
        "(a + b)²",
        "(a − b)²",
        "a² − b",
      ),
      ...p(
        null,
        false,
        false,
        "a² + b × c",
        "(a + b)² − c",
        "a × (b − c)²",
        "a³ + b²",
        "(a + b)² ÷ c",
        "a² − b²",
      ),
    ],
  },
  {
    level: 5,
    name: "All together",
    patterns: [
      ...p(
        null,
        true,
        false,
        "a + b × (c − d)",
        "(a + b)² − c × d",
        "a² ÷ (b + c)",
        "(a − b) × c²",
      ),
      ...p(
        null,
        false,
        false,
        "a − (b + c)² ÷ d",
        "((a + b) × c − d) ÷ e",
        "a × (b + (c − d) × e)",
        "(a² − b) ÷ (c + d)",
        "a + b × c² − (d + e)",
        "((a − b)² + c) × d",
      ),
    ],
  },
];

export const levelInfo = (level: number) =>
  LEVELS.find((l) => l.level === level);

const int = (random: () => number, lo: number, hi: number) =>
  lo + Math.floor(random() * (hi - lo + 1));

/** Does every step make a whole number from 0 to `max`, with times tables, divisions and powers kept small? */
export function fair(root: Node, max: number): boolean {
  let node = root;
  for (let guard = 0; guard < 20; guard++) {
    const step = nextStep(node);
    if (!step) return isNum(node);
    if (step.kind === "pow" && isNum(step.base)) {
      const top = step.exp === 2 ? ORDERUP.maxSquareBase : ORDERUP.maxCubeBase;
      if (step.base.value < 2 || step.base.value > top) return false;
    }
    if (step.kind === "bin" && isNum(step.left) && isNum(step.right)) {
      const [a, b] = [step.left.value, step.right.value];
      if (
        step.op === "×" &&
        (a > ORDERUP.maxFactor || b > ORDERUP.maxFactor || a < 2 || b < 2)
      )
        return false;
      if (
        step.op === "÷" &&
        (b < 2 || b > 10 || a / b > ORDERUP.maxFactor || a / b < 2)
      )
        return false;
      if ((step.op === "+" || step.op === "−") && (a === 0 || b === 0))
        return false;
    }
    const v = stepValue(step);
    if (!Number.isInteger(v) || v < 0 || v > max) return false;
    node = applyStep(node, step.id);
  }
  return false;
}

/** One bag: the expression and what it counts for. */
export interface Bag {
  level: number;
  pattern: string;
  key: SkillKey | null;
  expr: Node;
  /** The expression as text (for the ticket's first line and the saved record). */
  text: string;
  answer: number;
}

/** Fills a pattern until it's fair, or null after `ORDERUP.tries` tries. */
export function fillPattern(
  pattern: Pattern,
  level: number,
  random: () => number,
): Bag | null {
  const max = ORDERUP.maxValue[level];
  const blanks = blanksIn(pattern.src);
  for (let t = 0; t < ORDERUP.tries; t++) {
    const nums = Array.from({ length: blanks }, () =>
      pattern.big
        ? int(random, 3, 60)
        : int(random, 2, 12 + (random() < 0.4 ? 30 : 0)),
    );
    const expr = parse(pattern.src, nums);
    if (!fair(expr, max)) continue;
    let node = expr;
    for (let s = nextStep(node); s; s = nextStep(node))
      node = applyStep(node, s.id);
    return {
      level,
      pattern: pattern.src,
      key: pattern.key,
      expr,
      text: format(expr),
      answer: isNum(node) ? node.value : NaN,
    };
  }
  return null;
}

/** One bag for a level: a short one or a longer one. */
export function makeBag(
  level: number,
  short: boolean,
  random: () => number,
): Bag {
  const info = levelInfo(level);
  if (!info) throw new Error(`No level ${level}`);
  const pool = info.patterns.filter((x) => x.short === short);
  const start = int(random, 0, pool.length - 1);
  for (let k = 0; k < pool.length; k++) {
    const bag = fillPattern(pool[(start + k) % pool.length], level, random);
    if (bag) return bag;
  }
  throw new Error(`Level ${level} made no fair bag`);
}

/** A set of bags: short ones first, then longer ones. Full help gives more short ones. */
export function makeSet(
  level: number,
  fullHelp: boolean,
  random: () => number,
): Bag[] {
  const shortCount = fullHelp
    ? ORDERUP.shortBags.full
    : ORDERUP.shortBags.normal;
  return Array.from({ length: ORDERUP.setSize }, (_, i) =>
    makeBag(level, i < shortCount, random),
  );
}

/** Level 6: the same numbers and signs with brackets round numbers `from` to `to` (counted from 0). */
export function withBrackets(flat: string, from: number, to: number): string {
  const parts = flat.split(" ");
  const numberAt: number[] = [];
  parts.forEach((t, i) => /^\d+$/.test(t) && numberAt.push(i));
  if (from < 0 || to >= numberAt.length || from >= to)
    throw new Error("Bad bracket span");
  parts[numberAt[from]] = `(${parts[numberAt[from]]}`;
  parts[numberAt[to]] = `${parts[numberAt[to]]})`;
  return parts.join(" ");
}

/** A level 6 bag: an expression with no brackets, and a target only brackets can reach. */
export interface BracketBag {
  flat: string;
  /** Its value with no brackets. */
  plain: number;
  target: number;
  /** One span that reaches the target (others may too). */
  span: [number, number];
}

const BRACKET_PATTERNS = [
  "a + b × c",
  "a × b + c",
  "a − b × c",
  "a × b − c",
  "a + b × c − d",
  "a × b + c × d",
  "a × b − c + d",
  "a + b ÷ c",
];

export function makeBracketBag(random: () => number): BracketBag {
  const max = ORDERUP.maxValue[6];
  for (let t = 0; t < ORDERUP.tries * 4; t++) {
    const src = BRACKET_PATTERNS[int(random, 0, BRACKET_PATTERNS.length - 1)];
    const nums = Array.from({ length: blanksIn(src) }, () =>
      int(random, 2, 12),
    );
    const flatExpr = parse(src, nums);
    if (!fair(flatExpr, max)) continue;
    const flat = format(flatExpr);
    const n = nums.length;
    const from = int(random, 0, n - 2);
    const to = int(random, from + 1, n - 1);
    if (from === 0 && to === n - 1) continue;
    const bracketed = parse(withBrackets(flat, from, to));
    if (!fair(bracketed, max)) continue;
    const [plain, target] = [
      valueAfterSteps(flatExpr),
      valueAfterSteps(bracketed),
    ];
    if (plain === target) continue;
    return { flat, plain, target, span: [from, to] };
  }
  throw new Error("Level 6 made no bag");
}

function valueAfterSteps(root: Node): number {
  let node = root;
  for (let s = nextStep(node); s; s = nextStep(node))
    node = applyStep(node, s.id);
  return isNum(node) ? node.value : NaN;
}

/** Does putting brackets round numbers `from` to `to` reach the target? (Any span that does counts.) */
export function bracketsReach(
  bag: BracketBag,
  from: number,
  to: number,
): boolean {
  try {
    const root = parse(withBrackets(bag.flat, from, to));
    return (
      fair(root, Number.MAX_SAFE_INTEGER) &&
      valueAfterSteps(root) === bag.target
    );
  } catch {
    return false;
  }
}
