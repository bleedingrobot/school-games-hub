/**
 * Star Web's night sky (docs/CLASSLIVE-PLAN.md section 2): the anchor fact glowing in the middle, seven arms of stars,
 * constellation lines for lit arms, a line-art sky creature and the supernova. It only draws what the screen says
 * (no wrong answers exist in the screen data). Moving parts are CSS transform/opacity animations (projector.css).
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ARMS, ARM_GOAL, ARM_NAMES, type Arm, type Star, type StarsGame } from '../../../shared/classlive/stars';
import { ARM_COLOURS } from './arms';

/** A pupil token colour (0 to 11). */
export const PLAYER_COLOURS = Array.from({ length: 12 }, (_, i) => `hsl(${(i * 30 + 200) % 360} 85% 68%)`);

/* ---- the backdrop: deep gradient, three drifting layers of twinkling stars, a few shooting stars ---- */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const FIELD = [0, 1, 2].map((layer) =>
  Array.from({ length: 34 - layer * 8 }, (_, i) => ({
    x: rnd(i * 3 + layer * 101) * 100,
    y: rnd(i * 7 + layer * 53 + 1) * 100,
    s: 1 + layer * 0.9 + rnd(i + layer) * 1.2,
    d: rnd(i * 11 + layer) * 6,
    t: 2.5 + rnd(i * 5 + layer * 9) * 4,
  })),
);

export const NightBackdrop = memo(function NightBackdrop() {
  return (
    <div className="cl-back" aria-hidden="true">
      <div className="cl-back__glow" />
      {FIELD.map((dots, layer) => (
        <div key={layer} className={`cl-field cl-field--${layer}`}>
          {dots.map((d, i) => (
            <i key={i} className="cl-dot" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, animationDelay: `${d.d}s`, animationDuration: `${d.t}s` }} />
          ))}
        </div>
      ))}
      <b className="cl-shoot cl-shoot--a" />
      <b className="cl-shoot cl-shoot--b" />
      <b className="cl-shoot cl-shoot--c" />
    </div>
  );
});

/* ---- the creature: a whale drawn only in glowing lines ---- */
function Whale() {
  return (
    <svg className="cl-whale__svg" viewBox="0 0 420 220" fill="none" stroke="#9be7ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <g className="cl-whale__lines">
        <path d="M22 118 C50 50 170 28 266 66 C310 84 336 104 372 86 L398 52 M372 86 L402 124 C360 140 322 136 292 124 C196 188 66 180 22 118 Z" />
        <path d="M120 150 C150 190 190 200 214 176 C190 176 150 166 120 150 Z" />
        <path d="M70 126 C130 150 210 150 282 124" opacity="0.55" />
        <path d="M150 62 C150 40 170 28 160 8 M150 62 C140 38 124 30 130 10" opacity="0.7" />
        <circle cx="82" cy="104" r="5" fill="#9be7ff" />
        {[[50, 120], [110, 62], [200, 38], [266, 66], [292, 124], [372, 86], [214, 176], [120, 150], [398, 52], [402, 124]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4.5" fill="#fff" stroke="none" />
        ))}
      </g>
    </svg>
  );
}

/* ---- geometry ---- */
interface Spot {
  star: Star;
  x: number;
  y: number;
  r: number;
}
interface ArmShape {
  arm: Arm;
  angle: number;
  tip: { x: number; y: number };
  label: { x: number; y: number };
  spots: Spot[];
  lit: boolean;
}
interface Shape {
  w: number;
  h: number;
  cx: number;
  cy: number;
  anchorR: number;
  fs: number;
  textFs: number;
  showText: boolean;
  labelFs: number;
  arms: ArmShape[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const TOP = 60;
const BOTTOM = 64;

function shapeOf(w: number, h: number, stars: Star[]): Shape {
  const small = Math.min(w, h);
  const labelFs = clamp(small * 0.03, 12, 24);
  const cx = w / 2;
  const cy = TOP + (h - TOP - BOTTOM) / 2;
  const sideRoom = clamp(w * 0.07, 24, 110);
  const rx = Math.max(60, w / 2 - sideRoom - 10);
  const ry = Math.max(60, (h - TOP - BOTTOM) / 2 - labelFs - 14);
  const maxArm = Math.max(1, ...ARMS.map((a) => stars.filter((s) => s.arm === a).length));
  const density = clamp(1.15 - maxArm / 45, 0.55, 1);
  const base = clamp(small * 0.0105, 5, 11) * density;
  const textFs = clamp(small * 0.02, 9, 15) * density;
  const arms = ARMS.map((arm, i): ArmShape => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ARMS.length;
    const mine = stars.filter((s) => s.arm === arm).sort((a, b) => a.id - b.id);
    const spots = mine.map((star, k) => {
      const f = 0.44 + 0.5 * (1 - Math.exp(-k / 2.6));
      const pat = [0, 0.55, -0.55, 1, -1][k % 5];
      const jit = (((star.id * 37) % 11) - 5) / 5;
      const delta = pat * (0.05 + 0.2 * f) + jit * 0.02;
      const a = angle + delta;
      const ff = f + jit * 0.012;
      return {
        star,
        x: cx + Math.cos(a) * rx * ff,
        y: cy + Math.sin(a) * ry * ff,
        r: base * (1 + 0.12 * Math.min(star.glow, 6)),
      };
    });
    const lx = cx + Math.cos(angle) * rx * 1.02;
    const ly = cy + Math.sin(angle) * ry * 1.02;
    const half = labelFs * 4.2;
    return {
      arm,
      angle,
      tip: { x: cx + Math.cos(angle) * rx * 0.97, y: cy + Math.sin(angle) * ry * 0.97 },
      label: { x: clamp(lx, half + 4, w - half - 4), y: ly + (Math.sin(angle) < -0.3 ? -8 : Math.sin(angle) > 0.3 ? labelFs + 6 : labelFs / 3) },
      spots,
      lit: spots.length >= ARM_GOAL[arm],
    };
  });
  return { w, h, cx, cy, anchorR: clamp(small * 0.04, 14, 40), fs: clamp(Math.min(w * 0.06, h * 0.05), 17, 46), textFs, showText: w >= 560, labelFs, arms };
}

/** Where a new star flies in from: an edge of the screen, chosen from its number. */
function startOf(id: number, spot: { x: number; y: number }, w: number, h: number) {
  const edge = id % 4;
  const along = rnd(id + 3);
  const x = edge === 1 ? w + 40 : edge === 3 ? -40 : 0.1 * w + along * 0.8 * w;
  const y = edge === 0 ? -40 : edge === 2 ? h + 40 : 0.1 * h + along * 0.8 * h;
  return { dx: Math.round(x - spot.x), dy: Math.round(y - spot.y) };
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export interface SkyProps {
  game: StarsGame;
  /** Who found each star lately (name text shown for a few seconds), by star id. */
  fresh: Record<number, string>;
  /** Stars flying in right now. */
  arriving: Set<number>;
  pulsing: Set<number>;
  /** Arms whose lines are drawing in right now. */
  drawing: Set<Arm>;
  swim: boolean;
  over: boolean;
  nova: number;
  onPick?: (id: number) => void;
}

export function StarSky({ game, fresh, arriving, pulsing, drawing, swim, over, nova, onPick }: SkyProps) {
  const [ref, { w, h }] = useSize();
  const shape = useMemo(() => (w && h ? shapeOf(w, h, game.stars) : null), [w, h, game.stars]);
  const spot = game.spotlight;
  const spotSpot = shape && spot !== null ? shape.arms.flatMap((a) => a.spots).find((s) => s.star.id === spot) : undefined;
  const { x, y, p } = game.anchor;
  return (
    <div className="cl-sky" ref={ref}>
      {(swim || (over && game.creature)) && (
        <div className={`cl-whale ${swim ? 'cl-whale--swim' : 'cl-whale--still'}`} aria-hidden="true">
          <div className="cl-whale__bob"><Whale /></div>
        </div>
      )}
      {shape && (
        <svg className="cl-sky__svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Star Web sky: ${game.stars.length} stars around ${x} times ${y} equals ${p}`}>
          <defs>
            {ARMS.map((a) => (
              <radialGradient key={a} id={`cl-g-${a}`}>
                <stop offset="0%" stopColor={ARM_COLOURS[a]} stopOpacity="0.95" />
                <stop offset="35%" stopColor={ARM_COLOURS[a]} stopOpacity="0.35" />
                <stop offset="100%" stopColor={ARM_COLOURS[a]} stopOpacity="0" />
              </radialGradient>
            ))}
            <radialGradient id="cl-g-anchor">
              <stop offset="0%" stopColor="#fff7d1" stopOpacity="1" />
              <stop offset="25%" stopColor="#ffd54a" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#ff9f43" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ff9f43" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* spokes, then constellation lines of lit arms */}
          {shape.arms.map((a) => (
            <line key={`s-${a.arm}`} className="cl-spoke" x1={shape.cx} y1={shape.cy} x2={a.tip.x} y2={a.tip.y} stroke={ARM_COLOURS[a.arm]} />
          ))}
          {shape.arms.map((a) =>
            a.lit && a.spots.length > 1 ? (
              <polyline
                key={`l-${a.arm}`}
                className={`cl-line ${drawing.has(a.arm) ? 'cl-line--draw' : ''}`}
                pathLength={1}
                points={[`${shape.cx},${shape.cy}`, ...a.spots.map((s) => `${s.x},${s.y}`)].join(' ')}
                stroke={ARM_COLOURS[a.arm]}
              />
            ) : null,
          )}
          {spotSpot && <line key={`sp-${spot}`} className="cl-beam" x1={shape.cx} y1={shape.cy} x2={spotSpot.x} y2={spotSpot.y} pathLength={1} />}

          {/* the anchor */}
          <g className="cl-anchor">
            <circle cx={shape.cx} cy={shape.cy} r={shape.anchorR * 4.2} fill="url(#cl-g-anchor)" className="cl-anchor__halo" />
            <path className="cl-anchor__spark" d={sparkle(shape.cx, shape.cy, shape.anchorR * 1.7, shape.anchorR * 0.22)} fill="#fff7d1" />
            <circle cx={shape.cx} cy={shape.cy} r={shape.anchorR * 0.62} fill="#fffbe6" />
          </g>

          {/* supernova rings */}
          {nova > 0 && (
            <g key={nova}>
              {[0, 1, 2].map((i) => (
                <circle key={i} className="cl-ring" cx={shape.cx} cy={shape.cy} r={Math.min(w, h) * 0.3} style={{ animationDelay: `${i * 0.35}s` }} />
              ))}
            </g>
          )}

          {/* arm labels */}
          {shape.arms.map((a) => (
            <text key={`t-${a.arm}`} className={`cl-armlabel ${a.lit ? 'cl-armlabel--lit' : ''} ${drawing.has(a.arm) ? 'cl-armlabel--pop' : ''}`} x={a.label.x} y={a.label.y} textAnchor="middle" fontSize={shape.labelFs} fill={ARM_COLOURS[a.arm]}>
              {ARM_NAMES[a.arm]}
              <tspan className="cl-armlabel__n" dx={shape.labelFs * 0.4}>{`${a.spots.length} / ${ARM_GOAL[a.arm]}`}</tspan>
            </text>
          ))}

          {/* the stars */}
          {shape.arms.flatMap((a) =>
            a.spots.map((s) => {
              const arriv = arriving.has(s.star.id);
              const { dx, dy } = arriv ? startOf(s.star.id, s, w, h) : { dx: 0, dy: 0 };
              const left = s.x < shape.cx;
              const trail = Math.min(1, 240 / (Math.hypot(dx, dy) || 1));
              const chosen = spot === s.star.id;
              const rr = chosen ? s.r * 1.8 : s.r;
              return (
                <g key={s.star.id} transform={`translate(${s.x} ${s.y})`}>
                  <g className={`cl-star ${arriv ? 'cl-star--arrive' : ''} ${pulsing.has(s.star.id) ? 'cl-star--pulse' : ''}`} style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }} onClick={onPick ? () => onPick(s.star.id) : undefined} role={onPick ? 'button' : undefined} aria-label={onPick ? `Show ${s.star.text}` : undefined}>
                    {arriv && <line className="cl-trail" x1={0} y1={0} x2={dx * trail} y2={dy * trail} stroke={ARM_COLOURS[a.arm]} />}
                    <circle r={Math.max(rr * 6, 18)} fill="transparent" />
                    <g className="cl-star__twinkle" style={{ animationDelay: `${(s.star.id % 9) * 0.4}s` }}>
                      <circle r={rr * (3.6 + Math.min(s.star.glow, 6) * 0.25)} fill={`url(#cl-g-${a.arm})`} />
                      <path d={sparkle(0, 0, rr * 2.1, rr * 0.28)} fill="#fff" />
                      <circle r={rr * 0.75} fill="#fff" />
                    </g>
                    {shape.showText && (
                      <text className="cl-star__text" x={left ? -rr - 5 : rr + 5} y={shape.textFs * 0.35} textAnchor={left ? 'end' : 'start'} fontSize={shape.textFs} fill={ARM_COLOURS[a.arm]}>{s.star.text}</text>
                    )}
                    {fresh[s.star.id] && <text className="cl-star__who" x={0} y={rr * 2.4 + shape.textFs * 1.1} textAnchor="middle" fontSize={shape.textFs * 1.35}>{fresh[s.star.id]}</text>}
                  </g>
                </g>
              );
            }),
          )}
          <text className="cl-anchor__text" x={shape.cx} y={shape.cy + shape.anchorR * 1.5 + shape.fs * 0.9} textAnchor="middle" fontSize={shape.fs}>{`${x} × ${y} = ${p}`}</text>
        </svg>
      )}
      {nova > 0 && <div key={`f${nova}`} className="cl-flash" aria-hidden="true" />}
    </div>
  );
}

/** A four-point sparkle path centred on (x, y): long points `r`, waist `n`. */
function sparkle(x: number, y: number, r: number, n: number) {
  return `M${x} ${y - r} L${x + n} ${y - n} L${x + r} ${y} L${x + n} ${y + n} L${x} ${y + r} L${x - n} ${y + n} L${x - r} ${y} L${x - n} ${y - n} Z`;
}

export type { Arm };
