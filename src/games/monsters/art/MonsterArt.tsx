/**
 * Monster drawings, built from parts (no image files). `MonsterArt` takes a species id from
 * the monster book and draws it, so all 54 entries work. Each of the 18 families has its own
 * shape; the colour comes from the type (and a different one if shiny). First forms are small
 * and cute (big round eyes, cheeks), grown forms get more and bigger parts, last forms look
 * fierce (narrow eyes, grins, crowns of flames / spikes / crystals).
 *
 * The picture is 120 × 120 with the ground at y = 108. Idle bob, hurt wobble and the faint
 * (sink and fade) are CSS animations on the wrapper, switched off for reduced motion.
 */
import type { ReactNode } from 'react';
import { speciesOf } from '../../../../shared/monsters/monsterBook';
import {
  Bolt, Cheeks, Crystal, Eyes, Flame, Leaf, Mouth, OUTLINE, PALETTES, SHINY_PALETTES, Shadow, Sparkle, Spike,
  type Palette,
} from './parts';
import './monster-art.css';

type Stage = 1 | 2 | 3;
type Draw = (s: Stage, c: Palette) => ReactNode;

const body = (c: Palette) => ({ fill: c.main, stroke: c.dark, strokeWidth: 2.6, strokeLinejoin: 'round' as const });
const belly = (c: Palette) => ({ fill: c.light, opacity: 0.9 });

/** How big each stage is drawn (first forms are small). */
export const STAGE_SCALE = [0.82, 0.93, 1] as const;

const DRAWINGS: Record<string, Draw> = {
  // ---- Leaf ----
  digibud: (s, c) => (
    <>
      <path d={`M60 ${74 - 26 - s * 3} q-2 -10 -${2 + s} -16`} stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Leaf x={60} y={44 - s * 3} len={14 + s * 5} rot={-150} c={c} />
      <Leaf x={60} y={44 - s * 3} len={14 + s * 5} rot={-30} c={c} />
      {s >= 2 && <Leaf x={60} y={46 - s * 3} len={16 + s * 4} rot={-90} c={c} />}
      {s === 3 && (
        <>
          <Leaf x={60} y={50} len={22} rot={-120} c={c} />
          <Leaf x={60} y={50} len={22} rot={-60} c={c} />
          <path d="M44 84 q-8 4 -6 14 M76 84 q8 4 6 14" stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      <circle cx="60" cy="76" r={26 + s * 3} {...body(c)} />
      <ellipse cx="60" cy="86" rx={14 + s * 2} ry={11 + s} {...belly(c)} />
      <Eyes x={60} y={72} gap={11} stage={s} />
      {s === 1 && <Cheeks x={60} y={80} gap={18} />}
      <Mouth x={60} y={82} stage={s} />
    </>
  ),
  roundroot: (s, c) => (
    <>
      {[0, 1, 2].slice(0, s === 1 ? 2 : 3).map((i) => (
        <path key={i} d={`M${34 + i * (s === 1 ? 52 : 26)} 96 q${i === 1 ? 0 : i === 0 ? -8 : 8} 12 ${i === 1 ? 0 : i === 0 ? -4 : 4} 14`} stroke={c.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
      ))}
      <ellipse cx="60" cy="80" rx={32 + s * 2} ry={22 + s * 2} {...body(c)} />
      {Array.from({ length: s + 1 }, (_, i) => (
        <circle key={i} cx={60 + (i - s / 2) * 20} cy={56 - (i % 2) * 5 - s * 2} r={10 + s * 2} fill={c.dark} stroke={OUTLINE} strokeWidth="1.8" />
      ))}
      {s >= 2 && <Leaf x={60} y={52 - s * 2} len={18} rot={-100} c={c} />}
      {s === 3 && (
        <>
          <Leaf x={60} y={46} len={20} rot={-140} c={c} />
          <Leaf x={60} y={46} len={20} rot={-40} c={c} />
        </>
      )}
      <ellipse cx="60" cy="88" rx="18" ry="9" {...belly(c)} />
      <Eyes x={60} y={78} gap={13} stage={s} />
      {s === 1 && <Cheeks x={60} y={86} gap={20} />}
      <Mouth x={60} y={88} stage={s} />
    </>
  ),
  placepetal: (s, c) => {
    const n = s === 1 ? 5 : s === 2 ? 7 : 9;
    return (
      <>
        {s === 3 && (
          <>
            <path d="M60 100 L60 108" stroke={c.dark} strokeWidth="4" />
            <Leaf x={60} y={102} len={22} rot={-160} c={c} />
            <Leaf x={60} y={102} len={22} rot={-20} c={c} />
          </>
        )}
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * 360;
          return <ellipse key={i} cx="60" cy={s === 3 ? 70 - 24 : 66 - 22} rx={9 + s * 1.5} ry={13 + s * 2} transform={`rotate(${a} 60 ${s === 3 ? 70 : 66})`} fill={c.accent} stroke={c.dark} strokeWidth="2" />;
        })}
        <circle cx="60" cy={s === 3 ? 70 : 66} r={20 + s * 2} {...body(c)} />
        <ellipse cx="60" cy={s === 3 ? 80 : 76} rx="11" ry="7" {...belly(c)} />
        <Eyes x={60} y={s === 3 ? 66 : 62} gap={9} stage={s} size={0.95} />
        {s === 1 && <Cheeks x={60} y={72} gap={15} />}
        <Mouth x={60} y={s === 3 ? 78 : 74} stage={s} />
      </>
    );
  },
  // ---- Water ----
  plusplash: (s, c) => (
    <>
      {s >= 2 && (
        <>
          <path d="M32 80 q-16 -2 -14 12 q10 2 18 -6Z M88 80 q16 -2 14 12 q-10 2 -18 -6Z" fill={c.main} stroke={c.dark} strokeWidth="2.4" strokeLinejoin="round" />
        </>
      )}
      <path d={`M60 ${26 - s * 3} C${80 + s * 2} ${50} ${92 + s * 2} ${62} ${92 + s * 2} ${80} A${32 + s * 2} ${28 + s} 0 0 1 ${28 - s * 2} ${80} C${28 - s * 2} ${62} ${40 - s * 2} ${50} 60 ${26 - s * 3}Z`} {...body(c)} />
      {s === 3 && <path d="M30 52 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 14 0" stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" />}
      <path d="M52 52 h16 M60 44 v16" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" transform={s === 1 ? 'translate(0 2) scale(1)' : undefined} />
      <ellipse cx="60" cy="92" rx="16" ry="9" {...belly(c)} />
      <Eyes x={60} y={78} gap={12} stage={s} />
      {s === 1 && <Cheeks x={60} y={87} gap={20} />}
      <Mouth x={60} y={88} stage={s} />
    </>
  ),
  minnowus: (s, c) => (
    <>
      <path d={`M${84 + s * 2} 72 L${108} ${58 - s * 3} Q${100} 72 ${108} ${86 + s * 3}Z`} {...body(c)} />
      <path d={`M44 ${52 - s * 4} Q${58} ${26 - s * 8} ${72} ${54 - s * 2}Z`} fill={c.dark} stroke={c.dark} strokeWidth="2" strokeLinejoin="round" />
      {s === 3 && <path d="M58 50 l4 5 l4 -5 l4 5" stroke="#fff" strokeWidth="1.5" fill="none" />}
      <ellipse cx="56" cy="72" rx={32 + s * 1.5} ry={22 + s * 2} {...body(c)} />
      <ellipse cx="56" cy="82" rx="24" ry="10" {...belly(c)} />
      <path d="M62 76 q10 8 22 -2 q-6 12 -20 12Z" fill={c.dark} opacity="0.7" />
      {s >= 2 && <path d="M44 92 l-8 12 l16 -4Z" fill={c.dark} stroke={c.dark} strokeWidth="2" strokeLinejoin="round" />}
      <Eyes x={42} y={68} gap={8} stage={s} size={0.95} />
      {s === 1 && <Cheeks x={42} y={78} gap={12} />}
      <Mouth x={36} y={80} stage={s} />
    </>
  ),
  carrycrab: (s, c) => (
    <>
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M${60 + d * 24} 80 q${d * 14} -6 ${d * 18} -${16 + s * 2}`} stroke={c.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d={`M${60 + d * (42 + s)} ${64 - s * 2} m${-d * 12} 0 a${12 + s * 2} ${12 + s * 2} 0 1 0 ${d * 20} -${8 + s}  l${-d * 8} 8Z`} {...body(c)} />
          <path d={`M${60 + d * 26} 94 l${d * 12} 10 M${60 + d * 20} 98 l${d * 10} 10`} stroke={c.dark} strokeWidth="3.4" strokeLinecap="round" />
        </g>
      ))}
      <path d="M46 62 V50 M74 62 V50" stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
      <circle cx="46" cy="48" r="6.5" fill="#fff" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="74" cy="48" r="6.5" fill="#fff" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="46.8" cy="48.6" r="3.2" fill={OUTLINE} />
      <circle cx="74.8" cy="48.6" r="3.2" fill={OUTLINE} />
      <ellipse cx="60" cy="82" rx={30 + s} ry={20 + s} {...body(c)} />
      <ellipse cx="60" cy="90" rx="18" ry="8" {...belly(c)} />
      {s >= 2 && <path d="M40 72 q20 -12 40 0" stroke={c.dark} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {s === 3 && [-1, 1].map((d) => <Spike key={d} x={60 + d * 26} y={68} w={9} h={14} rot={d * 30} fill={c.dark} stroke={OUTLINE} />)}
      {s === 3 && <path d="M44 38 l5 -12 l6 8 l5 -12 l5 12 l6 -8 l5 12Z" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />}
      <Mouth x={60} y={80} stage={s} />
      {s === 1 && <Cheeks x={60} y={80} gap={22} />}
    </>
  ),
  // ---- Fire ----
  factorch: (s, c) => (
    <>
      {s === 3 && [-1, 1].map((d) => <Flame key={d} x={60 + d * 24} y={70} h={30} rot={d * 34} c={c} />)}
      <Flame x={60} y={52} h={22 + s * 8} c={c} />
      {s >= 2 && <Flame x={48} y={54} h={16 + s * 4} rot={-24} c={c} />}
      {s >= 2 && <Flame x={72} y={54} h={16 + s * 4} rot={24} c={c} />}
      <path d="M36 92 q-6 -4 -4 -14 M84 92 q6 -4 4 -14" stroke={c.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="78" rx={23 + s * 1.5} ry={26 + s * 1.5} {...body(c)} />
      <ellipse cx="60" cy="88" rx="13" ry="12" {...belly(c)} />
      <Eyes x={60} y={72} gap={10} stage={s} />
      {s === 1 && <Cheeks x={60} y={80} gap={16} />}
      <Mouth x={60} y={82} stage={s} />
    </>
  ),
  multipup: (s, c) => (
    <>
      <Flame x={96} y={92} h={20 + s * 6} rot={40} c={c} />
      <path d="M86 94 q14 2 14 -10" stroke={c.main} strokeWidth="8" fill="none" strokeLinecap="round" />
      {[-1, 1].map((d) => (
        <path key={d} d={`M${60 + d * 20} 54 L${60 + d * (36 + s * 2)} ${34 - s * 5} L${60 + d * 34} 66Z`} {...body(c)} />
      ))}
      {s >= 2 && [-1, 1].map((d) => <Flame key={d} x={60 + d * 34} y={36} h={10 + s * 4} rot={d * 20} c={c} />)}
      <ellipse cx="60" cy="94" rx={24 + s} ry="12" {...body(c)} />
      <circle cx="60" cy="68" r={27 + s * 1.5} {...body(c)} />
      <ellipse cx="60" cy="80" rx="15" ry="11" {...belly(c)} />
      <ellipse cx="60" cy="75" rx="5" ry="3.6" fill={OUTLINE} />
      <Eyes x={60} y={64} gap={13} stage={s} />
      {s === 1 && <Cheeks x={60} y={74} gap={22} />}
      <Mouth x={60} y={84} stage={s} />
      {s === 3 && <path d="M30 50 L36 42 L42 52 M90 50 L84 42 L78 52" stroke={c.accent} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </>
  ),
  squaremander: (s, c) => (
    <>
      <path d={`M84 96 q${22} 4 ${20} -${16 + s * 2} q-2 -10 ${-6} -${14}`} stroke={c.main} strokeWidth="9" fill="none" strokeLinecap="round" />
      <Flame x={98} y={62 - s * 2} h={18 + s * 6} rot={16} c={c} />
      {Array.from({ length: s + 1 }, (_, i) => (
        <rect key={i} x={40 + i * (s === 1 ? 16 : s === 2 ? 11 : 9)} y={40 - s * 2 - (i % 2) * 4} width={8 + s * 2} height={8 + s * 2} rx="1.5" fill={c.dark} stroke={OUTLINE} strokeWidth="1.6" transform={s === 3 ? `rotate(45 ${44 + i * 9} ${44})` : undefined} />
      ))}
      <rect x={34 - s} y={48 - s} width={52 + s * 2} height={52 + s} rx="14" {...body(c)} />
      <rect x="44" y="76" width="32" height="22" rx="8" {...belly(c)} />
      <path d="M44 100 v8 M76 100 v8" stroke={c.dark} strokeWidth="6" strokeLinecap="round" />
      <Eyes x={60} y={64} gap={13} stage={s} />
      {s === 1 && <Cheeks x={60} y={72} gap={22} />}
      <Mouth x={60} y={74} stage={s} />
      {s === 3 && <path d="M38 50 l-6 -10 l12 4 M82 50 l6 -10 l-12 4" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />}
    </>
  ),
  // ---- Ice ----
  divvy: (s, c) => (
    <>
      {s >= 2 && [-1, 1].map((d) => <Crystal key={d} x={60 + d * 8} y={44} w={8} h={12 + s * 5} rot={d * 18} fill={c.light} stroke={c.dark} shine="#fff" />)}
      {s === 3 && <Crystal x={60} y={44} w={10} h={30} fill={c.light} stroke={c.dark} shine="#fff" />}
      {[-1, 1].map((d) => <path key={d} d={`M${60 + d * 24} 72 q${d * 14} 12 ${d * 8} 26 q${-d * 12} -6 ${-d * 14} -20Z`} {...body(c)} />)}
      <ellipse cx="60" cy="72" rx={25 + s} ry={32 + s} fill={c.dark} stroke={c.dark} strokeWidth="2.6" />
      <ellipse cx="60" cy="76" rx={19 + s} ry={26 + s} {...belly(c)} />
      <path d="M52 96 l-6 10 h12 Z M68 96 l6 10 h-12 Z" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M53 66 L60 77 L67 66Z" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />
      <Eyes x={60} y={58} gap={10} stage={s} />
      {s === 1 && <Cheeks x={60} y={66} gap={17} />}
      <path d="M44 84 h32" stroke={c.dark} strokeWidth="2" strokeDasharray="3 3" opacity="0.5" />
    </>
  ),
  remaindeer: (s, c) => (
    <>
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M${60 + d * 16} 46 q${d * 8} -${14 + s * 4} ${d * (10 + s * 3)} -${22 + s * 6}`} stroke={c.light} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d={`M${60 + d * 16} 46 q${d * 8} -${14 + s * 4} ${d * (10 + s * 3)} -${22 + s * 6}`} stroke={c.dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          {s >= 2 && <Crystal x={60 + d * 22} y={38} w={7} h={14 + s * 3} rot={d * 50} fill={c.light} stroke={c.dark} shine="#fff" />}
          {s === 3 && <Crystal x={60 + d * 27} y={26} w={7} h={18} rot={d * 30} fill={c.light} stroke={c.dark} shine="#fff" />}
          <ellipse cx={60 + d * 26} cy="62" rx="9" ry="5.5" transform={`rotate(${d * 24} ${60 + d * 26} 62)`} {...body(c)} />
        </g>
      ))}
      <ellipse cx="60" cy="94" rx="24" ry="13" {...body(c)} />
      <circle cx="60" cy="70" r={24 + s} {...body(c)} />
      <ellipse cx="60" cy="82" rx="12" ry="9" {...belly(c)} />
      <circle cx="60" cy="80" r="4.5" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" />
      <Eyes x={60} y={66} gap={11} stage={s} />
      {s === 1 && <Cheeks x={60} y={74} gap={19} />}
      <Mouth x={60} y={88} stage={s} />
    </>
  ),
  sharebear: (s, c) => (
    <>
      {[-1, 1].map((d) => <circle key={d} cx={60 + d * 24} cy="48" r="10" {...body(c)} />)}
      {[-1, 1].map((d) => <circle key={d} cx={60 + d * 24} cy="48" r="5" fill={c.light} />)}
      <ellipse cx="60" cy="82" rx={34 + s} ry={26 + s} {...body(c)} />
      <ellipse cx="60" cy="88" rx="22" ry="17" {...belly(c)} />
      <path d="M60 72 V102" stroke={c.dark} strokeWidth="2.6" strokeDasharray="5 4" opacity="0.7" />
      {s >= 2 && [-1, 1].map((d) => <Crystal key={d} x={60 + d * 32} y={66} w={9} h={14 + s * 3} rot={d * 40} fill={c.light} stroke={c.dark} shine="#fff" />)}
      {s === 3 && [0, 1, 2].map((i) => <Crystal key={i} x={44 + i * 16} y={56} w={8} h={16} fill={c.light} stroke={c.dark} shine="#fff" />)}
      <circle cx="60" cy="64" r={22 + s} {...body(c)} />
      <ellipse cx="60" cy="72" rx="11" ry="8" {...belly(c)} />
      <ellipse cx="60" cy="69" rx="4" ry="3" fill={OUTLINE} />
      <Eyes x={60} y={58} gap={11} stage={s} size={0.92} />
      {s === 1 && <Cheeks x={60} y={68} gap={19} />}
      <Mouth x={60} y={78} stage={s} />
      {s === 3 && <path d="M30 100 l-2 8 M36 102 l-1 8 M90 100 l2 8 M84 102 l1 8" stroke={c.light} strokeWidth="3" strokeLinecap="round" />}
    </>
  ),
  // ---- Spark ----
  fractopus: (s, c) => (
    <>
      {Array.from({ length: s + 3 }, (_, i) => {
        const x = 30 + (i * 60) / (s + 2);
        const d = i % 2 === 0 ? 1 : -1;
        return <path key={i} d={`M${x} 82 q${d * 10} 12 ${-d * 2} 20 q${d * 6} 4 ${d * 2} 8`} stroke={c.main} strokeWidth="7" fill="none" strokeLinecap="round" />;
      })}
      {s >= 2 && [-1, 1].map((d) => <Bolt key={d} x={60 + d * 30 - 4} y={30} s={0.9 + s * 0.1} rot={d * 16} fill={c.accent} stroke={OUTLINE} />)}
      {s === 3 && <Bolt x={56} y={14} s={1.2} fill={c.accent} stroke={OUTLINE} />}
      <path d={`M${30 - s} 84 C${28 - s} ${40 - s * 2} ${92 + s} ${40 - s * 2} ${90 + s} 84Z`} {...body(c)} />
      <ellipse cx="60" cy="76" rx="16" ry="9" {...belly(c)} />
      {s === 1 && <Bolt x={56} y={36} s={0.55} fill={c.accent} stroke={OUTLINE} />}
      <Eyes x={60} y={66} gap={12} stage={s} />
      {s === 1 && <Cheeks x={60} y={75} gap={21} />}
      <Mouth x={60} y={78} stage={s} />
    </>
  ),
  numeratot: (s, c) => (
    <>
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M${60 + d * 10} 36 l${d * 6} -${10 + s * 3} l${-d * 5} -4 l${d * 7} -${8 + s * 2}`} stroke={c.dark} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={60 + d * (18 + s * 1.5)} cy={12 - s * 3 + 4} r={4 + s} fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" />
        </g>
      ))}
      <path d="M40 98 q-6 8 -2 10 M80 98 q6 8 2 10" stroke={c.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="68" rx={22 + s} ry={34 + s} {...body(c)} />
      <path d="M58 76 l-8 14 h6 l-4 12 l14 -18 h-7 l6 -8Z" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />
      {s === 3 && [-1, 1].map((d) => <Bolt key={d} x={60 + d * 34 - 4} y={52} s={0.9} rot={d * 10} fill={c.accent} stroke={OUTLINE} />)}
      <Eyes x={60} y={52} gap={9} stage={s} />
      {s === 1 && <Cheeks x={60} y={60} gap={16} />}
      <Mouth x={60} y={64} stage={s} />
    </>
  ),
  denomibolt: (s, c) => (
    <>
      <path d={`M92 88 l12 -6 l-6 -8 l14 -4 l-10 -8`} stroke={c.accent} strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" transform={s === 1 ? 'scale(0.9) translate(10 6)' : undefined} />
      {[-1, 1].map((d) => <Bolt key={d} x={60 + d * (22 + s * 2) - 4} y={36 - s * 3} s={0.8 + s * 0.16} rot={d * 24} fill={c.accent} stroke={OUTLINE} />)}
      <ellipse cx="60" cy="84" rx={36 + s * 1.5} ry={22 + s} {...body(c)} />
      <path d="M32 86 H88" stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="94" rx="22" ry="8" {...belly(c)} />
      <circle cx="60" cy="62" r={20 + s} {...body(c)} />
      {s === 3 && [-1, 1].map((d) => <Bolt key={d} x={60 + d * 14 - 4} y={32} s={1.1} rot={d * 8} fill={c.accent} stroke={OUTLINE} />)}
      <Eyes x={60} y={58} gap={10} stage={s} size={0.95} />
      {s === 1 && <Cheeks x={60} y={67} gap={17} />}
      <Mouth x={60} y={70} stage={s} />
      <path d="M34 100 v8 M86 100 v8" stroke={c.dark} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  // ---- Stone ----
  pebblepoint: (s, c) => (
    <>
      {Array.from({ length: s === 1 ? 1 : s === 2 ? 3 : 5 }, (_, i) => {
        const count = s === 1 ? 1 : s === 2 ? 3 : 5;
        const all = { length: count };
        const mid = (all.length - 1) / 2;
        const off = i - mid;
        const h = 18 + (all.length > 1 ? (mid - Math.abs(off)) * 6 : 6) + s * 3;
        return s === 3 ? (
          <Crystal key={i} x={60 + off * 12} y={50 + Math.abs(off) * 3} w={10} h={h + 6} rot={off * 14} fill={c.accent} stroke={c.dark} shine="#fff" />
        ) : (
          <Spike key={i} x={60 + off * 13} y={52 + Math.abs(off) * 3} w={12} h={h} rot={off * 16} fill={c.dark} stroke={OUTLINE} />
        );
      })}
      <path d={`M30 ${84} Q${28} ${56} ${52} ${50 - s} Q${66} ${46 - s} ${82} ${54} Q${94 + s} ${68} ${88 + s} ${88} Q${84} ${104} ${60} ${104} Q${36} ${104} 30 84Z`} {...body(c)} />
      <path d="M40 62 q6 -4 10 0 M70 96 q8 2 12 -4" stroke={c.dark} strokeWidth="2" fill="none" opacity="0.6" strokeLinecap="round" />
      <ellipse cx="60" cy="92" rx="16" ry="8" {...belly(c)} />
      <Eyes x={60} y={74} gap={12} stage={s} />
      {s === 1 && <Cheeks x={60} y={83} gap={20} />}
      <Mouth x={60} y={86} stage={s} />
    </>
  ),
  coinrock: (s, c) => (
    <>
      {s >= 2 && [-1, 1].map((d) => <circle key={d} cx={60 + d * (34 + s)} cy="86" r={8 + s} {...body(c)} />)}
      {s === 3 && <path d="M42 48 l6 -14 l6 10 l6 -14 l6 14 l6 -10 l6 14Z" fill={c.accent} stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />}
      <circle cx="60" cy="76" r={30 + s} {...body(c)} />
      <circle cx="60" cy="76" r={24 + s} fill="none" stroke={c.accent} strokeWidth="4" strokeDasharray="4 3" />
      <circle cx="60" cy="76" r={20 + s} fill={c.light} opacity="0.35" />
      {s === 3 && <polygon points="60,44 66,52 54,52" fill="#38bdf8" stroke={OUTLINE} strokeWidth="1.4" />}
      <Eyes x={60} y={72} gap={11} stage={s} />
      {s === 1 && <Cheeks x={60} y={81} gap={19} />}
      <Mouth x={60} y={84} stage={s} />
      <path d="M44 106 v3 M76 106 v3" stroke={c.dark} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  centipebble: (s, c) => {
    const n = s + 2;
    return (
      <>
        {Array.from({ length: n - 1 }, (_, i) => {
          const x = 98 - i * (s === 1 ? 20 : s === 2 ? 17 : 14);
          const r = 11 + s;
          return (
            <g key={i}>
              <path d={`M${x - 4} ${88 + r - 4} v10 M${x + 4} ${88 + r - 4} v10`} stroke={c.dark} strokeWidth="3.4" strokeLinecap="round" />
              {s === 3 && <Spike x={x} y={88 - r + 1} w={8} h={10} fill={c.accent} stroke={OUTLINE} />}
              <circle cx={x} cy={88} r={r} {...body(c)} />
            </g>
          );
        })}
        {s >= 2 && [-1, 1].map((d) => <path key={d} d={`M${34 + d * 8} 52 q${d * 6} -14 ${d * 12} -12`} stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round" />)}
        <circle cx="38" cy="76" r={22 + s} {...body(c)} />
        <ellipse cx="38" cy="86" rx="10" ry="6" {...belly(c)} />
        <Eyes x={38} y={72} gap={9} stage={s} size={0.95} />
        {s === 1 && <Cheeks x={38} y={80} gap={15} />}
        <Mouth x={38} y={86} stage={s} />
      </>
    );
  },
};

export type MonsterState = 'idle' | 'hurt' | 'faint';

export interface MonsterArtProps {
  /** A species id from the monster book, e.g. "digibud-1". */
  species: string;
  shiny?: boolean;
  /** Pixel width and height (the picture is square). Leave out to fill the box it is in. */
  size?: number;
  state?: MonsterState;
  /** Mirror left to right (monsters on the left face right). */
  flip?: boolean;
  /** Turn the idle bob off (for lists and the monster book). */
  still?: boolean;
  className?: string;
  /** Draw it with no name at all (no label, no tooltip): for the monster book's dark shapes, which must not give the name away. */
  nameless?: boolean;
}

/** Draws one monster. The drawing is labelled with the monster's name for screen readers. */
export function MonsterArt({ species, shiny, size, state = 'idle', flip, still, className, nameless }: MonsterArtProps) {
  const sp = speciesOf(species);
  const draw = DRAWINGS[sp.family];
  const c = (shiny ? SHINY_PALETTES : PALETTES)[sp.type];
  const label = `${sp.name}${shiny ? ' (shiny)' : ''}`;
  const scale = STAGE_SCALE[sp.stage - 1];
  return (
    <span
      className={`mon-art mon-art--${state}${still ? ' mon-art--still' : ''}${className ? ` ${className}` : ''}`}
      data-species={species}
      style={size ? { width: size, height: size } : undefined}
    >
      <svg viewBox="0 0 120 120" {...(nameless ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })} focusable="false">
        {!nameless && <title>{label}</title>}
        <Shadow rx={30 + sp.stage * 4} />
        <g className="mon-art__body" transform={`translate(60 108) scale(${flip ? -scale : scale} ${scale}) translate(-60 -108)`}>
          {draw(sp.stage, c)}
          {shiny && (
            <>
              <Sparkle x={104} y={26} r={7} fill="#fde047" />
              <Sparkle x={16} y={40} r={5} fill="#fff" />
              <Sparkle x={96} y={64} r={4} fill="#fff" />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}
