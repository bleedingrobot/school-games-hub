/** Year 5 card (Fraction): the mixed-number pick, checked against its four choices. */
const mixed = (label: string) => {
  const m = /^(\d+) (\d+)\/(\d+)$/.exec(label);
  if (!m) throw new Error(`${label} is not a mixed number`);
  return { w: Number(m[1]), n: Number(m[2]), d: Number(m[3]) };
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  'mix5:tap': (parts, _prompt, right, wrong) => {
    const [top, bottom] = parts[0].split('/').map(Number);
    // Compare as top-over-bottom by cross-multiplying: w n/d is (w×d + n)/d.
    const same = (label: string) => {
      const { w, n, d } = mixed(label);
      return (w * d + n) * bottom === top * d;
    };
    if (!same(right)) throw new Error(`${right} is not ${parts[0]}`);
    for (const w of wrong) if (same(w)) throw new Error(`${w} is also ${parts[0]}`);
  },
};
