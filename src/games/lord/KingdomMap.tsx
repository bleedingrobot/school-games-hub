import type { ReactNode } from 'react';
import { HeroSprite } from './Sprite';
import { sceneArt } from './art';
import type { HeroClass } from '../../../shared/lord/types';

/**
 * Every place on the map painted 17 Nov 2026 (dark and gritty, James) (docs/lord-art/config.json), as a share of the picture's width and
 * height, with its letter key. The village has no list of buttons any more: the map is the menu (James).
 */
const SPOTS = [
  { id: 'forest', label: 'The Forest', key: 'F', x: 9, y: 36 },
  { id: 'inn', label: 'Inn', key: 'I', x: 41, y: 47 },
  { id: 'shop', label: 'Shop', key: 'S', x: 31, y: 61 },
  { id: 'healer', label: 'Healer', key: 'H', x: 23, y: 80 },
  { id: 'warriors', label: 'Warriors', key: 'W', x: 54.5, y: 44 },
  { id: 'training', label: 'Training', key: 'T', x: 52, y: 88 },
  { id: 'bank', label: 'Bank', key: 'B', x: 65, y: 59 },
  { id: 'news', label: 'News', key: 'N', x: 62, y: 75 },
  { id: 'arena', label: 'Arena', key: 'A', x: 83, y: 73 },
  { id: 'hall', label: 'Hall of Heroes', key: 'G', x: 74, y: 40 },
  { id: 'dragon', label: 'The Dragon', key: 'D', x: 57, y: 22 },
] as const;
export type MapSpot = (typeof SPOTS)[number]['id'] | 'hero';

export const hasMap = () => !!sceneArt('map').wide;

/**
 * The village: the kingdom map as big as the screen allows, every place a label on it (a real button, with its letter
 * key), your hero standing by the fountain (tap to see your hero), whatever is passed in (the purse, the help button) on top, and `below` (notes) under it.
 */
export function KingdomMap({ onGo, dragonReady, forestOpen, heroClass, look, busy, children, below }: {
  onGo: (spot: MapSpot) => void; dragonReady: boolean; forestOpen: boolean; heroClass: HeroClass; look?: string; busy: boolean; children?: ReactNode; below?: ReactNode;
}) {
  const art = sceneArt('map');
  if (!art.wide) return null;
  return (
    <div className="lord-map">
      <div className="lord-map__frame">
      <div className="lord-map__scroll">
        <div className="lord-map__paper">
          <picture aria-hidden="true">
            <source media="(max-width: 900px)" srcSet={art.small} />
            <img src={art.wide} alt="" draggable={false} />
          </picture>
          {SPOTS.map((s) => {
            const shut = (s.id === 'dragon' && !dragonReady) || (s.id === 'forest' && !forestOpen);
            const why = s.id === 'dragon' ? 'not yet' : 'tomorrow';
            return (
              <button
                key={s.id} type="button" className={`lord-map__spot lord-map__spot--${s.id}${shut ? ' is-shut' : ''}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }} disabled={busy || shut} onClick={() => onGo(s.id)} aria-keyshortcuts={s.key}
                aria-label={shut ? `${s.label} (${why})` : s.label}
              >
                <span><kbd>{s.key}</kbd>{s.label}{shut && <small> ({why})</small>}</span>
              </button>
            );
          })}
          <button type="button" className="lord-map__hero" style={{ left: '45%', top: '73%' }} onClick={() => onGo('hero')} aria-label="Your hero" aria-keyshortcuts="Y" disabled={busy}>
            <HeroSprite heroClass={heroClass} look={look} scale={4} label="" />
            <span><kbd>Y</kbd>You</span>
          </button>
        </div>
      </div>
      {children}
      </div>
      {below}
    </div>
  );
}
