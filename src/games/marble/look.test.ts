import { describe, expect, it } from 'vitest';
import { COURSES } from '../../../shared/marble/courses';
import { lookFor } from './look';

describe('lookFor', () => {
  it('gives only Boulder Beach the diorama look', () => {
    expect(COURSES.length).toBeGreaterThan(1);
    for (const c of COURSES) expect(lookFor(c.def.id).diorama).toBe(c.def.id === 'boulder-beach');
    expect(lookFor('boulder-beach')).toMatchObject({ topPattern: 'sand', rail: 'driftwood' });
    expect(lookFor('nope').diorama).toBe(false);
  });
});
