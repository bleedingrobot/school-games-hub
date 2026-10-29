import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COURSE_INFO } from './courseInfo';
import { cardArt } from './cardArt';

const DIR = join(__dirname, 'art', 'cards');

describe('the course card pictures', () => {
  it('every course has a picture', () => {
    for (const c of COURSE_INFO) expect(cardArt(c.id), c.id).toBeTruthy();
  });
  it('every file is for a course, and small enough for a Chromebook', () => {
    const ids = new Set(COURSE_INFO.map((c) => c.id));
    for (const f of readdirSync(DIR)) {
      expect(ids, `${f} is not a course id`).toContain(f.replace(/\.webp$/, ''));
      expect(statSync(join(DIR, f)).size / 1024, f).toBeLessThan(120);
    }
  });
});
