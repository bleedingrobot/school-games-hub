/**
 * The world map page in the Menu: a painted overview of the world (made on the gaming computer) with a
 * button on each place, and the key things in the place you pick. Places not open yet show a "?".
 * Everything on it comes from shared/monsters/world/worldMap.ts; this only draws it. The buttons are in
 * the reading order of the list, so a keyboard or screen reader goes through the places one by one.
 * Pick an open place you are not in and "Travel here" takes you there (fast travel, worldMap.ts).
 */
import { useState } from 'react';
import type { GameMap, WorldState } from '../../../../shared/monsters/world/types';
import { landingFor, worldPlaces } from '../../../../shared/monsters/world/worldMap';

// The painted world, made on the gaming computer (scripts/monsters-worldmap-art.py). Without it the places sit on a plain sea.
const PICTURE = Object.values(import.meta.glob('./assets/world-map.webp', { eager: true, import: 'default' }) as Record<string, string>)[0];

/** Where each place sits on the picture, in percent from the top left. EASY TO EDIT when the picture changes. */
export const PLACE_SPOTS: Record<string, [number, number]> = {
  // Just below each painted place, so the label doesn't hide it.
  'harbour-town': [51, 72],
  'kauri-bush': [28, 79],
  'shell-beach': [42, 92],
  'fire-mountain': [76, 62],
  'snowy-peaks': [43, 37],
  'glowworm-caves': [19, 48],
  'harbour-city': [78, 82],
  'steam-valley': [88, 35],
  'lagoon-isle': [12, 95],
  'aurora-hollow': [65, 18],
};

export function WorldMapPage({ world, maps, onTravel }: { world: WorldState; maps: Record<string, GameMap>; onTravel?: (place: string) => void }) {
  const places = worldPlaces(world, maps);
  const [pick, setPick] = useState(() => places.find((p) => p.here)?.id ?? places[0].id);
  const chosen = places.find((p) => p.id === pick) ?? places[0];
  return (
    <div className="mwm">
      <div className={`mwm-map${PICTURE ? '' : ' mwm-map--plain'}`} role="group" aria-label="World map">
        {PICTURE && <img className="mwm-pic" src={PICTURE} alt="" draggable={false} />}
        {places.map((p) => {
          const [x, y] = PLACE_SPOTS[p.id] ?? [50, 50];
          const todo = p.pins.filter((pin) => pin.todo).length;
          return (
            <button
              key={p.id}
              type="button"
              className={`mwm-place${p.open ? '' : ' is-shut'}${p.here ? ' is-here' : ''}${p.id === pick ? ' is-picked' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-pressed={p.id === pick}
              onClick={() => setPick(p.id)}
            >
              {p.here && <span className="mwm-here">You are here</span>}
              {p.open ? p.name : '?'}
              {todo > 0 && <span className="mwm-todo" aria-label={`${todo} things to do`}>{todo}</span>}
            </button>
          );
        })}
      </div>
      <section className="mwm-info" aria-live="polite" aria-labelledby="mwm-name">
        <h3 id="mwm-name">{chosen.name}{chosen.here ? ' (you are here)' : ''}</h3>
        {!chosen.open && <p>Not open yet. {chosen.opens}.</p>}
        {chosen.open && (
          <ul className="mwm-pins">
            {chosen.pins.map((pin, i) => (
              <li key={i} className={pin.todo ? 'is-todo' : ''}>
                <span aria-hidden="true">{pin.icon}</span> {pin.text}
              </li>
            ))}
          </ul>
        )}
        {onTravel && chosen.open && !chosen.here && landingFor(chosen.id, maps) && (
          <button type="button" className="mb-btn mb-btn--primary mwm-travel" onClick={() => onTravel(chosen.id)}>Travel to {chosen.name}</button>
        )}
      </section>
    </div>
  );
}
