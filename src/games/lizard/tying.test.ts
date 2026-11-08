import { describe, expect, it } from 'vitest';
import { showBundleButtons } from './Goes';
import { tryLine } from './voiceLines';

describe('Lizard: tying the bundles', () => {
  it('hides + bundle on steps 1 to 3 and on the guided first go', () => {
    for (const step of [1, 2, 3]) expect(showBundleButtons(step, false)).toBe(false);
    for (const step of [4, 5, 6, 7]) expect(showBundleButtons(step, false)).toBe(true);
    expect(showBundleButtons(5, true)).toBe(false);
    // The written line after a wrong try: the child's count, never a card answer.
    const build = tryLine({ kind: 'build', n: 43 }, { h: 0, t: 3, o: 4 }, 'build');
    expect(build).toContain('34');
    expect(build).toContain('43');
    expect(tryLine({ kind: 'bundle', n: 25 }, { h: 0, t: 2, o: 13 }, 'bundle')).toContain('2 bundles and 13 sticks');
    expect(tryLine({ kind: 'swap', n: 40 }, { h: 0, t: 3, o: 7 }, 'swap')).toContain('3 bundles and 7 sticks');
    const card = tryLine({ kind: 'read', n: 43 }, { h: 0, t: 3, o: 4 }, 'reverse', 34);
    expect(card).toContain('34');
    expect(card).not.toContain('43');
  });
});
