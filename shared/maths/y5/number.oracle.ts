/** Year 5 card (Number): the right answer from the screen text alone, with plain arithmetic (not the generators). */
const read = (text: string) => Number(text.replace(/[^\d]/g, ''));

export function oracle(key: string, parts: string[], _prompt: string | undefined): number | null {
  if (key === 'pv5:worth') {
    const digits = parts[1].replace(/[^\d]/g, '');
    const d = parts[3];
    const at = digits.indexOf(d);
    if (at < 0 || digits.lastIndexOf(d) !== at) throw new Error(`digit ${d} is not once in ${digits}`);
    return Number(d) * 10 ** (digits.length - 1 - at);
  }
  if (key === 'pv5:split') return read(parts[0]) - read(parts[2]) - read(parts[6]);
  if (key === 'cnt5:more') return read(parts[0]) + read(parts[2]);
  if (key === 'cnt5:less') return read(parts[2]) - read(parts[0]);
  if (key === 'cnt5:next') {
    const [a, b, c] = parts.slice(0, 3).map(read);
    if (b - a !== c - b) throw new Error('not a steady count');
    return c + (c - b);
  }
  if (key.startsWith('ment5:')) return parts[1] === '+' ? read(parts[0]) + read(parts[2]) : read(parts[0]) - read(parts[2]);
  if (key.startsWith('miss5:')) return parts[1] === '+' ? read(parts[4]) - read(parts[0]) : read(parts[0]) - read(parts[4]);
  if (key === 'mul5:times' || key === 'mul5:flip') return read(parts[0]) * read(parts[2]);
  if (key === 'mul5:split') return read(parts[0]) * read(parts[2]) - read(parts[4]);
  return null; // big5: checked against its choices in number.picks.ts
}
