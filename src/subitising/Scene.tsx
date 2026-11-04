import { STAGES } from '../../shared/subitising/config';
import { artUrl } from './art';
import './scene.css';

const BED_LEFT = 6;
const BED_GAP = 2.5;
/** Beds share the scene width (160) whatever the number of stages. */
const BED_W = (160 - 2 * BED_LEFT - (STAGES.length - 1) * BED_GAP) / STAGES.length;
const BED_PITCH = BED_W + BED_GAP;

/** The garden behind the screens: the painted picture if there is one, else a drawn sky, hill, fence and one bed per stage. */
export function GardenScene({ className = '', beds = true }: { className?: string; beds?: boolean }) {
  const url = artUrl('garden-scene');
  const cls = `sb-scene ${className}`.trim();
  if (url) return <div className={`${cls} sb-scene--painted`} style={{ backgroundImage: `url(${url})` }} aria-hidden="true" />;
  return (
    <svg className={cls} viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sbSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9d8f3" />
          <stop offset="1" stopColor="#e6f5fc" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="url(#sbSky)" />
      <ellipse cx="30" cy="14" rx="13" ry="4" fill="#fff" opacity="0.85" />
      <ellipse cx="38" cy="11" rx="8" ry="3.5" fill="#fff" opacity="0.85" />
      <ellipse cx="118" cy="22" rx="15" ry="4" fill="#fff" opacity="0.8" />
      <path d="M-10 58 Q 30 32 80 42 T 170 40 V 90 H-10Z" fill="#a8dd8f" />
      <path d="M-10 66 Q 50 44 100 54 T 170 52 V 90 H-10Z" fill="#8ccf74" />
      <g fill="#f3e6c8" stroke="#c9b48a" strokeWidth="0.4">
        <rect x="0" y="58.5" width="160" height="1.6" />
        <rect x="0" y="62.5" width="160" height="1.6" />
        {Array.from({ length: 27 }, (_, i) => (
          <rect key={i} x={i * 6 + 1} y="55.5" width="2.6" height="11" rx="1" />
        ))}
      </g>
      <rect y="66" width="160" height="24" fill="#74bf5f" />
      {beds && (
        <g className="sb-scene-beds">
          {STAGES.map((_, i) => (
            <g key={i} transform={`translate(${BED_LEFT + i * BED_PITCH} 71)`}>
              <rect width={BED_W} height="14" rx="1.5" fill="#b9803f" stroke="#7b4f22" strokeWidth="0.6" />
              <rect x="1.2" y="1.2" width={BED_W - 2.4} height="4" rx="1" fill="#5e4026" />
              <path d={`M0 8.5H${BED_W}M0 11.5H${BED_W}`} stroke="#8a5a28" strokeWidth="0.5" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/** A small picture of the garden to stand in for an icon (Training home, dashboard tile). */
export function SceneThumb({ className = '' }: { className?: string }) {
  return (
    <span className={`sb-thumb ${className}`.trim()} aria-hidden="true">
      <GardenScene />
    </span>
  );
}
