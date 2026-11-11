import { describe, expect, it } from 'vitest';
import { GAMES, stepOf, stepWords } from './config';

describe('Step words', () => {
  it('every game names every step in its order, and Hop counts in twos as step 3 of 6', () => {
    for (const [id, g] of Object.entries(GAMES)) {
      expect(g.levelWord).toBe('step');
      expect(g.order.length).toBe(Object.keys(g.levels).length);
      for (const v of g.order) expect(g.levels[v], `${id} ${v}`).toBeTruthy();
    }
    expect(stepWords('hop', 2)).toBe('Step 3 of 6: Counting in twos');
    expect(stepOf('hop', 2)).toEqual({ n: 3, of: 6, name: 'Counting in twos' });
    expect(stepWords('beanstalk', 0)).toBe('Step 1 of 4: Bonds to 10');
    expect(stepOf('robin', null)).toBeNull();
  });
});




