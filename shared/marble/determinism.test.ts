import { expect, it } from 'vitest';
import { determinismReport, fingerprint } from './determinism';

it('plays the same busy workload the same way every time', () => {
  const a = determinismReport();
  expect(determinismReport()).toBe(a);
  expect(a.split('\n').length).toBeGreaterThan(100);
});

it('keeps the pinned fingerprint (if physics numbers change on purpose, update it and re-run npm run marble:determinism)', () => {
  expect(fingerprint(determinismReport())).toMatchInlineSnapshot(`"c370983f"`);
});
