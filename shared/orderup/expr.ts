/**
 * Order Up!'s expression engine (docs/ORDERUP-PLAN.md, stage 2). Pure functions shared by the browser and the server.
 *
 * An expression is a tree. The parser builds it with the order of operations already in its shape, so a step is allowed
 * exactly when its node is "ready": a sign with a plain number on each side, or a plain number with an exponent. Doing a
 * step replaces its node with the answer, and brackets round a single number drop away: 4 + 3 × 5 → 4 + 15 → 19.
 */

export type Op = "+" | "−" | "×" | "÷";
/** The four rules on the order card, in order. */
export type Rule = "brackets" | "exponents" | "times-divide" | "add-subtract";

export type Node =
  | { kind: "num"; id: number; value: number }
  | { kind: "bin"; id: number; op: Op; left: Node; right: Node }
  | { kind: "pow"; id: number; base: Node; exp: number }
  | { kind: "group"; id: number; inner: Node };

/** What the pupil sees, left to right. A number with an exponent is one token (`exp`), and so is a closing bracket with one. */
export type Token =
  | { kind: "num"; id: number; value: number; exp?: number }
  | { kind: "op"; id: number; op: Op }
  | { kind: "open"; id: number }
  | { kind: "close"; id: number; exp?: number };

const SUPER: Record<string, number> = { "²": 2, "³": 3 };
const OPS: Record<string, Op> = {
  "+": "+",
  "-": "−",
  "−": "−",
  "*": "×",
  x: "×",
  "×": "×",
  "/": "÷",
  "÷": "÷",
};

/**
 * Reads "18 − (2 + 1)² ÷ 3". ASCII works too (- * / ^2). Letters a to h are blanks, filled from `fill` in order (for the
 * problem makers' patterns). Throws on anything it can't read.
 */
export function parse(text: string, fill: readonly number[] = []): Node {
  const src = text.replace(/\^2/g, "²").replace(/\^3/g, "³");
  let at = 0;
  let nextId = 1;
  let blank = 0;
  const skip = () => {
    while (src[at] === " ") at++;
  };
  const peek = () => {
    skip();
    return src[at];
  };
  const expr = (): Node => {
    let node = term();
    while (
      peek() !== undefined &&
      OPS[peek()] &&
      (OPS[peek()] === "+" || OPS[peek()] === "−")
    ) {
      const op = OPS[src[at++]];
      node = { kind: "bin", id: nextId++, op, left: node, right: term() };
    }
    return node;
  };
  const term = (): Node => {
    let node = power();
    while (
      peek() !== undefined &&
      OPS[peek()] &&
      (OPS[peek()] === "×" || OPS[peek()] === "÷")
    ) {
      const op = OPS[src[at++]];
      node = { kind: "bin", id: nextId++, op, left: node, right: power() };
    }
    return node;
  };
  const power = (): Node => {
    const base = atom();
    const c = src[at];
    if (c !== undefined && SUPER[c]) {
      at++;
      return { kind: "pow", id: nextId++, base, exp: SUPER[c] };
    }
    return base;
  };
  const atom = (): Node => {
    const c = peek();
    if (c === "(") {
      at++;
      const id = nextId++;
      const inner = expr();
      if (peek() !== ")") throw new Error(`Missing ) in "${text}"`);
      at++;
      return { kind: "group", id, inner };
    }
    if (c !== undefined && /[a-h]/.test(c)) {
      at++;
      if (blank >= fill.length)
        throw new Error(`No number for blank ${blank + 1} in "${text}"`);
      return { kind: "num", id: nextId++, value: fill[blank++] };
    }
    const m = /^\d+/.exec(src.slice(at));
    if (!m) throw new Error(`Can't read "${text}" at ${at}`);
    at += m[0].length;
    return { kind: "num", id: nextId++, value: Number(m[0]) };
  };
  const root = expr();
  if (peek() !== undefined) throw new Error(`Left over in "${text}" at ${at}`);
  return root;
}

/** How many blanks (letters a to h) a pattern has. */
export const blanksIn = (pattern: string) =>
  (pattern.match(/[a-h]/g) ?? []).length;

export const isNum = (n: Node): n is Extract<Node, { kind: "num" }> =>
  n.kind === "num";

/** The rule a node's step uses (its colour on the order card). */
export function ruleOf(node: Node): Rule {
  if (node.kind === "pow") return "exponents";
  if (node.kind === "group") return "brackets";
  if (node.kind === "bin")
    return node.op === "×" || node.op === "÷" ? "times-divide" : "add-subtract";
  return "add-subtract";
}

/** The rule for a sign. */
export const ruleOfOp = (op: Op): Rule =>
  op === "×" || op === "÷" ? "times-divide" : "add-subtract";

/** A step that can be done now: a sign with a number each side, or a number with an exponent. */
export function isReady(node: Node): boolean {
  if (node.kind === "bin") return isNum(node.left) && isNum(node.right);
  if (node.kind === "pow") return isNum(node.base);
  return false;
}

/** Every node, parents before children, left to right. */
export function walk(node: Node, out: Node[] = []): Node[] {
  out.push(node);
  if (node.kind === "bin") {
    walk(node.left, out);
    walk(node.right, out);
  } else if (node.kind === "pow") walk(node.base, out);
  else if (node.kind === "group") walk(node.inner, out);
  return out;
}

export const findNode = (root: Node, id: number) =>
  walk(root).find((n) => n.id === id);

/** The steps that are allowed now, left to right. */
export const readySteps = (root: Node): Node[] => walk(root).filter(isReady);

/** The step the usual order does next: the first ready step in working order (inside out, left to right). */
export function nextStep(root: Node): Node | null {
  const visit = (n: Node): Node | null => {
    if (isReady(n)) return n;
    if (n.kind === "bin") return visit(n.left) ?? visit(n.right);
    if (n.kind === "pow") return visit(n.base);
    if (n.kind === "group") return visit(n.inner);
    return null;
  };
  return visit(root);
}

/** A ready step's answer. Not a whole number (a division that doesn't go) gives NaN. */
export function stepValue(node: Node): number {
  if (node.kind === "pow" && isNum(node.base))
    return node.base.value ** node.exp;
  if (node.kind === "bin" && isNum(node.left) && isNum(node.right)) {
    const [a, b] = [node.left.value, node.right.value];
    if (node.op === "+") return a + b;
    if (node.op === "−") return a - b;
    if (node.op === "×") return a * b;
    return b !== 0 && a % b === 0 ? a / b : NaN;
  }
  throw new Error("Not a ready step");
}

/** The value of the whole expression, worked the usual way. */
export function valueOf(node: Node): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "group":
      return valueOf(node.inner);
    case "pow":
      return valueOf(node.base) ** node.exp;
    case "bin": {
      const [a, b] = [valueOf(node.left), valueOf(node.right)];
      if (node.op === "+") return a + b;
      if (node.op === "−") return a - b;
      if (node.op === "×") return a * b;
      return a / b;
    }
  }
}

/** Does the step with this id: its node becomes the answer (same id), and brackets round a lone number drop. */
export function applyStep(root: Node, id: number): Node {
  const step = findNode(root, id);
  if (!step || !isReady(step)) throw new Error(`Step ${id} is not ready`);
  const value = stepValue(step);
  const swap = (n: Node): Node => {
    if (n.id === id) return { kind: "num", id, value };
    if (n.kind === "bin")
      return { ...n, left: swap(n.left), right: swap(n.right) };
    if (n.kind === "pow") return { ...n, base: swap(n.base) };
    if (n.kind === "group") {
      const inner = swap(n.inner);
      return isNum(inner) ? inner : { ...n, inner };
    }
    return n;
  };
  return swap(root);
}

/** The tokens to draw. */
export function tokensOf(node: Node): Token[] {
  switch (node.kind) {
    case "num":
      return [{ kind: "num", id: node.id, value: node.value }];
    case "bin":
      return [
        ...tokensOf(node.left),
        { kind: "op", id: node.id, op: node.op },
        ...tokensOf(node.right),
      ];
    case "group":
      return [
        { kind: "open", id: node.id },
        ...tokensOf(node.inner),
        { kind: "close", id: node.id },
      ];
    case "pow": {
      const inner = tokensOf(node.base);
      const last = inner[inner.length - 1];
      inner[inner.length - 1] = { ...last, exp: node.exp } as Token;
      return inner;
    }
  }
}

const SUP = ["", "", "²", "³"];

/** The expression as text: "4 + 3 × 5", "(2 + 1)²". */
export function format(node: Node): string {
  let out = "";
  for (const t of tokensOf(node)) {
    if (t.kind === "num")
      out += `${out && !out.endsWith("(") ? " " : ""}${t.value}${t.exp ? SUP[t.exp] : ""}`;
    else if (t.kind === "op") out += ` ${t.op}`;
    else if (t.kind === "open")
      out += `${out && !out.endsWith("(") ? " " : ""}(`;
    else out += `)${t.exp ? SUP[t.exp] : ""}`;
  }
  return out;
}

/** How many steps the expression takes. */
export const stepCount = (node: Node): number =>
  walk(node).filter((n) => n.kind === "bin" || n.kind === "pow").length;

/**
 * The step a pick of numbers means, or null. One number with an exponent is its own step; two numbers mean the sign that
 * joins them. Ids are the number tokens' ids.
 */
export function stepForPick(root: Node, ids: readonly number[]): Node | null {
  for (const n of walk(root)) {
    if (
      ids.length === 1 &&
      n.kind === "pow" &&
      isNum(n.base) &&
      n.base.id === ids[0]
    )
      return n;
    if (
      ids.length === 2 &&
      n.kind === "bin" &&
      isNum(n.left) &&
      isNum(n.right)
    ) {
      const pair = [n.left.id, n.right.id];
      if (pair.includes(ids[0]) && pair.includes(ids[1]) && ids[0] !== ids[1])
        return n;
    }
  }
  return null;
}

/** Is this number token one with an exponent (a step on its own)? */
export function hasExponent(root: Node, id: number): boolean {
  return walk(root).some(
    (n) => n.kind === "pow" && isNum(n.base) && n.base.id === id,
  );
}
