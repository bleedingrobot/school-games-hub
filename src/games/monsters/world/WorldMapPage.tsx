/**
 * The world map page in the Menu: a painted overview of the world (made on the gaming computer) with a
 * button on each place, and the key things in the place you pick. Places not open yet show a "?".
 * Everything on it comes from shared/monsters/world/worldMap.ts; this only draws it. The buttons are in
 * the reading order of the list, so a keyboard or screen reader goes through the places one by one.
 */
import { useState } from 'react';
import type { GameMap, WorldState } from '../../../../shared/monsters/world/types';
import { worldPlaces } from '../../../../shared/monsters/world/worldMap';

// The painted world (missing until it is painted: the places then sit on a plain sea).
const PICTURE = Object.values(import.meta.glob('./assets/world-map.webp', { eager: true, import: 'default' }) as Record<string, string>)[0];

/** Where each place sits on the picture, in percent from the top left. EASY TO EDIT when the picture changes. */
export const PLACE_SPOTS: Record<string, [number, number]> = {
  'harbour-town': [50, 60],
  'kauri-bush': [27, 68],
  'shell-beach': [42, 86],
  'fire-mountain': [76, 46],
  'snowy-peaks': [44, 24],
  'glowworm-caves': [18, 38],
  'harbour-city': [74, 80],
  'steam-valley': [88, 22],
  'lagoon-isle': [12, 88],
  'aurora-hollow': [64, 8],
};

export function WorldMapPage({ world, maps }: { world: WorldState; maps: Record<string, GameMap> }) {
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
      </section>
    </div>
  );
}
