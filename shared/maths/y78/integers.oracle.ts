/** Card Y3: the right answer to a negative number question, from the screen text alone (not the generators). */
const num = (text: string) => Number(text.replace(/°C?$/, '').replace('−', '-'));

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  if (!key.startsWith('int:')) return null;
  if (key === 'int:smallest') return Math.min(...prompt!.replace(/^Which is the smallest\? /, '').split(', ').map(num));
  if (key === 'int:compare-dec') return null; // checked against its choices in y78.test.ts
  const [a, op, b, , c] = parts;
  if (!c.startsWith('?')) return num(c) - num(a); // a + ? = c
  return op === '+' ? num(a) + num(b) : num(a) - num(b);
}
