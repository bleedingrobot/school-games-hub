// Every game's stories (docs/plans/stories/PLAN.md): good ids, no two the same anywhere, 1 to 8 short pages, a stand-in each.
import { describe, expect, it } from 'vitest';
import { storyProblems } from '../../shared/kit/stories';
import { ALL_STORIES as CLANS } from './clans/stories';
import { ALL_STORIES as LORD } from './lord/stories';
import { ALL_STORIES as TRADER } from './trader/stories';

describe('game stories', () => {
  it('pass the story checks across every game together, and never mention maths, romance or orphans', () => {
    expect(storyProblems([...CLANS, ...LORD, ...TRADER])).toEqual([]);
    const words = [...CLANS, ...LORD, ...TRADER].flatMap((s) => s.pages.map((p) => `${p.title} ${p.text}`)).join(' ').toLowerCase();
    for (const bad of ['maths', 'math ', 'question', 'kiss', 'love', 'marry', 'orphan']) expect(words).not.toContain(bad);
  });
});
