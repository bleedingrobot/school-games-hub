/** Year 5 Measure card: the right answer from the screen text alone (not the generators). */
const MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, km: 1000000 };
const SIDES: Record<string, number> = { 'Equilateral triangle': 3, 'Regular pentagon': 5, 'Regular hexagon': 6, 'Regular octagon': 8 };
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;
const nums = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

export function oracle(key: string, parts: string[], _prompt: string | undefined): number | null {
  if (key === 'per5:sq') return 4 * nums(parts[0])[0];
  if (key === 'per5:rect') {
    const [w, h] = nums(parts[0]);
    return 2 * (w + h);
  }
  if (key === 'per5:reg') return SIDES[parts[0].split(',')[0]] * nums(parts[0])[0];
  if (key.startsWith('mmkm5:')) {
    const [value, from] = parts[0].split(' ');
    return tidy((Number(value) * MM[from]) / MM[parts[3]]);
  }
  return null;
}
