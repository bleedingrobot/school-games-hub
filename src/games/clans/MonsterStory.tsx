/**
 * The win story: five painted pages, shown the first time a clan beats the season monster (and again from the Monster screen
 * and the Stories shelf). Now the kit's StoryBook (docs/plans/stories/PLAN.md), so it has Skip; words in monsterStoryPages.ts.
 */
import type { MonsterKind } from '../../../shared/clans/types';
import { StoryBook } from '../../kit/StoryBook';
import { winStory } from './stories';

export function MonsterStory({ kind, clan, onClose }: { kind: MonsterKind; clan: string; onClose: () => void }) {
  return <StoryBook story={winStory(kind)} blanks={{ clan }} onClose={onClose} className="cq-storybook" />;
}
