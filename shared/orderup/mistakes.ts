/**
 * Why a pick or an answer was wrong, and the hint for it (docs/ORDERUP-PLAN.md, "Mistakes table"). The words here are the
 * ones on screen and read aloud by Bella, so screens and clips share them.
 */
import {
  findNode,
  format,
  isNum,
  nextStep,
  ruleOfOp,
  stepForPick,
  tokensOf,
  walk,
  type Node,
  type Op,
} from "./expr";

export type PickMistake =
  /** + or − picked while a × or ÷ step must come first (4 + 3 in 4 + 3 × 5). */
  | "rank"
  /** Same rank, but one further left must come first (× before an earlier ÷, + before an earlier −). */
  | "left-to-right"
  /** A step outside brackets while there is work inside them. */
  | "brackets-first"
  /** A sign picked while a number with an exponent next to it must be done first (2 × 3 in 2 × 3²). */
  | "exponent-first"
  /** Two numbers not joined by one sign. */
  | "not-same-step";

export type AnswerMistake =
  /** 3² typed as 3 × 2. */
  | "power-as-times"
  /** 3 × 5 typed as 3 + 5. */
  | "added-not-multiplied"
  /** 12 ÷ 3 typed as 12 − 3 or 12 × 3. */
  | "divide-slip"
  | "wrong";

export type PickResult =
  | { ok: true; step: Node }
  | { ok: false; mistake: PickMistake; next: Node | null };

/** The sign token between two number tokens, when they sit side by side with no bracket between. */
function signBetween(
  root: Node,
  a: number,
  b: number,
): { op: Op; crossesBracket: boolean } | null {
  const tokens = tokensOf(root);
  let i = tokens.findIndex((t) => t.kind === "num" && t.id === a);
  let j = tokens.findIndex((t) => t.kind === "num" && t.id === b);
  if (i < 0 || j < 0) return null;
  if (i > j) [i, j] = [j, i];
  const between = tokens.slice(i + 1, j);
  const ops = between.filter((t) => t.kind === "op");
  if (ops.length !== 1 || between.some((t) => t.kind === "num")) return null;
  const op = ops[0];
  return {
    op: op.kind === "op" ? op.op : "+",
    crossesBracket: between.some(
      (t) => t.kind === "open" || t.kind === "close",
    ),
  };
}

/** Is the node with this id inside brackets? */
function insideBrackets(root: Node, id: number): boolean {
  const path = (n: Node, inGroup: boolean): boolean | null => {
    if (n.id === id) return inGroup;
    const kids =
      n.kind === "bin"
        ? [n.left, n.right]
        : n.kind === "pow"
          ? [n.base]
          : n.kind === "group"
            ? [n.inner]
            : [];
    for (const k of kids) {
      const r = path(k, inGroup || n.kind === "group");
      if (r !== null) return r;
    }
    return null;
  };
  return path(root, false) ?? false;
}

/** Checks a pick (one number with an exponent, or two numbers). Every ready step is allowed. */
export function checkPick(root: Node, ids: readonly number[]): PickResult {
  const step = stepForPick(root, ids);
  if (step) return { ok: true, step };
  const next = nextStep(root);
  if (ids.length !== 2) return { ok: false, mistake: "not-same-step", next };
  const sign = signBetween(root, ids[0], ids[1]);
  if (!sign) return { ok: false, mistake: "not-same-step", next };
  if (!next) return { ok: false, mistake: "not-same-step", next };
  const pow = walk(root).some(
    (n) =>
      n.kind === "pow" &&
      isNum(n.base) &&
      (n.base.id === ids[0] || n.base.id === ids[1]),
  );
  if (
    sign.crossesBracket ||
    (insideBrackets(root, next.id) &&
      !ids.every((id) => insideBrackets(root, id)))
  )
    return { ok: false, mistake: "brackets-first", next };
  if (pow || next.kind === "pow")
    return { ok: false, mistake: "exponent-first", next };
  if (
    next.kind === "bin" &&
    ruleOfOp(sign.op) === "add-subtract" &&
    ruleOfOp(next.op) === "times-divide"
  )
    return { ok: false, mistake: "rank", next };
  return { ok: false, mistake: "left-to-right", next };
}

/** Why a typed answer for a step is wrong. */
export function answerMistake(step: Node, given: number): AnswerMistake {
  if (
    step.kind === "pow" &&
    isNum(step.base) &&
    given === step.base.value * step.exp
  )
    return "power-as-times";
  if (step.kind === "bin" && isNum(step.left) && isNum(step.right)) {
    const [a, b] = [step.left.value, step.right.value];
    if (step.op === "×" && given === a + b) return "added-not-multiplied";
    if (step.op === "÷" && (given === a - b || given === a * b))
      return "divide-slip";
  }
  return "wrong";
}

/** The hint for a wrong pick, naming the step that goes next. */
export function pickHint(mistake: PickMistake, next: Node | null): string {
  const step = next ? format(next) : "";
  switch (mistake) {
    case "rank":
      return `Multiply and divide before you add and subtract. Do ${step} first.`;
    case "left-to-right": {
      const team =
        next?.kind === "bin" && ruleOfOp(next.op) === "times-divide"
          ? "× and ÷"
          : "+ and −";
      return `${team} are a team. Go left to right: ${step} first.`;
    }
    case "brackets-first":
      return "Brackets first. Work inside the brackets before anything else.";
    case "exponent-first":
      return `Exponents come straight after brackets. Do ${step} first.`;
    case "not-same-step":
      return "Those numbers aren't joined by one sign. Pick two numbers with one sign between them.";
  }
}

/** The hint for a wrong answer to a step. */
export function answerHint(mistake: AnswerMistake, step: Node): string {
  const text = format(step);
  if (mistake === "power-as-times" && step.kind === "pow" && isNum(step.base)) {
    const b = step.base.value;
    return `${text} means ${Array(step.exp).fill(b).join(" × ")}, not ${b} × ${step.exp}.`;
  }
  if (
    mistake === "added-not-multiplied" &&
    step.kind === "bin" &&
    isNum(step.left) &&
    isNum(step.right)
  )
    return `${text} means ${step.left.value} groups of ${step.right.value}, not ${step.left.value} + ${step.right.value}.`;
  if (
    mistake === "divide-slip" &&
    step.kind === "bin" &&
    isNum(step.left) &&
    isNum(step.right)
  )
    return `${text} asks how many ${step.right.value}s fit into ${step.left.value}.`;
  return `Not yet. Try ${text} again.`;
}

/** The node with this id, for the browser to show which step a hint means. */
export const nodeById = findNode;
