/**
 * A game's 📖 Stories list (docs/plans/stories/PLAN.md): every story it has, open ones to watch (again), "?" ones still to
 * come with a hint of how to open them. Opening one shows the StoryBook. The game places it (a panel, a tab, a dialog).
 */
import { useState, type ReactNode } from 'react';
import type { ShelfStory } from '../../shared/kit/stories';
import { StoryBook, type StoryBookProps } from './StoryBook';
import { useStories } from './useStories';
import './storyBook.css';

export interface StoryShelfProps {
  stories: ShelfStory[];
  /** Passed to the StoryBook when a story is opened. */
  book?: Omit<StoryBookProps, 'story' | 'onClose'>;
  /** Shown when there are no stories (should not happen). */
  empty?: ReactNode;
}

export function StoryShelf({ stories, book, empty = null }: StoryShelfProps) {
  const [open, setOpen] = useState<ShelfStory | null>(null);
  const { hasSeen } = useStories();
  if (stories.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="kit-shelf" role="list">
        {stories.map((s) => {
          const first = s.story.pages[0];
          const thumb = first.art?.small ?? first.art?.wide;
          return (
            <button
              key={s.story.id}
              type="button"
              role="listitem"
              className="kit-shelf__item"
              disabled={!s.open}
              onClick={() => setOpen(s)}
              aria-label={s.open ? `Watch ${s.story.title}` : `Still to come. ${s.hint ?? ''}`}
            >
              {s.open ? (
                <span
                  className="kit-shelf__thumb"
                  style={thumb ? { backgroundImage: `url(${thumb})` } : { background: `linear-gradient(${first.standIn.sky[0]}, ${first.standIn.sky[1]})` }}
                  aria-hidden="true"
                >
                  {thumb ? null : first.standIn.emoji}
                </span>
              ) : (
                <span className="kit-shelf__thumb kit-shelf__thumb--locked" aria-hidden="true">
                  ?
                </span>
              )}
              <span className="kit-shelf__label">
                {s.open ? s.story.title : '???'}
                {s.open && !hasSeen(s.story.id) && <span className="kit-shelf__new">New</span>}
                {!s.open && s.hint && <span className="kit-shelf__hint">{s.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {open && <StoryBook {...book} story={open.story} onClose={() => setOpen(null)} />}
    </>
  );
}
