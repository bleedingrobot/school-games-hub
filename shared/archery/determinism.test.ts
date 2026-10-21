import { describe, expect, it } from 'vitest';
import { determinismReport, fingerprint } from './determinism';

describe('determinism', () => {
  it('gives the same busy fights twice', () => {
    expect(determinismReport()).toBe(determinismReport());
  });

  it('gives the pinned fingerprint (if this changes, the rules changed: every saved fight is affected)', () => {
    expect(fingerprint(determinismReport())).toBe('c74ca8ad');
  });
});
