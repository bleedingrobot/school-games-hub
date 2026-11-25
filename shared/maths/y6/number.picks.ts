/** Year 6 card L1 (Number): the ordering picks, checked against the four choices. */
const check = (biggest: boolean) => (_parts: string[], prompt: string, right: string, wrong: string[]) => {
  if (!prompt.includes(biggest ? 'biggest' : 'smallest')) throw new Error(`prompt says ${prompt}`);
  const all = [right, ...wrong].map(Number);
  const target = biggest ? Math.max(...all) : Math.min(...all);
  if (Number(right) !== target) throw new Error(`${right} is not the ${biggest ? 'biggest' : 'smallest'} of ${all.join(', ')}`);
  if (wrong.some((w) => Number(w) === target)) throw new Error('a wrong choice is also right');
  if (all.some((v) => !(v > 0 && v < 1))) throw new Error('not between 0 and 1');
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  'dorder:biggest': check(true),
  'dorder:smallest': check(false),
};
