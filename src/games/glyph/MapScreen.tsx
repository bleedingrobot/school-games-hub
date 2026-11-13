/** The jungle map: six temples on a path (a drawn stand-in; the painting goes in later). */
import { useEffect, useRef } from 'react';
import { PASS_FIRST_GO, TEMPLES, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';
import { templeOpen, type Progress } from '../../../shared/glyph/play';
import { GlyphStar, Lock } from './Art';

/** Where each temple sits, in percent of the map, wide and narrow. */
const WIDE = [[9, 76], [27, 42], [45, 72], [60, 30], [78, 62], [92, 22]];
const NARROW = [[26, 88], [72, 72], [28, 56], [72, 40], [28, 25], [66, 11]];

const stars = (best: number): number => (best >= WALLS_PER_TEMPLE ? 3 : best >= PASS_FIRST_GO ? 2 : best > 0 ? 1 : 0);

function PathSvg({ points, className }: { points: number[][]; className: string }) {
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x * 10} ${y * 10}`).join(' ');
  return (
    <svg className={className} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="#d9c089" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 38" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Foliage() {
  return (
    <svg className="gg-map__trees" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[[20, 150, 1.2], [90, 40, 0.9], [170, 170, 1.1], [250, 30, 1], [330, 150, 1.3], [380, 50, 0.8], [210, 100, 0.7], [50, 100, 0.7]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-4" y="0" width="8" height="26" fill="#5a3b1e" />
          <circle cx="0" cy="-6" r="24" fill="#2f7d3a" />
          <circle cx="-14" cy="6" r="16" fill="#3c9347" />
          <circle cx="14" cy="6" r="16" fill="#276b32" />
        </g>
      ))}
    </svg>
  );
}

export function MapScreen({ progress, busy, error, onPlay, onHowTo, onReplayGuide, onExit }: {
  progress: Progress;
  busy: boolean;
  error: string | null;
  onPlay: (temple: number) => void;
  onHowTo: () => void;
  onReplayGuide: () => void;
  onExit?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="gg-map" aria-labelledby="gg-map-h">
      <header className="gg-map__top">
        <div>
          <h2 id="gg-map-h" className="gg-h" tabIndex={-1} ref={heading}>Glyph Gates</h2>
          <p className="gg-soft">Light the tiles that match the gold stone and open the temple walls.</p>
        </div>
        <div className="gg-map__btns">
          <button type="button" className="gg-btn" onClick={onHowTo}>How to play</button>
          <button type="button" className="gg-btn" onClick={onReplayGuide} disabled={busy}>Replay the guide</button>
        </div>
      </header>
      {error && <p className="gg-error" role="alert">{error}</p>}
      <div className="gg-map__land">
        <Foliage />
        <PathSvg points={WIDE} className="gg-map__path gg-map__path--wide" />
        <PathSvg points={NARROW} className="gg-map__path gg-map__path--narrow" />
        {TEMPLES.map((t, i) => {
          const open = templeOpen(progress, t.id);
          const best = progress.best[t.id] ?? 0;
          const passed = progress.passed >= t.id;
          const label = open ? `${t.name}, temple ${t.id}${best ? `, best ${best} of ${WALLS_PER_TEMPLE} first go` : ''}${passed ? ', passed' : ''}` : `${t.name}, locked`;
          return (
            <button
              key={t.id}
              type="button"
              className={`gg-temple${open ? '' : ' gg-temple--locked'}${passed ? ' gg-temple--passed' : ''}`}
              style={{ ['--x' as string]: `${WIDE[i][0]}%`, ['--y' as string]: `${WIDE[i][1]}%`, ['--mx' as string]: `${NARROW[i][0]}%`, ['--my' as string]: `${NARROW[i][1]}%` }}
              aria-label={label}
              aria-disabled={!open}
              disabled={busy && open}
              onClick={() => open && onPlay(t.id)}
            >
              <span className="gg-temple__stone" aria-hidden="true">{open ? t.id : <Lock />}</span>
              <span className="gg-temple__name">{t.name}</span>
              {open && (
                <span className="gg-temple__best">
                  <span className="gg-stars" aria-hidden="true">{[1, 2, 3].map((k) => <GlyphStar key={k} on={k <= stars(best)} />)}</span>
                  {best ? `${best} of ${WALLS_PER_TEMPLE}` : 'Not yet'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="gg-soft gg-map__pass">Open {PASS_FIRST_GO} of {WALLS_PER_TEMPLE} walls at the first go to pass a temple.</p>
      {onExit && <button type="button" className="gg-btn" onClick={onExit}>Back to games</button>}
    </section>
  );
}
