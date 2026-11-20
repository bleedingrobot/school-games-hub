import type { CSSProperties } from 'react';
import { backgroundById } from './looks';

/** Fixed numbers, so the particles look the same every time. */
const BITS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 61) % 100,
  size: 3 + ((i * 7) % 6),
  duration: 8 + ((i * 13) % 9),
  delay: -((i * 11) % 17),
  drift: ((i * 29) % 80) - 40,
  spin: 180 + ((i * 47) % 360),
  hue: i % 3,
}));

/**
 * A chess background painting with its own drifting particles: gold dust in the castle, leaves in the forest, sea
 * spray on the coast, embers at the volcano, snow on the mountain, bubbles under the sea and stars in space.
 */
export function Scenery({ background, className = '' }: { background: string | undefined; className?: string }) {
  const bg = backgroundById(background);
  return (
    <div className={`cw-scene cw-scene--${bg.particle} ${className}`} aria-hidden="true">
      <img key={bg.id} src={bg.img} srcSet={`${bg.small} 800w, ${bg.img} 1600w`} sizes="100vw" alt="" />
      <div className="cw-fx">
        {BITS.map((b, i) => (
          <span
            key={i}
            className={`cw-fx__bit cw-fx__bit--${b.hue}`}
            style={
              {
                '--x': `${b.x}%`,
                '--y': `${b.y}%`,
                '--size': `${b.size}px`,
                '--drift': `${b.drift}px`,
                '--spin': `${b.spin}deg`,
                animationDuration: `${b.duration}s`,
                animationDelay: `${b.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
