/**
 * Card Y6: the right answer to an algebra question, worked out from the screen text alone (the prompt and parts), with plain
 * arithmetic and never by calling the generators. A pick question about a rule or a sentence has no number: it answers null
 * and is checked in algebra.test.ts.
 */
const num = (text: string) => Number(text.replace('−', '-'));
const must = <T>(found: T | null | undefined): T => {
  if (found === null || found === undefined) throw new Error('algebra oracle: could not read the question');
  return found;
};

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  if (!key.startsWith('alg:')) return null;
  const p = prompt ?? '';
  switch (key) {
    case 'alg:sub-sq': {
      const m = must(/^When [a-z] = (\d+)$/.exec(p));
      return num(m[1]) ** 2;
    }
    case 'alg:sub-area': {
      const m = must(/^A = lw, when l = (\d+) and w = (\d+)$/.exec(p));
      return num(m[1]) * num(m[2]);
    }
    case 'alg:sub-lin': {
      const v = must(/^When ([a-z]) = (\d+)$/.exec(p));
      const m = must(/^(\d+)[a-z] ([+−]) (\d+)$/.exec(parts[0]));
      const base = num(m[1]) * num(v[2]);
      return m[2] === '+' ? base + num(m[3]) : base - num(m[3]);
    }
    case 'alg:eq-add': {
      const m = must(/^If [a-z] ([+−]) (\d+) = (\d+)$/.exec(p));
      return m[1] === '+' ? num(m[3]) - num(m[2]) : num(m[3]) + num(m[2]);
    }
    case 'alg:eq-mul': {
      const m = must(/^If (\d+)[a-z] = (\d+)$/.exec(p));
      return num(m[2]) / num(m[1]);
    }
    case 'alg:eq-div': {
      const m = must(/^If [a-z] ÷ (\d+) = (\d+)$/.exec(p));
      return num(m[1]) * num(m[2]);
    }
    case 'alg:eq-two': {
      const m = must(/^If (\d+)[a-z] ([+−]) (\d+) = (\d+)$/.exec(p));
      const right = m[2] === '+' ? num(m[4]) - num(m[3]) : num(m[4]) + num(m[3]);
      return right / num(m[1]);
    }
    case 'alg:like-add':
      return parts[0].split(' + ').map((t) => (t.length === 1 ? 1 : num(t.slice(0, -1)))).reduce((a, b) => a + b, 0);
    case 'alg:like-sub': {
      const [a, b] = parts[0].split(' − ').map((t) => (t.length === 1 ? 1 : num(t.slice(0, -1))));
      return a - b;
    }
    case 'alg:pat-next': {
      const seen = parts.filter((x) => x !== '?').map((x) => num(x.replace(',', '')));
      return seen[seen.length - 1] + (seen[1] - seen[0]);
    }
    case 'alg:pat-term': {
      const m = must(/^Rule: t = (\d+)n \+ (\d+)$/.exec(p));
      const n = must(/^(\d+)th term$/.exec(parts[0]));
      return num(m[1]) * num(n[1]) + num(m[2]);
    }
    case 'alg:eq2-dec': {
      const m = must(/^If [a-z] \+ (\d+) = (\d+(?:\.\d+)?)$/.exec(p));
      return Math.round((num(m[2]) - num(m[1])) * 100) / 100;
    }
    case 'alg:eq2-ineq': {
      const m = must(/^If [a-z] ([+−]) (\d+) [≥≤] (−?\d+)$/.exec(p));
      return m[1] === '+' ? num(m[3]) - num(m[2]) : num(m[3]) + num(m[2]);
    }
    case 'alg:eq2-two': {
      const m = must(/^If (\d+)[a-z] \+ (\d+) = (\d+)$/.exec(p));
      return (num(m[3]) - num(m[2])) / num(m[1]);
    }
    default:
      return null; // alg:pat-rule, alg:tf-whole, alg:tf-dec: the right choice is words, checked in algebra.test.ts
  }
}
