import { useEffect, useRef, type ReactNode } from 'react';
import { useSound } from '../sound';
import hall from './art/hall.webp';
import hallSmall from './art/hall-800.webp';
import hallTall from './art/hall-tall.webp';
import hallTallSmall from './art/hall-tall-800.webp';
import './hall.css';
import './hallPages.css';

/**
 * The Achievement Hall's look, shared (James, 25 Nov 2026: the leaderboard and lobby match the achievements page): a full window
 * over the hub bar, the painted hall behind, and a slim top row with ⌂ Hub, sound, a gold title and one button on the right.
 * `page` adds `.hall-page`, which repaints the hub's usual panels, chips, buttons and lists in the Hall's dark glass and gold
 * (hallPages.css), so a page keeps its own parts and markup.
 */
export function HallWindow({ title, action, page, children }: { title: ReactNode; action?: ReactNode; page?: string; children: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { soundOn, setSoundOn } = useSound();
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div className={page ? `ah-window hall-page hall-page--${page}` : 'ah-window'}>
      <picture className="ah-backdrop" aria-hidden="true">
        <source media="(orientation: portrait) and (max-width: 600px)" srcSet={hallTallSmall} />
        <source media="(orientation: portrait)" srcSet={hallTall} />
        <source media="(max-width: 900px)" srcSet={hallSmall} />
        <img src={hall} alt="" />
      </picture>
      <div className="ah">
        <header className="ah-top">
          <span className="ah-top__buttons">
            <a className="ah-btn" href="#/">
              <span aria-hidden="true">⌂</span> Hub
            </a>
            <button
              type="button"
              className="ah-btn"
              aria-pressed={soundOn}
              onClick={() => setSoundOn(!soundOn)}
              title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
            >
              <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
              <span className="sr-only">Sound</span>
            </button>
          </span>
          <h1 className="ah-title" ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          {action ?? <span className="ah-top__spacer" aria-hidden="true" />}
        </header>
        {children}
      </div>
    </div>
  );
}
