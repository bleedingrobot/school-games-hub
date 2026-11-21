// Every game's stories (docs/plans/stories/PLAN.md): good ids, no two the same anywhere, 1 to 8 short pages, a stand-in each.
import { describe, expect, it } from 'vitest';
import { storyProblems } from '../../shared/kit/stories';
import { ALL_STORIES as CLANS } from './clans/stories';
import { ALL_STORIES as GEMKEEP } from './gem-keep/stories';
import { ALL_STORIES as GOBLIN } from './goblinstorm/stories';
import { ALL_STORIES as LORD, LAIR, MASTER_STORIES, VICTORY, lordShelf } from './lord/stories';
import { ALL_STORIES as TRADER_MAIN, QUEST_STORIES } from './trader/stories';

// Star Trader's quest stories (Q.3) are read by each giver, not the narrator, so they sit apart from ALL_STORIES.
const TRADER = [...TRADER_MAIN, ...Object.values(QUEST_STORIES)];

describe('game stories', () => {
  it('pass the story checks across every game together, and never mention maths, romance or orphans', () => {
    expect(storyProblems([...CLANS, ...GEMKEEP, ...GOBLIN, ...LORD, ...TRADER])).toEqual([]);
    const words = [...CLANS, ...GEMKEEP, ...GOBLIN, ...LORD, ...TRADER].flatMap((s) => s.pages.map((p) => `${p.title} ${p.text}`)).join(' ').toLowerCase();
    for (const bad of ['maths', 'math ', 'question', 'kiss', 'love', 'marry', 'orphan']) expect(words).not.toContain(bad);
    // Dragon Maths ST.5: a page for each of the 11 masters, the lair (2) and the victory (5). On the shelf, a hero meeting
    // Master Pip has Pip open and the rest still to come; a dragon winner has them all.
    expect([MASTER_STORIES.length, LAIR.pages.length, VICTORY.pages.length]).toEqual([11, 2, 5]);
    const shelf = (hero: unknown) => lordShelf(hero as Parameters<typeof lordShelf>[0]).filter((s) => s.open).length;
    expect([shelf({ level: 1, dragonKills: 0 }), shelf({ level: 1, dragonKills: 1 })]).toEqual([2, 14]);
  });
});
