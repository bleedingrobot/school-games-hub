import { describe, expect, it } from 'vitest';
import { showBundleButtons } from './Goes';

describe('Lizard: tying the bundles', () => {
  it('hides + bundle on steps 1 to 3 and on the guided first go', () => {
    for (const step of [1, 2, 3]) expect(showBundleButtons(step, false)).toBe(false);
    for (const step of [4, 5, 6, 7]) expect(showBundleButtons(step, false)).toBe(true);
    expect(showBundleButtons(5, true)).toBe(false);
  });
});
