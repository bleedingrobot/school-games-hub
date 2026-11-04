import type { ReactNode } from 'react';

export type Level = 0 | 1 | 2 | 3 | 4;
export type StageId = 1 | 2 | 3 | 4;

const GREEN = '#3f9d4e';
const GREEN_DARK = '#2c7a3a';
const GREEN_LIGHT = '#6cbf6f';
const BROWN = '#7a5a3a';

/** A leaf from (x, y), pointing along `angle` degrees. */
function Leaf({ x, y, angle, len = 14, fill = GREEN_LIGHT }: { x: number; y: number; angle: number; len?: number; fill?: string }) {
  return (
    <path
      d={`M0 0 Q ${len / 2} ${-len * 0.45} ${len} 0 Q ${len / 2} ${len * 0.45} 0 0Z`}
      fill={fill}
      stroke={GREEN_DARK}
      strokeWidth="0.8"
      strokeLinejoin="round"
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  );
}

/** The same soil mound under every plant so they line up in the beds. */
function Mound({ children }: { children: ReactNode }) {
  return (
    <>
      <ellipse cx="50" cy="101" rx="36" ry="9" fill="#6b4627" />
      <path d="M16 100 Q 50 80 84 100 Q 50 108 16 100Z" fill="#855a33" />
      <path d="M30 96 Q 50 88 70 96" fill="none" stroke="#9a6d41" strokeWidth="1.5" strokeLinecap="round" />
      {children}
    </>
  );
}

/** Stem tops by step (0 = seed has none). */
const TOP = [96, 78, 60, 46, 38] as const;

function Seed() {
  return (
    <>
      <ellipse cx="50" cy="92" rx="5" ry="3.5" fill="#4a3018" transform="rotate(-20 50 92)" />
      <ellipse cx="48.5" cy="91" rx="1.6" ry="1" fill="#8a6a45" />
    </>
  );
}

function Stem({ level, w = 4, color = GREEN }: { level: Level; w?: number; color?: string }) {
  return <line x1="50" y1="96" x2="50" y2={TOP[level]} stroke={color} strokeWidth={w} strokeLinecap="round" />;
}

/** Leaves for the herb-like plants (daisy, sunflower). */
function HerbLeaves({ level, big = 1 }: { level: Level; big?: number }) {
  const L = (x: number, y: number, a: number, len: number) => <Leaf key={`${x}${y}${a}`} x={x} y={y} angle={a} len={len * big} />;
  if (level === 1) return <>{[L(50, 82, -150, 11), L(50, 82, -30, 11)]}</>;
  return (
    <>
      {L(50, 90, -160, 18)}
      {L(50, 90, -20, 18)}
      {level >= 2 && L(50, 76, -140, 15)}
      {level >= 2 && L(50, 76, -40, 15)}
      {level >= 3 && L(50, 62, -145, 12)}
      {level >= 3 && L(50, 62, -35, 12)}
    </>
  );
}

function Daisy({ level }: { level: Level }) {
  if (level === 0) return <Seed />;
  return (
    <>
      <Stem level={level} />
      <HerbLeaves level={level} />
      {level === 3 && (
        <>
          <ellipse cx="50" cy="42" rx="5" ry="7" fill="#fff" stroke="#c9d6e0" strokeWidth="0.8" />
          <path d="M43.5 46 Q50 54 56.5 46 Q50 41 43.5 46Z" fill={GREEN} />
        </>
      )}
      {level === 4 && (
        <g transform="translate(50 36)">
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-12" rx="4.2" ry="10" fill="#fff" stroke="#c9d6e0" strokeWidth="0.8" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="7.5" fill="#f5b400" stroke="#c98a00" strokeWidth="0.8" />
        </g>
      )}
    </>
  );
}

function Sunflower({ level }: { level: Level }) {
  if (level === 0) return <Seed />;
  return (
    <>
      <Stem level={level} w={5.5} color={GREEN_DARK} />
      <HerbLeaves level={level} big={1.25} />
      {level === 3 && (
        <>
          <circle cx="50" cy="42" r="8" fill={GREEN} stroke={GREEN_DARK} strokeWidth="0.8" />
          {[-40, 0, 40].map((a) => (
            <ellipse key={a} cx="50" cy="33" rx="3" ry="5" fill="#f6c51e" transform={`rotate(${a} 50 42)`} />
          ))}
        </>
      )}
      {level === 4 && (
        <g transform="translate(50 34)">
          {Array.from({ length: 14 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-15" rx="4.4" ry="9" fill="#f6c51e" stroke="#d29a00" strokeWidth="0.7" transform={`rotate(${i * (360 / 14)})`} />
          ))}
          <circle r="12" fill="#6b3d1c" stroke="#4a2a12" strokeWidth="1" />
          <circle r="6" fill="#4a2a12" opacity="0.55" />
        </g>
      )}
    </>
  );
}

/** A drooping spray of yellow kōwhai flowers. */
function Droop({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y} q 2 5 0 9`} stroke={GREEN_DARK} strokeWidth="0.9" fill="none" />
      <ellipse cx={x} cy={y + 4} rx="2.6" ry="3.2" fill="#f7cb1c" stroke="#c99a00" strokeWidth="0.5" />
      <ellipse cx={x + 0.5} cy={y + 8} rx="2.6" ry="3.2" fill="#f7cb1c" stroke="#c99a00" strokeWidth="0.5" />
      <ellipse cx={x} cy={y + 12} rx="2.4" ry="3" fill="#ffd940" stroke="#c99a00" strokeWidth="0.5" />
    </g>
  );
}

/** Small clusters of leaflets, a tree's canopy. */
function Canopy({ pts, r, fill }: { pts: Array<[number, number]>; r: number; fill: string }) {
  return (
    <>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={fill} stroke={GREEN_DARK} strokeWidth="0.8" />
      ))}
    </>
  );
}

function Kowhai({ level }: { level: Level }) {
  if (level === 0) return <Seed />;
  if (level === 1) {
    return (
      <>
        <Stem level={1} w={3} color={BROWN} />
        <Canopy pts={[[44, 80], [56, 80], [50, 74]]} r={4.5} fill={GREEN_LIGHT} />
      </>
    );
  }
  const top = TOP[level];
  return (
    <>
      <path d={`M50 98 Q 49 ${top + 22} 50 ${top + 8}`} stroke={BROWN} strokeWidth={level >= 3 ? 6 : 4.5} fill="none" strokeLinecap="round" />
      <path d={`M50 ${top + 22} Q 38 ${top + 18} 33 ${top + 8} M50 ${top + 18} Q 62 ${top + 14} 67 ${top + 6}`} stroke={BROWN} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {level === 2 && <Canopy pts={[[34, 58], [66, 56], [50, 52], [42, 62], [58, 62], [50, 60]]} r={8} fill={GREEN_LIGHT} />}
      {level >= 3 && <Canopy pts={[[28, 52], [72, 50], [50, 38], [38, 46], [62, 44], [38, 58], [62, 58], [50, 52]]} r={10} fill={GREEN_LIGHT} />}
      {level === 3 && [[30, 60], [40, 66], [60, 64], [70, 60], [50, 62], [34, 48], [66, 46]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2" ry="3" fill="#c9dc52" stroke="#8a9a1c" strokeWidth="0.5" />)}
      {level === 4 && [[24, 58], [34, 62], [44, 66], [56, 66], [66, 62], [76, 58], [30, 50], [70, 48]].map(([x, y]) => <Droop key={`${x}${y}`} x={x} y={y} />)}
    </>
  );
}

/** A red brush flower of the pōhutukawa. */
function Brush({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1="0" y1="0" x2={Math.cos((i / 9) * Math.PI * 2) * 5.5} y2={Math.sin((i / 9) * Math.PI * 2) * 5.5} stroke="#d4222b" strokeWidth="1.3" strokeLinecap="round" />
      ))}
      <circle r="1.5" fill="#f6d36a" />
    </g>
  );
}

function Pohutukawa({ level }: { level: Level }) {
  if (level === 0) return <Seed />;
  if (level === 1) {
    return (
      <>
        <Stem level={1} w={3.2} color="#6b4a32" />
        <Leaf x={50} y={80} angle={-150} len={12} fill="#3f8a55" />
        <Leaf x={50} y={80} angle={-30} len={12} fill="#3f8a55" />
      </>
    );
  }
  const top = TOP[level];
  return (
    <>
      <path d={`M48 98 Q 46 ${top + 24} 50 ${top + 8}`} stroke="#6b4a32" strokeWidth={level >= 3 ? 7 : 5} fill="none" strokeLinecap="round" />
      <path d={`M49 ${top + 24} Q 36 ${top + 18} 31 ${top + 8} M50 ${top + 20} Q 63 ${top + 14} 69 ${top + 6}`} stroke="#6b4a32" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {level === 2 && <Canopy pts={[[34, 58], [66, 56], [50, 52], [42, 62], [58, 62], [50, 60]]} r={8.5} fill="#3f8a55" />}
      {level >= 3 && <Canopy pts={[[26, 54], [74, 52], [50, 38], [36, 46], [64, 44], [36, 60], [64, 60], [50, 52]]} r={11} fill="#3f8a55" />}
      {level >= 3 && <Canopy pts={[[42, 50], [58, 48], [50, 42]]} r={6} fill="#56a468" />}
      {level === 3 && [[28, 50], [38, 62], [62, 62], [72, 50], [50, 36], [44, 46], [58, 44]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#c0392b" stroke="#8c1d18" strokeWidth="0.5" />)}
      {level === 4 && [[26, 50], [36, 62], [64, 62], [74, 50], [50, 33], [42, 44], [58, 43], [30, 58], [70, 58], [50, 56]].map(([x, y]) => <Brush key={`${x}${y}`} x={x} y={y} />)}
    </>
  );
}

const KINDS: Record<StageId, (p: { level: Level }) => ReactNode> = { 1: Daisy, 2: Sunflower, 3: Kowhai, 4: Pohutukawa };

/** A stand-in drawn plant: a different kind for each stage, five steps, all on the same soil mound. */
export function PlantSvg({ stage, level }: { stage: StageId; level: Level }) {
  const Kind = KINDS[stage];
  return (
    <svg viewBox="0 0 100 110" className="sb-plant" aria-hidden="true" focusable="false">
      <Mound>
        <Kind level={level} />
      </Mound>
    </svg>
  );
}
