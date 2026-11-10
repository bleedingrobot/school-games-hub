import { describe, expect, it } from 'vitest';
import { hasRaft, showBundleButtons } from './Goes';
import { KEYS } from '../../../shared/lizard/round';
import { DEMO_STEPS, demoMat, tryLine } from './voiceLines';

describe('Lizard: tying the bundles', () => {
  it('hides + bundle on steps 1 to 3 and on the guided first go', () => {
    for (const step of [1, 2, 3]) expect(showBundleButtons(step, false)).toBe(false);
    for (const step of [4, 5, 6, 7]) expect(showBundleButtons(step, false)).toBe(true);
    expect(showBundleButtons(5, true)).toBe(false);
    // The raft tip only shows on a go with a raft in it.
    expect(hasRaft({ kind: 'swap', n: 29, answer: 119 })).toBe(false);
    expect(hasRaft({ kind: 'bundle', n: 23, answer: 203 })).toBe(false);
    expect(hasRaft({ kind: 'build', n: 120, answer: 120 })).toBe(true);
    expect(hasRaft({ kind: 'read', n: 305, answer: 305 })).toBe(true);
    // The Show me first examples are made up: 36 and 15 are not asked as a Swap or a Bundle go.
    expect(KEYS).not.toContain('pvregroup:s36');
    expect(KEYS).not.toContain('pvregroup:b15');
    expect(demoMat('swap', 0)).toEqual({ h: 0, t: 3, o: 6 });
    expect(DEMO_STEPS.swap.at(-1)?.line).toBe('Now you try one like it.');
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
