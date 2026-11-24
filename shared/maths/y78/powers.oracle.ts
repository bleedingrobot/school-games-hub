/** Card Y4: the right answer to a powers, primes or factors question, from the screen text alone (not the generators). */
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "10⁴" → 10000, "2³" → 8, "10⁻²" → 0.01, "7" → 7. Null for anything else (such as "10ⁿ"). */
function value(text: string): number | null {
  const m = /^(\d+)(?:(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+))?$/.exec(text);
  if (!m) return null;
  const base = Number(m[1]);
  if (!m[3]) return base;
  const e = Number([...m[3]].map((c) => SUP.indexOf(c)).join(''));
  if (m[2]) return base === 10 ? Number(`1e-${e}`) : base ** -e;
  return base ** e;
}

/** Brute force, on purpose. */
const hcf = (a: number, b: number) => {
  for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) return d;
  return 1;
};
const lcm = (a: number, b: number) => {
  for (let m = Math.max(a, b); ; m += Math.max(a, b)) if (m % a === 0 && m % b === 0) return m;
};

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  switch (key) {
    case 'pow:ten':
    case 'exp:value':
    case 'negpow:dec':
      return value(parts[0]);
    case 'pow:zeros':
      return prompt!.split(' = ')[0].replace(/ /g, '').length - 1;
    case 'pow:times':
      return Number(parts[0]) * value(parts[2])!;
    case 'exp:plus':
      return parts[1] === '+' ? value(parts[0])! + Number(parts[2]) : value(parts[0])! - Number(parts[2]);
    case 'hcf:of':
    case 'hcf:lcm': {
      const [a, b] = parts[0].match(/\d+/g)!.map(Number);
      return key === 'hcf:of' ? hcf(a, b) : lcm(a, b);
    }
    case 'pf:mult':
      return value(parts[0])! * value(parts[2])!;
    case 'pf:power': {
      const m = /^(\d+) = (\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) × (\d+)ⁿ\. What is n\?$/.exec(prompt!)!;
      const first = value(m[2] + m[3])!;
      for (let n = 1; n <= 10; n++) if (first * Number(m[4]) ** n === Number(m[1])) return n;
      return null;
    }
    default:
      return null; // the pick questions with labels that aren't numbers: checked against their choices in powers.picks.ts
  }
}

export { value as powerValue };
