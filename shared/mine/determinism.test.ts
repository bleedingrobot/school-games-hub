import { describe, expect, it } from 'vitest';
import { determinismReport, fingerprint } from './determinism';

describe('determinism', () => {
  it('gives the same busy run twice', () => {
    expect(determinismReport()).toBe(determinismReport());
  });

  it('gives the pinned fingerprint (if this changes, the rules changed: every saved run and board time is affected)', () => {
    expect(fingerprint(determinismReport())).toBe('e3b847d2');
  });
});
