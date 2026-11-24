/** Card Y7: the right answer to a measurement or geometry question, from the screen text alone (not the generators). */
const BASE: Record<string, number> = { km: 1000, m: 1, cm: 0.01, mm: 0.001, L: 1000, mL: 1, kg: 1000, g: 1 };
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;
const nums = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const degs = (parts: string[]) => parts.filter((p) => /^\d+°$/.test(p)).map((p) => Number(p.replace('°', '')));
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** The Year 8 unit questions: "from>to" and how many of `to` make one of `from`. */
const UNITS: Record<string, number> = { 'm²>cm²': 10000, 'cm²>mm²': 100, 'mL>cm³': 1, 'L>cm³': 1000, 'm³>L': 1000 };

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  const p = prompt ?? '';
  const [first, , third] = parts;
  if (key.startsWith('metric:')) {
    const [value, from] = first.split(' ');
    return tidy((Number(value) * BASE[from]) / BASE[parts[3]]);
  }
  if (key === 'mtime:frac-h') {
    const [n, d] = first.replace(' h', '').split('/').map(Number);
    return tidy((60 * n) / d);
  }
  if (key === 'mtime:h-min') {
    const [h, m] = nums(first);
    return h * 60 + m;
  }
  if (key === 'mtime:min-h') return nums(first)[0] - nums(third)[0] * 60;
  if (key === 'formula:rect-area') {
    const [w, h] = nums(p);
    return w * h;
  }
  if (key === 'formula:rect-perim') {
    const [w, h] = nums(p);
    return 2 * (w + h);
  }
  if (key === 'formula:tri-area') {
    const [b, h] = nums(p);
    return (b * h) / 2;
  }
  if (key === 'formula:cube-vol') return nums(p)[0] ** 3;
  if (key === 'formula:cuboid-vol') return nums(p).reduce((x, y) => x * y, 1);
  if (key === 'formula:square-side') return nums(p)[0] / 4;
  if (key.startsWith('angle:')) {
    const total = Number(parts[parts.length - 1].replace('°', ''));
    return total - degs(parts.slice(0, -1)).reduce((x, y) => x + y, 0);
  }
  if (key === 'polygon:exterior') return 360 / nums(p.split('(')[1])[0];
  if (key === 'polygon:sum') return (nums(p.split('(')[1])[0] - 2) * 180;
  if (key === 'compass:turn') return ((COMPASS.indexOf(third) - COMPASS.indexOf(first) + 8) % 8) * 45;
  if (key === 'compass:from-n') return COMPASS.indexOf(first) * 45;
  if (key.startsWith('unitsq:')) {
    const [n, from] = first.split(' ');
    return Number(n) * UNITS[`${from}>${parts[3]}`];
  }
  if (key === 'circle:diam') return 2 * nums(p)[0];
  if (key === 'circle:radius') return nums(p)[0] / 2;
  return null;
}
