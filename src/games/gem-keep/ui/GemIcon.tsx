import type { Colour } from '../../../../shared/gem-keep/gems';
import { gemSpriteUrl } from '../art';
import { GEM_COLOURS, svgPath } from '../render/shapes';

/** A gem as a small picture: the painted gem when there is one, otherwise the same shapes and colours as on the map. */
export function GemIcon({ colours, size = 32, grade }: { colours: Colour[]; size?: number; grade?: number }) {
  const [main, ...more] = colours;
  const c = GEM_COLOURS[main];
  const id = `gk-shine-${main}`;
  const painted = colours.every((colour) => gemSpriteUrl(colour));
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="gk-gem-icon">
      {painted ? (
        <>
          <image href={gemSpriteUrl(main)} x="2" y="1" width="36" height="36" />
          {more.map((colour, i) => (
            <image key={colour} href={gemSpriteUrl(colour)} x={24 - i * 22} y="24" width="15" height="15" />
          ))}
        </>
      ) : (
        <>
          <defs>
            <radialGradient id={id} cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor={c.light} />
              <stop offset="0.45" stopColor={c.fill} />
              <stop offset="1" stopColor={c.dark} />
            </radialGradient>
          </defs>
          <path d={svgPath(main, 20, 19, 14)} fill={`url(#${id})`} stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
          {more.map((colour, i) => (
            <path
              key={colour}
              d={svgPath(colour, 31 - i * 22, 31, 6.5)}
              fill={GEM_COLOURS[colour].fill}
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ))}
        </>
      )}
      {grade !== undefined && grade > 1 && (
        <text x="20" y="24" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" stroke="#1d1b3a" strokeWidth="3" paintOrder="stroke">
          {grade}
        </text>
      )}
    </svg>
  );
}
