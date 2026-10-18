import { describe, expect, it } from 'vitest';
import { TOPICS, type TopicId } from '../maths/skillPacks';
import { bandFor } from './bands';
import { effectiveTopic, TOPIC_IDS } from './topics';

describe('switched-off topics', () => {
  it('a topic that is on is asked as itself', () => {
    for (const t of TOPIC_IDS) expect(effectiveTopic(t, TOPIC_IDS)).toBe(t);
    expect(effectiveTopic('fractions', undefined)).toBe('fractions');
  });

  it('a topic that is off is swapped for the nearest one that is on (the easier one on a tie)', () => {
    expect(effectiveTopic('fractions', ['add-sub', 'division', 'decimals'])).toBe('division');
    expect(effectiveTopic('times-tables', ['add-sub', 'fractions'])).toBe('add-sub');
    expect(effectiveTopic('place-value', ['decimals'])).toBe('decimals');
  });

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

  it('never blocks when nothing is on', () => {
    expect(effectiveTopic('decimals', [])).toBe('decimals');
  });
});
