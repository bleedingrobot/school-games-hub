/**
 * One Star Web solo sky (docs/STARWEB-PLAN.md "Changes from the class rules"): the class game's fact reader, checker and
 * link finder (shared/classlive/stars.ts), with the solo caps on top. The browser runs this for instant feedback and the
 * server runs it again on every save, so both agree on every star.
 */
import { ARMS, ARM_GOAL, ARM_NAMES, MAX_STARS, factKey, factText, isTrue, linkOf, readFact, show, type Anchor, type Arm, type Fact } from '../classlive/stars';
import { GOLD, SILVER, WILD_CAP, type Medal } from './config';

/** A star as a solo sky keeps it (short keys: it is saved as jsonb). */
export interface SoloStar {
  /** factKey: the same fact written another way has the same key. */
  k: string;
  /** The fact as shown ("12 × 7 = 84"). */
  t: string;
  a: Arm;
  /** How we know. */
  h: string;
}

export interface SoloSky {
  anchor: Anchor;
  stars: SoloStar[];
}

export type SoloReply =
  | { result: 'new'; star: SoloStar }
  | { result: 'again'; star: SoloStar }
  | { result: 'same' | 'unlinked' | 'wrong'; text: string; fact: Fact }
  | { result: 'unreadable' | 'full' };

/** A pupil's try at a fact: what it is and, if it's a new linked fact, the star (not added: see `addTry`). */
export function judge(sky: SoloSky, text: unknown): SoloReply {
  const fact = readFact(text);
  if (!fact) return { result: 'unreadable' };
  const t = factText(fact);
  if (!isTrue(fact)) return { result: 'wrong', text: t, fact };
  const link = linkOf(fact, sky.anchor);
  if (link === 'same') return { result: 'same', text: t, fact };
  if (!link) return { result: 'unlinked', text: t, fact };
  const k = factKey(fact);
  const found = sky.stars.find((s) => s.k === k);
  if (found) return { result: 'again', star: found };
  if (sky.stars.length >= MAX_STARS) return { result: 'full' };
  return { result: 'new', star: { k, t, a: link.arm, h: link.how } };
}

/** The sky after a try (a new star added), and the reply. */
export function addTry(sky: SoloSky, text: unknown): { sky: SoloSky; reply: SoloReply } {
  const reply = judge(sky, text);
  return { sky: reply.result === 'new' ? { ...sky, stars: [...sky.stars, reply.star] } : sky, reply };
}

export const armCounts = (stars: readonly SoloStar[]): Record<Arm, number> =>
  Object.fromEntries(ARMS.map((a) => [a, stars.filter((s) => s.a === a).length])) as Record<Arm, number>;

export const armLit = (stars: readonly SoloStar[], arm: Arm) => stars.filter((s) => s.a === arm).length >= ARM_GOAL[arm];
export const allLit = (stars: readonly SoloStar[]) => ARMS.every((a) => armLit(stars, a));
export const litArms = (stars: readonly SoloStar[]) => ARMS.filter((a) => armLit(stars, a));

/** Stars that count for silver and gold: every star but Wild links past WILD_CAP. */
export function countedStars(stars: readonly SoloStar[]): number {
  let wild = 0;
  let n = 0;
  for (const s of stars) {
    if (s.a === 'wild' && ++wild > WILD_CAP) continue;
    n++;
  }
  return n;
}

/** Bronze when every arm is lit, silver at 25 counted stars, gold (supernova) at 30. */
export function medalOf(stars: readonly SoloStar[]): Medal {
  if (!allLit(stars)) return 0;
  const n = countedStars(stars);
  return n >= GOLD ? 3 : n >= SILVER ? 2 : 1;
}

/** The emptiest arm still to light, or null when all are lit. */
export function emptiestArm(stars: readonly SoloStar[]): Arm | null {
  const counts = armCounts(stars);
  let best: Arm | null = null;
  for (const arm of ARMS) {
    if (counts[arm] >= ARM_GOAL[arm]) continue;
    if (best === null || counts[arm] / ARM_GOAL[arm] < counts[best] / ARM_GOAL[best]) best = arm;
  }
  return best;
}

/** Where to start for an arm, from the known fact's own numbers: never a whole fact. */
export function startingPoint(arm: Arm, { x, y, p }: Anchor): string {
  switch (arm) {
    case 'turn': return `start from ${y} ×`;
    case 'divide': return `start from ${p} ÷`;
    case 'double': return `start from ${x * 2} × or ${y * 2} ×`;
    case 'halve': return x % 2 === 0 ? `start from ${x / 2} ×` : y % 2 === 0 ? `start from ${y / 2} ×` : `start from ${show(x * 50)} ×`;
    case 'tens': return `start from ${x * 10} ×`;
    case 'near': return `start from ${x} × ${y + 1}`;
    case 'wild': return `start from ${p} +`;
  }
}

/**
 * The next-step line, always there (docs/STARWEB-PLAN.md design 7): the arm still to light and a starting point, never a
 * whole fact. Once every arm is lit it points at the next medal.
 */
export function nextStep(sky: SoloSky): string {
  const arm = emptiestArm(sky.stars);
  if (arm) {
    const need = ARM_GOAL[arm] - sky.stars.filter((s) => s.a === arm).length;
    return `${ARM_NAMES[arm]} needs ${need} more ${need === 1 ? 'star' : 'stars'}: ${startingPoint(arm, sky.anchor)}.`;
  }
  const n = countedStars(sky.stars);
  if (n < SILVER) return `Every arm is lit! ${SILVER - n} more for silver.`;
  if (n < GOLD) return `Silver! ${GOLD - n} more for gold and a supernova.`;
  return 'Gold! Find more if you like, or press Finish.';
}

/** The shape of a fact without its answer ("×6,14"), so wrong tries at the same fact are counted together. */
export const shapeOf = (f: Fact) => `${f.op}${f.a},${f.b}`;

const trueAnswer = (f: Fact): number | null => {
  if (f.op === '+') return f.a + f.b;
  if (f.op === '-') return f.a - f.b;
  if (f.op === '×') return (f.a * f.b) / 100;
  if (f.b === 0) return null;
  return (f.a * 100) / f.b;
};

/**
 * A "why" line for a common slip (docs/STARWEB-PLAN.md design 8), or null. It names the slip, and gives the answer only
 * where the plan's table does (the pupil has already written the fact).
 */
export function whyLine(f: Fact, { x, y, p }: Anchor): string | null {
  if (f.op !== '×') return null;
  const [u, v] = [f.a / 100, f.b / 100];
  const pairs: [number, number][] = [[x, y], [y, x]];
  for (const [px, py] of pairs) {
    if (u === px * 2 && v === py * 2 && f.c === p * 200) return 'Double both numbers and the answer is 4 times as big.';
    if (u === px * 10 && v === py * 10 && f.c === p * 1000) return 'Each × 10 makes it 10 times bigger.';
    if (u === px && Math.abs(v - py) === 1) {
      const more = v > py;
      const wrongGroup = more ? p + py : p - py;
      if (f.c === wrongGroup * 100 && px !== py) return `${show(f.a)} × ${show(f.b)} is one ${more ? 'more' : 'fewer'} group of ${px}: ${p} ${more ? '+' : '−'} ${px}.`;
    }
    if ((u * 2 === px && v === py) || (u === px && v * 2 === py)) {
      if (p % 2 === 1 || f.c !== p * 50) return `Half of ${p} is ${show(p * 50)}.`;
    }
  }
  return null;
}

/**
 * The working for a fact tried wrong twice (docs/STARWEB-PLAN.md "How a sky plays" 3): how it links to the known fact,
 * with the last step left to do. Null when the fact doesn't link at all.
 */
export function workingFor(f: Fact, k: Anchor): string | null {
  const c = trueAnswer(f);
  if (c === null || !Number.isInteger(c) || c < 0) return null;
  const right: Fact = { ...f, c };
  const link = linkOf(right, k);
  if (!link || link === 'same') return null;
  const lhs = `${show(f.a)} ${f.op === '-' ? '−' : f.op} ${show(f.b)}`;
  const known = `${k.x} × ${k.y}`;
  if (link.arm === 'turn') return `${lhs} is ${known} turned around: the answer doesn't change.`;
  if (link.arm === 'divide') return `${lhs}: how many ${show(f.b)}s make ${show(f.a)}? Use ${known} = ${k.p}.`;
  if (link.arm === 'near') return `${lhs} is ${known} with one group more or fewer. Start from ${k.p}.`;
  if (link.arm === 'wild') return `Work out ${lhs} step by step. It uses ${k.p}.`;
  const ratio = c / (k.p * 100);
  if (ratio === 1) return `${lhs}: one number got bigger and the other smaller by the same, so the answer stays ${k.p}.`;
  const word = ratio === 2 ? 'double' : ratio === 4 ? 'double double' : ratio === 0.5 ? 'half of' : ratio === 0.25 ? 'half of half of'
    : ratio === 0.1 ? 'a tenth of' : ratio === 0.01 ? 'a hundredth of' : Number.isInteger(ratio) ? `${ratio} times` : null;
  if (!word) return `${lhs} links to ${known} = ${k.p}. How did each number change?`;
  return `${lhs} is ${word} ${known}, so the answer is ${word} ${k.p}.`;
}

/** A worked example for "Show me", on a different fact from this sky's (never this sky's answers). */
export function showMe(arm: Arm, k: Anchor): string[] {
  const [x, y] = k.x * k.y === 10 ? [3, 4] : [2, 5];
  const p = x * y;
  const known = `We know ${x} × ${y} = ${p}.`;
  switch (arm) {
    case 'turn': return [known, `Turn it around: ${y} × ${x} = ${p}. Same answer!`];
    case 'divide': return [known, `Division undoes it: ${p} ÷ ${x} = ${y}, and ${p} ÷ ${y} = ${x}.`];
    case 'double': return [known, `Double the ${y}: ${x} × ${y * 2}. Double the answer too: ${p * 2}.`, `So ${x} × ${y * 2} = ${p * 2}.`];
    case 'halve': return [known, `Halve the ${x}: ${x / 2} × ${y}. Halve the answer too: ${p / 2}.`, `So ${x / 2} × ${y} = ${p / 2}.`];
    case 'tens': return [known, `Make the ${x} ten times bigger: ${x * 10} × ${y}. The answer is ten times bigger: ${p * 10}.`, `So ${x * 10} × ${y} = ${p * 10}.`];
    case 'near': return [known, `${x} × ${y + 1} is one more group of ${x}: ${p} + ${x} = ${p + x}.`, `So ${x} × ${y + 1} = ${p + x}.`];
    case 'wild': return [known, `Make ${p} another way: ${p - 1} + 1 = ${p}, or ${p * 2} ÷ 2 = ${p}.`];
  }
}
