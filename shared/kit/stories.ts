/**
 * Story pages for the older-pupil games (docs/plans/stories/PLAN.md). No game words in here: each game writes its own
 * stories as `Story` data and shows them with the kit's StoryBook. A story id names one story everywhere: in the
 * database (`story_seen`), on the shelf and in the art. Ids are short, lower case and never renamed after they ship.
 */

/** One page: a painting (or its drawn stand-in), a title and up to about 35 words. */
export interface StoryPage {
  title: string;
  text: string;
  /** Painted picture, if it exists yet: the 1600 px painting and its 800 px copy. */
  art?: { wide?: string; small?: string };
  /** Drawn stand-in until the painting exists: a big emoji on a two-colour sky (top, bottom). */
  standIn: { emoji: string; sky: [string, string] };
}

export interface Story {
  /** `<game>-<name>`, e.g. `trader-opening`, `goblinstorm-hero-knight`. */
  id: string;
  title: string;
  pages: StoryPage[];
}

/** A story on a game's shelf: open (watchable) or still to come, with a hint of how to open it. */
export interface ShelfStory {
  story: Story;
  open: boolean;
  /** Shown for a story still to come, e.g. "Reach the Dark Forest". */
  hint?: string;
}

export const STORY_ID = /^[a-z][a-z0-9-]{1,48}$/;
export const MAX_WORDS_A_PAGE = 40;

/** Problems with a game's stories, in plain words (empty when fine). Used by each game's story test. */
export function storyProblems(stories: readonly Story[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const s of stories) {
    if (!STORY_ID.test(s.id)) out.push(`${s.id}: the id must be lower case letters, digits and dashes`);
    if (ids.has(s.id)) out.push(`${s.id}: used twice`);
    ids.add(s.id);
    if (s.pages.length < 1 || s.pages.length > 8) out.push(`${s.id}: needs 1 to 8 pages`);
    s.pages.forEach((p, i) => {
      const words = p.text.trim().split(/\s+/).length;
      if (!p.title.trim()) out.push(`${s.id} page ${i + 1}: no title`);
      if (words > MAX_WORDS_A_PAGE) out.push(`${s.id} page ${i + 1}: ${words} words (at most ${MAX_WORDS_A_PAGE})`);
      if (!p.standIn.emoji) out.push(`${s.id} page ${i + 1}: no stand-in picture`);
    });
  }
  return out;
}

/** `{name}`-style blanks filled in, e.g. a clan's name. Unknown blanks are left as they are. */
export function fillStory(text: string, blanks: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => blanks[key] ?? all);
}
