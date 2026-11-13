/** Glyph Gates' drawn stand-ins (paintings go in later): glyphs, fraction bars, monkeys, the lock and the star. */
import { GRID } from '../../../shared/glyph/config';
import { rowCol } from '../../../shared/glyph/glyphs';
import type { Frac } from '../../../shared/glyph/fractions';

/** A glyph: a 4 × 4 mini grid with the glyph's cells lit. `ghost` shows the empty cells faintly. */
export function GlyphPicture({ cells, size = 96, tone = 'green' }: { cells: readonly number[]; size?: number; tone?: 'green' | 'gold' }) {
  const step = 100 / GRID;
  return (
    <svg className={`gg-glyph-svg gg-glyph-svg--${tone}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {Array.from({ length: GRID * GRID }, (_, c) => {
        const [r, k] = rowCol(c);
        const on = cells.includes(c);
        return <rect key={c} x={k * step + 2} y={r * step + 2} width={step - 4} height={step - 4} rx="4" className={on ? 'gg-gl-on' : 'gg-gl-off'} />;
      })}
    </svg>
  );
}

/** A fraction bar: `d` equal parts with `n` shaded. All bars are the same length, so equal fractions look equal. */
export function FractionBar({ frac, tone = 'gold', label }: { frac: Frac; tone?: 'gold' | 'green' | 'red'; label: string }) {
  const w = 240;
  const part = w / frac.d;
  return (
    <svg className={`gg-bar gg-bar--${tone}`} viewBox={`0 0 ${w} 26`} role="img" aria-label={label}>
      {Array.from({ length: frac.d }, (_, i) => (
        <rect key={i} x={i * part + 0.75} y="2" width={part - 1.5} height="22" rx={frac.d > 20 ? 0 : 3} className={i < frac.n ? 'gg-bar-on' : 'gg-bar-off'} />
      ))}
    </svg>
  );
}

/** A cartoon monkey; arms up when `cheer` is set. */
export function Monkey({ cheer = false, flip = false }: { cheer?: boolean; flip?: boolean }) {
  return (
    <svg className={`gg-monkey${cheer ? ' gg-monkey--cheer' : ''}`} viewBox="0 0 80 90" width="64" height="72" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <g className="gg-monkey__armL"><path d="M20 52 Q6 44 8 24" stroke="#7a4a24" strokeWidth="9" strokeLinecap="round" fill="none" /><circle cx="8" cy="22" r="6" fill="#c98f5a" /></g>
      <g className="gg-monkey__armR"><path d="M60 52 Q74 44 72 24" stroke="#7a4a24" strokeWidth="9" strokeLinecap="round" fill="none" /><circle cx="72" cy="22" r="6" fill="#c98f5a" /></g>
      <ellipse cx="40" cy="64" rx="19" ry="21" fill="#8a5630" />
      <ellipse cx="40" cy="68" rx="11" ry="13" fill="#e2b98a" />
      <circle cx="16" cy="36" r="9" fill="#8a5630" /><circle cx="16" cy="36" r="5" fill="#e2b98a" />
      <circle cx="64" cy="36" r="9" fill="#8a5630" /><circle cx="64" cy="36" r="5" fill="#e2b98a" />
      <circle cx="40" cy="36" r="20" fill="#8a5630" />
      <ellipse cx="40" cy="42" rx="14" ry="12" fill="#e2b98a" />
      <circle cx="33" cy="34" r="4" fill="#fff" /><circle cx="47" cy="34" r="4" fill="#fff" />
      <circle cx="34" cy="35" r="2" fill="#222" /><circle cx="48" cy="35" r="2" fill="#222" />
      <path d="M32 46 Q40 54 48 46" stroke="#5a2f14" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A little padlock. */
export function Lock() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/** A star made of glyph squares: gold when earned. */
export function GlyphStar({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={on ? 'gg-star gg-star--on' : 'gg-star'}>
      <path d="M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z" />
    </svg>
  );
}

/** Left-to-right arrow for ×-arrows: a curved arrow from the gold stone's number to the tile's. */
export function ArrowCurve({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'red' }) {
  return (
    <span className={`gg-arrow gg-arrow--${tone}`}>
      <svg viewBox="0 0 60 18" width="60" height="18" aria-hidden="true">
        <path d="M2 14 Q30 -4 56 12" fill="none" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M50 6 L57 12 L48 16" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <b>{label}</b>
    </span>
  );
}

/** A fraction stacked: numerator, line, denominator. */
export function Stack({ frac }: { frac: Frac }) {
  return (
    <span className="gg-frac" aria-hidden="true">
      <span>{frac.n}</span>
      <span className="gg-frac__line" />
      <span>{frac.d}</span>
    </span>
  );
}
