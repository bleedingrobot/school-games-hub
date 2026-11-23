/**
 * Mystery Mural's pictures (shared/classlive/mural.ts PICTURES): bold, flat-colour stand-ins drawn with simple SVG shapes
 * until the painted ones are ready. Every picture fills a 240 x 160 box (the same 3:2 shape as the 12 x 8 tile grid), with
 * its own sky or sea, so each tile shows part of a clear scene. Flat fills only (no gradients or ids), so several copies
 * can sit on one page.
 */
import type { ReactNode } from 'react';
import type { Picture } from '../../../shared/classlive/mural';
import { painted } from './paintedArt';

const Sea = ({ y = 100, c = '#1b6fb5' }: { y?: number; c?: string }) => <rect x="0" y={y} width="240" height={160 - y} fill={c} />;
const Wave = ({ x, y, c = '#ffffff' }: { x: number; y: number; c?: string }) => (
  <path d={`M${x} ${y} q6 -8 12 0 t12 0 t12 0`} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
);
const Cloud = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
    <ellipse cx="0" cy="0" rx="22" ry="10" /><circle cx="-8" cy="-8" r="10" /><circle cx="8" cy="-10" r="13" />
  </g>
);
const Star = ({ x, y, r = 2 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="#fff6b0" />;

const ART: Record<Picture, () => ReactNode> = {
  whale: () => (
    <>
      <rect width="240" height="160" fill="#7fd6ff" />
      <Sea y={78} c="#1f86d1" />
      <Sea y={118} c="#14589c" />
      <circle cx="205" cy="26" r="16" fill="#ffe14d" />
      <path d="M118 78 q-6 -22 -16 -30 M118 78 q4 -24 14 -32 M118 78 v-26" stroke="#d6f3ff" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="102" cy="46" r="4" fill="#d6f3ff" /><circle cx="132" cy="44" r="4" fill="#d6f3ff" /><circle cx="118" cy="48" r="4" fill="#d6f3ff" />
      <path d="M40 112 q10 -48 80 -40 q64 4 88 34 q-14 -4 -22 4 q10 10 28 8 q-8 22 -34 14 q-30 36 -84 28 q-52 -6 -56 -48z" fill="#3b63d6" />
      <path d="M60 118 q60 24 130 -4 q-30 30 -70 30 q-44 0 -60 -26z" fill="#cfe0ff" />
      <path d="M214 98 q18 -22 24 -34 q4 22 -6 42z M214 106 q22 8 24 26 q-20 -2 -30 -16z" fill="#2c4cb3" />
      <circle cx="68" cy="100" r="6" fill="#fff" /><circle cx="70" cy="101" r="3" fill="#10204a" />
      <path d="M52 114 q12 8 26 6" stroke="#10204a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Wave x={12} y={92} /><Wave x={170} y={86} /><Wave x={20} y={140} c="#7fd6ff" /><Wave x={150} y={142} c="#7fd6ff" />
    </>
  ),
  volcano: () => (
    <>
      <rect width="240" height="160" fill="#ffb347" />
      <rect width="240" height="70" fill="#ff7a59" />
      <circle cx="40" cy="40" r="20" fill="#ffe14d" />
      <circle cx="124" cy="44" r="14" fill="#6b4b5e" /><circle cx="140" cy="30" r="12" fill="#7d5b6e" /><circle cx="158" cy="20" r="10" fill="#8a6a7c" /><circle cx="178" cy="12" r="8" fill="#97788a" />
      <path d="M30 150 L98 56 L142 56 L212 150z" fill="#6b3b22" />
      <path d="M98 56 L142 56 L136 70 L120 62 L104 72z" fill="#ff3d2e" />
      <path d="M106 66 q-6 30 -18 56 q12 4 20 -8z M128 68 q8 26 6 46 q14 -2 22 14 q-8 -34 -16 -52z" fill="#ff7a1c" />
      <path d="M104 54 l-2 -14 l8 6 l4 -12 l6 12 l8 -8 l-2 16z" fill="#ff5d1c" />
      <rect y="132" width="240" height="28" fill="#2e8b3a" />
      <ellipse cx="46" cy="140" rx="30" ry="12" fill="#3dae4b" /><ellipse cx="200" cy="142" rx="34" ry="12" fill="#3dae4b" />
      <circle cx="170" cy="40" r="5" fill="#ff5d1c" /><circle cx="76" cy="24" r="4" fill="#ff5d1c" />
    </>
  ),
  castle: () => (
    <>
      <rect width="240" height="160" fill="#7fc8ff" />
      <Cloud x={40} y={30} /><Cloud x={190} y={44} s={0.8} />
      <rect y="128" width="240" height="32" fill="#4fbf5a" />
      <rect x="62" y="70" width="116" height="62" fill="#c7b8ee" />
      <rect x="62" y="70" width="116" height="8" fill="#a897d8" />
      {[66, 84, 102, 120, 138, 156].map((x) => <rect key={x} x={x} y="62" width="10" height="10" fill="#c7b8ee" />)}
      <rect x="34" y="52" width="34" height="80" fill="#b3a2e4" /><rect x="172" y="52" width="34" height="80" fill="#b3a2e4" />
      <path d="M28 54 L51 18 L74 54z" fill="#e8384f" /><path d="M166 54 L189 18 L212 54z" fill="#e8384f" />
      <rect x="104" y="40" width="32" height="40" fill="#b3a2e4" /><path d="M98 42 L120 6 L142 42z" fill="#2f7be8" />
      <path d="M120 6 v-10 l12 4 l-12 4" fill="#ffd23f" />
      <path d="M104 132 v-28 a16 16 0 0 1 32 0 v28z" fill="#3a2a66" />
      <rect x="46" y="76" width="8" height="14" rx="4" fill="#3a2a66" /><rect x="186" y="76" width="8" height="14" rx="4" fill="#3a2a66" />
      <rect x="116" y="56" width="8" height="12" rx="4" fill="#3a2a66" />
      <rect x="76" y="88" width="10" height="14" fill="#ffd23f" /><rect x="154" y="88" width="10" height="14" fill="#ffd23f" />
    </>
  ),
  rocket: () => (
    <>
      <rect width="240" height="160" fill="#1c1458" />
      {[[20, 20], [60, 50], [200, 22], [170, 70], [30, 110], [220, 120], [90, 14], [150, 30], [14, 70]].map(([x, y]) => <Star key={`${x}${y}`} x={x} y={y} r={2.4} />)}
      <circle cx="196" cy="116" r="30" fill="#ff7bd5" /><ellipse cx="196" cy="116" rx="46" ry="8" fill="none" stroke="#ffd23f" strokeWidth="4" />
      <circle cx="44" cy="124" r="14" fill="#5fd4ff" />
      <path d="M96 150 q-18 -40 0 -92 q8 -22 24 -34 q16 12 24 34 q18 52 0 92z" fill="#f4f7ff" />
      <path d="M120 24 q16 12 24 34 h-48 q8 -22 24 -34z" fill="#ff3d5e" />
      <circle cx="120" cy="78" r="15" fill="#2f7be8" /><circle cx="120" cy="78" r="9" fill="#8ad7ff" />
      <path d="M96 118 l-24 28 l8 -42z M144 118 l24 28 l-8 -42z" fill="#ff3d5e" />
      <rect x="104" y="146" width="32" height="6" fill="#8a96c8" />
      <path d="M106 152 q14 30 28 0 q-14 8 -28 0z" fill="#ff9f1c" /><path d="M112 152 q8 18 16 0z" fill="#ffe14d" />
    </>
  ),
  kiwi: () => (
    <>
      <rect width="240" height="160" fill="#a5e08a" />
      <path d="M0 100 q40 -50 80 0 q20 -30 50 -6 q30 -40 60 4 q26 -20 50 0 v62 h-240z" fill="#4fae52" />
      <rect y="124" width="240" height="36" fill="#7a5230" />
      <path d="M20 90 q-10 -40 10 -70 M26 94 q-4 -30 22 -50 M214 92 q12 -40 -8 -70 M208 96 q4 -30 -20 -50" stroke="#2f8f43" strokeWidth="8" strokeLinecap="round" fill="none" />
      <ellipse cx="116" cy="94" rx="56" ry="42" fill="#8a5a2b" />
      <path d="M84 64 q10 -6 20 -4 M96 78 q14 -6 26 -4 M100 98 q16 -4 30 2 M126 66 q12 -4 22 2 M132 84 q12 -2 20 6" stroke="#5e3a18" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="68" cy="66" r="22" fill="#9c6a35" />
      <path d="M52 70 L6 106 L12 110 L58 82z" fill="#f2cf7a" />
      <circle cx="70" cy="60" r="6" fill="#fff" /><circle cx="68" cy="60" r="3" fill="#1b1b1b" />
      <path d="M100 132 v-8 M96 132 h14 M132 132 v-8 M128 132 h14" stroke="#f0a84a" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  dragon: () => (
    <>
      <rect width="240" height="160" fill="#5b2fa8" />
      <path d="M0 160 L0 110 L30 80 L56 112 L84 70 L120 120 L156 66 L190 112 L214 84 L240 110 V160z" fill="#3b1c78" />
      {[[30, 24], [200, 20], [170, 50], [70, 40]].map(([x, y]) => <Star key={`${x}${y}`} x={x} y={y} r={2.4} />)}
      <path d="M96 84 L40 30 q-6 40 14 66z M142 84 L200 28 q8 42 -16 70z" fill="#ff5d3a" />
      <path d="M70 150 q-4 -50 36 -70 q30 -14 52 6 q18 20 12 64z" fill="#3fbf55" />
      <path d="M88 146 q10 -34 44 -40 q-4 36 -8 40z" fill="#ffe14d" />
      <path d="M170 150 q34 -4 54 -30 q-30 12 -52 -2z" fill="#3fbf55" />
      <circle cx="104" cy="66" r="30" fill="#3fbf55" />
      <path d="M86 44 l-10 -22 l20 12z M122 40 l8 -24 l10 24z" fill="#ffe14d" />
      <circle cx="94" cy="62" r="8" fill="#fff" /><circle cx="114" cy="62" r="8" fill="#fff" /><circle cx="95" cy="63" r="4" fill="#10201a" /><circle cx="115" cy="63" r="4" fill="#10201a" />
      <ellipse cx="104" cy="82" rx="14" ry="9" fill="#2ea146" /><circle cx="99" cy="82" r="2" fill="#10201a" /><circle cx="109" cy="82" r="2" fill="#10201a" />
      <path d="M118 90 q30 4 50 -10 q-6 26 -26 30 q4 -10 -24 -20z" fill="#ff9f1c" /><path d="M126 92 q22 2 34 -6 q-4 14 -18 18z" fill="#ffe14d" />
    </>
  ),
  lighthouse: () => (
    <>
      <rect width="240" height="160" fill="#ff9e7a" />
      <rect width="240" height="64" fill="#ffd08a" />
      <circle cx="40" cy="70" r="24" fill="#fff0a0" />
      <Sea y={104} c="#1d6fb8" />
      <Wave x={10} y={120} /><Wave x={150} y={126} /><Wave x={80} y={142} c="#7fd6ff" />
      <path d="M150 160 q-6 -34 22 -48 q32 -4 52 18 l16 30z" fill="#4a3a38" />
      <path d="M96 118 L108 36 H132 L144 118z" fill="#f7f7f7" />
      <path d="M101 90 L103 70 H137 L139 90z M106 56 L108 36 H132 L134 56z" fill="#e8384f" />
      <rect x="102" y="26" width="36" height="12" fill="#3a3a52" /><rect x="108" y="10" width="24" height="16" fill="#ffe14d" />
      <path d="M120 2 L132 10 H108z" fill="#e8384f" />
      <path d="M132 18 L240 -4 V40z M108 18 L0 -4 V40z" fill="#fff6b0" opacity="0.55" />
      <path d="M112 118 v-14 a8 8 0 0 1 16 0 v14z" fill="#3a2a66" />
      <path d="M80 160 q8 -30 36 -42 h8 q26 12 34 42z" fill="#5a4a46" />
    </>
  ),
  octopus: () => (
    <>
      <rect width="240" height="160" fill="#14a3b8" />
      <rect y="108" width="240" height="52" fill="#e7c98a" />
      <ellipse cx="40" cy="112" rx="26" ry="10" fill="#d1ae6a" /><ellipse cx="206" cy="116" rx="30" ry="10" fill="#d1ae6a" />
      {[[30, 30, 7], [50, 60, 5], [200, 40, 8], [214, 80, 5], [180, 20, 4]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="none" stroke="#c7f3ff" strokeWidth="2.5" />)}
      <g fill="none" stroke="#e8387f" strokeWidth="14" strokeLinecap="round">
        <path d="M84 96 q-30 20 -44 -2 q-8 -12 4 -20" /><path d="M96 104 q-26 34 -50 24" />
        <path d="M110 108 q-8 28 -26 34" /><path d="M126 108 q6 28 26 34" />
        <path d="M144 104 q26 34 50 24" /><path d="M156 96 q30 20 44 -2 q8 -12 -4 -20" />
        <path d="M100 100 q-14 22 -10 38" /><path d="M140 100 q14 22 10 38" />
      </g>
      <ellipse cx="120" cy="64" rx="48" ry="46" fill="#ff5c9d" />
      <circle cx="94" cy="44" r="5" fill="#ffb3d0" /><circle cx="104" cy="34" r="3" fill="#ffb3d0" /><circle cx="146" cy="38" r="4" fill="#ffb3d0" />
      <circle cx="102" cy="68" r="12" fill="#fff" /><circle cx="138" cy="68" r="12" fill="#fff" />
      <circle cx="104" cy="70" r="6" fill="#1d1d3a" /><circle cx="136" cy="70" r="6" fill="#1d1d3a" />
      <path d="M108 90 q12 10 24 0" stroke="#7a1f48" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
  treehouse: () => (
    <>
      <rect width="240" height="160" fill="#9fe0ff" />
      <Cloud x={190} y={26} s={0.8} /><Cloud x={34} y={40} s={0.7} />
      <rect y="136" width="240" height="24" fill="#4fbf5a" />
      <circle cx="120" cy="52" r="46" fill="#2f9e44" /><circle cx="68" cy="66" r="34" fill="#3fb554" /><circle cx="174" cy="66" r="34" fill="#3fb554" /><circle cx="120" cy="30" r="26" fill="#52c768" />
      <path d="M104 160 q6 -60 -2 -100 h36 q-8 40 -2 100z" fill="#7a4a24" />
      <rect x="74" y="76" width="92" height="52" fill="#d28a4a" />
      {[88, 104, 120, 136, 152].map((x) => <path key={x} d={`M${x} 76 v52`} stroke="#a8652d" strokeWidth="2" />)}
      <path d="M66 78 L120 42 L174 78z" fill="#e8384f" />
      <rect x="92" y="92" width="22" height="22" rx="3" fill="#8ad7ff" stroke="#6b3a1a" strokeWidth="4" />
      <rect x="128" y="92" width="22" height="22" rx="3" fill="#ffe14d" stroke="#6b3a1a" strokeWidth="4" />
      <rect x="64" y="126" width="112" height="8" fill="#a8652d" />
      <path d="M180 134 L196 160 M196 134 L212 160 M184 142 h20 M190 152 h20" stroke="#8a5628" strokeWidth="4" fill="none" />
      <path d="M128 42 v-18 l16 6 l-16 6" fill="#ffd23f" /><path d="M128 42 v-22" stroke="#6b3a1a" strokeWidth="3" />
    </>
  ),
  pirate: () => (
    <>
      <rect width="240" height="160" fill="#8ad7ff" />
      <circle cx="200" cy="30" r="18" fill="#ffe14d" />
      <Cloud x={46} y={30} />
      <Sea y={110} c="#1f78c8" /><Sea y={136} c="#16569a" />
      <path d="M52 108 H190 q-10 30 -34 38 H84 q-24 -10 -32 -38z" fill="#7a4a24" />
      <path d="M52 108 H190 v8 H52z" fill="#5e3718" />
      {[84, 112, 140, 168].map((x) => <circle key={x} cx={x} cy="126" r="5" fill="#2a1c10" />)}
      <rect x="116" y="32" width="6" height="78" fill="#5e3718" />
      <path d="M122 36 q40 16 40 48 q-24 -8 -40 0z" fill="#fff" />
      <path d="M116 40 q-36 14 -36 44 q20 -8 36 0z" fill="#f2f2f2" />
      <circle cx="140" cy="62" r="7" fill="#1d1d1d" /><rect x="136" y="68" width="8" height="5" fill="#1d1d1d" />
      <circle cx="98" cy="62" r="6" fill="#e8384f" />
      <path d="M122 32 h28 v12 h-28z" fill="#1d1d1d" /><circle cx="136" cy="38" r="3" fill="#fff" />
      <path d="M52 108 q-22 -2 -30 -18 q20 0 34 8z" fill="#5e3718" />
      <Wave x={14} y={124} /><Wave x={170} y={132} /><Wave x={60} y={150} c="#8ad7ff" /><Wave x={150} y={152} c="#8ad7ff" />
    </>
  ),
};

/** One picture (fills its box: give it a 3:2 box, or it is cropped to fit). Hidden from screen readers unless `label` is given. */
export function MuralPicture({ id, label, className, small }: { id: Picture; label?: string; className?: string; small?: boolean }) {
  const draw = ART[id];
  const src = painted('mural', id, small);
  if (src) {
    return (
      <img className={className} src={src} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    );
  }
  return (
    <svg className={className} viewBox="0 0 240 160" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block' }}>
      {draw()}
    </svg>
  );
}
