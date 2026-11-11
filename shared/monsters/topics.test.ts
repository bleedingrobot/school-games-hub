import { describe, expect, it } from 'vitest';
import { TOPICS, type TopicId } from '../maths/skillPacks';
import { bandFor } from './bands';
import { effectiveTopic } from './topics';

describe('switched-off topics', () => {
  it('whatever is switched off, every type always gets a topic that is on, with a band that exists', () => {
    const ids = TOPICS.map((t) => t.id);
    for (let mask = 1; mask < 2 ** ids.length; mask++) {
      const on = ids.filter((_, i) => mask & (1 << i)) as TopicId[];
      for (const t of ids) {
        const got = effectiveTopic(t, on);
        expect(on).toContain(got);
        for (let area = 1; area <= 6; area++) expect(bandFor(got, area, true)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
