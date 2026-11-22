/**
 * A story told in painted pages (docs/plans/stories/PLAN.md), lifted from Clan Quest's win story with Skip added.
 * Full window. Skip (top right, or Escape) closes it from any page; arrow keys and Enter turn the pages. Closing it any way
 * marks the story seen. 🔊 reads each page aloud (the shared "Read to me" setting) with the narrator's clips (public/voice/stories/).
 * A page with no painting yet shows its drawn stand-in. Reduced motion: no slow zoom. Look: CSS variables on `.kit-story`
 * (--story-bg, --story-ink, --story-gold, --story-frame, --story-font) set by the game; the defaults suit a dark game.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fillStory, STORY_VOICE_FOLDER, storyVoiceLine, type Story, type StoryPage } from '../../shared/kit/stories';
import { speak, stopSpeaking, useReadAloud } from '../speech';
import { markStorySeen } from './useStories';
import './storyBook.css';

export interface StoryBookProps {
  story: Story;
  onClose: () => void;
  /** Blanks in the words, e.g. `{ clan: 'The Red Foxes' }` for `{clan}`. */
  blanks?: Record<string, string>;
  /** Folder of narrator clips (default the shared stories folder). A line with no clip falls back to the browser's voice. */
  clips?: string;
  /** Something drawn in the picture's bottom-left corner on every page (a captain's face), or made for each page. */
  corner?: ReactNode | ((page: StoryPage) => ReactNode);
  /** Words on the last page's button (default "The end"; "Let's go!" for an opening). */
  endLabel?: string;
  /** Extra class on the outside, for a game's own colours. */
  className?: string;
}

export function StoryBook({ story, onClose, blanks = {}, clips = STORY_VOICE_FOLDER, corner, endLabel = 'The end', className }: StoryBookProps) {
  const pages = story.pages;
  const [at, setAt] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const read = useReadAloud();
  const page = pages[at];
  const last = at === pages.length - 1;
  const words = fillStory(page.text, blanks);
  const title = fillStory(page.title, blanks);

  const close = () => {
    stopSpeaking();
    markStorySeen(story.id);
    onClose();
  };
  const go = (n: number) => setAt(Math.max(0, Math.min(pages.length - 1, n)));

  useEffect(() => {
    next.current?.focus();
    if (read.on) speak(storyVoiceLine(page), clips);
  }, [at, read.on]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), []);

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Keys pressed with nothing focused (say, after a click on the backdrop) land on the page body, not the book.
  const keysRef = useRef(keys);
  keysRef.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      keysRef.current({ key: e.key, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopImmediatePropagation() } as React.KeyboardEvent);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const art = page.art;
  return (
    <div className={`kit-story${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={story.title} onKeyDown={keys}>
      <div className="kit-story__top">
        <span className="kit-story__name">{story.title}</span>
        {read.available && (
          <button type="button" className="kit-story__btn kit-story__btn--quiet" aria-pressed={read.on} onClick={() => read.setOn(!read.on)}>
            {read.on ? '🔊 Reading' : '🔈 Read to me'}
          </button>
        )}
        <button type="button" className="kit-story__btn kit-story__btn--quiet" data-key="esc" onClick={close}>
          Skip ⏭
        </button>
      </div>
      <div className="kit-story__book">
        <div className="kit-story__pic" key={at}>
          {art?.wide ? (
            <img
              src={art.wide}
              srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined}
              sizes="(max-width: 1100px) 100vw, 1100px"
              alt=""
            />
          ) : (
            <div className="kit-story__drawn" style={{ background: `linear-gradient(${page.standIn.sky[0]}, ${page.standIn.sky[1]})` }} aria-hidden="true">
              <span>{page.standIn.emoji}</span>
            </div>
          )}
          <span className="kit-story__glow" aria-hidden="true" />
          {corner && <div className="kit-story__corner">{typeof corner === 'function' ? corner(page) : corner}</div>}
        </div>
        <div className="kit-story__words" aria-live="polite">
          {pages.length > 1 && <span className="kit-story__count">Page {at + 1} of {pages.length}</span>}
          <h2>{title}</h2>
          <p>{words}</p>
        </div>
        <div className="kit-story__nav">
          <button type="button" className="kit-story__btn" disabled={at === 0} onClick={() => go(at - 1)}>
            Back
          </button>
          {pages.length > 1 && (
            <span className="kit-story__dots" aria-hidden="true">
              {pages.map((_, i) => (
                <span key={i} className={i === at ? 'is-on' : ''} />
              ))}
            </span>
          )}
          {last ? (
            <button ref={next} type="button" className="kit-story__btn kit-story__btn--go" data-key="enter" onClick={close}>
              {endLabel}
            </button>
          ) : (
            <button ref={next} type="button" className="kit-story__btn kit-story__btn--go" data-key="enter" onClick={() => go(at + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
