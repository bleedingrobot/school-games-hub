import { HeroSprite } from './Sprite';
import { heroArt, lookArt, sceneArt } from './art';
import type { HeroClass } from '../../../shared/lord/types';

/**
 * Where each place is on James's map (P14), as a share of the picture's width and height. On a phone the label drops
 * the words in `before` and `more`, so the labels don't run into each other.
 */
const SPOTS = [
  { id: 'forest', label: 'The Forest', x: 24, y: 44 },
  { id: 'inn', label: 'The Inn', x: 43, y: 57 },
  { id: 'training', label: 'Training', more: ' grounds', x: 62, y: 65 },
  { id: 'arena', label: 'The Arena', x: 83, y: 62 },
  { id: 'dragon', label: 'Dragon', before: 'The Red ', x: 75, y: 26 },
] as const;
export type MapSpot = (typeof SPOTS)[number]['id'];

export const hasMap = () => !!sceneArt('map').wide;

/**
 * The kingdom map at the top of the village: tap a place to go there. It is a shortcut for a mouse or a finger; the
 * list of places under it does the same for the keyboard and screen readers, so the map itself is hidden from them.
 */
export function KingdomMap({ onGo, dragonReady, forestOpen, heroClass, look, busy }: {
  onGo: (spot: MapSpot) => void; dragonReady: boolean; forestOpen: boolean; heroClass: HeroClass; look?: string; busy: boolean;
}) {
  const art = sceneArt('map');
  if (!art.wide) return null;
  return (
    <div className="lord-map">
      <div className="lord-map__paper" aria-hidden="true">
        <picture>
          <source media="(max-width: 900px)" srcSet={art.small} />
          <img src={art.wide} alt="" draggable={false} />
        </picture>
        {SPOTS.map((s) => {
          const off = busy || (s.id === 'dragon' && !dragonReady) || (s.id === 'forest' && !forestOpen);
          return (
            <button
              key={s.id} type="button" tabIndex={-1} className={`lord-map__spot lord-map__spot--${s.id}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }} disabled={off} onClick={() => onGo(s.id)}
            >
              <span>
                {'before' in s && <span className="lord-map__long">{s.before}</span>}{s.label}
                {'more' in s && <span className="lord-map__long">{s.more}</span>}{s.id === 'dragon' && !dragonReady && ' (not yet)'}
              </span>
            </button>
          );
        })}
        {(heroArt(heroClass) || (look && lookArt(look))) && <div className="lord-map__hero" style={{ left: '47%', top: '50%' }}><HeroSprite heroClass={heroClass} look={look} scale={4} /></div>}
      </div>
      <h2 className="lord-sign lord-map__sign">The village of Hollowbrook</h2>
    </div>
  );
}
