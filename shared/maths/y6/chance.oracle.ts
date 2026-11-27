/** Card L5 (chance, data, patterns, fractions): the right answer from the screen text alone, with plain arithmetic. */
const nums = (text: string) => text.replace(/^The numbers /, '').split(', ').map(Number);
const NUMBER_OF: Record<string, number> = { impossible: 0, unlikely: 0.1, 'even chance': 0.5, likely: 0.9, certain: 1 };

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  if (key === 'mr6:range') {
    const n = nums(prompt!);
    return Math.max(...n) - Math.min(...n);
  }
  if (key === 'mr6:mean') {
    const n = nums(prompt!);
    return n.reduce((a, b) => a + b, 0) / n.length;
  }
  if (key === 'pat6:next') {
    const n = parts.slice(0, 4).map((p) => Number(p.replace(',', '')));
    return n[3] + (n[1] - n[0]);
  }
  if (key === 'pat6:step') {
    const n = parts[0].split(', ').map(Number);
    return n[1] - n[0];
  }
  if (key === 'pat6:gap') {
    const shown = parts.map((p) => p.replace(',', ''));
    const at = shown.indexOf('?');
    // The pattern goes up evenly: the gap sits halfway between its neighbours.
    return (Number(shown[at - 1]) + Number(shown[at + 1])) / 2;
  }
  if (key === 'chw:number' && parts[1] === 'is a chance of') return NUMBER_OF[parts[0].toLowerCase()];
  if (key === 'spin:part') {
    const m = /^A spinner has (\d+) equal parts\. (\d+) (?:is|are) \w+\.$/.exec(prompt!)!;
    return Number(m[2]) / Number(m[1]);
  }
  if (key === 'spin:rest') {
    const [n, d] = /is (\d+)\/(\d+)$/.exec(prompt!)!.slice(1).map(Number);
    return (d - n) / d;
  }
  if (key === 'fa6:same' || key === 'fa6:double') {
    // Exact: tops over a shared bottom, one division at the end (so no rounding dust).
    const ratio = (t: string) => (t.includes('/') ? t.split('/').map(Number) : [Number(t), 1]);
    const [[n1, d1], [n2, d2]] = [ratio(parts[0]), ratio(parts[2])];
    const top = parts[1] === '+' ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1;
    return top / (d1 * d2);
  }
  return null;
}
