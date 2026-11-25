/** Year 6 card L1 (Number): the right answer from the screen text alone, with plain arithmetic (not the generators). */
const read = (text: string) => Number(text.replace(/ /g, ''));
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function oracle(key: string, parts: string[], _prompt: string | undefined): number | null {
  if (key.startsWith('huge:')) {
    const n = read(parts[1]);
    const unit = (parts[2].endsWith('ten thousand') ? 10000 : 100000);
    return Math.floor(n / unit + 0.5) * unit;
  }
  if (key === 'rem:left') {
    const [n, , d] = parts.map(read);
    const q = parseInt(parts[4], 10);
    return n - d * q;
  }
  if (key === 'rem:times') {
    const n = read(parts[0]);
    const d = read(parts[2]);
    const r = read(parts[6]);
    return (n - r) / d;
  }
  if (key === 'thou:times') return clean(read(parts[0]) * 1000);
  if (key === 'thou:divide') return clean(read(parts[0]) / 1000);
  if (key === 'thou:frac') return clean(read(parts[0]) * 1000);
  return null; // dorder: checked against its choices in number.picks.ts
}
