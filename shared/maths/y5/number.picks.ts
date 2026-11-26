/** Year 5 card (Number): the biggest / smallest picks, checked against the four choices. */
const read = (text: string) => Number(text.replace(/[^\d]/g, ''));

const check = (biggest: boolean) => (_parts: string[], prompt: string, right: string, wrong: string[]) => {
  if (!prompt.includes(biggest ? 'biggest' : 'smallest')) throw new Error(`prompt says ${prompt}`);
  const all = [right, ...wrong].map(read);
  const target = biggest ? Math.max(...all) : Math.min(...all);
  if (read(right) !== target) throw new Error(`${right} is not the ${biggest ? 'biggest' : 'smallest'} of ${all.join(', ')}`);
  if (wrong.some((w) => read(w) === target)) throw new Error('a wrong choice is also right');
  if (all.some((v) => v < 10000 || v > 999999)) throw new Error('not 5 or 6 digits');
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  'big5:biggest': check(true),
  'big5:smallest': check(false),
};
