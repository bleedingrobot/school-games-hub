/** Card L3 (Year 6 measurement and angles): the right answer from the screen text alone (not the generators). */
const BASE: Record<string, number> = { m: 1, cm: 0.01, L: 1000, mL: 1, kg: 1000, g: 1 };
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;
const nums = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  const p = prompt ?? '';
  if (key === 'm6:small' || key === 'm6:big') {
    const [value, from] = parts[0].split(' ');
    return tidy((Number(value) * BASE[from]) / BASE[parts[3]]);
  }
  if (key === 'm6:mixed') {
    const [x, bigUnit, y, littleUnit] = parts[0].split(' ');
    return tidy(Number(x) + (Number(y) * BASE[littleUnit]) / BASE[bigUnit]);
  }
  if (key === 'area6:rect') {
    const [w, h] = nums(p);
    return w * h;
  }
  if (key === 'area6:tri') {
    const [b, h] = nums(p);
    return (b * h) / 2;
  }
  if (key === 'area6:box') return nums(p).reduce((x, y) => x * y, 1);
  if (key === 'ang6:line') return 180 - nums(parts[0])[0];
  if (key === 'ang6:point') {
    const known = parts.slice(0, parts.indexOf('=')).filter((s) => /^\d+°$/.test(s));
    return 360 - known.reduce((s, d) => s + Number(d.replace('°', '')), 0);
  }
  if (key === 'ang6:opposite') {
    const a = nums(p)[0];
    return /vertically opposite/.test(p) ? a : 180 - a;
  }
  return null;
}
