/**
 * The win story: five painted pages, clicked through, shown the first time a clan beats the season monster (and again from the
 * Monster screen). Paintings: art/season-monsters/story-<kind>-<n>.webp; until they exist each page is a drawn sky and emoji.
 * Arrow keys and Enter turn the pages; Escape closes. Reduced motion: no slow zoom.
 */
import { useEffect, useRef, useState } from 'react';
import type { MonsterKind } from '../../../shared/clans/types';
import { MONSTER_LOOKS } from '../../../shared/clans/monster';
import { storyArt } from './art';
import { MONSTER_STORIES, storyText } from './monsterStoryPages';

export function MonsterStory({ kind, clan, onClose }: { kind: MonsterKind; clan: string; onClose: () => void }) {
  const pages = MONSTER_STORIES[kind];
  const [at, setAt] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const page = pages[at];
  const last = at === pages.length - 1;
  const art = storyArt(kind, at + 1);
  const go = (n: number) => setAt(Math.max(0, Math.min(pages.length - 1, n)));
  useEffect(() => {
    next.current?.focus();
  }, [at]);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowLeft') go(at - 1);
    else if (e.key === 'Escape') onClose();
    else return;
    e.preventDefault();
  };
  return (
    <div className="cq-story" role="dialog" aria-modal="true" aria-label={`The story of how ${clan} beat ${MONSTER_LOOKS[kind].short}`} onKeyDown={keys}>
      <div className="cq-story__book">
        <div className="cq-story__pic" key={at}>
          {art.wide ? (
            <img src={art.wide} srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined} sizes="(max-width: 1100px) 100vw, 1100px" alt="" />
          ) : (
            <div className="cq-story__drawn" style={{ background: `linear-gradient(${page.sky[0]}, ${page.sky[1]})` }} aria-hidden="true">
              <span>{page.emoji}</span>
            </div>
          )}
          <span className="cq-story__glow" aria-hidden="true" />
        </div>
        <div className="cq-story__words" aria-live="polite">
          <span className="cq-story__count">Page {at + 1} of {pages.length}</span>
          <h2>{page.title}</h2>
          <p>{storyText(page, clan)}</p>
        </div>
        <div className="cq-story__nav">
          <button type="button" className="cq-btn" disabled={at === 0} onClick={() => go(at - 1)}>Back</button>
          <span className="cq-story__dots" aria-hidden="true">
            {pages.map((_, i) => <span key={i} className={i === at ? 'is-on' : ''} />)}
          </span>
          {last
            ? <button ref={next} type="button" className="cq-btn cq-btn--hot" onClick={onClose}>The end</button>
            : <button ref={next} type="button" className="cq-btn cq-btn--hot" onClick={() => go(at + 1)}>Next</button>}
        </div>
      </div>
    </div>
  );
}
