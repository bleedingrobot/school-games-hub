/** Year 5 card (Fraction): the right answer from the screen text alone, with plain arithmetic (not the generators). */
const read = (text: string) => Number(text.replace(/[$, ]/g, ''));
const hundredths = (text: string) => Math.round(read(text) * 100);
const back = (h: number) => Math.round(h) / 100;

export function oracle(key: string, parts: string[], _prompt: string | undefined): number | null {
  if (key === 'mix5:top') {
    const [, w, n, d] = /^(\d+) (\d+)\/(\d+)$/.exec(parts[0])!.map(Number);
    return w * d + n;
  }
  if (key === 'mix5:whole') {
    const [, top, d] = /^(\d+)\/(\d+)$/.exec(parts[0])!.map(Number);
    const n = Number(/^\? (\d+)\/\d+$/.exec(parts[2])![1]);
    return (top - n) / d;
  }
  if (key === 'hund5:add' || key === 'hund5:take' || key === 'hund5:cross') {
    const a = hundredths(parts[0]);
    const b = hundredths(parts[2]);
    return back(parts[1] === '+' ? a + b : a - b);
  }
  if (key === 'cash5:total') return back(hundredths(parts[0]) + hundredths(parts[2]));
  if (key === 'cash5:change') return back(hundredths(parts[0]) - hundredths(parts[2]));
  if (key === 'cash5:near') return Math.floor(read(parts[0]) + 0.5);
  if (key === 'pat5:next') {
    const t = parts.slice(0, 4).map((p) => hundredths(p.replace(',', '')));
    return back(t[3] + (t[1] - t[0]));
  }
  if (key === 'pat5:gap') {
    const at = parts.findIndex((p) => p.startsWith('?'));
    const t = parts.map((p) => (p.startsWith('?') ? 0 : hundredths(p.replace(',', ''))));
    const step = at === 1 ? (t[3] - t[0]) / 3 : t[1] - t[0];
    return back(t[0] + at * step);
  }
  if (key === 'pat5:step') {
    const t = parts[0].split(', ').map(hundredths);
    return back(t[1] - t[0]);
  }
  return null; // mix5:tap is checked against its choices in fraction.picks.ts
}
