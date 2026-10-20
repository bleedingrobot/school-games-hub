/** The map: rooms visited so far, as a see-through diagram you can read in one glance. Pause the game while it is open. */
import { useEffect, useRef, useState } from 'react';
import { DOOR_COLOURS } from './palette';
import { floorOf, mapPicture } from './mapView';
import type { MineSession } from './session';

const SCALE = 46;
const PAD = 22;

export function MineMap({ session, onClose }: { session: MineSession; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const here = floorOf(session.world, session.state);
  const [floor, setFloor] = useState<number | null>(null);
  useEffect(() => heading.current?.focus(), []);
  const pic = mapPicture(session.world, session.state, session.visited, floor);
  const w = pic.width * SCALE + PAD * 2;
  const h = pic.height * SCALE + PAD * 2;
  const pos = (x: number, y: number) => [PAD + x * SCALE, PAD + y * SCALE] as const;
  const room = new Map(pic.rooms.map((r) => [r.index, r]));
  const faint = new Map(pic.unseen.map((u) => [u.index, u]));
  const floors = Array.from({ length: pic.floors }, (_, i) => i);

  return (
    <div className="mn-overlay" role="dialog" aria-modal="true" aria-labelledby="mn-map-title" onKeyDown={(e) => (e.key === 'Escape' || e.code === 'KeyM') && onClose()}>
      <div className="mn-panel mn-map">
        <h2 id="mn-map-title" ref={heading} tabIndex={-1}>Map</h2>
        <p className="mn-hint">Rooms you have been in. The white arrow is your ship. The game waits while the map is open.</p>
        <div className="mn-map__floors" role="group" aria-label="Which floors to show">
          <button type="button" className="button button--light mn-btn" aria-pressed={floor === null} onClick={() => setFloor(null)}>All floors</button>
          {floors.map((f) => (
            <button key={f} type="button" className="button button--light mn-btn" aria-pressed={floor === f} onClick={() => setFloor(f)}>
              Floor {f + 1}{f === here ? ' (you)' : ''}
            </button>
          ))}
        </div>
        <svg className="mn-map__svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Map of the mine: ${pic.rooms.length} rooms visited.`}>
          {pic.links.map((l, i) => {
            const a = room.get(l.from) ?? faint.get(l.from);
            const b = room.get(l.to) ?? faint.get(l.to);
            if (!a || !b) return null;
            const [x1, y1] = pos(a.x, a.y);
            const [x2, y2] = pos(b.x, b.y);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={l.walked ? 'mn-map__link' : 'mn-map__link mn-map__link--faint'} />;
          })}
          {pic.unseen.map((u) => {
            const [x, y] = pos(u.x, u.y);
            return <text key={u.index} x={x} y={y + 5} textAnchor="middle" className="mn-map__unknown">?</text>;
          })}
          {pic.rooms.map((r) => {
            const [x, y] = pos(r.x, r.y);
            const rw = Math.max(10, r.hx * SCALE * 1.1);
            const rh = Math.max(10, r.hy * SCALE * 1.1);
            return (
              <g key={r.index}>
                <rect x={x - rw} y={y - rh} width={rw * 2} height={rh * 2} rx={4} className={`mn-map__room${r.here ? ' mn-map__room--here' : ''}`} />
                {r.start && <text x={x} y={y + 4} textAnchor="middle" className="mn-map__tag">EXIT</text>}
                {r.reactor && !r.start && <text x={x} y={y + 4} textAnchor="middle" className="mn-map__tag mn-map__tag--reactor">REACTOR</text>}
                {r.doors.map((d, i) => (
                  <circle key={i} cx={x - rw + 7 + i * 11} cy={y - rh + 7} r={4.5} fill={`#${DOOR_COLOURS[d as keyof typeof DOOR_COLOURS].toString(16).padStart(6, '0')}`} stroke="#fff" strokeWidth={1} />
                ))}
              </g>
            );
          })}
          {(floor === null || floor === here) && (
            <g transform={`translate(${pos(pic.ship.x, pic.ship.y).join(' ')}) rotate(${(pic.ship.angle * 180) / Math.PI})`}>
              <path d="M0 -9 L6 7 L0 4 L-6 7 Z" className="mn-map__ship" />
            </g>
          )}
        </svg>
        <p className="mn-legend">
          <span>Doors: </span>
          {(['blue', 'yellow', 'red', 'question'] as const).map((d) => (
            <span key={d} className="mn-legend__item">
              <span className="mn-legend__dot" style={{ background: `#${DOOR_COLOURS[d].toString(16).padStart(6, '0')}` }} aria-hidden="true" />
              {d === 'question' ? 'question' : d}
            </span>
          ))}
        </p>
        <button type="button" className="button button--play mn-btn mn-map__back" onClick={onClose}>Back to the game</button>
      </div>
    </div>
  );
}
