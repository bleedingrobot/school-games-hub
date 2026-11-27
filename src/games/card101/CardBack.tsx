/**
 * The card backs, drawn in code (docs/101-ART-PLAN.md "Card backs"). Each is the art inside the same white frame, in the
 * card's 100 × 140 box. A painted back (art/paint/backs/<id>.webp) replaces the drawn art inside the frame once it's
 * tidied in; Sea Glass and Rock Pool already use Bond Match's painted sea-glass tile and Pip the crab.
 */
import type { ReactNode } from 'react';
import { backPicture, BORROWED } from './art';
import type { BackId } from './backs';

/** The art area inside the white frame. */
const IN = { x: 6, y: 6, w: 88, h: 128, r: 6 };

function Frame({ id, children, fill }: { id: string; children?: ReactNode; fill: string }) {
  return (
    <>
      <defs>
        <clipPath id={`c101-${id}-clip`}>
          <rect x={IN.x} y={IN.y} width={IN.w} height={IN.h} rx={IN.r} />
        </clipPath>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#fff" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
      <g clipPath={`url(#c101-${id}-clip)`}>
        <rect x={IN.x} y={IN.y} width={IN.w} height={IN.h} fill={fill} />
        {children}
      </g>
      <rect x={IN.x} y={IN.y} width={IN.w} height={IN.h} rx={IN.r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
    </>
  );
}

const grad = (id: string, stops: [string, string], x2 = 1, y2 = 1) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={stops[0]} />
    <stop offset="1" stopColor={stops[1]} />
  </linearGradient>
);

/** A five-petal pōhutukawa pom-pom. */
function Pom({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="0" y1="0" x2={r * Math.cos((i * Math.PI) / 6)} y2={r * Math.sin((i * Math.PI) / 6)} stroke="#e53935" strokeWidth={r / 5} strokeLinecap="round" />
      ))}
      <circle r={r * 0.35} fill="#ffcdd2" />
    </g>
  );
}

function Koru({ x, y, s, flip = false, colour }: { x: number; y: number; s: number; flip?: boolean; colour: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}
      d="M0 20 C0 4 22 -6 30 8 C36 18 26 28 18 22 C12 18 16 10 21 13"
      fill="none"
      stroke={colour}
      strokeWidth={4 / s}
      strokeLinecap="round"
    />
  );
}

function Star({ x, y, r, fill = '#fff' }: { x: number; y: number; r: number; fill?: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    return `${(x + d * Math.cos(a)).toFixed(2)},${(y + d * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} />;
}

function Drawn({ id }: { id: BackId }) {
  const g = `c101-${id}-g`;
  switch (id) {
    case 'classic':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>
            {grad(g, ['#5b3cc4', '#2b1d7a'])}
            <pattern id={`${g}-dots`} width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1.6" fill="rgba(255,210,63,0.35)" />
            </pattern>
          </defs>
          <rect x="6" y="6" width="88" height="128" fill={`url(#${g}-dots)`} />
          <path d="M50 38 L78 70 L50 102 L22 70 Z" fill="#2b1d7a" stroke="#ffd23f" strokeWidth="2.5" />
        </Frame>
      );
    case 'seaglass':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#0f766e', '#134e4a'])}</defs>
          {[14, 30, 46, 62, 78, 94, 110, 126].map((y, i) => (
            <circle key={y} cx={i % 2 ? 22 : 78} cy={y} r="2" fill="rgba(253,230,138,0.45)" />
          ))}
          <circle cx="50" cy="70" r="34" fill="rgba(153,246,228,0.25)" />
          <image href={BORROWED.seaGlass} x="18" y="38" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
        </Frame>
      );
    case 'rockpool':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#22d3ee', '#0e7490'], 0, 1)}</defs>
          {[18, 30, 42].map((r) => (
            <ellipse key={r} cx="50" cy="74" rx={r * 1.1} ry={r * 0.8} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          ))}
          <circle cx="16" cy="18" r="9" fill="#94a3b8" />
          <circle cx="86" cy="124" r="11" fill="#94a3b8" />
          <image href={BORROWED.pip} x="16" y="40" width="68" height="68" preserveAspectRatio="xMidYMid meet" />
        </Frame>
      );
    case 'pohutukawa':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#1b5e20', '#0b3d12'])}</defs>
          {[
            [24, 26, 9],
            [76, 26, 9],
            [24, 114, 9],
            [76, 114, 9],
            [50, 70, 16],
          ].map(([x, y, r]) => (
            <Pom key={`${x}-${y}`} x={x} y={y} r={r} />
          ))}
          {[
            [50, 34],
            [50, 106],
            [20, 70],
            [80, 70],
          ].map(([x, y]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx="7" ry="3.5" fill="#43a047" transform={`rotate(${x === 50 ? 0 : 90} ${x} ${y})`} />
          ))}
        </Frame>
      );
    case 'koru':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#065f46', '#064e3b'])}</defs>
          <Koru x={14} y={14} s={1} colour="#34d399" />
          <Koru x={86} y={14} s={1} flip colour="#5eead4" />
          <Koru x={14} y={100} s={1} colour="#5eead4" />
          <Koru x={86} y={100} s={1} flip colour="#34d399" />
          <Koru x={30} y={56} s={1.3} colour="#a7f3d0" />
        </Frame>
      );
    case 'kea':
      return (
        <Frame id={id} fill="#4d5d23">
          {Array.from({ length: 7 }, (_, row) =>
            Array.from({ length: 5 }, (_, col) => {
              const x = 10 + col * 20 + (row % 2) * 10;
              const y = 12 + row * 19;
              const mid = row >= 2 && row <= 4 && col >= 1 && col <= 3;
              return <path key={`${row}-${col}`} d={`M${x} ${y - 10} Q${x + 10} ${y} ${x} ${y + 12} Q${x - 10} ${y} ${x} ${y - 10} Z`} fill={mid ? '#f97316' : row % 2 ? '#6b7f2a' : '#7c9431'} stroke="#2f3a12" strokeWidth="0.8" />;
            }),
          )}
        </Frame>
      );
    case 'paua':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1e3a8a" />
              <stop offset="0.35" stopColor="#0d9488" />
              <stop offset="0.7" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          {[12, 22, 32, 42, 52].map((r, i) => (
            <ellipse key={r} cx="50" cy="70" rx={r} ry={r * 1.35} fill="none" stroke={['#67e8f9', '#a78bfa', '#6ee7b7', '#93c5fd', '#f0abfc'][i]} strokeWidth="3" opacity="0.65" transform={`rotate(${i * 9} 50 70)`} />
          ))}
        </Frame>
      );
    case 'matariki':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#1e1b4b', '#020617'], 0, 1)}</defs>
          <path d="M0 120 C30 90 70 60 100 20" stroke="rgba(199,210,254,0.18)" strokeWidth="18" fill="none" />
          {[
            [14, 20],
            [84, 16],
            [22, 118],
            [80, 110],
            [12, 76],
            [90, 64],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#e0e7ff" />
          ))}
          {[
            [50, 60, 6],
            [40, 70, 4.5],
            [60, 72, 4.5],
            [46, 82, 4],
            [58, 52, 3.5],
            [36, 56, 3],
            [52, 92, 3],
            [64, 86, 3],
            [44, 46, 2.5],
          ].map(([x, y, r]) => (
            <Star key={`${x}-${y}`} x={x} y={y} r={r * 1.5} fill="#fef9c3" />
          ))}
        </Frame>
      );
    case 'wave':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#38bdf8', '#1d4ed8'], 0, 1)}</defs>
          {[20, 44, 68, 92, 116, 140].map((y, i) => (
            <path key={y} d={`M-4 ${y} q12 -16 24 0 t24 0 t24 0 t24 0 t24 0`} fill="none" stroke={i % 2 ? '#e0f2fe' : '#7dd3fc'} strokeWidth="5" strokeLinecap="round" />
          ))}
        </Frame>
      );
    case 'golden':
      return (
        <Frame id={id} fill={`url(#${g})`}>
          <defs>{grad(g, ['#fbbf24', '#b45309'])}</defs>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            return <path key={i} d={`M50 70 L${50 + 90 * Math.cos(a - 0.09)} ${70 + 90 * Math.sin(a - 0.09)} L${50 + 90 * Math.cos(a + 0.09)} ${70 + 90 * Math.sin(a + 0.09)} Z`} fill="rgba(255,247,200,0.35)" />;
          })}
          <circle cx="50" cy="70" r="20" fill="#fde68a" stroke="#92400e" strokeWidth="1.5" />
          <path d="M37 78 L35 62 L43 69 L50 58 L57 69 L65 62 L63 78 Z" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" strokeLinejoin="round" />
        </Frame>
      );
  }
}

/** One card back, painted if its picture is in, else drawn. Classic always keeps its "101". */
export function CardBackArt({ id }: { id: BackId }) {
  const painted = backPicture(id);
  return (
    <>
      {painted ? (
        <Frame id={`${id}-p`} fill="#2b1d7a">
          <image href={painted} x={IN.x} y={IN.y} width={IN.w} height={IN.h} preserveAspectRatio="xMidYMid slice" />
        </Frame>
      ) : (
        <Drawn id={id} />
      )}
      {id === 'classic' && (
        <text x="50" y="80" textAnchor="middle" fill="#ffd23f" stroke="#2b1d7a" strokeWidth="1" fontSize="26" fontWeight="900" fontFamily="inherit">
          101
        </text>
      )}
    </>
  );
}

/** A back on its own (the picker and the fan on the setup screen). */
export function CardBackSvg({ id, className = '' }: { id: BackId; className?: string }) {
  return (
    <svg className={`playing-card is-down ${className}`} viewBox="0 0 100 140" aria-hidden="true" focusable="false">
      <CardBackArt id={id} />
    </svg>
  );
}
