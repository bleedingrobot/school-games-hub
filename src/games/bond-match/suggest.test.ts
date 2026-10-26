import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Bond Match is never evidence for the ladder (James, 19 and 20 Oct 2026)', () => {
  it('has no way to write a maths record, a ladder place or a focus result: no file of the game names one', () => {
    const writers = /record_fact_answers|recordMathsAnswers|recordAnswers|add_maths_focus_results|countForFocuses|record_ladder_place|record_placement|syncPlace|sendPlacement|set_my_maths_focus|saveMyFocus|clearMyFocus/;
    const dirs = ['src/games/bond-match', 'shared/bond-match', 'supabase/functions/bond-match'];
    for (const dir of dirs) {
      for (const name of readdirSync(resolve(dir))) {
        if (!/\.tsx?$/.test(name) || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
        expect(readFileSync(join(resolve(dir), name), 'utf8'), `${dir}/${name}`).not.toMatch(writers);
      }
    }
    expect(readFileSync(resolve('src/data/bondMatch.ts'), 'utf8')).not.toMatch(writers);
  });
});
