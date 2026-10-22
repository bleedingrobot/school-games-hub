import { HeroSprite } from './Sprite';
import { heroArt, sceneArt } from './art';
import type { HeroClass } from '../../../shared/lord/types';

/** Where each place is on James's map (P14), as a share of the picture's width and height. */
const SPOTS = [
  { id: 'forest', label: 'The Forest', x: 16, y: 52 },
  { id: 'inn', label: 'The Inn', x: 49, y: 44 },
  { id: 'training', label: 'Training grounds', x: 63, y: 58 },
  { id: 'arena', label: 'The Arena', x: 84, y: 42 },
  { id: 'dragon', label: 'The Red Dragon', x: 66, y: 18 },
] as const;
export type MapSpot = (typeof SPOTS)[number]['id'];

export const hasMap = () => !!sceneArt('map').wide;

/**
 * The kingdom map at the top of the village: tap a place to go there. It is a shortcut for a mouse or a finger; the
 * list of places under it does the same for the keyboard and screen readers, so the map itself is hidden from them.
 */
export function KingdomMap({ onGo, dragonReady, forestOpen, heroClass, busy }: {
  onGo: (spot: MapSpot) => void; dragonReady: boolean; forestOpen: boolean; heroClass: HeroClass; busy: boolean;
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
              <span>{s.id === 'dragon' && !dragonReady ? 'The Red Dragon (not yet)' : s.label}</span>
            </button>
          );
        })}
        {heroArt(heroClass) && <div className="lord-map__hero" style={{ left: '49%', top: '44%' }}><HeroSprite heroClass={heroClass} scale={4} /></div>}
      </div>
      <h2 className="lord-sign lord-map__sign">The village of Hollowbrook</h2>
    </div>
  );
}
